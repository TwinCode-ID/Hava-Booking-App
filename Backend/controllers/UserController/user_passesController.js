const UserPasses = require("../../models/UserData/User_Passes");
const Package = require("../../models/StudioData/Packages");
const User = require("../../models/UserData/User");
const admin = require("../../config/firebase");
const mongoose = require("mongoose");
const crypto = require("crypto");
const { sendShareEmail } = require("../../helper/sendEmail");
const { normalizeEmail } = require("../../helper/authSecurity");
const {
  canManageStudio,
  idsEqual,
  isDevTeam,
  isStudioStaff,
} = require("../../helper/authorization");
const {
  consumeOneTimeEntitlement,
} = require("../../helper/oneTimePackageEntitlement");
const {
  isPassCurrentlyFrozen,
  notCurrentlyFrozenFilter,
} = require("../../helper/passState");

const SHARE_CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SHARE_LINK_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_FREEZE_DURATION_MS = 90 * 24 * 60 * 60 * 1000;
const hashShareCode = (code) =>
  crypto.createHash("sha256").update(code).digest("hex");
const getPublicAppOrigin = () => {
  const configured =
    process.env.PUBLIC_APP_ORIGIN || "https://booktheclassindonesia.com";
  const url = new URL(configured);
  if (
    (url.protocol !== "https:" &&
      !(process.env.NODE_ENV !== "production" && url.hostname === "localhost")) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("PUBLIC_APP_ORIGIN is not configured securely.");
  }
  return url.origin;
};
const getShareCodeFromClientLink = (shareLink) => {
  if (typeof shareLink !== "string" || shareLink.length > 2048) return null;
  try {
    const url = new URL(shareLink);
    if (
      url.origin !== getPublicAppOrigin() ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    const match = url.pathname.match(/^\/shared-pass\/([^/]+)$/);
    const code = match ? decodeURIComponent(match[1]) : null;
    return code && SHARE_CODE_PATTERN.test(code) ? code : null;
  } catch {
    return null;
  }
};

exports.passReminder = async (req, res) => {
  try {
    const { passId } = req.params;

    const pass = await UserPasses.findById(passId)
      .populate("userId", "fullName fcmTokens")
      .populate("packageId", "packageName reminderDaysBefore");

    if (!pass) return res.status(404).json({ message: "Pass not found" });
    if (!canManageStudio(req.user, pass.issuingStudio)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const user = pass.userId;
    const pkg = pass.packageId;

    if (!user.fcmTokens || user.fcmTokens.length === 0) {
      return res
        .status(400)
        .json({ message: "User has no registered devices for notifications." });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiryDate = new Date(pass.expiryDate);
    expiryDate.setHours(0, 0, 0, 0);

    const diffTime = expiryDate.getTime() - today.getTime();
    const daysRemaining = Math.round(diffTime / (1000 * 60 * 60 * 24));

    let bodyText = "";
    let titleText = "Package Expiring Soon! ⏳";

    if (daysRemaining < 0) {
      titleText = "Package Expired! 🚨";
      bodyText = `Hi ${user.fullName}, your ${pkg?.packageName || "Pass"} has already expired.`;
    } else if (daysRemaining === 0) {
      titleText = "Package Expiring Today! 🚨";
      bodyText = `Hi ${user.fullName}, your ${pkg?.packageName || "Pass"} expires TODAY!`;
    } else if (daysRemaining === 1) {
      bodyText = `Hi ${user.fullName}, your ${pkg?.packageName || "Pass"} will expire in 1 day.`;
    } else {
      bodyText = `Hi ${user.fullName}, your ${pkg?.packageName || "Pass"} will expire in ${daysRemaining} days.`;
    }

    const sendPromises = user.fcmTokens.map((token) => {
      const message = {
        notification: {
          title: titleText,
          body: bodyText,
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
              "interruption-level": "active",
            },
          },
        },
        android: {
          notification: {
            sound: "default",
            defaultVibrateTimings: true,
          },
        },
        token: token,
      };
      return admin.messaging().send(message);
    });

    const results = await Promise.allSettled(sendPromises);

    const successCount = results.filter((r) => r.status === "fulfilled").length;
    const failureCount = results.filter((r) => r.status === "rejected").length;

    res.status(200).json({
      message: `Test reminder processed (${daysRemaining} days remaining)`,
      successCount,
      failureCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.assignPassToUser = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId, packageId, durationInDays } = req.body;

    const selectedPackage = await Package.findById(packageId).session(session);
    if (!selectedPackage) throw new Error("Package not found");
    if (selectedPackage.isActive === false) {
      const error = new Error("Package is not available");
      error.status = 400;
      throw error;
    }
    if (!canManageStudio(req.user, selectedPackage.studioLocation)) {
      const error = new Error("Unauthorized");
      error.status = 403;
      throw error;
    }
    const recipient = await User.findById(userId)
      .select("role preferredStudioId isStudent")
      .session(session);
    if (!recipient) {
      const error = new Error("User not found");
      error.status = 404;
      throw error;
    }
    if (
      !isDevTeam(req.user) &&
      (recipient.role !== "client" ||
        !idsEqual(
          recipient.preferredStudioId,
          selectedPackage.studioLocation,
        ))
    ) {
      const error = new Error(
        "You can only assign passes to clients affiliated with your studio.",
      );
      error.status = 403;
      throw error;
    }
    const requiresStudentEligibility =
      selectedPackage.isStudentPackage === true ||
      selectedPackage.packageCategory?.includes("Student");
    if (requiresStudentEligibility) {
      if (recipient.isStudent !== true) {
        const error = new Error(
          "This package is restricted to verified students.",
        );
        error.status = 403;
        throw error;
      }
    }

    const validityDuration = Number(
      durationInDays || selectedPackage.validityDays,
    );
    if (!Number.isFinite(validityDuration) || validityDuration <= 0) {
      const error = new Error("Invalid pass duration");
      error.status = 400;
      throw error;
    }

    const purchaseDate = new Date();
    const expiryDate = new Date(purchaseDate);
    expiryDate.setDate(expiryDate.getDate() + validityDuration);

    let passesToCreate = [];

    if (selectedPackage.isCombo && selectedPackage.comboItems.length > 0) {
      passesToCreate = selectedPackage.comboItems.map((item) => ({
        userId,
        packageId,
        packageNameSnapshot: selectedPackage.packageName,
        packageCategorySnapshot: selectedPackage.packageCategory,
        isStudentRestrictedSnapshot: requiresStudentEligibility,
        purchaseDate,
        expiryDate,
        validityDuration,
        firstUsageDate: null,
        issuingStudio: selectedPackage.studioLocation,
        isActive: true,
        remainingCredits: item.credits,
        initialCredits: item.credits,
        instructorType: item.instructorType,
        classType: item.classType,
      }));
    } else {
      passesToCreate = [
        {
          userId,
          packageId,
          packageNameSnapshot: selectedPackage.packageName,
          packageCategorySnapshot: selectedPackage.packageCategory,
          isStudentRestrictedSnapshot: requiresStudentEligibility,
          purchaseDate,
          expiryDate,
          validityDuration,
          firstUsageDate: null,
          issuingStudio: selectedPackage.studioLocation,
          remainingCredits: req.body.credits || selectedPackage.credits,
          initialCredits: req.body.credits || selectedPackage.credits,
          instructorType:
            req.body.instructorType || selectedPackage.instructorType,
          classType: req.body.classType || selectedPackage.classType,
          isActive: true,
        },
      ];
    }

    if (selectedPackage.isOneTimePurchase === true) {
      await consumeOneTimeEntitlement({
        userId,
        packageId,
        source: "direct_assignment",
        session,
      });
    }

    const savedPasses = await UserPasses.insertMany(passesToCreate, {
      session,
    });
    await session.commitTransaction();

    res.status(201).json({
      message: selectedPackage.isCombo
        ? "Combo passes assigned successfully."
        : "Pass assigned.",
      passes: savedPasses,
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(error.status || 500).json({ error: error.message });
  } finally {
    session.endSession();
  }
};

exports.deductCredits = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId, passId, creditsToDeduct } = req.body;

    const userPass = await UserPasses.findById(passId).session(session);

    if (!userPass) throw new Error("Pass not found or unauthorized.");
    if (!canManageStudio(req.user, userPass.issuingStudio)) {
      const error = new Error("Unauthorized.");
      error.status = 403;
      throw error;
    }
    const belongsToUser =
      idsEqual(userPass.userId, userId) ||
      userPass.sharedWith?.some((id) => idsEqual(id, userId));
    if (!belongsToUser) throw new Error("Pass does not belong to this user.");
    if (
      !Number.isFinite(Number(creditsToDeduct)) ||
      Number(creditsToDeduct) <= 0
    ) {
      throw new Error("Credits to deduct must be a positive number.");
    }
    if (!userPass.isActive) throw new Error("This pass is inactive.");
    if (isPassCurrentlyFrozen(userPass)) {
      throw new Error("This pass is currently frozen.");
    }
    if (new Date() > userPass.expiryDate)
      throw new Error("This pass has expired.");
    if (userPass.remainingCredits < creditsToDeduct)
      throw new Error("Insufficient credits.");

    if (!userPass.firstUsageDate) {
      const now = new Date();
      userPass.firstUsageDate = now;
      const newExpiry = new Date(now);
      newExpiry.setDate(newExpiry.getDate() + userPass.validityDuration);
      userPass.expiryDate = newExpiry;
    }

    userPass.remainingCredits -= Number(creditsToDeduct);
    if (userPass.remainingCredits === 0) userPass.isActive = false;

    await userPass.save({ session });
    await session.commitTransaction();

    res.status(200).json({
      message: "Credits deducted successfully",
      remaining: userPass.remainingCredits,
      expiryDate: userPass.expiryDate,
      firstUsage: userPass.firstUsageDate,
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(error.status || 400).json({ error: error.message });
  } finally {
    session.endSession();
  }
};

exports.updateUserPass = async (req, res) => {
  try {
    const { passId } = req.params;
    const {
      remainingCredits,
      expiryDate,
      instructorType,
      classType,
      validityDuration,
    } = req.body;

    const pass = await UserPasses.findById(passId);
    if (!pass) return res.status(404).json({ error: "Pass not found" });
    if (!canManageStudio(req.user, pass.issuingStudio)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (remainingCredits !== undefined)
      pass.remainingCredits = Number(remainingCredits);
    if (expiryDate) pass.expiryDate = new Date(expiryDate);
    if (validityDuration) pass.validityDuration = Number(validityDuration);
    if (instructorType) pass.instructorType = instructorType;
    if (classType) pass.classType = classType;

    const now = new Date();

    // Check if it has credits
    const hasCredits = pass.remainingCredits > 0;
    // Check if it's not expired (If expiryDate is null, it hasn't been activated yet, so it's still valid)
    const isNotExpired = !pass.expiryDate || pass.expiryDate > now;

    // Automatically set isActive status
    pass.isActive = hasCredits && isNotExpired;

    await pass.save();
    res.status(200).json({ message: "Pass updated successfully", pass });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getMyActivePasses = async (req, res) => {
  try {
    const { userId } = req.params;
    const now = new Date();
    const requestingOwnPasses = idsEqual(req.user._id, userId);
    if (!requestingOwnPasses && !isStudioStaff(req.user)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const ownershipFilter = { $or: [{ userId }, { sharedWith: userId }] };
    const tenantFilter =
      !requestingOwnPasses && !isDevTeam(req.user)
        ? { issuingStudio: req.user.adminStudioLocation }
        : {};

    // 1. Auto-Clean expired passes
    // (We also need to fix the duplicate $or here!)
    await UserPasses.updateMany(
      {
        $and: [
          ownershipFilter,
          {
            $or: [
              { remainingCredits: { $lte: 0 } },
              { expiryDate: { $lt: now } },
            ],
          },
        ],
        isActive: true,
        ...tenantFilter,
      },
      { $set: { isActive: false } },
    );

    // 2. STRICT FETCH: Safely combine multiple $or conditions
    const activePasses = await UserPasses.find({
      $and: [
        ownershipFilter,
        { $or: [{ expiryDate: { $gte: now } }, { expiryDate: null }] }, // Expiry check
      ],
      remainingCredits: { $gt: 0 },
      ...tenantFilter,
    })
      .populate("userId", "fullName avatar email")
      .populate("sharedWith", "fullName avatar email")
      .populate("issuingStudio", "studioName")
      .populate("packageId", "packageName")
      .sort({ expiryDate: 1 });

    res.status(200).json(activePasses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getMyInactivePasses = async (req, res) => {
  try {
    const userId = req.user._id;
    const inactivePasses = await UserPasses.find({
      $and: [
        { $or: [{ userId }, { sharedWith: userId }] },
        {
          $or: [
            { isActive: false },
            { remainingCredits: 0 },
            { expiryDate: { $lt: new Date() } },
          ],
        },
      ],
    })
      .populate("userId", "fullName avatar email")
      .populate("sharedWith", "fullName avatar email")
      .populate("issuingStudio", "studioName")
      .populate("packageId", "packageName")
      .sort({ expiryDate: -1 });
    res.status(200).json(inactivePasses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getUserPassHistory = async (req, res) => {
  try {
    const { studioId } = req.params;
    if (!canManageStudio(req.user, studioId)) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    const history = await UserPasses.find({ issuingStudio: studioId })
      .sort({ createdAt: -1 })
      .populate("packageId")
      // The studio's client list is built from these passes, so the client
      // card can only show a contact detail that is selected here. A member
      // registered with a phone number alone has no email at all.
      .populate("userId", "fullName email phoneNumber avatar isStudent")
      .populate("sharedWith", "fullName email phoneNumber avatar");
    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.detachSharedPass = async (req, res) => {
  try {
    const { passId } = req.params;
    const { userIdToDetach } = req.body;
    if (
      !mongoose.isValidObjectId(passId) ||
      !mongoose.isValidObjectId(userIdToDetach)
    ) {
      return res.status(400).json({ message: "Invalid pass or user ID." });
    }

    const requesterId = req.user._id;
    const requesterIsTarget = idsEqual(requesterId, userIdToDetach);
    const authorizationFilter = requesterIsTarget
      ? { $or: [{ userId: requesterId }, { sharedWith: requesterId }] }
      : { userId: requesterId };

    const detached = await UserPasses.findOneAndUpdate(
      {
        _id: passId,
        sharedWith: userIdToDetach,
        ...authorizationFilter,
      },
      { $pull: { sharedWith: userIdToDetach } },
      { new: false, projection: { _id: 1 } },
    );
    if (!detached) {
      return res.status(404).json({
        message: "Shared pass membership was not found.",
      });
    }

    return res.status(200).json({
      message: "User successfully detached from pass.",
      detachedUserId: userIdToDetach,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.managePassFreeze = async (req, res) => {
  try {
    const { passId } = req.params;
    const { action, startDate, endDate } = req.body;

    const pass = await UserPasses.findById(passId);
    if (!pass) return res.status(404).json({ message: "Pass not found" });

    const ownerId = pass.userId._id
      ? pass.userId._id.toString()
      : pass.userId.toString();
    const studioId = pass.issuingStudio
      ? pass.issuingStudio._id
        ? pass.issuingStudio._id.toString()
        : pass.issuingStudio.toString()
      : null;

    const isOwner = idsEqual(ownerId, req.user._id);
    const isAdmin = canManageStudio(req.user, studioId);

    if (!isOwner && !isAdmin) {
      return res
        .status(403)
        .json({ message: "Unauthorized to manage freeze requests." });
    }

    if (action === "request" && !isOwner) {
      return res
        .status(403)
        .json({ message: "Only the pass owner can request a freeze." });
    }
    if (["approve", "reject", "admin_freeze"].includes(action) && !isAdmin) {
      return res
        .status(403)
        .json({
          message: "Only this studio's staff can perform this action.",
        });
    }

    if (["request", "approve", "admin_freeze"].includes(action)) {
      if (
        pass.isActive !== true ||
        pass.remainingCredits <= 0 ||
        !pass.expiryDate ||
        new Date(pass.expiryDate) <= new Date()
      ) {
        return res.status(400).json({
          message: "Only an active, unexpired pass with credits can be frozen.",
        });
      }
      const packageId = pass.packageId?._id || pass.packageId;
      const sourcePackage = packageId
        ? await Package.findById(packageId).select("isAvailableToFreeze")
        : null;
      if (!sourcePackage || sourcePackage.isAvailableToFreeze !== true) {
        return res.status(400).json({
          message: "This package is not eligible for freezing.",
        });
      }
    }

    // Initialize Socket
    const io = req.app.get("io");

    // Helper functions to send real-time notifications
    const notifyClient = (message) => {
      if (io && ownerId) {
        io.to(ownerId).emit("purchase_notification", {
          type: "PASS_FREEZE_UPDATED",
          role: "client",
          message,
        });
      }
    };
    const notifyAdmin = (message) => {
      if (io && studioId) {
        io.to(studioId).emit("purchase_notification", {
          type: "PASS_FREEZE_UPDATED",
          role: "admin",
          message,
        });
      }
    };

    if (action === "unfreeze") {
      if (pass.freeze?.status !== "approved") {
        return res.status(400).json({
          message: "This package does not have an active approved freeze.",
        });
      }
      const today = new Date();
      const currentFreezeStart = new Date(pass.freeze?.startDate);
      const currentFreezeEnd = new Date(pass.freeze?.endDate);

      if (
        !Number.isNaN(currentFreezeStart.getTime()) &&
        !Number.isNaN(currentFreezeEnd.getTime()) &&
        today < currentFreezeEnd
      ) {
        const unusedFrom =
          today < currentFreezeStart ? currentFreezeStart : today;
        const unusedTime = currentFreezeEnd.getTime() - unusedFrom.getTime();
        const currentExpiry = new Date(pass.expiryDate);
        pass.expiryDate = new Date(currentExpiry.getTime() - unusedTime);

        pass.freeze.endDate = today;
        pass.freeze.status = "unfrozen"; // Ensure status is explicitly reset

        await pass.save();
        notifyClient("Your package has been unfrozen.");
        notifyAdmin("Package unfrozen.");
        return res.status(200).json({
          message: "Package unfrozen and expiry date adjusted.",
          pass,
        });
      } else {
        return res
          .status(400)
          .json({ message: "Freeze period has already ended." });
      }
    }

    if (pass.freeze && pass.freeze.hasBeenFrozen && action !== "request") {
      return res.status(400).json({
        message: "This package has already used its one-time freeze allowance.",
      });
    }

    if (action === "reject") {
      pass.freeze.status = "rejected";
      pass.freeze.startDate = null;
      pass.freeze.endDate = null;
      await pass.save();
      notifyClient("Your freeze request was rejected.");
      notifyAdmin("Freeze request rejected.");
      return res
        .status(200)
        .json({ message: "Freeze request rejected.", pass });
    }

    // Handle Customer's Freeze Request
    if (action === "request") {
      if (pass.freeze && pass.freeze.hasBeenFrozen) {
        return res.status(400).json({
          message:
            "This package has already used its one-time freeze allowance.",
        });
      }
      if (pass.freeze?.status === "requested") {
        return res.status(400).json({ message: "Freeze already requested." });
      }

      const start = new Date(startDate || new Date());
      const end = new Date(
        endDate || new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000),
      );
      if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        end <= start ||
        end <= new Date() ||
        end.getTime() - start.getTime() > MAX_FREEZE_DURATION_MS
      ) {
        return res.status(400).json({
          message:
            "Freeze dates must define a future period of no more than 90 days.",
        });
      }

      pass.freeze = {
        ...pass.freeze,
        startDate: start,
        endDate: end,
        status: "requested",
      };

      await pass.save();
      notifyAdmin("A client requested a package freeze.");
      notifyClient("Freeze request submitted.");
      return res
        .status(200)
        .json({ message: "Freeze requested successfully.", pass });
    }

    if (action === "approve" || action === "admin_freeze") {
      if (action === "approve" && pass.freeze?.status !== "requested") {
        return res.status(400).json({ message: "No freeze request is pending." });
      }
      const requestedStart = new Date(startDate || pass.freeze?.startDate);
      const end = new Date(endDate || pass.freeze?.endDate);
      const now = new Date();
      const start = requestedStart > now ? requestedStart : now;
      if (
        Number.isNaN(requestedStart.getTime()) ||
        Number.isNaN(end.getTime()) ||
        end <= start ||
        end.getTime() - start.getTime() > MAX_FREEZE_DURATION_MS
      ) {
        return res.status(400).json({
          message:
            "Freeze dates must define a future period of no more than 90 days.",
        });
      }

      const freezeDuration = end.getTime() - start.getTime();

      const currentExpiry = new Date(pass.expiryDate);
      if (Number.isNaN(currentExpiry.getTime())) {
        return res.status(400).json({ message: "Pass expiry date is invalid." });
      }
      pass.expiryDate = new Date(currentExpiry.getTime() + freezeDuration);

      pass.freeze = {
        hasBeenFrozen: true,
        startDate: start,
        endDate: end,
        status: "approved",
      };

      await pass.save();
      notifyClient("Your package freeze has been approved.");
      notifyAdmin("Package frozen.");
      return res
        .status(200)
        .json({ message: "Package frozen and expiry extended.", pass });
    }

    return res.status(400).json({ message: "Invalid action." });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

exports.generateShareLink = async (req, res) => {
  try {
    const pass = await UserPasses.findById(req.params.passId);
    if (!pass) return res.status(404).json({ message: "Pass not found" });

    const ownerId = pass.userId._id
      ? pass.userId._id.toString()
      : pass.userId.toString();
    if (ownerId !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Only the pass owner can generate a share link." });
    }
    if (
      pass.isActive !== true ||
      !pass.expiryDate ||
      pass.expiryDate <= new Date() ||
      pass.remainingCredits <= 0
    ) {
      return res.status(400).json({
        message: "Only an active, unexpired pass with credits can be shared.",
      });
    }
    if (isPassCurrentlyFrozen(pass)) {
      return res.status(400).json({
        message: "A pass cannot be shared while it is frozen.",
      });
    }

    const shareCode = crypto.randomBytes(32).toString("base64url");
    pass.shareCode = null;
    pass.shareCodeHash = hashShareCode(shareCode);
    pass.shareExpiresAt = new Date(Date.now() + SHARE_LINK_TTL_MS);
    pass.isShared = true;
    await pass.save();

    const safePass = pass.toObject();
    delete safePass.shareCodeHash;
    safePass.shareCode = shareCode;
    res.status(200).json({ message: "Share link generated", pass: safePass });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.sendShareLinkViaEmail = async (req, res) => {
  try {
    const { passId } = req.params;
    const email = normalizeEmail(req.body.email);
    const shareCode = getShareCodeFromClientLink(req.body.shareLink);
    if (!email || !shareCode) {
      return res
        .status(400)
        .json({ message: "A valid email and share link are required." });
    }

    const pass = await UserPasses.findById(passId)
      .select("+shareCodeHash")
      .populate("packageId", "packageName")
      .populate("userId", "fullName");

    if (!pass) return res.status(404).json({ message: "Pass not found" });

    const ownerId = pass.userId._id
      ? pass.userId._id.toString()
      : pass.userId.toString();
    if (ownerId !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Only the pass owner can email share links." });
    }

    if (
      !pass.shareCodeHash ||
      !pass.shareExpiresAt ||
      pass.shareExpiresAt <= new Date() ||
      pass.isActive !== true ||
      !pass.expiryDate ||
      pass.expiryDate <= new Date() ||
      pass.remainingCredits <= 0 ||
      isPassCurrentlyFrozen(pass) ||
      pass.shareCodeHash !== hashShareCode(shareCode)
    )
      return res.status(400).json({ message: "Share code not generated yet." });

    const senderName = pass.userId?.fullName || "A member";
    const packageName = pass.packageId?.packageName || "a package";

    const shareLink = `${getPublicAppOrigin()}/shared-pass/${encodeURIComponent(shareCode)}`;
    await sendShareEmail(senderName, email, shareLink, packageName);

    res.status(200).json({ message: "Invitation email sent successfully!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getSharedPassDetails = async (req, res) => {
  try {
    const { code } = req.params;
    if (!SHARE_CODE_PATTERN.test(code)) {
      return res
        .status(404)
        .json({ message: "Invalid or expired share link." });
    }
    const shareCheckTime = new Date();
    const pass = await UserPasses.findOne({
      shareCodeHash: hashShareCode(code),
      shareExpiresAt: { $gt: shareCheckTime },
      isShared: true,
      ...notCurrentlyFrozenFilter(shareCheckTime),
    })
      .populate("packageId", "packageName packageDescription")
      .populate("userId", "fullName avatar")
      .populate("issuingStudio", "studioName");

    if (!pass)
      return res
        .status(404)
        .json({ message: "Invalid or expired share link." });
    if (!pass.isActive)
      return res
        .status(400)
        .json({ message: "This pass is no longer active." });
    if (isPassCurrentlyFrozen(pass)) {
      return res.status(400).json({ message: "This pass is currently frozen." });
    }

    res.status(200).json(pass);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.acceptSharedPass = async (req, res) => {
  try {
    if (req.user?.role !== "client") {
      return res.status(403).json({
        code: "CLIENT_ACCOUNT_REQUIRED",
        message: "Only client accounts can accept a shared pass.",
      });
    }

    const { code } = req.params;
    const acceptorId = req.user._id;
    if (!SHARE_CODE_PATTERN.test(code)) {
      return res
        .status(404)
        .json({ message: "Invalid or expired share link." });
    }

    const shareCheckTime = new Date();
    const candidateFilter = {
      shareCodeHash: hashShareCode(code),
      shareExpiresAt: { $gt: shareCheckTime },
      isShared: true,
      isActive: true,
      ...notCurrentlyFrozenFilter(shareCheckTime),
    };
    const candidate = await UserPasses.findOne(candidateFilter)
      .select(
        "_id packageId packageCategorySnapshot isStudentRestrictedSnapshot expiryDate remainingCredits",
      )
      .lean();
    if (
      !candidate ||
      !candidate.expiryDate ||
      candidate.expiryDate <= new Date() ||
      candidate.remainingCredits <= 0
    ) {
      return res
        .status(404)
        .json({ message: "Invalid or expired share link." });
    }

    let studentRestricted = candidate.isStudentRestrictedSnapshot;
    if (
      typeof studentRestricted !== "boolean" &&
      candidate.packageCategorySnapshot?.includes("Student")
    ) {
      studentRestricted = true;
    }
    if (typeof studentRestricted !== "boolean" && candidate.packageId) {
      const pkg = await Package.findById(candidate.packageId)
        .select("isStudentPackage packageCategory")
        .lean();
      if (pkg) {
        studentRestricted = Boolean(
          pkg.isStudentPackage || pkg.packageCategory?.includes("Student"),
        );
      }
    }
    if (typeof studentRestricted !== "boolean") {
      return res.status(409).json({
        code: "PASS_REVIEW_REQUIRED",
        message:
          "This legacy pass must be reviewed by the studio before it can be shared.",
      });
    }
    if (
      studentRestricted &&
      !(await User.exists({ _id: acceptorId, isStudent: true }))
    ) {
      return res.status(403).json({
        code: "STUDENT_VERIFICATION_REQUIRED",
        message: "This pass can only be shared with a verified student.",
      });
    }

    const pass = await UserPasses.findOneAndUpdate(
      {
        ...candidateFilter,
        _id: candidate._id,
        expiryDate: { $gt: new Date() },
        remainingCredits: { $gt: 0 },
        userId: { $ne: acceptorId },
        sharedWith: { $ne: acceptorId },
      },
      {
        $addToSet: { sharedWith: acceptorId },
        $set: {
          isShared: false,
          shareCode: null,
          shareExpiresAt: null,
        },
        $unset: { shareCodeHash: 1 },
      },
      { new: true },
    );
    if (!pass)
      return res
        .status(404)
        .json({ message: "Invalid or expired share link." });
    if (!pass.isActive)
      return res
        .status(400)
        .json({ message: "This pass is no longer active." });

    res
      .status(200)
      .json({ message: "Pass successfully added to your account!", pass });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getPassForAdminScan = async (req, res) => {
  try {
    const { passId } = req.params;

    // Fetch the pass and populate necessary user/package details
    const pass = await UserPasses.findById(passId)
      .populate("userId", "fullName email phoneNumber")
      .populate("packageId", "packageName packageDescription");

    if (!pass) {
      return res.status(404).json({ message: "Pass not found." });
    }
    if (!canManageStudio(req.user, pass.issuingStudio)) {
      return res.status(403).json({ message: "Unauthorized." });
    }

    if (!pass.isActive) {
      return res.status(400).json({ message: "Pass is inactive or expired." });
    }

    if (pass.remainingCredits <= 0) {
      return res
        .status(400)
        .json({ message: "No credits remaining on this pass." });
    }

    res.status(200).json(pass);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
