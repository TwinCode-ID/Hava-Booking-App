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

test("studio purchase history requires a correctly scoped step-up from the same access session", async () => {
  const originalFindById = User.findById;
  User.findById = (id) => {
    const query = {
      lean: async () => ({
        _id: id,
        authVersion: 0,
        role: "studioAdmin",
        adminStudioLocation: "studio-a",
      }),
      select() {
        return query;
      },
    };
    return query;
  };

  try {
    const accessToken = issueAuthToken("admin-user", {
      authenticationMethod: "password",
      authVersion: 0,
    });
    const accessSessionId = verifyAuthToken(accessToken).jti;

    const bearerOnly = await runRevenueGuards({ accessToken });
    assert.equal(bearerOnly.passed, false);
    assert.equal(bearerOnly.response.statusCode, 403);
    assert.equal(bearerOnly.response.body.code, "STEP_UP_REQUIRED");
    assert.equal(bearerOnly.response.body.scope, FINANCIAL_READ_SCOPE);

    const wrongScope = issueStepUpToken(
      "admin-user",
      PASSKEY_MANAGEMENT_SCOPE,
      accessSessionId,
    );
    const wrongScopeResult = await runRevenueGuards({
      accessToken,
      stepUpToken: wrongScope,
    });
    assert.equal(wrongScopeResult.passed, false);
    assert.equal(wrongScopeResult.response.statusCode, 403);

    const siblingAccessToken = issueAuthToken("admin-user", {
      authenticationMethod: "password",
      authVersion: 0,
    });
    const siblingSessionStepUp = issueStepUpToken(
      "admin-user",
      FINANCIAL_READ_SCOPE,
      verifyAuthToken(siblingAccessToken).jti,
    );
    const siblingSessionResult = await runRevenueGuards({
      accessToken,
      stepUpToken: siblingSessionStepUp,
    });
    assert.equal(siblingSessionResult.passed, false);
    assert.equal(siblingSessionResult.response.statusCode, 403);

    const validStepUp = issueStepUpToken(
      "admin-user",
      FINANCIAL_READ_SCOPE,
      accessSessionId,
    );
    const authorized = await runRevenueGuards({
      accessToken,
      stepUpToken: validStepUp,
    });
    assert.equal(authorized.passed, true);
    assert.equal(authorized.request.user.role, "studioAdmin");
  } finally {
    User.findById = originalFindById;
  }
});

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

test("staff purchase access is step-up protected without blocking a client's own flow", async () => {
  const originalFindById = User.findById;
  let currentRole = "client";
  User.findById = (id) => {
    const query = {
      lean: async () => ({
        _id: id,
        authVersion: 0,
        role: currentRole,
        ...(currentRole === "studioAdmin"
          ? { adminStudioLocation: "studio-a" }
          : {}),
      }),
      select() {
        return query;
      },
    };
    return query;
  };

  try {
    const clientAccessToken = issueAuthToken("client-user", {
      authenticationMethod: "password",
      authVersion: 0,
    });
    const createGuards = getRouteGuards("post", "/");
    const ownHistoryGuards = getRouteGuards("get", "/user/:userId");
    for (const [method, path] of [
      ["post", "/"],
      ["get", "/verify/:transactionId"],
      ["get", "/user/:userId"],
      ["put", "/:purchaseId/proof"],
    ]) {
      assert.deepEqual(
        getRouteGuards(method, path).map((handler) => handler.name),
        ["protect", "requireFinancialStepUpForStaff"],
      );
    }

    assert.equal(
      (await runGuards(createGuards, { accessToken: clientAccessToken }))
        .passed,
      true,
    );
    assert.equal(
      (await runGuards(ownHistoryGuards, { accessToken: clientAccessToken }))
        .passed,
      true,
    );
    const freezeGuards = getPassRouteGuards("put", "/freeze/:passId");
    assert.deepEqual(
      freezeGuards.map((handler) => handler.name),
      ["protect", "requireFinancialStepUpForStaff"],
    );
    assert.equal(
      (await runGuards(freezeGuards, { accessToken: clientAccessToken })).passed,
      true,
    );

    currentRole = "studioAdmin";
    const staffAccessToken = issueAuthToken("admin-user", {
      authenticationMethod: "password",
      authVersion: 0,
    });
    const staffBearerOnly = await runGuards(createGuards, {
      accessToken: staffAccessToken,
    });
    assert.equal(staffBearerOnly.passed, false);
    assert.equal(staffBearerOnly.response.body.code, "STEP_UP_REQUIRED");

    const accessSessionId = verifyAuthToken(staffAccessToken).jti;
    const staffStepUp = issueStepUpToken(
      "admin-user",
      FINANCIAL_READ_SCOPE,
      accessSessionId,
    );
    assert.equal(
      (
        await runGuards(createGuards, {
          accessToken: staffAccessToken,
          stepUpToken: staffStepUp,
        })
      ).passed,
      true,
    );
    const staffFreezeBearerOnly = await runGuards(freezeGuards, {
      accessToken: staffAccessToken,
    });
    assert.equal(staffFreezeBearerOnly.passed, false);
    assert.equal(staffFreezeBearerOnly.response.body.code, "STEP_UP_REQUIRED");
    assert.equal(
      (
        await runGuards(freezeGuards, {
          accessToken: staffAccessToken,
          stepUpToken: staffStepUp,
        })
      ).passed,
      true,
    );

    for (const [method, path] of [
      ["get", "/studio/:studioId"],
      ["post", "/:purchaseId/review"],
      ["post", "/cashier-bulk"],
    ]) {
      assert.equal(
        getRouteGuards(method, path).at(-1).name,
        "requireScopedStepUp",
      );
    }
    for (const [method, path] of [
      ["put", "/update/:passId"],
      ["post", "/assign"],
      ["post", "/deduct"],
    ]) {
      assert.deepEqual(
        getPassRouteGuards(method, path).map((handler) => handler.name),
        ["protect", "studioAdmin", "requireScopedStepUp"],
      );
    }
  } finally {
    User.findById = originalFindById;
  }
});
