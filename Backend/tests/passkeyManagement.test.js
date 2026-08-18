const test = require("node:test");
const assert = require("node:assert/strict");

const User = require("../models/UserData/User");
const { toAuthenticatedUser } = require("../helper/userResponse");

let authenticationVerification = {
  verified: true,
  authenticationInfo: { newCounter: 7 },
};
let registrationVerification;

// The controller captures these functions when it is required. Replace only the
// authentication verifier so login-finish can be exercised without hardware.
const webAuthnPath = require.resolve("@simplewebauthn/server");
const realWebAuthn = require(webAuthnPath);
require.cache[webAuthnPath].exports = {
  ...realWebAuthn,
  verifyRegistrationResponse: async () => registrationVerification,
  verifyAuthenticationResponse: async () => authenticationVerification,
};

const {
  listPasskeys,
  deletePasskey,
  registerStart,
  registerFinish,
  loginFinish,
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

const withFindById = async (implementation, callback) => {
  const originalFindById = User.findById;
  User.findById = implementation;
  try {
    return await callback();
  } finally {
    User.findById = originalFindById;
  }
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

test("authenticated user responses strip passkey secrets and challenges", () => {
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

test("passkey list is owner-scoped and returns only approved metadata", async () => {
  const createdAt = new Date("2026-01-02T03:04:05.000Z");
  const lastUsedAt = new Date("2026-02-03T04:05:06.000Z");
  let requestedUserId;

  const user = {
    authenticators: [
      {
        _id: { toString: () => "passkey-one" },
        name: "Work laptop",
        createdAt,
        lastUsedAt,
        deviceType: "multiDevice",
        backedUp: true,
        transports: ["internal", "hybrid"],
        credentialID: "private-credential-id",
        credentialPublicKey: Buffer.from("private-public-key-material"),
        counter: 12,
      },
    ],
  };

  await withFindById(
    (id) => {
      requestedUserId = id;
      return createQuery(user);
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

      const passkey = response.body.passkeys[0];
      assert.deepEqual(Object.keys(passkey).sort(), safePasskeyKeys);
      assert.equal(passkey.id, "passkey-one");
      assert.equal(passkey.name, "Work laptop");
      assert.equal(
        new Date(passkey.createdAt).toISOString(),
        createdAt.toISOString(),
      );
      assert.equal(
        new Date(passkey.lastUsedAt).toISOString(),
        lastUsedAt.toISOString(),
      );
      assert.equal(passkey.deviceType, "multiDevice");
      assert.equal(passkey.backedUp, true);
      assert.deepEqual(passkey.transports, ["internal", "hybrid"]);
      assert.equal(Object.hasOwn(passkey, "credentialID"), false);
      assert.equal(Object.hasOwn(passkey, "credentialPublicKey"), false);
      assert.equal(Object.hasOwn(passkey, "counter"), false);
    },
  );
});

test("passkey list safely handles legacy entries without metadata", async () => {
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

  await withFindById(
    () => createQuery(user),
    async () => {
      const response = createResponse();
      await listPasskeys({ user: { _id: "owner-user" } }, response);

      assert.equal(response.statusCode, 200);
      assert.equal(response.body.passkeys.length, 1);
      const passkey = response.body.passkeys[0];
      assert.deepEqual(Object.keys(passkey).sort(), safePasskeyKeys);
      assert.equal(passkey.id, "legacy-passkey");
      assert.ok(passkey.name === "Passkey" || passkey.name === null);
      assert.equal(passkey.createdAt, null);
      assert.equal(passkey.lastUsedAt, null);
      assert.ok(
        passkey.deviceType === "unknown" || passkey.deviceType === null,
      );
      assert.ok(passkey.backedUp === false || passkey.backedUp === null);
      assert.deepEqual(passkey.transports, []);
    },
  );
});

test("passkey deletion only removes a passkey owned by the authenticated user", async () => {
  const owner = new User({
    fullName: "Owner",
    email: "owner@example.com",
    authenticators: [
      {
        credentialID: "credential-one",
        credentialPublicKey: Buffer.from("public-key-one"),
      },
      {
        credentialID: "credential-two",
        credentialPublicKey: Buffer.from("public-key-two"),
      },
    ],
  });
  const targetId = owner.authenticators[0]._id.toString();
  const remainingId = owner.authenticators[1]._id.toString();
  let requestedUserId;
  let saveCount = 0;
  owner.save = async () => {
    saveCount += 1;
  };

  await withFindById(
    (id) => {
      requestedUserId = id;
      return createQuery(owner);
    },
    async () => {
      const response = createResponse();
      await deletePasskey(
        {
          user: { _id: "owner-user" },
          params: { authenticatorId: targetId },
          body: { userId: "different-user" },
        },
        response,
      );

      assert.equal(requestedUserId, "owner-user");
      assert.equal(response.statusCode, 200);
      assert.equal(response.body.success, true);
      assert.equal(saveCount, 1);
      assert.equal(owner.authenticators.length, 1);
      assert.equal(owner.authenticators[0]._id.toString(), remainingId);
      assert.equal(response.body.passkeys.length, 1);
      assert.deepEqual(
        Object.keys(response.body.passkeys[0]).sort(),
        safePasskeyKeys,
      );
    },
  );
});

test("deleting an unowned passkey returns 404 without saving", async () => {
  const owner = new User({
    fullName: "Owner",
    email: "owner@example.com",
    authenticators: [
      {
        credentialID: "owner-credential",
        credentialPublicKey: Buffer.from("owner-public-key"),
      },
    ],
  });
  let saveCount = 0;
  owner.save = async () => {
    saveCount += 1;
  };

  await withFindById(
    () => createQuery(owner),
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
      assert.equal(saveCount, 0);
      assert.equal(owner.authenticators.length, 1);
    },
  );
});

test("deleting the final passkey is allowed", async () => {
  const owner = new User({
    fullName: "Owner",
    email: "owner@example.com",
    authenticators: [
      {
        credentialID: "only-credential",
        credentialPublicKey: Buffer.from("only-public-key"),
      },
    ],
  });
  const targetId = owner.authenticators[0]._id.toString();
  let saveCount = 0;
  owner.save = async () => {
    saveCount += 1;
  };

  await withFindById(
    () => createQuery(owner),
    async () => {
      const response = createResponse();
      await deletePasskey(
        {
          user: { _id: "owner-user" },
          params: { authenticatorId: targetId },
        },
        response,
      );

      assert.equal(response.statusCode, 200);
      assert.equal(response.body.success, true);
      assert.equal(saveCount, 1);
      assert.equal(owner.authenticators.length, 0);
      assert.deepEqual(response.body.passkeys, []);
    },
  );
});

test("passkey registration stores display and credential metadata", async () => {
  const originalFindById = User.findById;
  let requestedUserId;
  let saveCount = 0;
  const user = new User({
    fullName: "Owner",
    email: "owner@example.com",
    currentChallenge: "expected-challenge",
    authenticators: [],
  });
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
  User.findById = (id) => {
    requestedUserId = id;
    return createQuery(user);
  };

  try {
    const before = Date.now();
    const response = createResponse();
    await registerFinish(
      {
        user: { _id: "owner-user" },
        body: {
          userId: "different-user",
          name: "Work laptop",
          registrationResponse: {},
        },
      },
      response,
    );

    assert.equal(requestedUserId, "owner-user");
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, true);
    assert.equal(saveCount, 1);
    assert.equal(user.currentChallenge, undefined);
    assert.equal(user.authenticators.length, 1);

    const authenticator = user.authenticators[0];
    assert.equal(authenticator.credentialID, "new-credential");
    assert.equal(Buffer.isBuffer(authenticator.credentialPublicKey), true);
    assert.equal(authenticator.counter, 3);
    assert.equal(authenticator.name, "Work laptop");
    assert.equal(authenticator.createdAt instanceof Date, true);
    assert.ok(authenticator.createdAt.getTime() >= before);
    assert.equal(authenticator.lastUsedAt == null, true);
    assert.equal(authenticator.deviceType, "multiDevice");
    assert.equal(authenticator.backedUp, true);
    assert.deepEqual(authenticator.transports, ["internal", "hybrid"]);

    assert.deepEqual(
      Object.keys(response.body.passkey).sort(),
      safePasskeyKeys,
    );
    assert.equal(response.body.passkey.name, "Work laptop");
    assert.equal(response.body.passkey.deviceType, "multiDevice");
    assert.equal(response.body.passkey.backedUp, true);
    assert.deepEqual(response.body.passkey.transports, ["internal", "hybrid"]);
    assert.equal(
      Object.hasOwn(response.body.passkey, "credentialPublicKey"),
      false,
    );
    assert.equal(Object.hasOwn(response.body.passkey, "credentialID"), false);
    assert.equal(Object.hasOwn(response.body.passkey, "counter"), false);
  } finally {
    User.findById = originalFindById;
  }
});

test("passkey registration start and finish ignore a supplied userId", async () => {
  const requestedIds = [];

  await withFindById(
    (id) => {
      requestedIds.push(id);
      return createQuery(null);
    },
    async () => {
      const startResponse = createResponse();
      await registerStart(
        {
          user: { _id: "owner-user" },
          body: { userId: "different-user" },
        },
        startResponse,
      );

      const finishResponse = createResponse();
      await registerFinish(
        {
          user: { _id: "owner-user" },
          body: {
            userId: "different-user",
            name: "Work laptop",
            registrationResponse: {},
          },
        },
        finishResponse,
      );

      assert.deepEqual(requestedIds, ["owner-user", "owner-user"]);
      assert.equal(startResponse.statusCode, 404);
      assert.equal(finishResponse.statusCode, 400);
    },
  );
});

test("successful passkey login updates counter and last-used metadata", async () => {
  const originalFindOne = User.findOne;
  const originalSecret = process.env.JWT_SECRET;
  const before = Date.now();
  let saveCount = 0;
  let markedPath;

  const authenticator = {
    credentialID: "credential-one",
    credentialPublicKey: Buffer.from("public-key-one"),
    counter: 2,
    transports: ["internal"],
    lastUsedAt: null,
  };
  const user = {
    _id: "owner-user",
    currentChallenge: "expected-challenge",
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
    authenticationInfo: { newCounter: 7 },
  };
  User.findOne = () => createQuery(user);
  process.env.JWT_SECRET = "passkey-management-test-secret";

  try {
    const response = createResponse();
    await loginFinish(
      {
        body: {
          email: "owner@example.com",
          response: { id: "credential-one" },
        },
      },
      response,
    );

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.verified, true);
    assert.equal(typeof response.body.token, "string");
    assert.equal(Object.hasOwn(response.body, "credentialPublicKey"), false);
    assert.equal(authenticator.counter, 7);
    assert.equal(authenticator.lastUsedAt instanceof Date, true);
    assert.ok(authenticator.lastUsedAt.getTime() >= before);
    assert.ok(authenticator.lastUsedAt.getTime() <= Date.now());
    assert.equal(markedPath, "authenticators");
    assert.equal(user.currentChallenge, undefined);
    assert.equal(saveCount, 1);
  } finally {
    User.findOne = originalFindOne;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});

test("passkey management routes are protected and precede the generic user route", () => {
  const router = require("../routes/UserRoutes/userRoutes");
  const routeLayers = router.stack.filter((layer) => layer.route);
  const listIndex = routeLayers.findIndex(
    (layer) => layer.route.path === "/passkey" && layer.route.methods.get,
  );
  const deleteIndex = routeLayers.findIndex(
    (layer) =>
      layer.route.path === "/passkey/:authenticatorId" &&
      layer.route.methods.delete,
  );
  const genericGetIndex = routeLayers.findIndex(
    (layer) => layer.route.path === "/:id" && layer.route.methods.get,
  );

  assert.ok(listIndex >= 0, "GET /passkey route is registered");
  assert.ok(deleteIndex >= 0, "DELETE /passkey/:authenticatorId is registered");
  assert.ok(
    listIndex < genericGetIndex,
    "GET /passkey is not shadowed by GET /:id",
  );
  assert.equal(routeLayers[listIndex].route.stack[0].handle.name, "protect");
  assert.equal(routeLayers[deleteIndex].route.stack[0].handle.name, "protect");
});
