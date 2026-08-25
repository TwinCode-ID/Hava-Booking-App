const User = require("../models/UserData/User");
const { toAuthenticatedUser } = require("../helper/userResponse");
const {
  getAuthVersion,
  PASSKEY_MANAGEMENT_SCOPE,
  verifyAuthToken,
  verifyStepUpToken,
} = require("../helper/authToken");

const RECENT_AUTH_MAX_AGE_SECONDS = 10 * 60;

class SessionRevokedError extends Error {
  constructor() {
    super("The authenticated session has been revoked.");
    this.code = "SESSION_REVOKED";
    this.name = "SessionRevokedError";
  }
}

const getBearerToken = (authorization) => {
  if (typeof authorization !== "string" || authorization.length > 4096) {
    return null;
  }

  const [scheme, token, extra] = authorization.trim().split(/\s+/);
  if (extra || !/^Bearer$/i.test(scheme) || !token) return null;
  return token;
};

const getAuthenticatedUser = async (token) => {
  const decoded = verifyAuthToken(token);
  const user = await User.findById(decoded.id)
    .select("+password +authVersion")
    .lean();
  if (!user) return null;
  if (decoded.ver !== getAuthVersion(user)) {
    throw new SessionRevokedError();
  }
  return { decoded, user: toAuthenticatedUser(user) };
};

const getAuthenticationErrorCode = (error) => {
  if (error?.name === "TokenExpiredError") return "TOKEN_EXPIRED";
  if (error?.code === "SESSION_REVOKED") return "SESSION_REVOKED";
  return "INVALID_TOKEN";
};

const protect = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .json({ code: "AUTH_REQUIRED", message: "Not authorized" });
  }

  try {
    const token = getBearerToken(authorization);
    if (!token) {
      return res
        .status(401)
        .json({ code: "INVALID_TOKEN", message: "Not authorized" });
    }
    const authentication = await getAuthenticatedUser(token);
    if (!authentication) {
      return res
        .status(401)
        .json({ code: "INVALID_TOKEN", message: "Not authorized" });
    }

    req.user = authentication.user;
    req.auth = authentication.decoded;
    res.set("Cache-Control", "no-store");
    return next();
  } catch (error) {
    const code = getAuthenticationErrorCode(error);
    return res.status(401).json({ code, message: "Not authorized" });
  }
};

const optionalProtect = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) return next();

  try {
    const token = getBearerToken(authorization);
    if (!token) {
      return res
        .status(401)
        .json({ code: "INVALID_TOKEN", message: "Not authorized" });
    }

    const authentication = await getAuthenticatedUser(token);
    if (!authentication) {
      return res
        .status(401)
        .json({ code: "INVALID_TOKEN", message: "Not authorized" });
    }

    req.user = authentication.user;
    req.auth = authentication.decoded;
    return next();
  } catch (error) {
    const code = getAuthenticationErrorCode(error);
    return res.status(401).json({ code, message: "Not authorized" });
  }
};

const hasValidStepUp = (req, scope) => {
  const stepUpToken = req.headers?.["x-step-up-token"];
  if (typeof stepUpToken !== "string" || stepUpToken.length > 4096) {
    return false;
  }

  try {
    const decoded = verifyStepUpToken(stepUpToken, scope);
    return (
      decoded.id === req.user?._id?.toString() &&
      decoded.sid === req.auth?.jti
    );
  } catch {
    return false;
  }
};

const requireStepUp = (
  scope,
  message = "Please verify your identity again before continuing.",
) => {
  if (typeof scope !== "string" || !scope) {
    throw new TypeError("A step-up scope is required.");
  }

  return function requireScopedStepUp(req, res, next) {
    if (hasValidStepUp(req, scope)) return next();

    return res.status(403).json({
      code: "STEP_UP_REQUIRED",
      message,
      scope,
    });
  };
};

const requireRecentAuth = (req, res, next) => {
  const now = Math.floor(Date.now() / 1000);
  const authenticatedAt = req.auth?.auth_time ?? req.auth?.iat;
  const accessTokenIsRecent =
    Number.isInteger(authenticatedAt) &&
    authenticatedAt <= now + 5 &&
    now - authenticatedAt <= RECENT_AUTH_MAX_AGE_SECONDS;

  if (accessTokenIsRecent) return next();

  if (hasValidStepUp(req, PASSKEY_MANAGEMENT_SCOPE)) return next();

  return res.status(403).json({
    code: "RECENT_AUTH_REQUIRED",
    message: "Please verify your identity again before managing passkeys.",
  });
};

const studioAdmin = async (req, res, next) => {
  if (
    !req.user ||
    (req.user.role !== "studioAdmin" && req.user.role !== "devTeam")
  ) {
    return res.status(403).json({ message: "Unauthorized user" });
  }
  next();
};

const devTeam = async (req, res, next) => {
  if (!req.user || req.user.role !== "devTeam") {
    return res.status(403).json({ message: "Unauthorized user" });
  }
  next();
};

module.exports = {
  devTeam,
  getBearerToken,
  getAuthenticatedUser,
  hasValidStepUp,
  optionalProtect,
  protect,
  requireRecentAuth,
  requireStepUp,
  SessionRevokedError,
  studioAdmin,
};
