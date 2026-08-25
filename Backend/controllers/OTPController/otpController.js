const crypto = require("crypto");
const { sendEmail } = require("../../helper/sendEmail");
const {
  getAuthVersion,
  issueAuthToken,
} = require("../../helper/authToken");
const {
  generateOtp,
  hashOtp,
  logAuthError,
  normalizeEmail,
} = require("../../helper/authSecurity");
const {
  PREAUTH_PURPOSES,
  consumePreAuthSession,
  findActivePreAuthSession,
} = require("../../helper/preAuthSession");
const User = require("../../models/UserData/User");
const OTP = require("../../models/OTP/OTP");
const OtpLog = require("../../models/OTP/OtpLog");
const PendingRegistration = require("../../models/OTP/PendingRegistration");

const OTP_MAX_ATTEMPTS = 5;
const OTP_REQUEST_INTERVAL_MS = 60 * 1000;
const OTP_REQUESTS_PER_HOUR = 5;
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_SENT_MESSAGE = "If the account exists, a code has been sent.";
const INVALID_OTP_MESSAGE = "Invalid or expired OTP.";
const INVALID_OTP_FLOW_MESSAGE = "OTP verification flow is invalid or expired.";

const AUTHENTICATION_METHODS = {
  [PREAUTH_PURPOSES.PASSWORD_LOGIN]: "password_otp",
  [PREAUTH_PURPOSES.PASSWORDLESS_LOGIN]: "email_otp",
  [PREAUTH_PURPOSES.REGISTRATION]: "registration_otp",
};

const otpHashesMatch = (expectedHash, suppliedHash) => {
  if (
    typeof expectedHash !== "string" ||
    typeof suppliedHash !== "string" ||
    !/^[a-f\d]{64}$/i.test(expectedHash) ||
    !/^[a-f\d]{64}$/i.test(suppliedHash)
  ) {
    return false;
  }
  return crypto.timingSafeEqual(
    Buffer.from(expectedHash, "hex"),
    Buffer.from(suppliedHash, "hex"),
  );
};

const getBoundPreAuthFlow = async (body = {}) => {
  const email = normalizeEmail(body.email);
  if (!email) return null;

  const flow = await findActivePreAuthSession({
    token: body.preAuthToken,
    email,
    purpose: body.purpose,
  });
  if (!flow) return null;

  if (flow.session.purpose === PREAUTH_PURPOSES.REGISTRATION) {
    if (!flow.session.pendingRegistrationId || flow.session.userId) return null;

    const pendingRegistration = await PendingRegistration.findById(
      flow.session.pendingRegistrationId,
    ).select("+registrationVersion");
    if (
      !pendingRegistration ||
      normalizeEmail(pendingRegistration.email) !== email ||
      pendingRegistration.expiresAt <= new Date() ||
      pendingRegistration.registrationVersion !==
        flow.session.registrationVersion
    ) {
      return null;
    }

    return {
      ...flow,
      email,
      purpose: flow.session.purpose,
      pendingRegistration,
      registrationVersion: flow.session.registrationVersion,
    };
  }

  if (!flow.session.userId || flow.session.pendingRegistrationId) return null;
  const user = await User.findById(flow.session.userId);
  if (!user || normalizeEmail(user.email) !== email) return null;

  return {
    ...flow,
    email,
    purpose: flow.session.purpose,
    user,
  };
};

const getOtpSubjectBinding = (flow) =>
  flow.purpose === PREAUTH_PURPOSES.REGISTRATION
    ? {
        pendingRegistrationId: flow.pendingRegistration._id,
        registrationVersion: flow.registrationVersion,
      }
    : { userId: flow.user._id };

const rejectInvalidOtpFlow = (res) =>
  res.status(401).json({
    code: "INVALID_OTP_FLOW",
    error: INVALID_OTP_FLOW_MESSAGE,
  });

exports.requestOTP = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) {
      return res.status(400).json({ error: "A valid email is required." });
    }

    const flow = await getBoundPreAuthFlow(req.body);
    if (!flow) return rejectInvalidOtpFlow(res);

    const lastRequest = await OtpLog.findOne({ email }).sort({ createdAt: -1 });
    if (lastRequest) {
      const elapsed = Date.now() - lastRequest.createdAt.getTime();
      if (elapsed < OTP_REQUEST_INTERVAL_MS) {
        return res.status(429).json({
          code: "OTP_RATE_LIMITED",
          error: "Please wait before requesting another code.",
          retryAfter: Math.ceil(
            (OTP_REQUEST_INTERVAL_MS - elapsed) / 1000,
          ),
        });
      }
    }

    const requestCount = await OtpLog.countDocuments({ email });
    if (requestCount >= OTP_REQUESTS_PER_HOUR) {
      return res.status(429).json({
        code: "OTP_RATE_LIMITED",
        error: "Too many code requests. Please try again later.",
      });
    }

    const otp = generateOtp();
    const otpHash = hashOtp(email, otp);
    const subjectBinding = getOtpSubjectBinding(flow);
    const obsoleteSubjectFields = flow.pendingRegistration
      ? { userId: "" }
      : { pendingRegistrationId: "", registrationVersion: "" };
    await OTP.findOneAndUpdate(
      { email },
      {
        $set: {
          attempts: 0,
          createdAt: new Date(),
          otpHash,
          preAuthSessionHash: flow.tokenHash,
          purpose: flow.purpose,
          ...subjectBinding,
        },
        $unset: obsoleteSubjectFields,
      },
      { new: true, setDefaultsOnInsert: true, upsert: true },
    );
    await OtpLog.create({ email });

    try {
      await sendEmail(
        (flow.user || flow.pendingRegistration).fullName || "User",
        email,
        otp,
      );
    } catch (error) {
      // Do not leave a usable code behind if delivery failed. The request log
      // remains to prevent abusing email delivery failures as a bypass.
      await OTP.deleteOne({
        email,
        otpHash,
        preAuthSessionHash: flow.tokenHash,
      });
      throw error;
    }

    return res.status(200).json({ message: OTP_SENT_MESSAGE });
  } catch (error) {
    logAuthError("OTP request failed", error);
    return res.status(500).json({ error: "Unable to send a code." });
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = req.body.otp;
    if (!email || typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ error: INVALID_OTP_MESSAGE });
    }

    const flow = await getBoundPreAuthFlow(req.body);
    if (!flow) return rejectInvalidOtpFlow(res);

    const validAfter = new Date(Date.now() - OTP_TTL_MS);
    const subjectBinding = getOtpSubjectBinding(flow);
    const otpRecord = await OTP.findOne({
      email,
      preAuthSessionHash: flow.tokenHash,
      purpose: flow.purpose,
      ...subjectBinding,
      createdAt: { $gte: validAfter },
    }).select("+otpHash +attempts");
    if (!otpRecord || otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
      return res.status(400).json({ error: INVALID_OTP_MESSAGE });
    }

    const suppliedHash = hashOtp(email, otp);
    if (!otpHashesMatch(otpRecord.otpHash, suppliedHash)) {
      await OTP.updateOne(
        {
          _id: otpRecord._id,
          preAuthSessionHash: flow.tokenHash,
          purpose: flow.purpose,
          ...subjectBinding,
          attempts: { $lt: OTP_MAX_ATTEMPTS },
        },
        { $inc: { attempts: 1 } },
      );
      return res.status(400).json({ error: INVALID_OTP_MESSAGE });
    }

    // Atomic consumption prevents concurrent replay of the same valid code.
    const consumedOtp = await OTP.findOneAndDelete({
      _id: otpRecord._id,
      attempts: { $lt: OTP_MAX_ATTEMPTS },
      createdAt: { $gte: validAfter },
      otpHash: suppliedHash,
      preAuthSessionHash: flow.tokenHash,
      purpose: flow.purpose,
      ...subjectBinding,
    });
    if (!consumedOtp) {
      return res.status(400).json({ error: INVALID_OTP_MESSAGE });
    }

    const consumedPreAuth = await consumePreAuthSession({
      sessionId: flow.session._id,
      tokenHash: flow.tokenHash,
      ...subjectBinding,
      email,
      purpose: flow.purpose,
    });
    if (!consumedPreAuth) {
      return res.status(400).json({ error: INVALID_OTP_MESSAGE });
    }

    let authenticatedUser = flow.user;
    if (flow.purpose === PREAUTH_PURPOSES.REGISTRATION) {
      const pendingRegistration = await PendingRegistration.findOneAndDelete({
        _id: flow.pendingRegistration._id,
        email,
        registrationVersion: flow.registrationVersion,
        expiresAt: { $gt: new Date() },
      }).select("+passwordHash");
      if (!pendingRegistration) {
        return res.status(400).json({ error: INVALID_OTP_MESSAGE });
      }

      authenticatedUser = await User.createWithPasswordHash({
        fullName: pendingRegistration.fullName,
        email: pendingRegistration.email,
        password: pendingRegistration.passwordHash,
        phoneNumber: pendingRegistration.phoneNumber || "",
        role: "client",
        avatar: pendingRegistration.avatar || "",
      });
    }

    return res.status(200).json({
      message:
        flow.purpose === PREAUTH_PURPOSES.REGISTRATION
          ? "Registration successful"
          : "Login successful",
      _id: authenticatedUser._id,
      fullName: authenticatedUser.fullName,
      email: authenticatedUser.email,
      userId: authenticatedUser._id,
      role: authenticatedUser.role,
      purpose: flow.purpose,
      token: issueAuthToken(authenticatedUser._id, {
        authenticationMethod: AUTHENTICATION_METHODS[flow.purpose],
        authVersion: getAuthVersion(authenticatedUser),
      }),
    });
  } catch (error) {
    logAuthError("OTP verification failed", error);
    if (error?.code === 11000) {
      return res.status(409).json({
        code: "REGISTRATION_CONFLICT",
        error: "Unable to activate this registration. Start again.",
      });
    }
    return res.status(500).json({ error: "Unable to verify the code." });
  }
};

module.exports.OTP_MAX_ATTEMPTS = OTP_MAX_ATTEMPTS;
