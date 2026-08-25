const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const appleSignin = require("apple-signin-auth");
const { OAuth2Client } = require("google-auth-library");
const mongoose = require("mongoose");
const User = require("../../models/UserData/User");
const PendingRegistration = require("../../models/OTP/PendingRegistration");
const {
  ADMIN_MANAGEMENT_SCOPE,
  FINANCIAL_READ_SCOPE,
  getAuthVersion,
  issueAuthToken,
  issueStepUpToken,
  PASSKEY_MANAGEMENT_SCOPE,
} = require("../../helper/authToken");
const {
  logAuthError,
  normalizeDisplayName,
  normalizeEmail,
  validatePassword,
} = require("../../helper/authSecurity");
const {
  PREAUTH_PURPOSES,
  createPreAuthSession,
} = require("../../helper/preAuthSession");

const DUMMY_PASSWORD_HASH =
  "$2b$10$KM7M3Wkqj0U7g7qj6SI9b.xWitNbOmqOSoE7vkTmlpXlVJ4tGfOyK";
const PENDING_REGISTRATION_TTL_MS = 15 * 60 * 1000;
const ALLOWED_ROLES = new Set(["client", "studioAdmin", "devTeam"]);
const ALLOWED_STEP_UP_SCOPES = new Set([
  ADMIN_MANAGEMENT_SCOPE,
  PASSKEY_MANAGEMENT_SCOPE,
  FINANCIAL_READ_SCOPE,
]);
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const socialLoginResponse = (user, authenticationMethod) => ({
  _id: user._id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  avatar: user.avatar || "",
  token: issueAuthToken(user._id, {
    authenticationMethod,
    authVersion: getAuthVersion(user),
  }),
});

const getRequestedRegistrationRole = (req) => {
  const requestedRole = ALLOWED_ROLES.has(req.body.role)
    ? req.body.role
    : "client";

  if (requestedRole === "client") return "client";
  return req.user?.role === "devTeam" ? requestedRole : null;
};

const findOrCreateSocialUser = async ({
  providerField,
  providerId,
  email,
  fullName,
  avatar,
  canLinkByEmail = true,
}) => {
  let user = await User.findOne({ [providerField]: providerId });
  if (user) {
    if (!user.avatar && avatar) {
      user.avatar = avatar;
      await user.save();
    }
    return user;
  }

  user = await User.findOne({ email });
  if (user) {
    if (!canLinkByEmail) {
      const error = new Error("Existing account requires verification.");
      error.code = "SOCIAL_LINK_REQUIRES_VERIFICATION";
      throw error;
    }
    if (user[providerField] && user[providerField] !== providerId) {
      const error = new Error("Provider is already linked.");
      error.code = "SOCIAL_ACCOUNT_CONFLICT";
      throw error;
    }

    user[providerField] = providerId;
    if (!user.avatar && avatar) user.avatar = avatar;
    await user.save();
    return user;
  }

  return User.create({
    fullName,
    email,
    [providerField]: providerId,
    password: "",
    role: "client",
    phoneNumber: "",
    avatar: avatar || "",
  });
};

exports.loginWithGoogle = async (req, res) => {
  const { idToken } = req.body;
  if (typeof idToken !== "string" || idToken.length > 10000) {
    return res.status(400).json({ message: "Google ID token is required." });
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (error) {
    logAuthError("Google token verification failed", error);
    return res.status(401).json({ message: "Google authentication failed." });
  }

  const googleUserId = payload?.sub;
  const email = normalizeEmail(payload?.email);
  const isEmailVerified =
    payload?.email_verified === true || payload?.email_verified === "true";
  if (!googleUserId || !email || !isEmailVerified) {
    return res.status(401).json({ message: "Google authentication failed." });
  }

  const fullName = normalizeDisplayName(
    payload.name,
    email.split("@")[0],
  );
  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    fullName,
  )}&background=047857&color=fff`;

  // Google is authoritative for Gmail and Workspace addresses. Other Google
  // accounts must first link from an authenticated account to prevent an old
  // third-party email claim from taking over an existing local account.
  const googleIsAuthoritative =
    email.endsWith("@gmail.com") || Boolean(payload.hd);

  try {
    const user = await findOrCreateSocialUser({
      providerField: "googleUserId",
      providerId: googleUserId,
      email,
      fullName,
      avatar: payload.picture || defaultAvatar,
      canLinkByEmail: googleIsAuthoritative,
    });
    return res.status(200).json(socialLoginResponse(user, "google"));
  } catch (error) {
    logAuthError("Google account lookup failed", error);
    if (
      error.code === "SOCIAL_ACCOUNT_CONFLICT" ||
      error.code === "SOCIAL_LINK_REQUIRES_VERIFICATION"
    ) {
      return res.status(409).json({
        message:
          "This email already has an account. Sign in with the existing method before linking Google.",
      });
    }
    return res.status(500).json({ message: "Unable to complete sign-in." });
  }
};

exports.checkUserStatus = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) {
      return res.status(400).json({ message: "A valid email is required." });
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      // Match the password-account response so this endpoint cannot be used
      // as a high-confidence account enumeration oracle.
      return res.status(200).json({
        success: true,
        hasPassword: true,
      });
    }

    const preAuth = user.password
      ? {}
      : await createPreAuthSession({
          userId: user._id,
          email: user.email,
          purpose: PREAUTH_PURPOSES.PASSWORDLESS_LOGIN,
        });

    return res.status(200).json({
      success: true,
      hasPassword: Boolean(user.password),
      ...preAuth,
    });
  } catch (error) {
    logAuthError("Account status lookup failed", error);
    return res.status(500).json({ message: "Unable to check account status." });
  }
};

exports.register = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const fullName = normalizeDisplayName(req.body.fullName, "");
    const role = getRequestedRegistrationRole(req);
    const isStaffCreatingClient =
      role === "client" &&
      (req.user?.role === "studioAdmin" || req.user?.role === "devTeam");
    const isAuthenticatedProvisioning =
      isStaffCreatingClient || req.user?.role === "devTeam";
    const managedClientStudio =
      req.user?.role === "studioAdmin"
        ? req.user.adminStudioLocation
        : req.body.preferredStudioId;

    if (!email || !fullName) {
      return res
        .status(400)
        .json({ message: "A valid name and email are required." });
    }
    if (!role) {
      return res.status(403).json({ message: "Not authorized." });
    }
    if (
      isStaffCreatingClient &&
      !mongoose.isValidObjectId(managedClientStudio)
    ) {
      return res.status(400).json({
        message: "A valid managed studio is required for staff-created clients.",
      });
    }
    if (
      isStaffCreatingClient &&
      Object.hasOwn(req.body, "isStudent") &&
      typeof req.body.isStudent !== "boolean"
    ) {
      return res.status(400).json({
        message: "Student status must be true or false.",
      });
    }

    const password = req.body.password;
    if (isStaffCreatingClient && password !== "") {
      return res.status(400).json({
        message:
          "Staff-created clients must verify their email before creating a password.",
      });
    }
    if (!isStaffCreatingClient) {
      const passwordError = validatePassword(password);
      if (passwordError) {
        return res.status(400).json({ message: passwordError });
      }
    }

    if (await User.exists({ email })) {
      return res
        .status(400)
        .json({ message: "Unable to register with this email." });
    }

    const phoneNumber =
      typeof req.body.phoneNumber === "string"
        ? req.body.phoneNumber.trim().slice(0, 32)
        : "";
    const avatar =
      typeof req.body.avatar === "string"
        ? req.body.avatar.slice(0, 2048)
        : "";

    // Authenticated staff provision operational accounts immediately. Client
    // accounts created this way are deliberately passwordless; the client must
    // prove ownership of the mailbox through the passwordless OTP flow before
    // they can create their own password.
    if (isAuthenticatedProvisioning) {
      const user = await User.create({
        fullName,
        email,
        password: password || "",
        phoneNumber,
        role,
        isStudent: isStaffCreatingClient && req.body.isStudent === true,
        preferredStudioId: isStaffCreatingClient
          ? managedClientStudio
          : undefined,
        avatar,
        adminStudioLocation:
          role === "studioAdmin" && req.user?.role === "devTeam"
            ? req.body.adminStudioLocation
            : undefined,
      });

      return res.status(201).json({
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber || "",
        preferredStudioId: user.preferredStudioId || "",
        isStudent: user.isStudent === true,
        role: user.role,
        adminStudioLocation: user.adminStudioLocation || "",
        avatar: user.avatar || "",
        activationRequired: false,
      });
    }

    // Public registration is only a short-lived candidate at this point. No
    // active User or usable password exists until the bound email OTP wins the
    // one-time activation race.
    const registrationVersion = crypto.randomBytes(32).toString("base64url");
    const passwordHash = await bcrypt.hash(password, 10);
    const pendingUpdate = {
      $set: {
        fullName,
        email,
        passwordHash,
        phoneNumber,
        avatar,
        role: "client",
        registrationVersion,
        expiresAt: new Date(Date.now() + PENDING_REGISTRATION_TTL_MS),
      },
    };
    const pendingOptions = {
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
      upsert: true,
    };

    let pendingRegistration;
    try {
      pendingRegistration = await PendingRegistration.findOneAndUpdate(
        { email },
        pendingUpdate,
        pendingOptions,
      ).select("+registrationVersion");
    } catch (error) {
      // Two first-time requests for the same email can race the unique upsert.
      // Retrying as an update preserves recovery while still leaving only one
      // current registration version.
      if (error?.code !== 11000) throw error;
      pendingRegistration = await PendingRegistration.findOneAndUpdate(
        { email },
        pendingUpdate,
        { ...pendingOptions, upsert: false },
      ).select("+registrationVersion");
    }

    if (!pendingRegistration) {
      throw new Error("Unable to store pending registration.");
    }

    const preAuth = await createPreAuthSession({
      pendingRegistrationId: pendingRegistration._id,
      registrationVersion,
      email,
      purpose: PREAUTH_PURPOSES.REGISTRATION,
    });

    return res.status(202).json({
      fullName,
      email,
      phoneNumber,
      role: "client",
      avatar,
      activationRequired: true,
      ...preAuth,
    });

  } catch (error) {
    logAuthError("Registration failed", error);
    if (error?.code === 11000) {
      return res
        .status(400)
        .json({ message: "Unable to register with this email." });
    }
    return res.status(500).json({ message: "Registration failed." });
  }
};

exports.login = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;
    if (!email || typeof password !== "string" || password.length > 128) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const user = await User.findOne({ email }).select("+password");
    const passwordMatches = user?.password
      ? await user.matchPassword(password)
      : await bcrypt.compare(password, DUMMY_PASSWORD_HASH);

    if (!user || !passwordMatches) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // Password verification issues a short-lived, one-time grant. An OTP can
    // only become a session when it is bound to this exact grant.
    const preAuth = await createPreAuthSession({
      userId: user._id,
      email: user.email,
      purpose: PREAUTH_PURPOSES.PASSWORD_LOGIN,
    });
    return res.status(200).json({ success: true, ...preAuth });
  } catch (error) {
    logAuthError("Password verification failed", error);
    return res.status(500).json({ message: "Unable to sign in." });
  }
};

const loginWithAppleAudience = async (req, res, audience) => {
  const { identityToken } = req.body;
  if (typeof identityToken !== "string" || identityToken.length > 10000) {
    return res.status(400).json({ message: "Apple identity token is required." });
  }
  if (!audience) {
    return res.status(503).json({ message: "Apple sign-in is unavailable." });
  }

  let payload;
  try {
    payload = await appleSignin.verifyIdToken(identityToken, { audience });
  } catch (error) {
    logAuthError("Apple token verification failed", error);
    return res.status(401).json({ message: "Apple authentication failed." });
  }

  const appleUserId = payload?.sub;
  const email = normalizeEmail(payload?.email);
  const isEmailVerified =
    payload?.email_verified === true || payload?.email_verified === "true";
  if (!appleUserId) {
    return res.status(401).json({ message: "Apple authentication failed." });
  }

  try {
    const existingByAppleId = await User.findOne({ appleUserId });
    if (existingByAppleId) {
      return res
        .status(200)
        .json(socialLoginResponse(existingByAppleId, "apple"));
    }

    // Apple may omit email after the first authorization. It is only needed
    // when linking or creating an account; returning a generic failure avoids
    // trusting a client-supplied email.
    if (!email || !isEmailVerified) {
      return res.status(401).json({ message: "Apple authentication failed." });
    }

    const fullName = normalizeDisplayName(
      req.body.fullName,
      email.split("@")[0],
    );
    const user = await findOrCreateSocialUser({
      providerField: "appleUserId",
      providerId: appleUserId,
      email,
      fullName,
      avatar: "",
    });
    return res.status(200).json(socialLoginResponse(user, "apple"));
  } catch (error) {
    logAuthError("Apple account lookup failed", error);
    if (error.code === "SOCIAL_ACCOUNT_CONFLICT") {
      return res.status(409).json({
        message:
          "This email already has a different Apple account linked. Sign in using an existing method.",
      });
    }
    return res.status(500).json({ message: "Unable to complete sign-in." });
  }
};

exports.loginWithApple = (req, res) =>
  loginWithAppleAudience(req, res, process.env.APPLE_CLIENT_ID);

exports.loginWithAppleWeb = (req, res) =>
  loginWithAppleAudience(req, res, process.env.APPLE_CLIENT_ID_WEB);

exports.checkAuth = async (req, res) => {
  try {
    const { password } = req.body || {};
    const requestedScope = req.body?.scope ?? PASSKEY_MANAGEMENT_SCOPE;

    if (
      typeof requestedScope !== "string" ||
      !ALLOWED_STEP_UP_SCOPES.has(requestedScope)
    ) {
      return res.status(400).json({
        success: false,
        code: "INVALID_STEP_UP_SCOPE",
        message: "The requested verification scope is not supported.",
      });
    }
    if (typeof req.auth?.jti !== "string" || !req.auth.jti) {
      return res.status(401).json({
        success: false,
        code: "INVALID_ACCESS_SESSION",
        message: "Sign in again before verifying your identity.",
      });
    }

    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return res.status(401).json({ success: false, message: "Not authorized." });
    }
    if (!user.password) {
      return res.status(409).json({
        success: false,
        code: "PASSWORD_NOT_SET",
        hasPassword: false,
        message: "Create a password or sign in again before continuing.",
      });
    }
    if (typeof password !== "string" || password.length === 0) {
      return res.status(400).json({
        success: false,
        code: "PASSWORD_REQUIRED",
        message: "Password is required.",
      });
    }
    if (!(await user.matchPassword(password))) {
      return res.status(401).json({
        success: false,
        code: "INVALID_PASSWORD",
        message: "Incorrect password.",
      });
    }

    return res.status(200).json({
      success: true,
      hasPassword: true,
      stepUpToken: issueStepUpToken(
        user._id,
        requestedScope,
        req.auth.jti,
      ),
      stepUpExpiresIn: 300,
      stepUpScope: requestedScope,
    });
  } catch (error) {
    logAuthError("Sensitive-data password verification failed", error);
    return res.status(500).json({ message: "Unable to verify password." });
  }
};

exports.getMe = async (req, res) => {
  res.set("Cache-Control", "no-store");
  return res.json(req.user);
};
