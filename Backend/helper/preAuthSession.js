const crypto = require("crypto");
const PreAuthSession = require("../models/OTP/PreAuthSession");

const PREAUTH_PURPOSES = Object.freeze({
  PASSWORD_LOGIN: "password_login",
  PASSWORDLESS_LOGIN: "passwordless_login",
  REGISTRATION: "registration",
});

const PURPOSE_VALUES = new Set(Object.values(PREAUTH_PURPOSES));
const PREAUTH_SESSION_TTL_MS = 10 * 60 * 1000;
const PREAUTH_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const hashPreAuthToken = (token) => {
  if (typeof token !== "string" || !PREAUTH_TOKEN_PATTERN.test(token)) {
    return null;
  }
  return crypto.createHash("sha256").update(token).digest("hex");
};

const isPurposeAllowed = (purpose) => PURPOSE_VALUES.has(purpose);

const hasValidSubject = ({
  userId,
  pendingRegistrationId,
  registrationVersion,
  purpose,
}) => {
  if (purpose === PREAUTH_PURPOSES.REGISTRATION) {
    return Boolean(
      !userId &&
        pendingRegistrationId &&
        typeof registrationVersion === "string" &&
        PREAUTH_TOKEN_PATTERN.test(registrationVersion),
    );
  }

  return Boolean(userId && !pendingRegistrationId && !registrationVersion);
};

const createPreAuthSession = async ({
  userId,
  pendingRegistrationId,
  registrationVersion,
  email,
  purpose,
}) => {
  if (
    typeof email !== "string" ||
    !isPurposeAllowed(purpose) ||
    !hasValidSubject({
      userId,
      pendingRegistrationId,
      registrationVersion,
      purpose,
    })
  ) {
    throw new Error("Cannot create an invalid pre-authentication session.");
  }

  const preAuthToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashPreAuthToken(preAuthToken);
  const expiresAt = new Date(Date.now() + PREAUTH_SESSION_TTL_MS);

  await PreAuthSession.create({
    tokenHash,
    userId,
    pendingRegistrationId,
    registrationVersion,
    email,
    purpose,
    expiresAt,
  });

  return {
    preAuthToken,
    purpose,
    expiresIn: Math.floor(PREAUTH_SESSION_TTL_MS / 1000),
  };
};

const findActivePreAuthSession = async ({ token, email, purpose }) => {
  const tokenHash = hashPreAuthToken(token);
  if (!tokenHash || typeof email !== "string" || !isPurposeAllowed(purpose)) {
    return null;
  }

  const session = await PreAuthSession.findOne({
    tokenHash,
    email,
    purpose,
    expiresAt: { $gt: new Date() },
  }).select("+tokenHash +registrationVersion");

  return session ? { session, tokenHash } : null;
};

const consumePreAuthSession = async ({
  sessionId,
  tokenHash,
  userId,
  pendingRegistrationId,
  registrationVersion,
  email,
  purpose,
}) => {
  if (
    !sessionId ||
    !/^[a-f\d]{64}$/i.test(tokenHash || "") ||
    typeof email !== "string" ||
    !isPurposeAllowed(purpose) ||
    !hasValidSubject({
      userId,
      pendingRegistrationId,
      registrationVersion,
      purpose,
    })
  ) {
    return null;
  }

  return PreAuthSession.findOneAndDelete({
    _id: sessionId,
    tokenHash,
    userId,
    pendingRegistrationId,
    registrationVersion,
    email,
    purpose,
    expiresAt: { $gt: new Date() },
  });
};

module.exports = {
  PREAUTH_PURPOSES,
  PREAUTH_SESSION_TTL_MS,
  consumePreAuthSession,
  createPreAuthSession,
  findActivePreAuthSession,
  hashPreAuthToken,
  isPurposeAllowed,
};
