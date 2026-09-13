const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEFAULT_ORIGINS,
  DEFAULT_RP_ID,
  getPasskeyConfig,
} = require("../config/passkeySecurity");
const PasskeyCeremony = require("../models/UserData/PasskeyCeremony");

const ENV_KEYS = [
  "WEBAUTHN_ORIGINS",
  "WEBAUTHN_RP_ID",
  "WEBAUTHN_RP_NAME",
];

const withPasskeyEnv = (values, callback) => {
  const originals = new Map(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, values);

  try {
    return callback();
  } finally {
    for (const [key, value] of originals) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

test("WebAuthn config has production-compatible defaults", () => {
  withPasskeyEnv({}, () => {
    assert.deepEqual(getPasskeyConfig(), {
      origins: DEFAULT_ORIGINS,
      rpID: DEFAULT_RP_ID,
      rpName: "Hava",
    });
  });
});

test("WebAuthn config supports localhost and multiple exact origins", () => {
  withPasskeyEnv(
    {
      WEBAUTHN_ORIGINS: "http://localhost:5173,http://localhost:4173",
      WEBAUTHN_RP_ID: "localhost",
      WEBAUTHN_RP_NAME: "Hava Local",
    },
    () => {
      assert.deepEqual(getPasskeyConfig(), {
        origins: ["http://localhost:5173", "http://localhost:4173"],
        rpID: "localhost",
        rpName: "Hava Local",
      });
    },
  );
});

for (const [name, env] of [
  [
    "an origin outside the RP ID",
    {
      WEBAUTHN_RP_ID: "booktheclassindonesia.com",
      WEBAUTHN_ORIGINS: "https://attacker.example",
    },
  ],
  [
    "HTTP for a production RP",
    {
      WEBAUTHN_RP_ID: "booktheclassindonesia.com",
      WEBAUTHN_ORIGINS: "http://booktheclassindonesia.com",
    },
  ],
  [
    "an origin containing a path",
    {
      WEBAUTHN_RP_ID: "booktheclassindonesia.com",
      WEBAUTHN_ORIGINS: "https://booktheclassindonesia.com/login",
    },
  ],
]) {
  test(`WebAuthn config rejects ${name}`, () => {
    withPasskeyEnv(env, () => {
      assert.throws(() => getPasskeyConfig());
    });
  });
}

test("passkey ceremonies have a TTL index and hidden secrets", () => {
  assert.equal(
    PasskeyCeremony.schema.path("ceremonyIdHash").options.select,
    false,
  );
  assert.equal(PasskeyCeremony.schema.path("challenge").options.select, false);
  assert.equal(
    PasskeyCeremony.schema.path("sessionBindingHash").options.select,
    false,
  );
  assert.ok(
    PasskeyCeremony.schema.indexes().some(
      ([fields, options]) =>
        fields.expiresAt === 1 && options.expireAfterSeconds === 0,
    ),
  );
});
