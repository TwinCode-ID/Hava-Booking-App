const fs = require("fs");
const path = require("path");
const os = require("os");
const User = require("../../models/UserData/User");
const Studios = require("../../models/StudioData/Studios");
const {
  logAuthError,
  normalizeEmail,
  validatePassword,
} = require("../../helper/authSecurity");
const {
  PREAUTH_PURPOSES,
  createPreAuthSession,
} = require("../../helper/preAuthSession");
const { canAccessUser } = require("../../helper/authorization");
const {
  issueReplacementAuthToken,
} = require("../../helper/authToken");

const authenticationMethodChangedResponse = {
  code: "AUTHENTICATION_METHOD_CHANGED",
  reauthenticationRequired: true,
};

const getAuthenticationMethodChangedResponse = (user, accessClaims) => {
  const token = issueReplacementAuthToken(user, accessClaims);
  return token
    ? {
        code: "AUTHENTICATION_METHOD_CHANGED",
        reauthenticationRequired: false,
        token,
      }
    : authenticationMethodChangedResponse;
};

const nullableIdsEqual = (left, right) =>
  (left == null && right == null) || left?.toString() === right?.toString();

// A member who registered with a phone number alone can add a mailbox later.
// The address is never stored on the word of the request: this only issues the
// grant that a code, sent to that address, redeems. Until the code is verified
// the account still has no email. Verifying matters because social sign-in
// links accounts by email, so an unverified address would let one account
// capture another person's Google or Apple identity.
exports.startEmailClaim = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found." });
    if (user.email) {
      return res.status(409).json({
        code: "EMAIL_ALREADY_SET",
        message: "This account already has an email address.",
      });
    }
    if (await User.exists({ email })) {
      return res
        .status(409)
        .json({ message: "This email address is not available." });
    }

    const preAuth = await createPreAuthSession({
      userId: user._id,
      email,
      purpose: PREAUTH_PURPOSES.EMAIL_CLAIM,
    });

    return res.status(200).json({ success: true, email, ...preAuth });
  } catch (error) {
    logAuthError("Email claim could not be started", error);
    return res
      .status(500)
      .json({ message: "Unable to start email verification." });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const {
      fullName,
      phoneNumber,
      preferredStudioId,
      adminStudioLocation,
      avatar,
      role,
    } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(400).json({ message: "User not found" });
    const previousRole = user.role;
    const previousAdminStudioLocation = user.adminStudioLocation;

    user.fullName = fullName || user.fullName;
    user.phoneNumber = phoneNumber || user.phoneNumber;
    user.avatar = avatar || user.avatar;

    if (user.role === "client") {
      user.preferredStudioId = preferredStudioId || user.preferredStudioId;
    }

    if (user.role === "devTeam") {
      user.role = role || user.role;
      user.preferredStudioId = preferredStudioId || user.preferredStudioId;
      user.adminStudioLocation =
        adminStudioLocation || user.adminStudioLocation;
    }

    await user.save();

    const authenticationChanged =
      previousRole !== user.role ||
      !nullableIdsEqual(
        previousAdminStudioLocation,
        user.adminStudioLocation,
      );
    res.status(201).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber || "",
      preferredStudioId: user.preferredStudioId || "",
      role: user.role,
      adminStudioLocation: user.adminStudioLocation || "",
      avatar: user.avatar || "",
      isStudent: user.isStudent, // added to response snapshot payload
      ...(authenticationChanged
        ? getAuthenticationMethodChangedResponse(user, req.auth)
        : {}),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateProfileDeveloper = async (req, res) => {
  try {
    const {
      fullName,
      phoneNumber,
      preferredStudioId,
      adminStudioLocation,
      avatar,
      isStudent,
      role,
    } = req.body;
    const user = await User.findById(req.params.id || req.user._id);
    if (!user) return res.status(400).json({ message: "User not found" });
    if (!canAccessUser(req.user, user)) {
      return res.status(403).json({ message: "Not authorized." });
    }
    const previousRole = user.role;
    const previousAdminStudioLocation = user.adminStudioLocation;

    if (isStudent !== undefined && typeof isStudent !== "boolean") {
      return res.status(400).json({
        message: "Student status must be true or false.",
      });
    }

    user.fullName = fullName || user.fullName;
    user.phoneNumber = phoneNumber || user.phoneNumber;
    user.avatar = avatar || user.avatar;

    // Student eligibility is staff-managed and cannot be self-asserted.
    if (isStudent !== undefined) {
      user.isStudent = isStudent;
    }

    // DevTeam specific overrides
    if (req.user.role === "devTeam") {
      user.role = role || user.role;
      user.adminStudioLocation =
        adminStudioLocation || user.adminStudioLocation;
    }

    if (user.role === "client" && req.user.role === "devTeam") {
      user.preferredStudioId = preferredStudioId || user.preferredStudioId;
    }

    await user.save();
    const authenticationChanged =
      previousRole !== user.role ||
      !nullableIdsEqual(
        previousAdminStudioLocation,
        user.adminStudioLocation,
      );
    const responseUser =
      typeof user.toObject === "function" ? user.toObject() : user;
    res.status(200).json({
      ...responseUser,
      ...(authenticationChanged
        ? nullableIdsEqual(user._id, req.user._id)
          ? getAuthenticationMethodChangedResponse(user, req.auth)
          : {
              affectedUserMustReauthenticate: true,
              code: "TARGET_AUTHORIZATION_CHANGED",
            }
        : {}),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.setUserPassword = async (req, res) => {
  const { password, oldPassword } = req.body;
  try {
    const user = await User.findById(req.params.id).select("+password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.password) {
      user.password = password;
    } else {
      if (!(await user.matchPassword(oldPassword))) {
        return res.status(404).json({ message: "Password not matched" });
      } else {
        user.password = password;
      }
    }
    await user.save();
    res.status(201).json({
      message: "Success",
      ...getAuthenticationMethodChangedResponse(user, req.auth),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.setNewUserPassword = async (req, res) => {
  const { password } = req.body;
  try {
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.password) {
      return res
        .status(400)
        .json({
          message: "Password already exists. Use update password instead.",
        });
    }

    user.password = password;
    await user.save();
    res.status(201).json({
      message: "Success",
      ...getAuthenticationMethodChangedResponse(user, req.auth),
    });
  } catch (err) {
    logAuthError("Set password failed", err);
    res.status(500).json({ message: "Unable to set password." });
  }
};

exports.updatePassword = async (req, res) => {
  const { password, newPassword } = req.body;
  try {
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const hasExistingPassword = user.password && user.password !== "";

    if (hasExistingPassword) {
      if (typeof password !== "string" || password.length === 0) {
        return res.status(400).json({
          code: "CURRENT_PASSWORD_REQUIRED",
          message: "Current password is required.",
        });
      }

      const isMatch = await user.matchPassword(password);
      if (!isMatch) {
        return res
          .status(400)
          .json({
            code: "INVALID_CURRENT_PASSWORD",
            message: "Current password does not match.",
          });
      }
    }

    // Update to new password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      message: "Success",
      hasPassword: true,
      ...getAuthenticationMethodChangedResponse(user, req.auth),
    });
  } catch (err) {
    logAuthError("Password update failed", err);
    res.status(500).json({ message: "Unable to update password." });
  }
};

exports.logoutAllSessions = async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { _id: req.user._id },
      { $inc: { authVersion: 1 } },
      { new: true },
    ).select("_id");
    if (!user) {
      return res.status(401).json({
        code: "INVALID_TOKEN",
        message: "Not authorized",
      });
    }

    return res.status(200).json({
      success: true,
      code: "ALL_SESSIONS_REVOKED",
      message: "All sessions have been signed out.",
      reauthenticationRequired: true,
    });
  } catch (error) {
    logAuthError("Session revocation failed", error);
    return res.status(500).json({ message: "Unable to sign out all sessions." });
  }
};
exports.getPublicProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate("preferredStudioId", "studioName address")
      .populate("adminStudioLocation", "studioName address");

    if (!user) return res.status(404).json({ message: "User not found" });
    if (!canAccessUser(req.user, user)) {
      return res.status(403).json({ message: "Not authorized." });
    }

    res.json(user);
  } catch (err) {
    logAuthError("Profile lookup failed", err);
    res.status(500).json({ message: "Unable to load profile." });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    if (
      req.user.role === "studioAdmin" &&
      !req.user.adminStudioLocation
    ) {
      return res.status(403).json({ message: "Not authorized." });
    }
    const query =
      req.user.role === "devTeam"
        ? {}
        : {
            role: "client",
            preferredStudioId: req.user.adminStudioLocation,
          };
    const userQuery = User.find(query).sort({ createdAt: -1 });
    if (req.user.role !== "devTeam") {
      userQuery.select(
        "_id fullName email phoneNumber preferredStudioId avatar isStudent role",
      );
    }
    const users = await userQuery;
    res.json(users);
  } catch (err) {
    logAuthError("User list failed", err);
    res.status(500).json({ message: "Unable to load users." });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getSystemMetrics = async (req, res) => {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ramUsagePercent = Math.round((usedMem / totalMem) * 100);

    const yesterday = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
    const activeUsersCount = await User.countDocuments({
      updatedAt: { $gte: yesterday },
    });

    res.status(200).json({
      activeVisitors: activeUsersCount || 0,
      serverLoad: ramUsagePercent,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.saveFcmToken = async (req, res) => {
  try {
    const fcmToken =
      typeof req.body?.fcmToken === "string" ? req.body.fcmToken.trim() : "";
    const userId = req.user._id;

    if (
      fcmToken.length < 20 ||
      fcmToken.length > 4096 ||
      /[\s\u0000-\u001f\u007f]/.test(fcmToken)
    ) {
      return res.status(400).json({ message: "A valid push token is required." });
    }

    const result = await User.updateOne(
      { _id: userId },
      [
        {
          $set: {
            fcmTokens: {
              $slice: [
                {
                  $concatArrays: [
                    {
                      $filter: {
                        input: { $ifNull: ["$fcmTokens", []] },
                        as: "token",
                        cond: { $ne: ["$$token", fcmToken] },
                      },
                    },
                    [fcmToken],
                  ],
                },
                -10,
              ],
            },
          },
        },
      ],
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "FCM Token saved successfully" });
  } catch (error) {
    console.error("Push token update failed", error);
    res.status(500).json({ message: "Unable to save push token." });
  }
};
