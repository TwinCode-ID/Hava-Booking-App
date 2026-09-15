const crypto = require("crypto");
const PreAuthSession = require("../models/OTP/PreAuthSession");
const { PHONE_E164_PATTERN } = require("./phoneNumber");

const PREAUTH_PURPOSES = Object.freeze({
  PASSWORD_LOGIN: "password_login",
  PASSWORDLESS_LOGIN: "passwordless_login",
  PHONE_PASSWORD_LOGIN: "phone_password_login",
  PHONE_PASSWORD_SETUP: "phone_password_setup",
  REGISTRATION: "registration",
  // Attaching a mailbox to an account that has none. The address is proved by
  // a code sent to it before it is ever stored, because an unverified address
  // would let one account claim another person's mailbox — and social sign-in
  // links accounts by email.
  EMAIL_CLAIM: "email_claim",
});

const PURPOSE_VALUES = new Set(Object.values(PREAUTH_PURPOSES));
// Phone flows are addressed by number rather than mailbox, so the caller never
// has to know the account's email to continue a flow it started.
const PHONE_PURPOSE_VALUES = new Set([
  PREAUTH_PURPOSES.PHONE_PASSWORD_LOGIN,
  PREAUTH_PURPOSES.PHONE_PASSWORD_SETUP,
]);
const PREAUTH_SESSION_TTL_MS = 10 * 60 * 1000;
const PREAUTH_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const hashPreAuthToken = (token) => {
  if (typeof token !== "string" || !PREAUTH_TOKEN_PATTERN.test(token)) {
    return null;
  }
  return crypto.createHash("sha256").update(token).digest("hex");
};

const isPurposeAllowed = (purpose) => PURPOSE_VALUES.has(purpose);

const isPhonePurpose = (purpose) => PHONE_PURPOSE_VALUES.has(purpose);

// A phone purpose is only addressable by a canonical number, and a mailbox
// purpose must never carry one, so a flow can never be continued through the
// identifier it was not issued for.
const hasValidIdentifier = ({ phoneNumberE164, purpose }) =>
  isPhonePurpose(purpose)
    ? PHONE_E164_PATTERN.test(phoneNumberE164 || "")
    : phoneNumberE164 == null;

// A phone flow is addressed by its number and never needs the mailbox, and a
// front-desk account may not have one, so only mailbox flows require an email.
const hasValidEmail = ({ email, purpose }) =>
  typeof email === "string" || (isPhonePurpose(purpose) && email == null);

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
  phoneNumberE164,
  purpose,
}) => {
  if (
    !hasValidEmail({ email, purpose }) ||
    !isPurposeAllowed(purpose) ||
    !hasValidIdentifier({ phoneNumberE164, purpose }) ||
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
    email: email || undefined,
    phoneNumberE164,
    purpose,
    expiresAt,
  });

  return {
    preAuthToken,
    purpose,
    expiresIn: Math.floor(PREAUTH_SESSION_TTL_MS / 1000),
  };
};

// Phone flows are looked up by number and mailbox flows by email. Binding the
// lookup to the identifier the session was issued for keeps one flow from being
// redeemed through the other.
const getIdentifierFilter = ({ email, phoneNumberE164, purpose }) => {
  if (isPhonePurpose(purpose)) {
    return PHONE_E164_PATTERN.test(phoneNumberE164 || "")
      ? { phoneNumberE164 }
      : null;
  }
  return typeof email === "string" && email ? { email } : null;
};

const findActivePreAuthSession = async ({
  token,
  email,
  phoneNumberE164,
  purpose,
}) => {
  const tokenHash = hashPreAuthToken(token);
  const identifier = isPurposeAllowed(purpose)
    ? getIdentifierFilter({ email, phoneNumberE164, purpose })
    : null;
  if (!tokenHash || !identifier) {
    return null;
  }

  const session = await PreAuthSession.findOne({
    tokenHash,
    ...identifier,
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
  phoneNumberE164,
  purpose,
}) => {
  if (
    !sessionId ||
    !/^[a-f\d]{64}$/i.test(tokenHash || "") ||
    !hasValidEmail({ email, purpose }) ||
    !isPurposeAllowed(purpose) ||
    !hasValidIdentifier({ phoneNumberE164, purpose }) ||
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
    // A session issued for an account with no mailbox must only be redeemable
    // by one that still has none, so the absence is matched explicitly rather
    // than dropped from the filter.
    ...(email ? { email } : { email: { $exists: false } }),
    ...(isPhonePurpose(purpose) ? { phoneNumberE164 } : {}),
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
  isPhonePurpose,
  isPurposeAllowed,
};
