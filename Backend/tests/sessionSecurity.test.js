const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  "session-security-test-secret-that-is-at-least-32-characters";

const User = require("../models/UserData/User");
const {
  JWT_ALGORITHM,
  JWT_AUDIENCE,
  JWT_ISSUER,
  issueAuthToken,
  issueReplacementAuthToken,
  verifyAuthToken,
} = require("../helper/authToken");
const { protect } = require("../middlewares/authMiddleware");
const {
  logoutAllSessions,
  setNewUserPassword,
  updatePassword,
} = require("../controllers/UserController/userController");
const {
  deletePasskey,
} = require("../controllers/UserController/passkeyController");
const {
  configureAuthenticatedSockets,
  getSocketExpiryDelay,
  isSocketSecurityStateCurrent,
  revalidateSocketAuthentication,
  toSocketSecuritySnapshot,
} = require("../config/socketSecurity");

const createQuery = (value) => {
  const query = {
    select() {
      return query;
    },
    lean() {
      return Promise.resolve(value);
    },
  };
  return query;
};

const createResponse = () => ({
  statusCode: 200,
  body: undefined,
  headers: {},
  set(name, value) {
    this.headers[name] = value;
    return this;
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

const withFindById = async (implementation, callback) => {
  const original = User.findById;
  User.findById = implementation;
  try {
    return await callback();
  } finally {
    User.findById = original;
  }
};

test("access tokens carry a required authentication version", () => {
  const token = issueAuthToken("user-one", {
    authenticationMethod: "password_otp",
    authVersion: 4,
  });
  const decoded = verifyAuthToken(token);

  assert.equal(decoded.id, "user-one");
  assert.equal(decoded.ver, 4);
  assert.equal(decoded.token_use, "access");

  const legacyToken = jwt.sign(
    { id: "user-one", token_use: "access" },
    process.env.JWT_SECRET,
    {
      algorithm: JWT_ALGORITHM,
      audience: JWT_AUDIENCE,
      expiresIn: "5m",
      issuer: JWT_ISSUER,
      subject: "user-one",
    },
  );
  assert.throws(() => verifyAuthToken(legacyToken), /Invalid token subject/);
});

test("security changes receive a same-authentication replacement token", () => {
  const authenticatedAt = Math.floor(Date.now() / 1000) - 120;
  const original = verifyAuthToken(
    issueAuthToken("user-one", {
      authenticationMethod: "passkey",
      authenticatedAt,
      authVersion: 8,
    }),
  );
  const replacementToken = issueReplacementAuthToken(
    { _id: "user-one", authVersion: 9 },
    original,
  );
  const replacement = verifyAuthToken(replacementToken);

  assert.equal(replacement.ver, 9);
  assert.equal(replacement.auth_time, authenticatedAt);
  assert.deepEqual(replacement.amr, ["passkey"]);
  assert.notEqual(replacement.jti, original.jti);
  assert.equal(
    issueReplacementAuthToken(
      { _id: "user-one", authVersion: 10 },
      original,
    ),
    null,
  );
});

test("password and privilege changes increment the model authVersion", async () => {
  const passwordUser = new User({
    fullName: "Password User",
    email: "password@example.com",
    authVersion: 2,
    role: "client",
  });
  passwordUser.$isNew = false;
  passwordUser.$clearModifiedPaths();
  passwordUser.password = "Another-secure-password-123";

  await User.schema.s.hooks.execPre("save", passwordUser, []);
  assert.equal(passwordUser.authVersion, 3);
  assert.ok(passwordUser.passwordChangedAt instanceof Date);
  assert.match(passwordUser.password, /^\$2[aby]\$/);

  const roleUser = new User({
    fullName: "Role User",
    email: "role@example.com",
    authVersion: 9,
    role: "client",
  });
  roleUser.$isNew = false;
  roleUser.$clearModifiedPaths();
  roleUser.role = "studioAdmin";

  await User.schema.s.hooks.execPre("save", roleUser, []);
  assert.equal(roleUser.authVersion, 10);
});

test("atomic passkey removal increments authVersion in the same update", async () => {
  const query = User.findOneAndUpdate(
    { _id: "507f1f77bcf86cd799439011" },
    { $pull: { authenticators: { _id: "507f1f77bcf86cd799439012" } } },
  );

  await User.schema.s.hooks.execPre("findOneAndUpdate", query, []);
  assert.equal(query.getUpdate().$inc.authVersion, 1);
  assert.deepEqual(query.getUpdate().$pull, {
    authenticators: { _id: "507f1f77bcf86cd799439012" },
  });
});

test("password set and update responses rotate the current access token", async () => {
  for (const scenario of [
    {
      controller: setNewUserPassword,
      body: { password: "First-secure-password-123" },
      password: "",
    },
    {
      controller: updatePassword,
      body: {
        newPassword: "Updated-secure-password-456",
        password: "current-password",
      },
      password: "stored-hash",
    },
  ]) {
    const claims = verifyAuthToken(
      issueAuthToken("user-one", {
        authenticationMethod: "password_otp",
        authVersion: 2,
      }),
    );
    const user = {
      _id: "user-one",
      authVersion: 2,
      password: scenario.password,
      matchPassword: async (password) => password === "current-password",
      async save() {
        this.authVersion += 1;
      },
    };

    await withFindById(
      () => ({ select: async () => user }),
      async () => {
        const response = createResponse();
        await scenario.controller(
          {
            auth: claims,
            body: scenario.body,
            user: { _id: "user-one" },
          },
          response,
        );

        assert.ok(response.statusCode === 200 || response.statusCode === 201);
        assert.equal(response.body.reauthenticationRequired, false);
        assert.equal(verifyAuthToken(response.body.token).ver, 3);
      },
    );
  }
});

test("passkey removal rotates the current access token", async () => {
  const originalFindOneAndUpdate = User.findOneAndUpdate;
  const claims = verifyAuthToken(
    issueAuthToken("user-one", {
      authenticationMethod: "passkey",
      authVersion: 4,
    }),
  );
  User.findOneAndUpdate = () => ({
    select: async () => ({
      _id: "user-one",
      authVersion: 5,
      authenticators: [],
    }),
  });

  try {
    const response = createResponse();
    await deletePasskey(
      {
        auth: claims,
        params: { authenticatorId: "507f1f77bcf86cd799439011" },
        user: { _id: "user-one" },
      },
      response,
    );

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.reauthenticationRequired, false);
    assert.equal(verifyAuthToken(response.body.token).ver, 5);
  } finally {
    User.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test("logout-all atomically revokes the current session too", async () => {
  const originalFindOneAndUpdate = User.findOneAndUpdate;
  let capturedFilter;
  let capturedUpdate;
  User.findOneAndUpdate = (filter, update) => {
    capturedFilter = filter;
    capturedUpdate = update;
    return { select: async () => ({ _id: "user-one" }) };
  };

  try {
    const response = createResponse();
    await logoutAllSessions(
      { user: { _id: "user-one" } },
      response,
    );

    assert.deepEqual(capturedFilter, { _id: "user-one" });
    assert.deepEqual(capturedUpdate, { $inc: { authVersion: 1 } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.code, "ALL_SESSIONS_REVOKED");
    assert.equal(response.body.reauthenticationRequired, true);
    assert.equal(Object.hasOwn(response.body, "token"), false);
  } finally {
    User.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test("HTTP authentication rejects a token after authVersion changes", async () => {
  const token = issueAuthToken("user-one", {
    authenticationMethod: "password_otp",
    authVersion: 2,
  });

  await withFindById(
    () =>
      createQuery({
        _id: "user-one",
        authVersion: 3,
        email: "user@example.com",
        password: "stored-hash",
        role: "client",
      }),
    async () => {
      const request = { headers: { authorization: `Bearer ${token}` } };
      const response = createResponse();
      let nextCalled = false;

      await protect(request, response, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(response.statusCode, 401);
      assert.deepEqual(response.body, {
        code: "SESSION_REVOKED",
        message: "Not authorized",
      });
    },
  );
});

test("HTTP authentication accepts the current version without exposing it", async () => {
  const token = issueAuthToken("user-one", {
    authenticationMethod: "passkey",
    authVersion: 3,
  });

  await withFindById(
    () =>
      createQuery({
        _id: "user-one",
        authVersion: 3,
        email: "user@example.com",
        password: "stored-hash",
        role: "client",
      }),
    async () => {
      const request = { headers: { authorization: `Bearer ${token}` } };
      const response = createResponse();
      let nextCalled = false;

      await protect(request, response, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
      assert.equal(request.auth.ver, 3);
      assert.equal(request.user.hasPassword, true);
      assert.equal(Object.hasOwn(request.user, "authVersion"), false);
    },
  );
});

test("socket snapshots reject version, role, and studio changes", () => {
  const user = {
    _id: "user-one",
    authVersion: 5,
    role: "studioAdmin",
    adminStudioLocation: "studio-one",
  };
  const decoded = { id: "user-one", ver: 5 };
  const snapshot = toSocketSecuritySnapshot(user);

  assert.equal(isSocketSecurityStateCurrent(decoded, snapshot, user), true);
  assert.equal(
    isSocketSecurityStateCurrent(decoded, snapshot, {
      ...user,
      authVersion: 6,
    }),
    false,
  );
  assert.equal(
    isSocketSecurityStateCurrent(decoded, snapshot, {
      ...user,
      role: "client",
    }),
    false,
  );
  assert.equal(
    isSocketSecurityStateCurrent(decoded, snapshot, {
      ...user,
      adminStudioLocation: "studio-two",
    }),
    false,
  );
});

test("socket revalidation detects current privilege changes", async () => {
  const now = Date.now();
  const originalUser = {
    _id: "user-one",
    authVersion: 7,
    role: "studioAdmin",
    adminStudioLocation: "studio-one",
  };
  const socket = {
    data: {
      auth: {
        id: "user-one",
        ver: 7,
        exp: Math.floor(now / 1000) + 60,
      },
      securitySnapshot: toSocketSecuritySnapshot(originalUser),
      user: originalUser,
    },
  };

  await withFindById(
    () => createQuery({ ...originalUser, role: "client" }),
    async () => {
      assert.deepEqual(await revalidateSocketAuthentication(socket, now), {
        code: "SESSION_REVOKED",
        valid: false,
      });
    },
  );
});

test("socket connections disconnect at JWT expiry and clear their timers", (t) => {
  const now = 2_000_000_000_000;
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"], now });

  let connectionHandler;
  const io = {
    use() {},
    on(event, handler) {
      if (event === "connection") connectionHandler = handler;
    },
  };
  configureAuthenticatedSockets(io);

  const handlers = new Map();
  const emissions = [];
  let disconnectCalls = 0;
  const user = {
    _id: "user-one",
    authVersion: 1,
    role: "client",
    adminStudioLocation: null,
  };
  const socket = {
    data: {
      auth: {
        id: "user-one",
        ver: 1,
        exp: Math.floor(now / 1000) + 2,
      },
      securitySnapshot: toSocketSecuritySnapshot(user),
      user,
    },
    disconnect(close) {
      assert.equal(close, true);
      disconnectCalls += 1;
      handlers.get("disconnect")?.();
    },
    emit(event, payload) {
      emissions.push([event, payload]);
    },
    join() {},
    on(event, handler) {
      handlers.set(event, handler);
    },
  };

  connectionHandler(socket);
  assert.equal(getSocketExpiryDelay(socket.data.auth, now), 2000);
  t.mock.timers.tick(1999);
  assert.equal(disconnectCalls, 0);
  t.mock.timers.tick(1);

  assert.equal(disconnectCalls, 1);
  assert.deepEqual(emissions, [
    ["authentication_error", { code: "TOKEN_EXPIRED" }],
  ]);
});
