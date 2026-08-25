const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const JWT_ALGORITHM = "HS256";
const JWT_ISSUER = process.env.JWT_ISSUER || "hava-booking-api";
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || "hava-booking-app";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const STEP_UP_AUDIENCE = `${JWT_AUDIENCE}:step-up`;
const STEP_UP_EXPIRES_IN = "5m";
const PASSKEY_MANAGEMENT_SCOPE = "passkey:manage";
const FINANCIAL_READ_SCOPE = "financial:read";
const ADMIN_MANAGEMENT_SCOPE = "admin:manage";
const STEP_UP_SCOPE_PATTERN = /^[a-z][a-z0-9_-]{0,31}:[a-z][a-z0-9_-]{0,31}$/;

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("Authentication service is not configured securely.");
  }
  return secret;
};

const getAuthVersion = (userOrVersion) => {
  const value =
    userOrVersion && typeof userOrVersion === "object"
      ? userOrVersion.authVersion
      : userOrVersion;
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
};

const issueAuthToken = (
  userId,
  {
    authenticationMethod = "unknown",
    authVersion,
    authenticatedAt = Math.floor(Date.now() / 1000),
  } = {},
) => {
  const subject = userId?.toString();
  if (!subject) throw new Error("Cannot issue a token without a user ID.");
  if (!Number.isSafeInteger(authVersion) || authVersion < 0) {
    throw new Error("Cannot issue a token without an authentication version.");
  }
  if (!Number.isSafeInteger(authenticatedAt) || authenticatedAt <= 0) {
    throw new Error("Cannot issue a token with an invalid authentication time.");
  }

  return jwt.sign(
    {
      amr: [String(authenticationMethod).slice(0, 64)],
      auth_time: authenticatedAt,
      id: subject,
      token_use: "access",
      ver: authVersion,
    },
    getJwtSecret(),
    {
      algorithm: JWT_ALGORITHM,
      audience: JWT_AUDIENCE,
      expiresIn: JWT_EXPIRES_IN,
      issuer: JWT_ISSUER,
      jwtid: crypto.randomUUID(),
      subject,
    },
  );
};

const issueReplacementAuthToken = (user, accessClaims) => {
  const userId = user?._id?.toString();
  const claimUserId = accessClaims?.sub || accessClaims?.id;
  const nextAuthVersion = getAuthVersion(user);
  if (
    !userId ||
    claimUserId !== userId ||
    typeof accessClaims?.jti !== "string" ||
    !Number.isSafeInteger(accessClaims?.ver) ||
    nextAuthVersion !== accessClaims.ver + 1
  ) {
    return null;
  }

  const authenticatedAt = Number.isSafeInteger(accessClaims.auth_time)
    ? accessClaims.auth_time
    : accessClaims.iat;
  if (!Number.isSafeInteger(authenticatedAt) || authenticatedAt <= 0) {
    return null;
  }

  const authenticationMethod = Array.isArray(accessClaims.amr)
    ? accessClaims.amr.find(
        (method) => typeof method === "string" && method.length > 0,
      )
    : null;

  return issueAuthToken(userId, {
    authenticationMethod: authenticationMethod || "session",
    authenticatedAt,
    authVersion: nextAuthVersion,
  });
};

const issueStepUpToken = (
  userId,
  scope = PASSKEY_MANAGEMENT_SCOPE,
  accessTokenId,
) => {
  const subject = userId?.toString();
  if (
    !subject ||
    typeof scope !== "string" ||
    !STEP_UP_SCOPE_PATTERN.test(scope) ||
    typeof accessTokenId !== "string" ||
    !accessTokenId
  ) {
    throw new Error("Cannot issue an invalid step-up token.");
  }

  return jwt.sign(
    {
      auth_time: Math.floor(Date.now() / 1000),
      id: subject,
      sid: accessTokenId,
      scope,
      token_use: "step_up",
    },
    getJwtSecret(),
    {
      algorithm: JWT_ALGORITHM,
      audience: STEP_UP_AUDIENCE,
      expiresIn: STEP_UP_EXPIRES_IN,
      issuer: JWT_ISSUER,
      jwtid: crypto.randomUUID(),
      subject,
    },
  );
};

const verifyAuthToken = (token) => {
  const decoded = jwt.verify(token, getJwtSecret(), {
    algorithms: [JWT_ALGORITHM],
    audience: JWT_AUDIENCE,
    clockTolerance: 5,
    issuer: JWT_ISSUER,
    maxAge: JWT_EXPIRES_IN,
  });

  const userId = decoded.sub || decoded.id;
  if (
    typeof userId !== "string" ||
    (decoded.sub && decoded.id && decoded.sub !== decoded.id) ||
    decoded.token_use !== "access" ||
    !Number.isSafeInteger(decoded.ver) ||
    decoded.ver < 0
  ) {
    throw new Error("Invalid token subject.");
  }

  return { ...decoded, id: userId };
};

const verifyStepUpToken = (token, expectedScope = PASSKEY_MANAGEMENT_SCOPE) => {
  const decoded = jwt.verify(token, getJwtSecret(), {
    algorithms: [JWT_ALGORITHM],
    audience: STEP_UP_AUDIENCE,
    clockTolerance: 5,
    issuer: JWT_ISSUER,
    maxAge: STEP_UP_EXPIRES_IN,
  });

  const userId = decoded.sub || decoded.id;
  if (
    typeof userId !== "string" ||
    (decoded.sub && decoded.id && decoded.sub !== decoded.id) ||
    decoded.token_use !== "step_up" ||
    decoded.scope !== expectedScope ||
    typeof decoded.sid !== "string"
  ) {
    throw new Error("Invalid step-up token.");
  }

  return { ...decoded, id: userId };
};

module.exports = {
  ADMIN_MANAGEMENT_SCOPE,
  FINANCIAL_READ_SCOPE,
  getAuthVersion,
  issueStepUpToken,
  issueAuthToken,
  issueReplacementAuthToken,
  PASSKEY_MANAGEMENT_SCOPE,
  verifyStepUpToken,
  verifyAuthToken,
  JWT_ALGORITHM,
  JWT_AUDIENCE,
  JWT_ISSUER,
  STEP_UP_AUDIENCE,
};
