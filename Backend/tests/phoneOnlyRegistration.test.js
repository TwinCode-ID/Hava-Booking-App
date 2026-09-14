const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-only-jwt-secret-that-is-at-least-32-characters";

const User = require("../models/UserData/User");
const PendingRegistration = require("../models/OTP/PendingRegistration");
const PreAuthSession = require("../models/OTP/PreAuthSession");
const {
  approvePendingSignup,
  register,
  rejectPendingSignup,
} = require("../controllers/UserController/authController");

const STUDIO_ID = "507f1f77bcf86cd799439011";
const CANDIDATE_ID = "507f1f77bcf86cd799439012";
const PHONE_E164 = "+6281234567890";
const PASSWORD = "Correct-password-123";
// bcrypt digest shape the model insists on before storing a pre-hashed value.
const PASSWORD_DIGEST = `$2b$10$${"a".repeat(53)}`;

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

const selectResult = (value) => ({ select: async () => value });

// User.find(...).limit(2).select(...) as findUserByPhoneNumber uses it.
const findResult = (users) => {
  const query = {
    limit: () => query,
    select: async () => users,
    then: (resolve, reject) => Promise.resolve(users).then(resolve, reject),
  };
  return query;
};

const claimableAccount = (overrides = {}) => ({
  _id: "507f1f77bcf86cd799439018",
  fullName: "Front Desk Member",
  role: "client",
  password: "",
  phoneNumber: PHONE_E164,
  phoneNumberE164: PHONE_E164,
  authenticators: [],
  ...overrides,
});

const staffRequest = (body) => ({
  body,
  user: { role: "studioAdmin", adminStudioLocation: STUDIO_ID },
});

test("an account is identified by an email address, a phone number, or both", async (t) => {
  await t.test("registration with neither identifier is refused", async () => {
    const res = createResponse();
    await register({ body: { fullName: "Studio Member", password: PASSWORD } }, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /email address or a phone number/i);
  });

  await t.test("a number that cannot be normalized is refused", async () => {
    const res = createResponse();
    await register(
      {
        body: {
          fullName: "Studio Member",
          password: PASSWORD,
          phoneNumber: "12345",
        },
      },
      res,
    );

    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /valid phone number/i);
  });

  await t.test("staff create a client from a phone number alone", async () => {
    let created = null;
    const res = createResponse();

    await withStubs(
      [
        [User, "exists", async () => null],
        [
          User,
          "create",
          async (attributes) => {
            created = attributes;
            return {
              _id: "507f1f77bcf86cd799439013",
              ...attributes,
              phoneNumber: attributes.phoneNumber,
            };
          },
        ],
      ],
      () =>
        register(
          staffRequest({
            fullName: "Walk In Member",
            password: "",
            phoneNumber: PHONE_E164,
          }),
          res,
        ),
    );

    assert.equal(res.statusCode, 201);
    assert.equal(created.email, undefined);
    assert.equal(created.phoneNumber, PHONE_E164);
    assert.equal(res.body.email, "");
    assert.equal(res.body.phoneNumber, PHONE_E164);
  });

  await t.test("staff create a client from an email address alone", async () => {
    let created = null;
    const res = createResponse();

    await withStubs(
      [
        [User, "exists", async () => null],
        [
          User,
          "create",
          async (attributes) => {
            created = attributes;
            return { _id: "507f1f77bcf86cd799439014", ...attributes };
          },
        ],
      ],
      () =>
        register(
          staffRequest({
            fullName: "Mailbox Member",
            password: "",
            email: "member@example.com",
          }),
          res,
        ),
    );

    assert.equal(res.statusCode, 201);
    assert.equal(created.email, "member@example.com");
    assert.equal(created.phoneNumber, "");
  });
});

test("a phone-only registration waits for staff instead of a code", async (t) => {
  await t.test("no account exists until staff approve it", async () => {
    let parked = null;
    let createdUser = false;
    const res = createResponse();

    await withStubs(
      [
        [User, "exists", async () => null],
        [
          User,
          "create",
          async () => {
            createdUser = true;
          },
        ],
        [
          PendingRegistration,
          "findOneAndUpdate",
          async (filter, update) => {
            parked = { filter, update };
            return { _id: CANDIDATE_ID };
          },
        ],
      ],
      () =>
        register(
          {
            body: {
              fullName: "Walk In Member",
              password: PASSWORD,
              phoneNumber: PHONE_E164,
            },
          },
          res,
        ),
    );

    assert.equal(createdUser, false);
    assert.equal(res.statusCode, 202);
    assert.equal(res.body.approvalRequired, true);
    assert.equal(parked.filter.phoneNumberE164, PHONE_E164);
    assert.equal(parked.update.$set.approvalStatus, "awaitingStaff");
    // The plaintext password must never be parked alongside the candidate.
    assert.equal(parked.update.$set.password, undefined);
    assert.notEqual(parked.update.$set.passwordHash, PASSWORD);
  });

  await t.test("a number on a signed-in-able account is refused", async () => {
    let parked = false;
    const res = createResponse();

    await withStubs(
      [
        [User, "exists", async () => ({ _id: "507f1f77bcf86cd799439015" })],
        // The account already has a password, so it must be signed in to
        // rather than claimed or duplicated.
        [
          User,
          "find",
          () => findResult([claimableAccount({ password: "hashed" })]),
        ],
        [
          PendingRegistration,
          "findOneAndUpdate",
          async () => {
            parked = true;
          },
        ],
      ],
      () =>
        register(
          {
            body: {
              fullName: "Walk In Member",
              password: PASSWORD,
              phoneNumber: PHONE_E164,
            },
          },
          res,
        ),
    );

    assert.equal(parked, false);
    assert.equal(res.statusCode, 400);
  });
});

test("a number that already identifies an account links into it", async (t) => {
  await t.test(
    "a passwordless front-desk account is claimed, not duplicated",
    async () => {
      let createdUser = false;
      let parked = false;
      let grant = null;
      const res = createResponse();

      await withStubs(
        [
          [User, "exists", async () => ({ _id: "507f1f77bcf86cd799439018" })],
          [User, "find", () => findResult([claimableAccount()])],
          [
            User,
            "create",
            async () => {
              createdUser = true;
            },
          ],
          [
            PendingRegistration,
            "findOneAndUpdate",
            async () => {
              parked = true;
            },
          ],
          [
            PreAuthSession,
            "create",
            async (session) => {
              grant = session;
              return session;
            },
          ],
        ],
        () =>
          register(
            {
              body: {
                fullName: "Walk In Member",
                password: PASSWORD,
                phoneNumber: PHONE_E164,
              },
            },
            res,
          ),
      );

      assert.equal(createdUser, false);
      assert.equal(parked, false);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.claimable, true);
      assert.equal(res.body.hasPassword, false);
      assert.ok(res.body.preAuthToken);
      // The grant is bound to the existing account and its number, so the
      // password it redeems for lands on that identity and no other.
      assert.equal(grant.userId, "507f1f77bcf86cd799439018");
      assert.equal(grant.phoneNumberE164, PHONE_E164);
      assert.equal(grant.purpose, "phone_password_setup");
    },
  );

  await t.test("an account with no email can still be granted a claim", async () => {
    let grant = null;
    const res = createResponse();

    await withStubs(
      [
        [User, "exists", async () => ({ _id: "507f1f77bcf86cd799439018" })],
        // A front-desk member may have no mailbox at all; the phone grant must
        // not require one.
        [
          User,
          "find",
          () => findResult([claimableAccount({ email: undefined })]),
        ],
        [
          PreAuthSession,
          "create",
          async (session) => {
            grant = session;
            return session;
          },
        ],
      ],
      () =>
        register(
          {
            body: {
              fullName: "Walk In Member",
              password: PASSWORD,
              phoneNumber: PHONE_E164,
            },
          },
          res,
        ),
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.claimable, true);
    assert.equal(grant.email, undefined);
  });

  await t.test("staff cannot claim an account on someone's behalf", async () => {
    const res = createResponse();

    await withStubs(
      [
        [User, "exists", async () => ({ _id: "507f1f77bcf86cd799439018" })],
        [User, "find", () => findResult([claimableAccount()])],
      ],
      () =>
        register(
          staffRequest({
            fullName: "Walk In Member",
            password: "",
            phoneNumber: PHONE_E164,
          }),
          res,
        ),
    );

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.claimable, undefined);
  });
});

test("staff approval turns a parked registration into an account", async (t) => {
  await t.test("the stored digest becomes the member's password", async () => {
    let created = null;
    let claimed = null;
    const res = createResponse();

    await withStubs(
      [
        [
          PendingRegistration,
          "findOneAndDelete",
          (filter) => {
            claimed = filter;
            return selectResult({
              _id: CANDIDATE_ID,
              fullName: "Walk In Member",
              phoneNumber: PHONE_E164,
              phoneNumberE164: PHONE_E164,
              passwordHash: PASSWORD_DIGEST,
              avatar: "",
            });
          },
        ],
        [User, "exists", async () => null],
        [
          User,
          "createWithPasswordHash",
          async (attributes) => {
            created = attributes;
            return { _id: "507f1f77bcf86cd799439016", ...attributes };
          },
        ],
      ],
      () =>
        approvePendingSignup(
          { params: { id: CANDIDATE_ID }, body: {}, user: staffRequest({}).user },
          res,
        ),
    );

    assert.equal(res.statusCode, 201);
    // Only a candidate still awaiting staff may be claimed, and claiming it
    // deletes it so two cashiers cannot both activate the same person.
    assert.equal(claimed.approvalStatus, "awaitingStaff");
    assert.equal(created.password, PASSWORD_DIGEST);
    assert.equal(created.phoneNumber, PHONE_E164);
    assert.equal(created.preferredStudioId, STUDIO_ID);
    assert.equal(created.role, "client");
  });

  await t.test("a number taken since registering blocks activation", async () => {
    let created = false;
    const res = createResponse();

    await withStubs(
      [
        [
          PendingRegistration,
          "findOneAndDelete",
          () =>
            selectResult({
              _id: CANDIDATE_ID,
              fullName: "Walk In Member",
              phoneNumber: PHONE_E164,
              phoneNumberE164: PHONE_E164,
              passwordHash: PASSWORD_DIGEST,
            }),
        ],
        [User, "exists", async () => ({ _id: "507f1f77bcf86cd799439017" })],
        [
          User,
          "createWithPasswordHash",
          async () => {
            created = true;
          },
        ],
      ],
      () =>
        approvePendingSignup(
          { params: { id: CANDIDATE_ID }, body: {}, user: staffRequest({}).user },
          res,
        ),
    );

    assert.equal(created, false);
    assert.equal(res.statusCode, 409);
  });

  await t.test("an unknown candidate is not found", async () => {
    const res = createResponse();

    await withStubs(
      [[PendingRegistration, "findOneAndDelete", () => selectResult(null)]],
      () =>
        approvePendingSignup(
          { params: { id: CANDIDATE_ID }, body: {}, user: staffRequest({}).user },
          res,
        ),
    );

    assert.equal(res.statusCode, 404);
  });

  await t.test("rejection discards the candidate outright", async () => {
    let claimed = null;
    const res = createResponse();

    await withStubs(
      [
        [
          PendingRegistration,
          "findOneAndDelete",
          async (filter) => {
            claimed = filter;
            return { _id: CANDIDATE_ID };
          },
        ],
      ],
      () => rejectPendingSignup({ params: { id: CANDIDATE_ID } }, res),
    );

    assert.equal(res.statusCode, 200);
    assert.equal(claimed._id, CANDIDATE_ID);
    assert.equal(claimed.approvalStatus, "awaitingStaff");
  });
});
