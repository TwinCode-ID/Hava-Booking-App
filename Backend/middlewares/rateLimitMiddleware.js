const net = require("node:net");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const { normalizeEmail } = require("../helper/authSecurity");
const { normalizePhoneNumber } = require("../helper/phoneNumber");
const MongoRateLimitStore = require("../config/mongoRateLimitStore");

const CHAT_MESSAGE_LIMIT = 30;
const CHAT_MESSAGE_WINDOW_MS = 60 * 1000;

const ipv6SafeIpKey = (req) => {
  if (typeof req.ip !== "string" || net.isIP(req.ip) === 0) {
    throw new Error("Request IP is unavailable for rate limiting.");
  }
  return `ip:${ipKeyGenerator(req.ip)}`;
};

const accountOrIpKey = (req) => {
  const email = normalizeEmail(req.body?.email);
  if (email) return `email:${email}`;

  // Phone sign-in identifies the account by number, so the per-account budget
  // has to follow the number rather than falling back to a shared IP bucket.
  const phoneNumber = normalizePhoneNumber(req.body?.phoneNumber);
  return phoneNumber ? `phone:${phoneNumber}` : ipv6SafeIpKey(req);
};

const userOrIpKey = (req) => {
  const userId = req.user?._id?.toString();
  return userId ? `user:${userId}` : ipv6SafeIpKey(req);
};

const rateLimitHandler = (_req, res) =>
  res.status(429).json({
    code: "RATE_LIMITED",
    message: "Too many requests. Please try again later.",
  });

const baseOptions = {
  handler: rateLimitHandler,
  legacyHeaders: false,
  passOnStoreError: false,
  standardHeaders: true,
};

const generalApiLimiter = rateLimit({
  ...baseOptions,
  limit: 1000,
  store: new MongoRateLimitStore("general"),
  windowMs: 15 * 60 * 1000,
});

const authIpLimiter = rateLimit({
  ...baseOptions,
  limit: 40,
  store: new MongoRateLimitStore("auth-ip"),
  windowMs: 15 * 60 * 1000,
});

const authAccountLimiter = rateLimit({
  ...baseOptions,
  keyGenerator: accountOrIpKey,
  limit: 15,
  store: new MongoRateLimitStore("auth-account"),
  windowMs: 15 * 60 * 1000,
});

const otpRequestLimiter = rateLimit({
  ...baseOptions,
  limit: 10,
  store: new MongoRateLimitStore("otp-request"),
  windowMs: 60 * 60 * 1000,
});

const otpVerifyLimiter = rateLimit({
  ...baseOptions,
  keyGenerator: accountOrIpKey,
  limit: 10,
  store: new MongoRateLimitStore("otp-verify"),
  windowMs: 15 * 60 * 1000,
});

const sensitiveActionLimiter = rateLimit({
  ...baseOptions,
  keyGenerator: userOrIpKey,
  limit: 20,
  store: new MongoRateLimitStore("sensitive"),
  windowMs: 15 * 60 * 1000,
});

const chatMessageLimiter = rateLimit({
  ...baseOptions,
  keyGenerator: userOrIpKey,
  limit: CHAT_MESSAGE_LIMIT,
  store: new MongoRateLimitStore("chat-message"),
  windowMs: CHAT_MESSAGE_WINDOW_MS,
});

module.exports = {
  accountOrIpKey,
  authAccountLimiter,
  authIpLimiter,
  CHAT_MESSAGE_LIMIT,
  CHAT_MESSAGE_WINDOW_MS,
  chatMessageLimiter,
  generalApiLimiter,
  ipv6SafeIpKey,
  otpRequestLimiter,
  otpVerifyLimiter,
  sensitiveActionLimiter,
  userOrIpKey,
};
