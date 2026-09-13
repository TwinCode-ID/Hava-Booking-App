const DEFAULT_RP_ID = "booktheclassindonesia.com";
const DEFAULT_RP_NAME = "Hava";
const DEFAULT_ORIGINS = [
  "https://booktheclassindonesia.com",
  "https://www.booktheclassindonesia.com",
];

const normalizeRpId = (value) => {
  const rpId = (value || DEFAULT_RP_ID).trim().toLowerCase();
  const hostnamePattern =
    /^(?=.{1,253}$)(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)*[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/;
  if (
    !rpId ||
    rpId.length > 253 ||
    rpId.includes("://") ||
    rpId.includes("/") ||
    rpId.includes(":") ||
    !hostnamePattern.test(rpId)
  ) {
    throw new Error("WEBAUTHN_RP_ID must be a hostname without a scheme or port.");
  }
  return rpId;
};

const normalizeOrigin = (value, rpId) => {
  let origin;
  try {
    origin = new URL(value.trim());
  } catch {
    throw new Error("WEBAUTHN_ORIGINS contains an invalid URL.");
  }

  if (
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new Error("WebAuthn origins must contain only a scheme and host.");
  }

  const isLocalDevelopmentOrigin =
    rpId === "localhost" &&
    origin.protocol === "http:" &&
    origin.hostname === "localhost";
  if (origin.protocol !== "https:" && !isLocalDevelopmentOrigin) {
    throw new Error("WebAuthn origins must use HTTPS (except localhost).");
  }

  const hostname = origin.hostname.toLowerCase();
  if (hostname !== rpId && !hostname.endsWith(`.${rpId}`)) {
    throw new Error("Every WebAuthn origin must be within WEBAUTHN_RP_ID.");
  }

  return origin.origin;
};

const getPasskeyConfig = () => {
  const rpID = normalizeRpId(process.env.WEBAUTHN_RP_ID);
  const configuredOrigins = process.env.WEBAUTHN_ORIGINS
    ? process.env.WEBAUTHN_ORIGINS.split(",")
    : rpID === DEFAULT_RP_ID
      ? DEFAULT_ORIGINS
      : [`${rpID === "localhost" ? "http" : "https"}://${rpID}`];

  const origins = [
    ...new Set(
      configuredOrigins
        .map((origin) => origin.trim())
        .filter(Boolean)
        .map((origin) => normalizeOrigin(origin, rpID)),
    ),
  ];
  if (origins.length === 0) {
    throw new Error("At least one WebAuthn origin must be configured.");
  }

  const configuredName = process.env.WEBAUTHN_RP_NAME?.trim();
  const rpName = (configuredName || DEFAULT_RP_NAME).slice(0, 80);

  return { origins, rpID, rpName };
};

module.exports = {
  DEFAULT_ORIGINS,
  DEFAULT_RP_ID,
  getPasskeyConfig,
};
