const test = require("node:test");
const assert = require("node:assert/strict");

const User = require("../models/UserData/User");
const {
  ADMIN_MANAGEMENT_SCOPE,
  FINANCIAL_READ_SCOPE,
  issueAuthToken,
  issueStepUpToken,
  verifyAuthToken,
  verifyStepUpToken,
} = require("../helper/authToken");
const { checkAuth } = require("../controllers/UserController/authController");

const TEST_SECRET = "privileged-step-up-tests-use-a-long-secret-value";
const originalSecret = process.env.JWT_SECRET;

test.before(() => {
  process.env.JWT_SECRET = TEST_SECRET;
});

test.after(() => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
});

const createResponse = () => ({
  body: undefined,
  statusCode: 200,
  json(body) {
    this.body = body;
    return this;
  },
  set() {
    return this;
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
});

const getRouteGuards = (routerPath, method, path) => {
  const router = require(routerPath);
  const layer = router.stack.find(
    (candidate) =>
      candidate.route?.path === path && candidate.route.methods[method],
  );
  assert.ok(layer, `${method.toUpperCase()} ${path} must exist`);
  return layer.route.stack.slice(0, -1).map((entry) => entry.handle);
};

const runGuards = async (guards, { accessToken, body = {}, stepUpToken }) => {
  const request = {
    auth: undefined,
    body,
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(stepUpToken ? { "x-step-up-token": stepUpToken } : {}),
    },
    params: { id: "studio-a", studioId: "studio-a" },
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

test("admin grants are allowlisted and bound to the requesting access session", async () => {
  const originalFindById = User.findById;
  User.findById = (id) => ({
    select: async () => ({
      _id: id,
      password: "stored-password-hash",
      matchPassword: async (password) => password === "correct-password",
    }),
  });

  try {
    const response = createResponse();
    await checkAuth(
      {
        auth: { jti: "access-session-a" },
        body: {
          password: "correct-password",
          scope: ADMIN_MANAGEMENT_SCOPE,
        },
        user: { _id: "developer-a" },
      },
      response,
    );

    assert.equal(response.statusCode, 200);
    const decoded = verifyStepUpToken(
      response.body.stepUpToken,
      ADMIN_MANAGEMENT_SCOPE,
    );
    assert.equal(decoded.id, "developer-a");
    assert.equal(decoded.sid, "access-session-a");
  } finally {
    User.findById = originalFindById;
  }
});

test("privileged account and studio mutations no longer require a step-up grant", async () => {
  const originalFindById = User.findById;
  User.findById = (id) => {
    const query = {
      lean: async () => ({
        _id: id,
        authVersion: 0,
        role: "devTeam",
      }),
      select() {
        return query;
      },
    };
    return query;
  };

  try {
    const accessToken = issueAuthToken("developer-a", {
      authenticationMethod: "password",
      authVersion: 0,
    });
    const routes = [
      ["../routes/UserRoutes/userRoutes", "delete", "/:id"],
      ["../routes/StudioRoutes/studioRoutes", "post", "/"],
      ["../routes/StudioRoutes/studioRoutes", "delete", "/:id"],
    ];

    for (const [routerPath, method, path] of routes) {
      const guards = getRouteGuards(routerPath, method, path);
      const bearerOnly = await runGuards(guards, { accessToken });
      assert.equal(bearerOnly.passed, true, path);
    }

    const authRoutes = require("../routes/UserRoutes/authRoutes");
    const registration = authRoutes.stack.find(
      (layer) => layer.route?.path === "/register" && layer.route.methods.post,
    );
    assert.ok(
      !registration.route.stack.some(
        (entry) => entry.handle.name === "protectPrivilegedRegistration",
      ),
      "registration no longer gates privileged roles behind step-up",
    );
  } finally {
    User.findById = originalFindById;
  }
});

test("purchase, pass-credit, bank, and medical-record access no longer require a step-up grant", async () => {
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
    const accessToken = issueAuthToken("admin-a", {
      authenticationMethod: "password",
      authVersion: 0,
    });
    const routeCases = [
      ["../routes/StudioRoutes/purchaseRoutes", "get", "/studio/:studioId", {}],
      ["../routes/StudioRoutes/purchaseRoutes", "post", "/cashier-bulk", {}],
      ["../routes/UserRoutes/user_passesRoutes", "get", "/history/:studioId", {}],
      ["../routes/UserRoutes/user_passesRoutes", "post", "/assign", {}],
      ["../routes/UserRoutes/medicalRoutes", "get", "/:userId", {}],
      ["../routes/StudioRoutes/studioRoutes", "put", "/:id", { bankDetails: [] }],
    ];

    // A signed-in administrator reaches these directly now: the password
    // re-confirmation was removed, so the access token alone is the whole
    // authorization. Role and tenant checks still apply and are covered
    // elsewhere.
    for (const [routerPath, method, path, body] of routeCases) {
      const guards = getRouteGuards(routerPath, method, path);
      const bearerOnly = await runGuards(guards, { accessToken, body });
      assert.equal(bearerOnly.passed, true, `${method} ${path}`);
    }
  } finally {
    User.findById = originalFindById;
  }
});

test("promo, package catalogue, and student-eligibility changes no longer require a step-up grant", async () => {
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
    const accessToken = issueAuthToken("admin-a", {
      authenticationMethod: "password",
      authVersion: 0,
    });
    const routeCases = [
      ["../routes/StudioRoutes/packagesRoutes", "post", "/", {}],
      ["../routes/StudioRoutes/packagesRoutes", "put", "/:id", {}],
      ["../routes/StudioRoutes/promoRoutes", "post", "/", {}],
      ["../routes/StudioRoutes/promoRoutes", "get", "/studio/:studioId", {}],
      ["../routes/StudioRoutes/promoRoutes", "delete", "/:id", {}],
      ["../routes/UserRoutes/userRoutes", "put", "/profile/:id", { isStudent: true }],
    ];

    for (const [routerPath, method, path, body] of routeCases) {
      const guards = getRouteGuards(routerPath, method, path);
      const bearerOnly = await runGuards(guards, { accessToken, body });
      assert.equal(bearerOnly.passed, true, `${method} ${path}`);
    }
  } finally {
    User.findById = originalFindById;
  }
});
