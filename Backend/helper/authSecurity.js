const crypto = require("crypto");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

const normalizeEmail = (email) => {
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  if (
    normalized.length === 0 ||
    normalized.length > 254 ||
    !EMAIL_PATTERN.test(normalized)
  ) {
    return null;
  }
  return normalized;
};

const normalizeDisplayName = (name, fallback = "User") => {
  if (name && typeof name === "object") {
    name = [name.givenName, name.familyName].filter(Boolean).join(" ");
  }
  if (typeof name !== "string") return fallback;

  const normalized = name
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return normalized || fallback;
};

const validatePassword = (password) => {
  if (typeof password !== "string") return "Password is required.";
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be no more than ${PASSWORD_MAX_LENGTH} characters long.`;
  }
  return null;
};

const generateOtp = () => crypto.randomInt(100000, 1000000).toString();

const hashOtp = (email, otp) => {
  const secret = process.env.OTP_HASH_SECRET || process.env.JWT_SECRET;
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("OTP service is not configured securely.");
  }

  return crypto
    .createHmac("sha256", secret)
    .update(`hava-otp:v1:${email}:${otp}`)
    .digest("hex");
};

const logAuthError = (context, error) => {
  const details = {
    code: typeof error?.code === "string" ? error.code : undefined,
    name: typeof error?.name === "string" ? error.name : "Error",
  };
  if (process.env.NODE_ENV !== "production") {
    details.message = error?.message;
  }
  console.error(`[auth] ${context}`, details);
};

module.exports = {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  generateOtp,
  hashOtp,
  logAuthError,
  normalizeDisplayName,
  normalizeEmail,
  validatePassword,
};
