const { getPasskeyConfig } = require("./passkeySecurity");

const MIN_SECRET_LENGTH = 32;
const REQUIRED_PRODUCTION_VALUES = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN",
  "MONGO_URI",
  "OTP_HASH_SECRET",
  "UPLOAD_URL_SIGNING_SECRET",
];

const assertNonEmpty = (name) => {
  if (typeof process.env[name] !== "string" || !process.env[name].trim()) {
    throw new Error(`${name} must be configured.`);
  }
};

const assertSecret = (name) => {
  assertNonEmpty(name);
  if (process.env[name].length < MIN_SECRET_LENGTH) {
    throw new Error(`${name} must contain at least ${MIN_SECRET_LENGTH} characters.`);
  }
};

const assertHttpsOrigin = (name, fallback) => {
  let parsed;
  try {
    parsed = new URL(process.env[name] || fallback);
  } catch {
    throw new Error(`${name} must be a valid origin URL.`);
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(`${name} must be an HTTPS origin without credentials or a path.`);
  }
};

const validateSecurityEnvironment = () => {
  assertSecret("JWT_SECRET");

  if (process.env.NODE_ENV !== "production") return;

  REQUIRED_PRODUCTION_VALUES.forEach(assertNonEmpty);
  assertSecret("OTP_HASH_SECRET");
  assertSecret("UPLOAD_URL_SIGNING_SECRET");
  assertHttpsOrigin("PUBLIC_APP_ORIGIN", "https://booktheclassindonesia.com");
  assertHttpsOrigin("PUBLIC_API_ORIGIN");
  getPasskeyConfig();
};

module.exports = {
  MIN_SECRET_LENGTH,
  validateSecurityEnvironment,
};
