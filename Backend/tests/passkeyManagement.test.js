const test = require("node:test");
const assert = require("node:assert/strict");

const PasskeyCeremony = require("../models/UserData/PasskeyCeremony");
const User = require("../models/UserData/User");
const { toAuthenticatedUser } = require("../helper/userResponse");
const {
  getSessionBinding,
  hashCeremonyValue,
} = require("../helper/passkeyCeremony");

const REGISTRATION_CEREMONY_ID = "R".repeat(43);
const AUTHENTICATION_CEREMONY_ID = "A".repeat(43);
const TEST_JWT_SECRET = "passkey-management-test-secret-at-least-32-chars";

let authenticationOptionsInput;
let authenticationVerification;
let authenticationVerificationInput;
let registrationOptionsInput;
let registrationVerification;
let registrationVerificationInput;

const webAuthnPath = require.resolve("@simplewebauthn/server");
const realWebAuthn = require(webAuthnPath);
require.cache[webAuthnPath].exports = {
  ...realWebAuthn,
  generateAuthenticationOptions: async (input) => {
    authenticationOptionsInput = input;
    return {
      challenge: "authentication-challenge",
      rpId: input.rpID,
      timeout: 60_000,
      userVerification: input.userVerification,
    };
  },
  generateRegistrationOptions: async (input) => {
    registrationOptionsInput = input;
    return {
      challenge: "registration-challenge",
      rp: { id: input.rpID, name: input.rpName },
      user: {
        id: Buffer.from(input.userID).toString("base64url"),
        name: input.userName,
        displayName: input.userDisplayName,
      },
      excludeCredentials: input.excludeCredentials,
    };
  },
  verifyAuthenticationResponse: async (input) => {
    authenticationVerificationInput = input;
    return authenticationVerification;
  },
  verifyRegistrationResponse: async (input) => {
    registrationVerificationInput = input;
    return registrationVerification;
  },
};

const {
  AUTHENTICATION_FAILED_RESPONSE,
  getExpectedUserHandle,
  listPasskeys,
  deletePasskey,
  loginFinish,
  loginStart,
  registerFinish,
  registerStart,
} = require("../controllers/UserController/passkeyController");

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

const createQuery = (value) => {
  const result = Promise.resolve(value);
  const query = {
    select() {
      return query;
    },
    lean() {
      return query;
    },
    then(resolve, reject) {
      return result.then(resolve, reject);
    },
    catch(reject) {
      return result.catch(reject);
    },
  };
  return query;
};

const withModelMethods = async (model, methods, callback) => {
  const originals = new Map();
  for (const [name, implementation] of Object.entries(methods)) {
    originals.set(name, model[name]);
    model[name] = implementation;
  }

  try {
    return await callback();
  } finally {
    for (const [name, implementation] of originals) {
      model[name] = implementation;
    }
  }
};

const recordMatchesFilter = (record, filter) => {
  if (!record || record.type !== filter.type) return false;
  if (record.expiresAt.getTime() <= filter.expiresAt.$gt.getTime()) return false;
  if (filter.userId !== undefined && record.userId !== filter.userId) {
    return false;
  }
  if (
    filter.sessionBindingHash !== undefined &&
    record.sessionBindingHash !== filter.sessionBindingHash
  ) {
    return false;
  }
  return true;
};

const withCeremonyStore = async (callback) => {
  const records = new Map();
  const seed = ({
    ceremonyId,
    challenge,
    type,
    userId,
    sessionBinding,
    expiresAt = new Date(Date.now() + 60_000),
  }) => {
    records.set(hashCeremonyValue(ceremonyId), {
      challenge,
      expiresAt,
      sessionBindingHash: sessionBinding
        ? hashCeremonyValue(sessionBinding)
        : undefined,
      type,
      userId: userId?.toString(),
    });
  };

  await withModelMethods(
    PasskeyCeremony,
    {
      create: async (record) => {
        records.set(record.ceremonyIdHash, { ...record });
        return record;
      },
      findOneAndDelete: (filter) => {
        const record = records.get(filter.ceremonyIdHash);
        const consumed = recordMatchesFilter(record, filter) ? record : null;
        if (consumed) records.delete(filter.ceremonyIdHash);
        return createQuery(consumed);
      },
    },
    () => callback({ records, seed }),
  );
};

const safePasskeyKeys = [
  "backedUp",
  "createdAt",
  "deviceType",
  "id",
  "lastUsedAt",
  "name",
  "transports",
];

test("authenticated responses strip passkey secrets and legacy challenges", () => {
  const responseUser = toAuthenticatedUser({
    _id: "owner-user",
    email: "owner@example.com",
    password: "$2b$10$stored-password-hash",
    currentChallenge: "private-registration-challenge",
    authenticators: [
      {
        credentialID: "private-credential-id",
        credentialPublicKey: Buffer.from("private-public-key-material"),
        counter: 12,
      },
    ],
  });

  assert.equal(responseUser.hasPassword, true);
  assert.equal(Object.hasOwn(responseUser, "password"), false);
  assert.equal(Object.hasOwn(responseUser, "authenticators"), false);
  assert.equal(Object.hasOwn(responseUser, "currentChallenge"), false);
});

test("passkey list is owner-scoped and exposes metadata only", async () => {
  let requestedUserId;
  const user = {
    authenticators: [
      {
        _id: { toString: () => "passkey-one" },
        name: "Work laptop",
        createdAt: new Date("2026-01-02T03:04:05.000Z"),
        lastUsedAt: new Date("2026-02-03T04:05:06.000Z"),
        deviceType: "multiDevice",
        backedUp: true,
        transports: ["internal", "hybrid"],
        credentialID: "private-credential-id",
        credentialPublicKey: Buffer.from("private-public-key-material"),
        counter: 12,
      },
    ],
  };

  await withModelMethods(
    User,
    {
      findById: (id) => {
        requestedUserId = id;
        return createQuery(user);
      },
    },
    async () => {
      const response = createResponse();
      await listPasskeys(
        {
          user: { _id: "owner-user" },
          body: { userId: "different-user" },
        },
        response,
      );

      assert.equal(requestedUserId, "owner-user");
      assert.equal(response.statusCode, 200);
      assert.equal(response.body.passkeys.length, 1);
      assert.deepEqual(
        Object.keys(response.body.passkeys[0]).sort(),
        safePasskeyKeys,
      );
      assert.equal(response.body.passkeys[0].name, "Work laptop");
      assert.equal(response.body.passkeys[0].deviceType, "multiDevice");
      assert.equal(response.body.passkeys[0].backedUp, true);
      assert.equal(
        Object.hasOwn(response.body.passkeys[0], "credentialPublicKey"),
        false,
      );
    },
  );
});

test("passkey list handles legacy entries without metadata", async () => {
  const user = {
    authenticators: [
      {
        _id: { toString: () => "legacy-passkey" },
        credentialID: "private-legacy-credential-id",
        credentialPublicKey: Buffer.from("private-legacy-public-key"),
        counter: 1,
      },
    ],
  };

  await withModelMethods(
    User,
    { findById: () => createQuery(user) },
    async () => {
      const response = createResponse();
      await listPasskeys({ user: { _id: "owner-user" } }, response);

      assert.equal(response.statusCode, 200);
      assert.deepEqual(
        Object.keys(response.body.passkeys[0]).sort(),
        safePasskeyKeys,
      );
      assert.equal(response.body.passkeys[0].id, "legacy-passkey");
      assert.equal(response.body.passkeys[0].createdAt, null);
      assert.deepEqual(response.body.passkeys[0].transports, []);
    },
  );
});

test("passkey deletion is an atomic owner-scoped pull", async () => {
  const remaining = new User({
    fullName: "Owner",
    email: "owner@example.com",
    authenticators: [
      {
        credentialID: "remaining-credential",
        credentialPublicKey: Buffer.from("remaining-public-key"),
      },
    ],
  });
  const authenticatorId = "507f1f77bcf86cd799439011";
  let capturedFilter;
  let capturedUpdate;
  let capturedOptions;

  await withModelMethods(
    User,
    {
      findOneAndUpdate: (filter, update, options) => {
        capturedFilter = filter;
        capturedUpdate = update;
        capturedOptions = options;
        return createQuery(remaining);
      },
    },
    async () => {
      const response = createResponse();
      await deletePasskey(
        {
          user: { _id: "owner-user" },
          params: { authenticatorId },
          body: { userId: "different-user" },
        },
        response,
      );

      assert.deepEqual(capturedFilter, {
        _id: "owner-user",
        "authenticators._id": authenticatorId,
      });
      assert.deepEqual(capturedUpdate, {
        $pull: { authenticators: { _id: authenticatorId } },
      });
      assert.deepEqual(capturedOptions, { new: true });
      assert.equal(response.statusCode, 200);
      assert.equal(response.body.success, true);
      assert.equal(response.body.passkeys.length, 1);
    },
  );
});

test("deleting an unowned passkey returns 404", async () => {
  await withModelMethods(
    User,
    { findOneAndUpdate: () => createQuery(null) },
    async () => {
      const response = createResponse();
      await deletePasskey(
        {
          user: { _id: "owner-user" },
          params: { authenticatorId: "507f1f77bcf86cd799439011" },
        },
        response,
      );

      assert.equal(response.statusCode, 404);
      assert.equal(response.body.code, "PASSKEY_NOT_FOUND");
    },
  );
});

test("registration start returns a session-bound ceremony wrapper", async () => {
  const user = new User({
    fullName: "Owner",
    email: "owner@example.com",
    authenticators: [
      {
        credentialID: "existing-credential",
        credentialPublicKey: Buffer.from("existing-public-key"),
        transports: ["internal"],
      },
    ],
  });

  await withCeremonyStore(async ({ records }) => {
    await withModelMethods(
      User,
      { findById: () => createQuery(user) },
      async () => {
        const response = createResponse();
        await registerStart(
          {
            user: { _id: "owner-user" },
            auth: { jti: "session-one" },
            body: { userId: "different-user" },
          },
          response,
        );

        assert.equal(response.statusCode, 200);
        assert.match(response.body.ceremonyId, /^[A-Za-z0-9_-]{43}$/);
        assert.equal(response.body.options.challenge, "registration-challenge");
        assert.equal(registrationOptionsInput.rpID, "bookingservice.my.id");
        assert.equal(
          registrationOptionsInput.authenticatorSelection.userVerification,
          "required",
        );
        assert.equal(registrationOptionsInput.excludeCredentials.length, 1);

        const record = records.get(
          hashCeremonyValue(response.body.ceremonyId),
        );
        assert.equal(record.type, "registration");
        assert.equal(record.userId, "owner-user");
        assert.equal(
          record.sessionBindingHash,
          hashCeremonyValue("owner-user:session-one"),
        );
      },
    );
  });
});

test("registration ceremony rejects another JWT session without consuming", async () => {
  let userLookupCount = 0;
  await withCeremonyStore(async ({ records, seed }) => {
    seed({
      ceremonyId: REGISTRATION_CEREMONY_ID,
      challenge: "registration-challenge",
      type: "registration",
      userId: "owner-user",
      sessionBinding: getSessionBinding("owner-user", "session-one"),
    });

    await withModelMethods(
      User,
      {
        findById: () => {
          userLookupCount += 1;
          return createQuery(null);
        },
      },
      async () => {
        const response = createResponse();
        await registerFinish(
          {
            user: { _id: "owner-user" },
            auth: { jti: "session-two" },
            body: {
              ceremonyId: REGISTRATION_CEREMONY_ID,
              registrationResponse: {},
            },
          },
          response,
        );

        assert.equal(response.statusCode, 400);
        assert.equal(response.body.code, "PASSKEY_CEREMONY_INVALID");
        assert.equal(userLookupCount, 0);
        assert.equal(records.size, 1);
      },
    );
  });
});

test("registration finish consumes once and stores safe metadata", async () => {
  const user = new User({
    fullName: "Owner",
    email: "owner@example.com",
    authenticators: [],
  });
  let saveCount = 0;
  user.save = async () => {
    saveCount += 1;
  };
  registrationVerification = {
    verified: true,
    registrationInfo: {
      credential: {
        id: "new-credential",
        publicKey: Uint8Array.from([1, 2, 3, 4]),
        counter: 3,
        transports: ["internal", "hybrid"],
      },
      credentialDeviceType: "multiDevice",
      credentialBackedUp: true,
    },
  };

  await withCeremonyStore(async ({ records, seed }) => {
    seed({
      ceremonyId: REGISTRATION_CEREMONY_ID,
      challenge: "registration-challenge",
      type: "registration",
      userId: "owner-user",
      sessionBinding: getSessionBinding("owner-user", "session-one"),
    });

    await withModelMethods(
      User,
      {
        exists: async () => false,
        findById: () => createQuery(user),
      },
      async () => {
        const request = {
          user: { _id: "owner-user" },
          auth: { jti: "session-one" },
          body: {
            ceremonyId: REGISTRATION_CEREMONY_ID,
            name: "Work laptop",
            registrationResponse: { id: "new-credential", response: {} },
          },
        };
        const response = createResponse();
        await registerFinish(request, response);

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.success, true);
        assert.equal(saveCount, 1);
        assert.equal(records.size, 0);
        assert.equal(
          registrationVerificationInput.expectedChallenge,
          "registration-challenge",
        );
        assert.deepEqual(registrationVerificationInput.expectedOrigin, [
          "https://bookingservice.my.id",
          "https://www.bookingservice.my.id",
        ]);
        assert.equal(
          registrationVerificationInput.expectedRPID,
          "bookingservice.my.id",
        );
        assert.equal(user.authenticators[0].credentialID, "new-credential");
        assert.equal(user.authenticators[0].name, "Work laptop");
        assert.equal(user.authenticators[0].deviceType, "multiDevice");
        assert.equal(user.authenticators[0].backedUp, true);
        assert.deepEqual(user.authenticators[0].transports, [
          "internal",
          "hybrid",
        ]);
        assert.deepEqual(
          Object.keys(response.body.passkey).sort(),
          safePasskeyKeys,
        );

        const replayResponse = createResponse();
        await registerFinish(request, replayResponse);
        assert.equal(replayResponse.statusCode, 400);
        assert.equal(replayResponse.body.code, "PASSKEY_CEREMONY_INVALID");
        assert.equal(saveCount, 1);
      },
    );
  });
});

test("login start is identifier-less and uniform", async () => {
  let userLookupCount = 0;
  await withCeremonyStore(async ({ records }) => {
    await withModelMethods(
      User,
      {
        findOne: () => {
          userLookupCount += 1;
          throw new Error("login start must not query users");
        },
      },
      async () => {
        const responses = [];
        for (const body of [
          {},
          { email: "known@example.com" },
          { email: "not-an-email" },
        ]) {
          const response = createResponse();
          await loginStart({ body }, response);
          responses.push(response);
        }

        assert.equal(userLookupCount, 0);
        assert.equal(records.size, 3);
        for (const response of responses) {
          assert.equal(response.statusCode, 200);
          assert.deepEqual(Object.keys(response.body).sort(), [
            "ceremonyId",
            "options",
          ]);
          assert.match(response.body.ceremonyId, /^[A-Za-z0-9_-]{43}$/);
          assert.equal(
            Object.hasOwn(response.body.options, "allowCredentials"),
            false,
          );
          assert.equal(response.body.options.userVerification, "required");
        }
        assert.deepEqual(authenticationOptionsInput, {
          rpID: "bookingservice.my.id",
          userVerification: "required",
        });
      },
    );
  });
});

test("identifier-less login consumes once and updates metadata", async () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  const before = Date.now();
  let saveCount = 0;
  let markedPath;
  let capturedFindFilter;
  const authenticator = {
    credentialID: "credential-one",
    credentialPublicKey: Buffer.from("public-key-one"),
    counter: 2,
    transports: ["internal"],
    lastUsedAt: null,
  };
  const user = {
    _id: "owner-user",
    authenticators: [authenticator],
    markModified(path) {
      markedPath = path;
    },
    async save() {
      saveCount += 1;
    },
  };
  authenticationVerification = {
    verified: true,
    authenticationInfo: {
      newCounter: 7,
      credentialDeviceType: "multiDevice",
      credentialBackedUp: true,
    },
  };

  try {
    await withCeremonyStore(async ({ seed }) => {
      seed({
        ceremonyId: AUTHENTICATION_CEREMONY_ID,
        challenge: "authentication-challenge",
        type: "authentication",
      });

      await withModelMethods(
        User,
        {
          findOne: (filter) => {
            capturedFindFilter = filter;
            return createQuery(user);
          },
        },
        async () => {
          const request = {
            body: {
              ceremonyId: AUTHENTICATION_CEREMONY_ID,
              email: "ignored@example.com",
              response: {
                id: "credential-one",
                response: { userHandle: getExpectedUserHandle(user._id) },
              },
            },
          };
          const response = createResponse();
          await loginFinish(request, response);

          assert.deepEqual(capturedFindFilter, {
            "authenticators.credentialID": "credential-one",
          });
          assert.equal(response.statusCode, 200);
          assert.equal(response.body.verified, true);
          assert.equal(typeof response.body.token, "string");
          assert.equal(saveCount, 1);
          assert.equal(markedPath, "authenticators");
          assert.equal(authenticator.counter, 7);
          assert.equal(authenticator.deviceType, "multiDevice");
          assert.equal(authenticator.backedUp, true);
          assert.ok(authenticator.lastUsedAt.getTime() >= before);
          assert.equal(
            authenticationVerificationInput.expectedChallenge,
            "authentication-challenge",
          );
          assert.deepEqual(authenticationVerificationInput.expectedOrigin, [
            "https://bookingservice.my.id",
            "https://www.bookingservice.my.id",
          ]);

          const replayResponse = createResponse();
          await loginFinish(request, replayResponse);
          assert.equal(replayResponse.statusCode, 400);
          assert.deepEqual(replayResponse.body, AUTHENTICATION_FAILED_RESPONSE);
          assert.equal(saveCount, 1);
        },
      );
    });
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});

test("unknown credential receives the uniform authentication failure", async () => {
  await withCeremonyStore(async ({ seed }) => {
    seed({
      ceremonyId: AUTHENTICATION_CEREMONY_ID,
      challenge: "authentication-challenge",
      type: "authentication",
    });

    await withModelMethods(
      User,
      { findOne: () => createQuery(null) },
      async () => {
        const response = createResponse();
        await loginFinish(
          {
            body: {
              ceremonyId: AUTHENTICATION_CEREMONY_ID,
              response: {
                id: "unknown-credential",
                response: { userHandle: "dW5rbm93bg" },
              },
            },
          },
          response,
        );

        assert.equal(response.statusCode, 400);
        assert.deepEqual(response.body, AUTHENTICATION_FAILED_RESPONSE);
      },
    );
  });
});

test("passkey routes enforce recent authentication where required", () => {
  const router = require("../routes/UserRoutes/userRoutes");
  const routeLayers = router.stack.filter((layer) => layer.route);
  const findRoute = (path, method) =>
    routeLayers.find(
      (layer) => layer.route.path === path && layer.route.methods[method],
    );
  const handlerNames = (route) =>
    route.route.stack.map((layer) => layer.handle.name);

  const listRoute = findRoute("/passkey", "get");
  const deleteRoute = findRoute("/passkey/:authenticatorId", "delete");
  const registerStartRoute = findRoute("/passkey/register-start", "post");
  const registerFinishRoute = findRoute("/passkey/register-finish", "post");
  const genericGetRoute = findRoute("/:id", "get");

  assert.ok(listRoute);
  assert.ok(deleteRoute);
  assert.ok(registerStartRoute);
  assert.ok(registerFinishRoute);
  assert.ok(routeLayers.indexOf(listRoute) < routeLayers.indexOf(genericGetRoute));
  assert.equal(handlerNames(listRoute)[0], "protect");
  assert.deepEqual(handlerNames(deleteRoute).slice(0, 2), [
    "protect",
    "requireRecentAuth",
  ]);
  assert.deepEqual(handlerNames(registerStartRoute).slice(0, 2), [
    "protect",
    "requireRecentAuth",
  ]);
  assert.equal(handlerNames(registerFinishRoute)[0], "protect");
  assert.equal(
    handlerNames(registerFinishRoute).includes("requireRecentAuth"),
    false,
  );
});
