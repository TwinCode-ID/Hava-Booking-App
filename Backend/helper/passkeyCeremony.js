const crypto = require("crypto");
const PasskeyCeremony = require("../models/UserData/PasskeyCeremony");

const PASSKEY_CEREMONY_TTL_MS = 5 * 60 * 1000;
const CEREMONY_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const CEREMONY_TYPES = new Set(["authentication", "registration"]);

const hashCeremonyValue = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

const getSessionBinding = (userId, jwtId) => {
  const normalizedUserId = userId?.toString();
  if (!normalizedUserId || typeof jwtId !== "string" || !jwtId) return null;
  return `${normalizedUserId}:${jwtId}`;
};

const createPasskeyCeremony = async ({
  challenge,
  type,
  userId,
  sessionBinding,
}) => {
  if (
    typeof challenge !== "string" ||
    challenge.length === 0 ||
    challenge.length > 1024 ||
    !CEREMONY_TYPES.has(type)
  ) {
    throw new Error("Cannot create an invalid passkey ceremony.");
  }
  if (type === "registration" && (!userId || !sessionBinding)) {
    throw new Error("Registration ceremonies require a session binding.");
  }

  const ceremonyId = crypto.randomBytes(32).toString("base64url");
  await PasskeyCeremony.create({
    ceremonyIdHash: hashCeremonyValue(ceremonyId),
    challenge,
    type,
    userId: userId?.toString(),
    sessionBindingHash: sessionBinding
      ? hashCeremonyValue(sessionBinding)
      : undefined,
    expiresAt: new Date(Date.now() + PASSKEY_CEREMONY_TTL_MS),
  });

  return ceremonyId;
};

const consumePasskeyCeremony = async ({
  ceremonyId,
  type,
  userId,
  sessionBinding,
}) => {
  if (
    typeof ceremonyId !== "string" ||
    !CEREMONY_ID_PATTERN.test(ceremonyId) ||
    !CEREMONY_TYPES.has(type)
  ) {
    return null;
  }
  if (type === "registration" && (!userId || !sessionBinding)) return null;

  const filter = {
    ceremonyIdHash: hashCeremonyValue(ceremonyId),
    expiresAt: { $gt: new Date() },
    type,
  };
  if (userId !== undefined) filter.userId = userId?.toString();
  if (sessionBinding !== undefined) {
    filter.sessionBindingHash = sessionBinding
      ? hashCeremonyValue(sessionBinding)
      : null;
  }

  return PasskeyCeremony.findOneAndDelete(filter).select(
    "+challenge +userId +sessionBindingHash",
  );
};

module.exports = {
  CEREMONY_ID_PATTERN,
  PASSKEY_CEREMONY_TTL_MS,
  consumePasskeyCeremony,
  createPasskeyCeremony,
  getSessionBinding,
  hashCeremonyValue,
};
