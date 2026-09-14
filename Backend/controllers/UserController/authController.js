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
  consumePreAuthSession,
  createPreAuthSession,
  findActivePreAuthSession,
} = require("../../helper/preAuthSession");
const { normalizePhoneNumber } = require("../../helper/phoneNumber");
const { isSmsOtpEnabled } = require("../../helper/sendSms");

const DUMMY_PASSWORD_HASH =
  "$2b$10$KM7M3Wkqj0U7g7qj6SI9b.xWitNbOmqOSoE7vkTmlpXlVJ4tGfOyK";
const INVALID_PHONE_CREDENTIALS = "Invalid phone number or password.";
const PENDING_REGISTRATION_TTL_MS = 15 * 60 * 1000;
// A phone-only candidate waits for a person, not for a code, so it is kept
// long enough for the member to walk into the studio and be approved there.
const STAFF_APPROVAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;
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
  // Phone-only accounts have no email at all. Sending "" rather than dropping
  // the key keeps the response shape identical for every sign-in method.
  email: user.email || "",
  role: user.role,
  avatar: user.avatar || "",
  token: issueAuthToken(user._id, {
    authenticationMethod,
    authVersion: getAuthVersion(user),
  }),
});

const phoneLoginResponse = (user, authenticationMethod) => ({
  ...socialLoginResponse(user, authenticationMethod),
  phoneNumber: user.phoneNumber || "",
});

// A number shared by more than one account identifies no single member, so it
// must never authenticate one of them.
const findUserByPhoneNumber = async (phoneNumberE164, selection) => {
  if (!phoneNumberE164) return null;

  const query = User.find({ phoneNumberE164 }).limit(2);
  const users = await (selection ? query.select(selection) : query);
  return Array.isArray(users) && users.length === 1 ? users[0] : null;
};

// Creating the first password from a phone number alone is only ever offered
// for accounts a member cannot already sign in to. Anything with a password, a
// linked social account, or a passkey must be claimed through that method.
const canClaimAccountByPhone = (user) =>
  Boolean(
    user &&
      user.role === "client" &&
      !user.password &&
      !user.googleUserId &&
      !user.appleUserId &&
      !(Array.isArray(user.authenticators) && user.authenticators.length > 0),
  );

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

// Mirrors the password-account answer so a caller cannot tell an unknown
// number from one that simply cannot be claimed this way.
const unclaimablePhoneStatus = {
  success: true,
  hasPassword: true,
  identifier: "phone",
};

const checkPhoneUserStatus = async (req, res) => {
  const phoneNumberE164 = normalizePhoneNumber(req.body.phoneNumber);
  if (!phoneNumberE164) {
    return res.status(400).json({
      message: "Enter a valid phone number including its country code.",
    });
  }

  const user = await findUserByPhoneNumber(
    phoneNumberE164,
    "+password +authenticators",
  );
  if (!user) {
    return res.status(200).json(unclaimablePhoneStatus);
  }
  if (user.password) {
    return res.status(200).json({
      success: true,
      hasPassword: true,
      identifier: "phone",
      otpRequired: isSmsOtpEnabled(),
    });
  }
  if (!canClaimAccountByPhone(user)) {
    return res.status(200).json(unclaimablePhoneStatus);
  }

  // The grant is what lets the member create a first password, or — once SMS
  // exists — what the verification code is bound to.
  const preAuth = await createPreAuthSession({
    userId: user._id,
    email: user.email,
    phoneNumberE164,
    purpose: PREAUTH_PURPOSES.PHONE_PASSWORD_SETUP,
  });

  return res.status(200).json({
    success: true,
    hasPassword: false,
    identifier: "phone",
    otpRequired: isSmsOtpEnabled(),
    ...preAuth,
  });
};

exports.checkUserStatus = async (req, res) => {
  try {
    if (typeof req.body.phoneNumber === "string" && req.body.phoneNumber.trim()) {
      return await checkPhoneUserStatus(req, res);
    }

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

    const phoneNumber =
      typeof req.body.phoneNumber === "string"
        ? req.body.phoneNumber.trim().slice(0, 32)
        : "";
    const phoneNumberE164 = normalizePhoneNumber(phoneNumber);

    if (!fullName) {
      return res.status(400).json({ message: "A valid name is required." });
    }
    // A number that was typed but cannot be parsed is a mistake worth naming,
    // so it is reported before the broader "no identifier at all" case.
    if (phoneNumber && !phoneNumberE164) {
      return res
        .status(400)
        .json({ message: "Enter a valid phone number, including its country." });
    }
    // Either identifier alone is enough to register. Members joining at the
    // front desk frequently have only a phone number.
    if (!email && !phoneNumberE164) {
      return res
        .status(400)
        .json({ message: "An email address or a phone number is required." });
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
          "Staff-created clients must verify their own contact details before creating a password.",
      });
    }
    if (!isStaffCreatingClient) {
      const passwordError = validatePassword(password);
      if (passwordError) {
        return res.status(400).json({ message: passwordError });
      }
    }

    if (email && (await User.exists({ email }))) {
      return res
        .status(400)
        .json({ message: "Unable to register with this email." });
    }
    // Sign-in resolves an account through its number and deliberately refuses
    // to authenticate a number that matches more than one account, so a second
    // account must never be able to claim one that is already in use.
    if (phoneNumberE164 && (await User.exists({ phoneNumberE164 }))) {
      return res
        .status(400)
        .json({ message: "Unable to register with this phone number." });
    }

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
        // An absent identifier is stored as undefined, never as null or "",
        // so the sparse unique index skips it instead of treating every
        // phone-only account as a duplicate of the others.
        email: email || undefined,
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
        email: user.email || "",
        phoneNumber: user.phoneNumber || "",
        preferredStudioId: user.preferredStudioId || "",
        isStudent: user.isStudent === true,
        role: user.role,
        adminStudioLocation: user.adminStudioLocation || "",
        avatar: user.avatar || "",
        activationRequired: false,
      });
    }

    // A phone-only registration has nothing it can prove itself against: no
    // SMS gateway is contracted, so the number cannot be verified over the
    // air. The candidate is parked instead, and becomes an account only when a
    // cashier or an admin confirms the person at the front desk.
    if (!email) {
      const passwordHash = await bcrypt.hash(password, 10);
      await PendingRegistration.findOneAndUpdate(
        { phoneNumberE164 },
        {
          $set: {
            fullName,
            phoneNumber,
            phoneNumberE164,
            passwordHash,
            avatar,
            role: "client",
            approvalStatus: "awaitingStaff",
            registrationVersion: crypto.randomBytes(32).toString("base64url"),
            expiresAt: new Date(Date.now() + STAFF_APPROVAL_TTL_MS),
          },
        },
        {
          new: true,
          runValidators: true,
          setDefaultsOnInsert: true,
          upsert: true,
        },
      );

      return res.status(202).json({
        fullName,
        phoneNumber,
        role: "client",
        avatar,
        activationRequired: true,
        approvalRequired: true,
        message:
          "Your details were received. Studio staff will activate your account the next time you visit.",
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
      return res.status(400).json({
        message: "Unable to register with these contact details.",
      });
    }
    return res.status(500).json({ message: "Registration failed." });
  }
};

// --- Phone-only signup approval ---------------------------------------------
// A candidate that registered with a phone number alone has proven nothing, so
// it never becomes an account on its own. Staff confirm the person and the
// number in the studio, and only these handlers create the User.

const pendingSignupResponse = (candidate) => ({
  _id: candidate._id,
  fullName: candidate.fullName,
  phoneNumber: candidate.phoneNumber || "",
  requestedAt: candidate.createdAt,
  expiresAt: candidate.expiresAt,
});

exports.listPendingSignups = async (_req, res) => {
  try {
    const candidates = await PendingRegistration.find({
      approvalStatus: "awaitingStaff",
    })
      .sort({ createdAt: 1 })
      .limit(200);

    return res.status(200).json(candidates.map(pendingSignupResponse));
  } catch (error) {
    logAuthError("Listing pending signups failed", error);
    return res
      .status(500)
      .json({ message: "Unable to load pending registrations." });
  }
};

exports.approvePendingSignup = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Registration not found." });
    }
    if (
      Object.hasOwn(req.body, "isStudent") &&
      typeof req.body.isStudent !== "boolean"
    ) {
      return res
        .status(400)
        .json({ message: "Student status must be true or false." });
    }

    const managedStudio =
      req.user?.role === "studioAdmin"
        ? req.user.adminStudioLocation
        : req.body.preferredStudioId;
    if (!mongoose.isValidObjectId(managedStudio)) {
      return res
        .status(400)
        .json({ message: "A valid managed studio is required." });
    }

    // Claiming the candidate before creating the account means two cashiers
    // approving the same person cannot produce two accounts for one number.
    const candidate = await PendingRegistration.findOneAndDelete({
      _id: id,
      approvalStatus: "awaitingStaff",
    }).select("+passwordHash");
    if (!candidate) {
      return res.status(404).json({ message: "Registration not found." });
    }

    if (await User.exists({ phoneNumberE164: candidate.phoneNumberE164 })) {
      return res.status(409).json({
        message: "An account already uses this phone number.",
      });
    }

    const user = await User.createWithPasswordHash({
      fullName: candidate.fullName,
      phoneNumber: candidate.phoneNumber,
      password: candidate.passwordHash,
      role: "client",
      isStudent: req.body.isStudent === true,
      preferredStudioId: managedStudio,
      avatar: candidate.avatar || "",
    });

    return res.status(201).json({
      _id: user._id,
      fullName: user.fullName,
      email: "",
      phoneNumber: user.phoneNumber || "",
      preferredStudioId: user.preferredStudioId || "",
      isStudent: user.isStudent === true,
      role: user.role,
      avatar: user.avatar || "",
    });
  } catch (error) {
    logAuthError("Approving a pending signup failed", error);
    if (error?.code === 11000) {
      return res
        .status(409)
        .json({ message: "An account already uses this phone number." });
    }
    return res
      .status(500)
      .json({ message: "Unable to activate this registration." });
  }
};

exports.rejectPendingSignup = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Registration not found." });
    }

    const candidate = await PendingRegistration.findOneAndDelete({
      _id: id,
      approvalStatus: "awaitingStaff",
    });
    if (!candidate) {
      return res.status(404).json({ message: "Registration not found." });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    logAuthError("Rejecting a pending signup failed", error);
    return res
      .status(500)
      .json({ message: "Unable to discard this registration." });
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

// Phone sign-in resolves the account through the number kept in the member's
// profile. While SMS delivery is unavailable the password is the only factor;
// turning SMS_OTP_ENABLED on downgrades this response to a pre-auth grant and
// makes the code the second factor, exactly as email sign-in already works.
exports.loginWithPhone = async (req, res) => {
  try {
    const phoneNumberE164 = normalizePhoneNumber(req.body.phoneNumber);
    const password = req.body.password;
    if (
      !phoneNumberE164 ||
      typeof password !== "string" ||
      password.length > 128
    ) {
      return res.status(401).json({ message: INVALID_PHONE_CREDENTIALS });
    }

    const user = await findUserByPhoneNumber(
      phoneNumberE164,
      "+password +authenticators",
    );
    const passwordMatches = user?.password
      ? await user.matchPassword(password)
      : await bcrypt.compare(password, DUMMY_PASSWORD_HASH);

    if (!user) {
      return res.status(401).json({ message: INVALID_PHONE_CREDENTIALS });
    }
    if (!user.password) {
      const claimable = canClaimAccountByPhone(user);
      return res.status(409).json({
        code: claimable ? "PASSWORD_NOT_SET" : "PASSWORD_UNAVAILABLE",
        hasPassword: false,
        message: claimable
          ? "This account has no password yet. Create one to continue."
          : "Sign in with the method already linked to this account.",
      });
    }
    if (!passwordMatches) {
      return res.status(401).json({ message: INVALID_PHONE_CREDENTIALS });
    }

    if (isSmsOtpEnabled()) {
      const preAuth = await createPreAuthSession({
        userId: user._id,
        email: user.email,
        phoneNumberE164,
        purpose: PREAUTH_PURPOSES.PHONE_PASSWORD_LOGIN,
      });
      return res
        .status(200)
        .json({ success: true, otpRequired: true, ...preAuth });
    }

    return res.status(200).json({
      success: true,
      otpRequired: false,
      ...phoneLoginResponse(user, "phone_password"),
    });
  } catch (error) {
    logAuthError("Phone password verification failed", error);
    return res.status(500).json({ message: "Unable to sign in." });
  }
};

// Creates the first password for an account that was provisioned with a phone
// number but never activated — typically a client added at the front desk.
// Once SMS exists the code becomes the proof of ownership and this endpoint
// steps aside for the OTP flow, which ends at the authenticated set-password
// route the email flow already uses.
exports.setPhonePassword = async (req, res) => {
  try {
    if (isSmsOtpEnabled()) {
      return res.status(409).json({
        code: "OTP_VERIFICATION_REQUIRED",
        message: "Verify the code sent to your phone before creating a password.",
      });
    }

    const passwordError = validatePassword(req.body.password);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    const phoneNumberE164 = normalizePhoneNumber(req.body.phoneNumber);
    const flow = phoneNumberE164
      ? await findActivePreAuthSession({
          token: req.body.preAuthToken,
          phoneNumberE164,
          purpose: PREAUTH_PURPOSES.PHONE_PASSWORD_SETUP,
        })
      : null;
    if (!flow) {
      return res.status(401).json({
        code: "INVALID_PHONE_SETUP_FLOW",
        message: "This password setup session is invalid or has expired.",
      });
    }

    const user = await User.findById(flow.session.userId).select(
      "+password +authenticators",
    );
    // Re-check eligibility at redemption time: the account may have gained a
    // password or a linked credential since the grant was issued.
    if (
      !user ||
      user.phoneNumberE164 !== phoneNumberE164 ||
      !canClaimAccountByPhone(user)
    ) {
      return res.status(401).json({
        code: "INVALID_PHONE_SETUP_FLOW",
        message: "This password setup session is invalid or has expired.",
      });
    }

    const consumedPreAuth = await consumePreAuthSession({
      sessionId: flow.session._id,
      tokenHash: flow.tokenHash,
      userId: user._id,
      email: user.email,
      phoneNumberE164,
      purpose: PREAUTH_PURPOSES.PHONE_PASSWORD_SETUP,
    });
    if (!consumedPreAuth) {
      return res.status(401).json({
        code: "INVALID_PHONE_SETUP_FLOW",
        message: "This password setup session is invalid or has expired.",
      });
    }

    user.password = req.body.password;
    await user.save();

    return res.status(201).json({
      success: true,
      hasPassword: true,
      ...phoneLoginResponse(user, "phone_password_setup"),
    });
  } catch (error) {
    logAuthError("Phone password setup failed", error);
    return res.status(500).json({ message: "Unable to create a password." });
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
