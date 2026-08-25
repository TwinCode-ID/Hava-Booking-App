const net = require("node:net");

const PRODUCTION_ALLOWED_ORIGINS = [
  "https://bookingservice.my.id",
  "https://www.bookingservice.my.id",
];
const DEVELOPMENT_ALLOWED_ORIGINS = [
  ...PRODUCTION_ALLOWED_ORIGINS,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];
const TRUST_PROXY_PRESETS = new Set([
  "linklocal",
  "loopback",
  "uniquelocal",
]);
const isProductionEnvironment = (nodeEnv) =>
  typeof nodeEnv === "string" &&
  nodeEnv.trim().toLowerCase() === "production";

const getDefaultAllowedOrigins = (nodeEnv = process.env.NODE_ENV) =>
  isProductionEnvironment(nodeEnv)
    ? [...PRODUCTION_ALLOWED_ORIGINS]
    : [...DEVELOPMENT_ALLOWED_ORIGINS];

const getPublicApiOrigin = (
  configured = process.env.PUBLIC_API_ORIGIN,
  nodeEnv = process.env.NODE_ENV,
) => {
  if (typeof configured === "string" && configured.trim()) {
    return normalizeConfiguredOrigin(configured.trim(), nodeEnv);
  }
  if (isProductionEnvironment(nodeEnv)) {
    throw new Error("PUBLIC_API_ORIGIN must be configured in production.");
  }

  const port = process.env.PORT || "5000";
  if (!/^\d{2,5}$/.test(port) || Number(port) > 65535) {
    throw new Error("PORT must be a valid TCP port.");
  }
  return `http://localhost:${port}`;
};

const normalizeConfiguredOrigin = (value, nodeEnv = process.env.NODE_ENV) => {
  if (typeof value !== "string" || value.length === 0 || value === "null") {
    throw new Error("CORS origins must be explicit HTTP(S) origins.");
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid CORS origin: ${value}`);
  }

  if (
    (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(`Invalid CORS origin: ${value}`);
  }
  if (isProductionEnvironment(nodeEnv) && parsed.protocol !== "https:") {
    throw new Error("Production CORS origins must use HTTPS.");
  }

  return parsed.origin;
};

const parseAllowedOrigins = (
  configured = process.env.CORS_ORIGINS,
  nodeEnv = process.env.NODE_ENV,
) => {
  const candidates =
    typeof configured === "string" && configured.trim()
      ? configured.split(",").map((origin) => origin.trim())
      : getDefaultAllowedOrigins(nodeEnv);

  if (candidates.length === 0 || candidates.some((origin) => !origin)) {
    throw new Error("CORS_ORIGINS contains an empty origin.");
  }

  return new Set(
    candidates.map((origin) => normalizeConfiguredOrigin(origin, nodeEnv)),
  );
};

const allowedOrigins = parseAllowedOrigins();

// Requests without an Origin header include native apps and server-to-server
// clients. They still authenticate with bearer credentials at the route layer.
const isOriginAllowed = (origin) => !origin || allowedOrigins.has(origin);

const corsOrigin = (origin, callback) => {
  if (isOriginAllowed(origin)) return callback(null, true);
  const error = new Error("Origin is not allowed.");
  error.code = "CORS_NOT_ALLOWED";
  return callback(error);
};

const corsOptions = {
  allowedHeaders: ["Content-Type", "Authorization", "X-Step-Up-Token"],
  credentials: false,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  origin: corsOrigin,
};

const isValidProxyAddress = (entry) => {
  const slashIndex = entry.lastIndexOf("/");
  const address = slashIndex === -1 ? entry : entry.slice(0, slashIndex);
  const family = net.isIP(address);
  if (!family) return false;
  if (slashIndex === -1) return true;

  const prefix = entry.slice(slashIndex + 1);
  if (!/^\d+$/.test(prefix)) return false;
  const prefixLength = Number(prefix);
  return prefixLength >= 1 && prefixLength <= (family === 4 ? 32 : 128);
};

const getTrustProxySetting = (value = process.env.TRUST_PROXY) => {
  const configured = typeof value === "string" ? value.trim() : "";
  if (
    !configured ||
    configured.toLowerCase() === "false" ||
    configured === "0"
  ) {
    return false;
  }
  if (/^\d+$/.test(configured)) {
    const hopCount = Number(configured);
    if (!Number.isSafeInteger(hopCount) || hopCount < 1) {
      throw new Error("TRUST_PROXY hop count is invalid.");
    }
    return hopCount;
  }

  const entries = configured.split(",").map((entry) => entry.trim());
  if (
    entries.some(
      (entry) =>
        !entry ||
        (!TRUST_PROXY_PRESETS.has(entry.toLowerCase()) &&
          !isValidProxyAddress(entry)),
    )
  ) {
    throw new Error(
      "TRUST_PROXY must be a hop count or an explicit IP, CIDR, or safe subnet preset.",
    );
  }

  return entries.map((entry) =>
    TRUST_PROXY_PRESETS.has(entry.toLowerCase())
      ? entry.toLowerCase()
      : entry,
  );
};

module.exports = {
  DEVELOPMENT_ALLOWED_ORIGINS,
  PRODUCTION_ALLOWED_ORIGINS,
  allowedOrigins,
  corsOptions,
  corsOrigin,
  getDefaultAllowedOrigins,
  getPublicApiOrigin,
  getTrustProxySetting,
  isOriginAllowed,
  parseAllowedOrigins,
};
