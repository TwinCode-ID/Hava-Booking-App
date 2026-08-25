const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");

const MongoRateLimitStore = require("../config/mongoRateLimitStore");
const {
  DEVELOPMENT_ALLOWED_ORIGINS,
  PRODUCTION_ALLOWED_ORIGINS,
  allowedOrigins,
  corsOrigin,
  getDefaultAllowedOrigins,
  getTrustProxySetting,
  isOriginAllowed,
  parseAllowedOrigins,
} = require("../config/security");
const RateLimitCounter = require("../models/Security/RateLimitCounter");
const {
  accountOrIpKey,
  authIpLimiter,
  generalApiLimiter,
  ipv6SafeIpKey,
  userOrIpKey,
} = require("../middlewares/rateLimitMiddleware");

const createRequest = (ip = "198.51.100.24") => ({
  app: {
    get: (setting) => (setting === "trust proxy" ? false : undefined),
  },
  headers: {},
  ip,
  method: "GET",
  path: "/security-test",
  socket: { remoteAddress: ip },
});

const createResponse = () => ({
  body: undefined,
  headers: new Map(),
  statusCode: 200,
  getHeader(name) {
    return this.headers.get(name.toLowerCase());
  },
  json(body) {
    this.body = body;
    return this;
  },
  setHeader(name, value) {
    this.headers.set(name.toLowerCase(), value);
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
});

test("production CORS defaults exclude loopback development origins", () => {
  assert.deepEqual(
    getDefaultAllowedOrigins("production"),
    PRODUCTION_ALLOWED_ORIGINS,
  );
  assert.deepEqual(
    getDefaultAllowedOrigins(" Production "),
    PRODUCTION_ALLOWED_ORIGINS,
  );
  assert.equal(
    getDefaultAllowedOrigins("production").some((origin) =>
      /localhost|127\.0\.0\.1/.test(origin),
    ),
    false,
  );
  assert.deepEqual(
    getDefaultAllowedOrigins("development"),
    DEVELOPMENT_ALLOWED_ORIGINS,
  );
});

test("CORS configuration accepts only normalized HTTP(S) origins", () => {
  assert.deepEqual(
    [...parseAllowedOrigins("https://app.example.test/", "production")],
    ["https://app.example.test"],
  );
  assert.deepEqual(
    [
      ...parseAllowedOrigins(
        "http://localhost:5173, http://127.0.0.1:5173",
        "development",
      ),
    ],
    ["http://localhost:5173", "http://127.0.0.1:5173"],
  );

  for (const configured of [
    "http://localhost:5173",
    "https://user:secret@app.example.test",
    "https://app.example.test/login",
    "https://app.example.test?debug=1",
    "null",
    "*",
    "file:///tmp/app",
    "https://app.example.test,,https://other.example.test",
  ]) {
    assert.throws(
      () => parseAllowedOrigins(configured, "production"),
      configured,
    );
  }
});

test("CORS callbacks allow configured and origin-less clients only", () => {
  const configuredOrigin = [...allowedOrigins][0];
  assert.equal(isOriginAllowed(configuredOrigin), true);
  assert.equal(isOriginAllowed(undefined), true);
  assert.equal(isOriginAllowed("https://attacker.example"), false);

  corsOrigin(configuredOrigin, (error, allowed) => {
    assert.equal(error, null);
    assert.equal(allowed, true);
  });
  corsOrigin("https://attacker.example", (error, allowed) => {
    assert.equal(error.code, "CORS_NOT_ALLOWED");
    assert.equal(allowed, undefined);
  });
});

test("trust proxy accepts bounded explicit configurations and rejects trust-all", () => {
  assert.equal(getTrustProxySetting(""), false);
  assert.equal(getTrustProxySetting("false"), false);
  assert.equal(getTrustProxySetting("0"), false);
  assert.equal(getTrustProxySetting("1"), 1);
  assert.deepEqual(getTrustProxySetting("LOOPBACK, 10.0.0.0/8"), [
    "loopback",
    "10.0.0.0/8",
  ]);
  assert.deepEqual(getTrustProxySetting("2001:db8::1, 2001:db8::/48"), [
    "2001:db8::1",
    "2001:db8::/48",
  ]);

  const app = express();
  app.set("trust proxy", getTrustProxySetting("loopback, 10.0.0.0/8"));
  assert.equal(typeof app.get("trust proxy fn"), "function");

  for (const configured of [
    "true",
    "*",
    "-1",
    "proxy.internal",
    "0.0.0.0/0",
    "::/0",
    "10.0.0.0/33",
    "loopback,",
    "9007199254740992",
  ]) {
    assert.throws(() => getTrustProxySetting(configured), configured);
  }
});

test("Mongo rate-limit keys are namespaced, delimiter-safe, and hashed", () => {
  const store = new MongoRateLimitStore("auth-account");
  const id = store.getId("email:person@example.test");

  assert.equal(store.localKeys, false);
  assert.equal(store.prefix, "auth-account:");
  assert.match(id, /^auth-account:[a-f0-9]{64}$/);
  assert.equal(id.includes("person@example.test"), false);
  assert.equal(id, store.getId("email:person@example.test"));
  assert.notEqual(
    id,
    new MongoRateLimitStore("auth-ip").getId("email:person@example.test"),
  );

  for (const namespace of ["", "UPPERCASE", "has spaces", "trailing-"]) {
    assert.throws(() => new MongoRateLimitStore(namespace));
  }
  assert.throws(() => store.getId(""));
  assert.throws(() => store.init({ windowMs: 0 }));
  store.init({ windowMs: 15 * 60 * 1000 });
  assert.equal(store.windowMs, 15 * 60 * 1000);
});

test("Mongo rate-limit increment is one atomic, database-clock fixed-window update", async () => {
  const originalFindOneAndUpdate = RateLimitCounter.findOneAndUpdate;
  const store = new MongoRateLimitStore("atomic-test");
  store.init({ windowMs: 15 * 60 * 1000 });
  const resetAt = new Date(Date.now() + store.windowMs);
  let captured;

  RateLimitCounter.findOneAndUpdate = (filter, update, options) => {
    captured = { filter, options, update };
    return {
      lean: async () => ({ resetAt, totalHits: 3 }),
    };
  };

  try {
    assert.deepEqual(await store.increment("client-key"), {
      resetTime: resetAt,
      totalHits: 3,
    });
    assert.deepEqual(captured.filter, { _id: store.getId("client-key") });
    assert.deepEqual(captured.options, {
      new: true,
      upsert: true,
      updatePipeline: true,
    });
    assert.equal(captured.update.length, 1);

    const fields = captured.update[0].$set;
    assert.deepEqual(fields.totalHits.$cond[0], {
      $gt: [{ $ifNull: ["$resetAt", new Date(0)] }, "$$NOW"],
    });
    assert.deepEqual(fields.totalHits.$cond.slice(1), [
      { $add: [{ $ifNull: ["$totalHits", 0] }, 1] },
      1,
    ]);
    assert.deepEqual(fields.resetAt.$cond.slice(1), [
      "$resetAt",
      { $add: ["$$NOW", store.windowMs] },
    ]);
  } finally {
    RateLimitCounter.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test("Mongo rate-limit reads expired windows as absent and has an exact TTL index", async () => {
  const originalFindById = RateLimitCounter.findById;
  const store = new MongoRateLimitStore("read-test");
  let value = { resetAt: new Date(Date.now() - 1), totalHits: 4 };
  RateLimitCounter.findById = () => ({ lean: async () => value });

  try {
    assert.equal(await store.get("client-key"), undefined);
    value = { resetAt: new Date(Date.now() + 60_000), totalHits: 4 };
    assert.deepEqual(await store.get("client-key"), {
      resetTime: value.resetAt,
      totalHits: 4,
    });
  } finally {
    RateLimitCounter.findById = originalFindById;
  }

  assert.ok(
    RateLimitCounter.schema.indexes().some(
      ([fields, options]) =>
        fields.resetAt === 1 && options.expireAfterSeconds === 0,
    ),
  );
});

test("Mongo rate-limit store implements decrement and reset for the v8 Store API", async () => {
  const originalUpdateOne = RateLimitCounter.updateOne;
  const originalDeleteOne = RateLimitCounter.deleteOne;
  const store = new MongoRateLimitStore("lifecycle-test");
  let decrementCall;
  let resetCall;

  RateLimitCounter.updateOne = async (filter, update) => {
    decrementCall = { filter, update };
  };
  RateLimitCounter.deleteOne = async (filter) => {
    resetCall = filter;
  };

  try {
    await store.decrement("client-key");
    await store.resetKey("client-key");

    assert.deepEqual(decrementCall, {
      filter: {
        _id: store.getId("client-key"),
        totalHits: { $gt: 0 },
      },
      update: { $inc: { totalHits: -1 } },
    });
    assert.deepEqual(resetCall, { _id: store.getId("client-key") });
  } finally {
    RateLimitCounter.updateOne = originalUpdateOne;
    RateLimitCounter.deleteOne = originalDeleteOne;
  }
});

test("account and sensitive limiter keys normalize identity and IPv6 subnets", () => {
  assert.equal(
    accountOrIpKey({
      body: { email: " Person@Example.Test " },
      ip: "198.51.100.10",
    }),
    "email:person@example.test",
  );
  assert.equal(
    accountOrIpKey({ body: { email: "invalid" }, ip: "198.51.100.10" }),
    "ip:198.51.100.10",
  );
  assert.equal(
    userOrIpKey({ ip: "198.51.100.10", user: { _id: 1234 } }),
    "user:1234",
  );

  const firstSubnet = ipv6SafeIpKey({ ip: "2001:db8:abcd:1200::1" });
  assert.equal(
    firstSubnet,
    ipv6SafeIpKey({ ip: "2001:db8:abcd:12ff::9" }),
  );
  assert.notEqual(
    firstSubnet,
    ipv6SafeIpKey({ ip: "2001:db8:abcd:1300::1" }),
  );
  assert.throws(() => ipv6SafeIpKey({ ip: "not-an-ip" }));
  assert.throws(() => ipv6SafeIpKey({}));
});

test("rate-limit store failures fail closed through Express error handling", async () => {
  const originalFindOneAndUpdate = RateLimitCounter.findOneAndUpdate;
  const storeError = new Error("database unavailable");
  RateLimitCounter.findOneAndUpdate = () => {
    throw storeError;
  };

  try {
    const response = createResponse();
    let nextError;
    await generalApiLimiter(createRequest(), response, (error) => {
      nextError = error;
    });

    assert.equal(nextError, storeError);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body, undefined);
  } finally {
    RateLimitCounter.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test("v8 rate limiters can stack shared-store classes without double counting", async () => {
  const originalFindOneAndUpdate = RateLimitCounter.findOneAndUpdate;
  const counterIds = [];
  RateLimitCounter.findOneAndUpdate = (filter) => {
    counterIds.push(filter._id);
    return {
      lean: async () => ({
        resetAt: new Date(Date.now() + 15 * 60 * 1000),
        totalHits: 1,
      }),
    };
  };

  try {
    const request = createRequest();
    const response = createResponse();
    let error;
    await generalApiLimiter(request, response, (nextError) => {
      error = nextError;
    });
    assert.equal(error, undefined);
    await authIpLimiter(request, response, (nextError) => {
      error = nextError;
    });

    assert.equal(error, undefined);
    assert.equal(counterIds.length, 2);
    assert.match(counterIds[0], /^general:/);
    assert.match(counterIds[1], /^auth-ip:/);
    assert.notEqual(counterIds[0], counterIds[1]);
  } finally {
    RateLimitCounter.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test("production and development server entry points keep security wiring in parity", () => {
  const backendRoot = path.join(__dirname, "..");
  const productionServer = fs.readFileSync(
    path.join(backendRoot, "server.js"),
    "utf8",
  );
  const developmentServer = fs.readFileSync(
    path.join(backendRoot, "serverdev.js"),
    "utf8",
  );

  assert.equal(developmentServer, productionServer);
  assert.match(
    productionServer,
    /app\.set\("trust proxy", getTrustProxySetting\(\)\)/,
  );
  assert.match(productionServer, /app\.use\("\/api", generalApiLimiter\)/);
  assert.match(productionServer, /app\.use\(cors\(corsOptions\)\)/);
  assert.doesNotMatch(productionServer, /origin:\s*["']\*["']/);
  assert.doesNotMatch(productionServer, /app\.set\("trust proxy",\s*1\)/);
});
