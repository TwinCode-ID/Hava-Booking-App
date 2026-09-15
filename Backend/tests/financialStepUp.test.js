const test = require("node:test");
const assert = require("node:assert/strict");

const User = require("../models/UserData/User");
const {
  FINANCIAL_READ_SCOPE,
  issueAuthToken,
  issueStepUpToken,
  PASSKEY_MANAGEMENT_SCOPE,
  verifyAuthToken,
  verifyStepUpToken,
} = require("../helper/authToken");
const { checkAuth } = require("../controllers/UserController/authController");

const TEST_SECRET =
  "financial-step-up-test-secret-that-is-at-least-32-characters";
const originalJwtSecret = process.env.JWT_SECRET;

test.before(() => {
  process.env.JWT_SECRET = TEST_SECRET;
});

test.after(() => {
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
});

const createResponse = () => ({
  body: undefined,
  headers: {},
  statusCode: 200,
  json(body) {
    this.body = body;
    return this;
  },
  set(name, value) {
    this.headers[name] = value;
    return this;
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
});

const getRevenueGuards = () => {
  const purchaseRoutes = require("../routes/StudioRoutes/purchaseRoutes");
  const layer = purchaseRoutes.stack.find(
    (candidate) =>
      candidate.route?.path === "/studio/:studioId" &&
      candidate.route.methods.get,
  );
  assert.ok(layer, "the studio purchase-history route is registered");

  const handlers = layer.route.stack.map((entry) => entry.handle);
  assert.equal(handlers.length, 4);
  assert.deepEqual(
    handlers.slice(0, -1).map((handler) => handler.name),
    ["protect", "studioAdmin", "requireScopedStepUp"],
  );
  return handlers.slice(0, -1);
};

const runRevenueGuards = async ({ accessToken, stepUpToken }) => {
  const request = {
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(stepUpToken ? { "x-step-up-token": stepUpToken } : {}),
    },
    params: { studioId: "studio-a" },
  };
  const response = createResponse();

  for (const guard of getRevenueGuards()) {
    let continued = false;
    await guard(request, response, () => {
      continued = true;
    });
    if (!continued) return { passed: false, request, response };
  }

  return { passed: true, request, response };
};

const getRouteGuards = (method, path) => {
  const purchaseRoutes = require("../routes/StudioRoutes/purchaseRoutes");
  const layer = purchaseRoutes.stack.find(
    (candidate) =>
      candidate.route?.path === path && candidate.route.methods[method],
  );
  assert.ok(layer, `${method.toUpperCase()} ${path} is registered`);
  return layer.route.stack.slice(0, -1).map((entry) => entry.handle);
};

const getPassRouteGuards = (method, path) => {
  const passRoutes = require("../routes/UserRoutes/user_passesRoutes");
  const layer = passRoutes.stack.find(
    (candidate) =>
      candidate.route?.path === path && candidate.route.methods[method],
  );
  assert.ok(layer, `${method.toUpperCase()} ${path} is registered`);
  return layer.route.stack.slice(0, -1).map((entry) => entry.handle);
};

const runGuards = async (guards, { accessToken, stepUpToken }) => {
  const request = {
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(stepUpToken ? { "x-step-up-token": stepUpToken } : {}),
    },
    params: {},
  };
  const response = createResponse();

  for (const guard of guards) {
    let continued = false;
    await guard(request, response, () => {
      continued = true;
    });
    if (!continued) return { passed: false, request, response };
  }
  return { passed: true, request, response };
};

test("password verification issues only allowlisted, same-session financial grants", async () => {
  const originalFindById = User.findById;
  let lookupCount = 0;
  User.findById = (id) => ({
    select: async () => {
      lookupCount += 1;
      return {
        _id: id,
        password: "stored-password-hash",
        matchPassword: async (password) => password === "correct-password",
      };
    },
  });

  try {
    const invalidScopeResponse = createResponse();
    await checkAuth(
      {
        auth: { jti: "access-session-a" },
        body: { password: "correct-password", scope: "admin:everything" },
        user: { _id: "admin-user" },
      },
      invalidScopeResponse,
    );
    assert.equal(invalidScopeResponse.statusCode, 400);
    assert.equal(
      invalidScopeResponse.body.code,
      "INVALID_STEP_UP_SCOPE",
    );
    assert.equal(lookupCount, 0);

    const missingSessionResponse = createResponse();
    await checkAuth(
      {
        auth: {},
        body: { password: "correct-password", scope: FINANCIAL_READ_SCOPE },
        user: { _id: "admin-user" },
      },
      missingSessionResponse,
    );
    assert.equal(missingSessionResponse.statusCode, 401);
    assert.equal(
      missingSessionResponse.body.code,
      "INVALID_ACCESS_SESSION",
    );
    assert.equal(lookupCount, 0);

    const response = createResponse();
    await checkAuth(
      {
        auth: { jti: "access-session-a" },
        body: { password: "correct-password", scope: FINANCIAL_READ_SCOPE },
        user: { _id: "admin-user" },
      },
      response,
    );

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.stepUpScope, FINANCIAL_READ_SCOPE);
    assert.equal(response.body.stepUpExpiresIn, 300);
    const decoded = verifyStepUpToken(
      response.body.stepUpToken,
      FINANCIAL_READ_SCOPE,
    );
    assert.equal(decoded.id, "admin-user");
    assert.equal(decoded.sid, "access-session-a");

    const defaultScopeResponse = createResponse();
    await checkAuth(
      {
        auth: { jti: "access-session-a" },
        body: { password: "correct-password" },
        user: { _id: "admin-user" },
      },
      defaultScopeResponse,
    );
    assert.equal(
      defaultScopeResponse.body.stepUpScope,
      PASSKEY_MANAGEMENT_SCOPE,
    );
    assert.equal(
      verifyStepUpToken(
        defaultScopeResponse.body.stepUpToken,
        PASSKEY_MANAGEMENT_SCOPE,
      ).sid,
      "access-session-a",
    );
  } finally {
    User.findById = originalFindById;
  }
});
