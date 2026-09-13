const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-only-jwt-secret-that-is-at-least-32-characters";

const User = require("../models/UserData/User");
const PreAuthSession = require("../models/OTP/PreAuthSession");
const {
  checkUserStatus,
  loginWithPhone,
  setPhonePassword,
} = require("../controllers/UserController/authController");
const {
  PREAUTH_PURPOSES,
  findActivePreAuthSession,
  hashPreAuthToken,
} = require("../helper/preAuthSession");
const { normalizePhoneNumber } = require("../helper/phoneNumber");
const { accountOrIpKey } = require("../middlewares/rateLimitMiddleware");
const { verifyAuthToken } = require("../helper/authToken");

const USER_ID = "507f1f77bcf86cd799439011";
const EMAIL = "member@example.com";
const PHONE_E164 = "+6281234567890";
const FLOW_TOKEN = "A".repeat(43);
// bcrypt digest of "Correct-password-123"
const PASSWORD = "Correct-password-123";

const createResponse = () => ({
  statusCode: 200,
  body: undefined,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

const queryResult = (value) => ({
  select: async () => value,
});

// User.find(...).limit(2).select(...) as the controller uses it.
const findResult = (users) => {
  const query = {
    limit: () => query,
    select: async () => users,
    then: (resolve, reject) => Promise.resolve(users).then(resolve, reject),
  };
  return query;
};

const createUser = (overrides = {}) => ({
  _id: USER_ID,
  fullName: "Studio Member",
  email: EMAIL,
  role: "client",
  avatar: "",
  authVersion: 3,
  phoneNumber: "0812-3456-7890",
  phoneNumberE164: PHONE_E164,
  password: "",
  authenticators: [],
  matchPassword: async (candidate) => candidate === PASSWORD,
  save: async () => {},
  ...overrides,
});

const withStubs = async (stubs, run) => {
  const originals = stubs.map(([owner, key]) => [owner, key, owner[key]]);
  stubs.forEach(([owner, key, value]) => {
    owner[key] = value;
  });
  try {
    return await run();
  } finally {
    originals.forEach(([owner, key, value]) => {
      owner[key] = value;
    });
  }
};

const withSmsEnabled = async (run) => {
  const previousFlag = process.env.SMS_OTP_ENABLED;
  const previousProvider = process.env.SMS_PROVIDER;
  process.env.SMS_OTP_ENABLED = "true";
  process.env.SMS_PROVIDER = "test-gateway";
  try {
    return await run();
  } finally {
    if (previousFlag === undefined) delete process.env.SMS_OTP_ENABLED;
    else process.env.SMS_OTP_ENABLED = previousFlag;
    if (previousProvider === undefined) delete process.env.SMS_PROVIDER;
    else process.env.SMS_PROVIDER = previousProvider;
  }
};

test("phone numbers resolve to one canonical identity", async (t) => {
  await t.test("every stored notation of a number normalizes alike", () => {
    for (const stored of [
      "+6281234567890",
      "+62 812-3456-7890",
      "0812 3456 7890",
      "(0812) 3456-7890",
      "006281234567890",
      "6281234567890",
      "81234567890",
    ]) {
      assert.equal(normalizePhoneNumber(stored), PHONE_E164, stored);
    }
  });

  await t.test("numbers that cannot identify an account are rejected", () => {
    for (const invalid of [
      "",
      "   ",
      "12345",
      "+0812345678",
      "+62812345678901234",
      "0812-not-a-number",
      "<script>0812345678</script>",
      null,
      undefined,
      12345678,
      { phoneNumber: "+6281234567890" },
    ]) {
      assert.equal(normalizePhoneNumber(invalid), null, String(invalid));
    }
  });

  await t.test("the assumed country is configurable and can be refused", () => {
    const previous = process.env.PHONE_DEFAULT_COUNTRY_CODE;
    try {
      process.env.PHONE_DEFAULT_COUNTRY_CODE = "+64";
      assert.equal(normalizePhoneNumber("021 000 000"), "+6421000000");
      assert.equal(normalizePhoneNumber("+6281234567890"), PHONE_E164);

      process.env.PHONE_DEFAULT_COUNTRY_CODE = "";
      assert.equal(normalizePhoneNumber("081234567890"), null);
      assert.equal(normalizePhoneNumber("+6281234567890"), PHONE_E164);
    } finally {
      if (previous === undefined) delete process.env.PHONE_DEFAULT_COUNTRY_CODE;
      else process.env.PHONE_DEFAULT_COUNTRY_CODE = previous;
    }
  });

  await t.test("the profile number is the sign-in number", async () => {
    const user = new User({
      fullName: "Studio Member",
      email: EMAIL,
      phoneNumber: "0812 3456 7890",
    });
    await User.schema.s.hooks.execPre("save", user, []);
    assert.equal(user.phoneNumberE164, PHONE_E164);

    user.$isNew = false;
    user.$clearModifiedPaths();
    user.phoneNumber = "not a phone number";
    await User.schema.s.hooks.execPre("save", user, []);
    assert.equal(user.phoneNumberE164, undefined);

    // Serialized profiles keep exposing only the number the member entered.
    const serialized = new User({
      fullName: "Studio Member",
      email: EMAIL,
      phoneNumber: "0812 3456 7890",
      phoneNumberE164: PHONE_E164,
    }).toJSON();
    assert.equal(serialized.phoneNumber, "0812 3456 7890");
    assert.equal(Object.hasOwn(serialized, "phoneNumberE164"), false);
  });

  await t.test("profile updates that skip the document stay in sync", async () => {
    const query = User.findOneAndUpdate(
      { _id: USER_ID },
      { $set: { phoneNumber: "0812 3456 7890" } },
    );
    await User.schema.s.hooks.execPre("findOneAndUpdate", query, []);
    assert.equal(query.getUpdate().$set.phoneNumberE164, PHONE_E164);

    const clearing = User.findOneAndUpdate(
      { _id: USER_ID },
      { $set: { phoneNumber: "" } },
    );
    await User.schema.s.hooks.execPre("findOneAndUpdate", clearing, []);
    assert.equal(clearing.getUpdate().$unset.phoneNumberE164, "");
    assert.equal(
      Object.hasOwn(clearing.getUpdate().$set, "phoneNumberE164"),
      false,
    );
  });

  await t.test("per-account rate limits follow the phone number", () => {
    assert.equal(
      accountOrIpKey({ body: { phoneNumber: "0812 3456 7890" } }),
      `phone:${PHONE_E164}`,
    );
    assert.equal(
      accountOrIpKey({ body: { email: EMAIL, phoneNumber: "0812 3456 7890" } }),
      `email:${EMAIL}`,
    );
  });
});

test("phone account status only offers what the account still needs", async (t) => {
  await t.test("an unknown number answers like a password account", async () => {
    await withStubs(
      [
        [User, "find", () => findResult([])],
        [
          PreAuthSession,
          "create",
          async () => {
            throw new Error("Unknown numbers must not receive a grant");
          },
        ],
      ],
      async () => {
        const response = createResponse();
        await checkUserStatus({ body: { phoneNumber: PHONE_E164 } }, response);

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.hasPassword, true);
        assert.equal(Object.hasOwn(response.body, "preAuthToken"), false);
      },
    );
  });

  await t.test("a number on two accounts identifies neither", async () => {
    await withStubs(
      [
        [
          User,
          "find",
          () =>
            findResult([
              createUser(),
              createUser({ _id: "507f1f77bcf86cd799439012" }),
            ]),
        ],
        [
          PreAuthSession,
          "create",
          async () => {
            throw new Error("A shared number must not receive a grant");
          },
        ],
      ],
      async () => {
        const response = createResponse();
        await checkUserStatus({ body: { phoneNumber: PHONE_E164 } }, response);

        assert.equal(response.body.hasPassword, true);
        assert.equal(Object.hasOwn(response.body, "preAuthToken"), false);
      },
    );
  });

  await t.test("an account with a password is asked for it", async () => {
    await withStubs(
      [
        [
          User,
          "find",
          () => findResult([createUser({ password: "stored-hash" })]),
        ],
        [
          PreAuthSession,
          "create",
          async () => {
            throw new Error("A password account must not receive a grant");
          },
        ],
      ],
      async () => {
        const response = createResponse();
        await checkUserStatus({ body: { phoneNumber: PHONE_E164 } }, response);

        assert.equal(response.body.hasPassword, true);
        assert.equal(response.body.otpRequired, false);
      },
    );
  });

  await t.test("a never-activated client is offered a password", async () => {
    let createdSession;
    await withStubs(
      [
        [User, "find", () => findResult([createUser()])],
        [
          PreAuthSession,
          "create",
          async (record) => {
            createdSession = record;
            return record;
          },
        ],
      ],
      async () => {
        const response = createResponse();
        await checkUserStatus(
          { body: { phoneNumber: "0812 3456 7890" } },
          response,
        );

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.hasPassword, false);
        assert.equal(response.body.otpRequired, false);
        assert.equal(
          response.body.purpose,
          PREAUTH_PURPOSES.PHONE_PASSWORD_SETUP,
        );
        assert.match(response.body.preAuthToken, /^[A-Za-z0-9_-]{43}$/);
        assert.equal(
          createdSession.tokenHash,
          hashPreAuthToken(response.body.preAuthToken),
        );
        assert.equal(createdSession.phoneNumberE164, PHONE_E164);
        assert.equal(createdSession.userId, USER_ID);
        assert.equal(createdSession.email, EMAIL);
      },
    );
  });

  await t.test(
    "accounts reachable another way cannot be claimed by number",
    async () => {
      for (const alreadyReachable of [
        { googleUserId: "google-subject" },
        { appleUserId: "apple-subject" },
        { authenticators: [{ credentialID: "passkey" }] },
        { role: "studioAdmin" },
      ]) {
        await withStubs(
          [
            [User, "find", () => findResult([createUser(alreadyReachable)])],
            [
              PreAuthSession,
              "create",
              async () => {
                throw new Error("A reachable account must not be claimable");
              },
            ],
          ],
          async () => {
            const response = createResponse();
            await checkUserStatus(
              { body: { phoneNumber: PHONE_E164 } },
              response,
            );

            assert.equal(
              response.body.hasPassword,
              true,
              JSON.stringify(alreadyReachable),
            );
            assert.equal(Object.hasOwn(response.body, "preAuthToken"), false);
          },
        );
      }
    },
  );

  await t.test("an unusable number is refused outright", async () => {
    const response = createResponse();
    await checkUserStatus({ body: { phoneNumber: "0812" } }, response);
    assert.equal(response.statusCode, 400);
  });
});

test("phone sign-in authenticates the account holding the number", async (t) => {
  await t.test("the right password opens a session", async () => {
    await withStubs(
      [
        [
          User,
          "find",
          () => findResult([createUser({ password: "stored-hash" })]),
        ],
      ],
      async () => {
        const response = createResponse();
        await loginWithPhone(
          { body: { phoneNumber: "0812 3456 7890", password: PASSWORD } },
          response,
        );

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.otpRequired, false);
        const decoded = verifyAuthToken(response.body.token);
        assert.equal(decoded.id, USER_ID);
        assert.equal(decoded.ver, 3);
        assert.deepEqual(decoded.amr, ["phone_password"]);
      },
    );
  });

  await t.test("a wrong password and an unknown number look alike", async () => {
    const attempts = [];
    await withStubs(
      [
        [
          User,
          "find",
          () => findResult([createUser({ password: "stored-hash" })]),
        ],
      ],
      async () => {
        const response = createResponse();
        await loginWithPhone(
          { body: { phoneNumber: PHONE_E164, password: "wrong-password" } },
          response,
        );
        attempts.push(response);
      },
    );

    await withStubs([[User, "find", () => findResult([])]], async () => {
      const response = createResponse();
      await loginWithPhone(
        { body: { phoneNumber: PHONE_E164, password: PASSWORD } },
        response,
      );
      attempts.push(response);
    });

    attempts.forEach((response) => {
      assert.equal(response.statusCode, 401);
      assert.equal(response.body.message, "Invalid phone number or password.");
      assert.equal(Object.hasOwn(response.body, "token"), false);
    });
  });

  await t.test("a number on two accounts signs in to neither", async () => {
    await withStubs(
      [
        [
          User,
          "find",
          () =>
            findResult([
              createUser({ password: "stored-hash" }),
              createUser({
                _id: "507f1f77bcf86cd799439012",
                password: "stored-hash",
              }),
            ]),
        ],
      ],
      async () => {
        const response = createResponse();
        await loginWithPhone(
          { body: { phoneNumber: PHONE_E164, password: PASSWORD } },
          response,
        );

        assert.equal(response.statusCode, 401);
        assert.equal(Object.hasOwn(response.body, "token"), false);
      },
    );
  });

  await t.test("an account without a password is sent to create one", async () => {
    await withStubs([[User, "find", () => findResult([createUser()])]], async () => {
      const response = createResponse();
      await loginWithPhone(
        { body: { phoneNumber: PHONE_E164, password: PASSWORD } },
        response,
      );

      assert.equal(response.statusCode, 409);
      assert.equal(response.body.code, "PASSWORD_NOT_SET");
      assert.equal(Object.hasOwn(response.body, "token"), false);
    });
  });

  await t.test(
    "enabling SMS makes the code a second factor instead of a session",
    async () => {
      let createdSession;
      await withSmsEnabled(() =>
        withStubs(
          [
            [
              User,
              "find",
              () => findResult([createUser({ password: "stored-hash" })]),
            ],
            [
              PreAuthSession,
              "create",
              async (record) => {
                createdSession = record;
                return record;
              },
            ],
          ],
          async () => {
            const response = createResponse();
            await loginWithPhone(
              { body: { phoneNumber: PHONE_E164, password: PASSWORD } },
              response,
            );

            assert.equal(response.statusCode, 200);
            assert.equal(response.body.otpRequired, true);
            assert.equal(Object.hasOwn(response.body, "token"), false);
            assert.equal(
              response.body.purpose,
              PREAUTH_PURPOSES.PHONE_PASSWORD_LOGIN,
            );
            assert.equal(createdSession.phoneNumberE164, PHONE_E164);
          },
        ),
      );
    },
  );
});

test("creating a first password consumes a bound phone grant", async (t) => {
  const activeSession = {
    _id: "507f1f77bcf86cd799439055",
    userId: USER_ID,
    email: EMAIL,
    phoneNumberE164: PHONE_E164,
    purpose: PREAUTH_PURPOSES.PHONE_PASSWORD_SETUP,
  };

  await t.test("a valid grant sets the password and signs in", async () => {
    let savedPassword;
    let deleteFilter;
    const user = createUser({
      save: async function save() {
        savedPassword = this.password;
        this.authVersion += 1;
      },
    });

    await withStubs(
      [
        [PreAuthSession, "findOne", () => queryResult(activeSession)],
        [
          PreAuthSession,
          "findOneAndDelete",
          async (filter) => {
            deleteFilter = filter;
            return activeSession;
          },
        ],
        [User, "findById", () => queryResult(user)],
      ],
      async () => {
        const response = createResponse();
        await setPhonePassword(
          {
            body: {
              phoneNumber: "0812 3456 7890",
              preAuthToken: FLOW_TOKEN,
              purpose: PREAUTH_PURPOSES.PHONE_PASSWORD_SETUP,
              password: "First-secure-password-123",
            },
          },
          response,
        );

        assert.equal(response.statusCode, 201);
        assert.equal(savedPassword, "First-secure-password-123");
        // The grant is redeemed exactly once, bound to number and account.
        assert.equal(deleteFilter.phoneNumberE164, PHONE_E164);
        assert.equal(deleteFilter.userId, USER_ID);
        assert.equal(deleteFilter.tokenHash, hashPreAuthToken(FLOW_TOKEN));
        const decoded = verifyAuthToken(response.body.token);
        assert.equal(decoded.id, USER_ID);
        assert.equal(decoded.ver, 4);
        assert.deepEqual(decoded.amr, ["phone_password_setup"]);
      },
    );
  });

  await t.test("a grant cannot be redeemed for another number", async () => {
    await withStubs(
      [
        [
          PreAuthSession,
          "findOne",
          (filter) =>
            queryResult(
              filter.phoneNumberE164 === PHONE_E164 ? activeSession : null,
            ),
        ],
        [
          PreAuthSession,
          "findOneAndDelete",
          async () => {
            throw new Error("An unbound grant must not be consumed");
          },
        ],
        [User, "findById", () => queryResult(createUser())],
      ],
      async () => {
        const response = createResponse();
        await setPhonePassword(
          {
            body: {
              phoneNumber: "+6289999999999",
              preAuthToken: FLOW_TOKEN,
              purpose: PREAUTH_PURPOSES.PHONE_PASSWORD_SETUP,
              password: "First-secure-password-123",
            },
          },
          response,
        );

        assert.equal(response.statusCode, 401);
        assert.equal(response.body.code, "INVALID_PHONE_SETUP_FLOW");
      },
    );
  });

  await t.test(
    "an account that gained a credential is no longer claimable",
    async () => {
      for (const changedSince of [
        { password: "stored-hash" },
        { googleUserId: "google-subject" },
        { authenticators: [{ credentialID: "passkey" }] },
        { phoneNumberE164: "+6289999999999" },
      ]) {
        await withStubs(
          [
            [PreAuthSession, "findOne", () => queryResult(activeSession)],
            [
              PreAuthSession,
              "findOneAndDelete",
              async () => {
                throw new Error("An ineligible account must not be claimed");
              },
            ],
            [User, "findById", () => queryResult(createUser(changedSince))],
          ],
          async () => {
            const response = createResponse();
            await setPhonePassword(
              {
                body: {
                  phoneNumber: PHONE_E164,
                  preAuthToken: FLOW_TOKEN,
                  purpose: PREAUTH_PURPOSES.PHONE_PASSWORD_SETUP,
                  password: "First-secure-password-123",
                },
              },
              response,
            );

            assert.equal(
              response.statusCode,
              401,
              JSON.stringify(changedSince),
            );
            assert.equal(response.body.code, "INVALID_PHONE_SETUP_FLOW");
          },
        );
      }
    },
  );

  await t.test("a weak password is refused before anything is spent", async () => {
    await withStubs(
      [
        [
          PreAuthSession,
          "findOne",
          () => {
            throw new Error("Password policy must be checked first");
          },
        ],
      ],
      async () => {
        const response = createResponse();
        await setPhonePassword(
          {
            body: {
              phoneNumber: PHONE_E164,
              preAuthToken: FLOW_TOKEN,
              purpose: PREAUTH_PURPOSES.PHONE_PASSWORD_SETUP,
              password: "short",
            },
          },
          response,
        );

        assert.equal(response.statusCode, 400);
      },
    );
  });

  await t.test("enabling SMS retires the unverified setup path", async () => {
    await withSmsEnabled(() =>
      withStubs(
        [
          [
            PreAuthSession,
            "findOne",
            () => {
              throw new Error("No grant may be redeemed without verification");
            },
          ],
        ],
        async () => {
          const response = createResponse();
          await setPhonePassword(
            {
              body: {
                phoneNumber: PHONE_E164,
                preAuthToken: FLOW_TOKEN,
                purpose: PREAUTH_PURPOSES.PHONE_PASSWORD_SETUP,
                password: "First-secure-password-123",
              },
            },
            response,
          );

          assert.equal(response.statusCode, 409);
          assert.equal(response.body.code, "OTP_VERIFICATION_REQUIRED");
        },
      ),
    );
  });
});

test("phone and mailbox flows cannot be redeemed through each other", async (t) => {
  await t.test("a phone grant is not addressable by email", async () => {
    let lookupFilter;
    await withStubs(
      [
        [
          PreAuthSession,
          "findOne",
          (filter) => {
            lookupFilter = filter;
            return queryResult(null);
          },
        ],
      ],
      async () => {
        const byEmail = await findActivePreAuthSession({
          token: FLOW_TOKEN,
          email: EMAIL,
          purpose: PREAUTH_PURPOSES.PHONE_PASSWORD_SETUP,
        });
        assert.equal(byEmail, null);
        assert.equal(lookupFilter, undefined);

        await findActivePreAuthSession({
          token: FLOW_TOKEN,
          email: EMAIL,
          phoneNumberE164: PHONE_E164,
          purpose: PREAUTH_PURPOSES.PHONE_PASSWORD_SETUP,
        });
        assert.equal(lookupFilter.phoneNumberE164, PHONE_E164);
        assert.equal(Object.hasOwn(lookupFilter, "email"), false);
      },
    );
  });

  await t.test("a mailbox grant is not addressable by number", async () => {
    let lookupFilter;
    await withStubs(
      [
        [
          PreAuthSession,
          "findOne",
          (filter) => {
            lookupFilter = filter;
            return queryResult(null);
          },
        ],
      ],
      async () => {
        await findActivePreAuthSession({
          token: FLOW_TOKEN,
          email: EMAIL,
          phoneNumberE164: PHONE_E164,
          purpose: PREAUTH_PURPOSES.PASSWORD_LOGIN,
        });

        assert.equal(lookupFilter.email, EMAIL);
        assert.equal(Object.hasOwn(lookupFilter, "phoneNumberE164"), false);
      },
    );
  });

  await t.test("the stored session enforces the same split", async () => {
    const phoneSession = new PreAuthSession({
      tokenHash: "a".repeat(64),
      userId: USER_ID,
      email: EMAIL,
      purpose: PREAUTH_PURPOSES.PHONE_PASSWORD_LOGIN,
      expiresAt: new Date(Date.now() + 60000),
    });
    await PreAuthSession.schema.s.hooks.execPre("validate", phoneSession, []);
    assert.match(
      phoneSession.$__.validationError.errors.phoneNumberE164.message,
      /phone flows/,
    );

    const mailboxSession = new PreAuthSession({
      tokenHash: "b".repeat(64),
      userId: USER_ID,
      email: EMAIL,
      phoneNumberE164: PHONE_E164,
      purpose: PREAUTH_PURPOSES.PASSWORD_LOGIN,
      expiresAt: new Date(Date.now() + 60000),
    });
    await PreAuthSession.schema.s.hooks.execPre("validate", mailboxSession, []);
    assert.match(
      mailboxSession.$__.validationError.errors.phoneNumberE164.message,
      /phone flows/,
    );
  });
});
