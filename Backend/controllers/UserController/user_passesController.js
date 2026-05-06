const UserPasses = require("../../models/UserData/User_Passes");
const Package = require("../../models/StudioData/Packages");
const admin = require("../../config/firebase");
const mongoose = require("mongoose");
const { sendShareEmail } = require("../../helper/sendEmail");

exports.passReminder = async (req, res) => {
  try {
    const { passId } = req.params;

    const pass = await UserPasses.findById(passId)
      .populate("userId", "fullName fcmTokens")
      .populate("packageId", "packageName reminderDaysBefore");

    if (!pass) return res.status(404).json({ message: "Pass not found" });

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
  try {
    const { userId, packageId, durationInDays, issuingStudio } = req.body;

    const selectedPackage = await Package.findById(packageId);
    if (!selectedPackage) throw new Error("Package not found");

    const purchaseDate = new Date();
    const expiryDate = new Date(purchaseDate);
    expiryDate.setDate(expiryDate.getDate() + durationInDays);

    let passesToCreate = [];

    if (selectedPackage.isCombo && selectedPackage.comboItems.length > 0) {
      passesToCreate = selectedPackage.comboItems.map((item) => ({
        userId,
        packageId,
        packageNameSnapshot: selectedPackage.packageName,
        packageCategorySnapshot: selectedPackage.packageCategory,
        purchaseDate,
        expiryDate,
        validityDuration: durationInDays,
        firstUsageDate: null,
        issuingStudio: issuingStudio || selectedPackage.studioLocation,
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
          purchaseDate,
          expiryDate,
          validityDuration: durationInDays,
          firstUsageDate: null,
          remainingCredits: req.body.credits || selectedPackage.credits,
          initialCredits: req.body.credits || selectedPackage.credits,
          instructorType:
            req.body.instructorType || selectedPackage.instructorType,
          classType: req.body.classType || selectedPackage.classType,
          isActive: true,
        },
      ];
    }

    const savedPasses = await UserPasses.insertMany(passesToCreate);

    res.status(201).json({
      message: selectedPackage.isCombo
        ? "Combo passes assigned successfully."
        : "Pass assigned.",
      passes: savedPasses,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deductCredits = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId, passId, creditsToDeduct } = req.body;

    const userPass = await UserPasses.findOne({
      _id: passId,
      $or: [{ userId: userId }, { sharedWith: userId }],
    }).session(session);

    if (!userPass) throw new Error("Pass not found or unauthorized.");
    if (!userPass.isActive) throw new Error("This pass is inactive.");
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

    userPass.remainingCredits -= creditsToDeduct;
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
    res.status(400).json({ error: error.message });
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

    if (remainingCredits !== undefined)
      pass.remainingCredits = Number(remainingCredits);
    if (expiryDate) pass.expiryDate = new Date(expiryDate);
    if (validityDuration) pass.validityDuration = Number(validityDuration);
    if (instructorType) pass.instructorType = instructorType;
    if (classType) pass.classType = classType;

    const now = new Date();
    pass.isActive = pass.expiryDate > now && pass.remainingCredits > 0;

    await pass.save();
    res.status(200).json({ message: "Pass updated successfully", pass });
  } catch (error) {
    res.status(500).json({ error: error.message });
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

    // 1. Auto-Clean: Proactively set isActive to false for any passes that hit 0 credits or expired
    // This acts as a safety net in case credits were deducted manually in the database
    await UserPasses.updateMany(
      {
        $or: [{ userId: userId }, { sharedWith: userId }],
        isActive: true,
        $or: [{ remainingCredits: { $lte: 0 } }, { expiryDate: { $lt: now } }],
      },
      { $set: { isActive: false } },
    );

    // 2. Fetch ONLY truly active passes with credits > 0
    const activePasses = await UserPasses.find({
      $or: [{ userId: userId }, { sharedWith: userId }],
      remainingCredits: { $gt: 0 },
      $or: [
        { expiryDate: { $gte: now } },
        { expiryDate: null }, // Include passes that haven't been activated yet
      ],
    })
      .populate("userId", "fullName avatar email")
      .populate("sharedWith", "fullName avatar email")
      .populate("issuingStudio", "studioName")
      .populate("packageId", "packageName")
      .sort({ expiryDate: 1 }); // Sort by closest expiry date first

    res.status(200).json(activePasses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getMyInactivePasses = async (req, res) => {
  try {
    const userId = req.user._id;
    const inactivePasses = await UserPasses.find({
      $or: [{ userId: userId }, { sharedWith: userId }],
      $or: [
        { isActive: false },
        { remainingCredits: 0 },
        { expiryDate: { $lt: new Date() } },
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
    const history = await UserPasses.find({ issuingStudio: studioId })
      .sort({ createdAt: -1 })
      .populate("packageId")
      .populate("userId", "fullName email avatar")
      .populate("sharedWith", "fullName email avatar");
    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.detachSharedPass = async (req, res) => {
  try {
    const { passId } = req.params;
    const { userIdToDetach } = req.body;
    const requesterId = req.user._id.toString();

    const pass = await UserPasses.findById(passId);
    if (!pass) return res.status(404).json({ message: "Pass not found" });

    const ownerId = pass.userId._id
      ? pass.userId._id.toString()
      : pass.userId.toString();

    if (requesterId !== ownerId && requesterId !== userIdToDetach) {
      return res
        .status(403)
        .json({ message: "Unauthorized to detach this user." });
    }

    pass.sharedWith = pass.sharedWith.filter(
      (id) => id.toString() !== userIdToDetach,
    );

    await pass.save();

    res
      .status(200)
      .json({ message: "User successfully detached from pass.", pass });
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

    // ALLOW either the owner of the pass OR a studio admin to manage freezes
    const isOwner = ownerId === req.user._id.toString();
    const isAdmin = req.user.role === "admin" || req.user.adminStudioLocation;

    if (!isOwner && !isAdmin) {
      return res
        .status(403)
        .json({ message: "Unauthorized to manage freeze requests." });
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
      const today = new Date();
      const currentFreezeEnd = new Date(pass.freeze.endDate);

      if (today < currentFreezeEnd) {
        const unusedTime = Math.abs(currentFreezeEnd - today);
        const unusedDays = Math.ceil(unusedTime / (1000 * 60 * 60 * 24));

        const currentExpiry = new Date(pass.expiryDate);
        pass.expiryDate = new Date(
          currentExpiry.setDate(currentExpiry.getDate() - unusedDays),
        );

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
      const start = new Date(startDate || pass.freeze.startDate);
      const end = new Date(endDate || pass.freeze.endDate);

      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const currentExpiry = new Date(pass.expiryDate);
      pass.expiryDate = new Date(
        currentExpiry.setDate(currentExpiry.getDate() + diffDays),
      );

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

    pass.shareCode =
      Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    pass.isShared = true;
    await pass.save();

    res.status(200).json({ message: "Share link generated", pass });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.sendShareLinkViaEmail = async (req, res) => {
  try {
    const { passId } = req.params;
    const { email, shareLink } = req.body;

    const pass = await UserPasses.findById(passId)
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

    if (!pass.shareCode)
      return res.status(400).json({ message: "Share code not generated yet." });

    const senderName = pass.userId?.fullName || "A member";
    const packageName = pass.packageId?.packageName || "a package";

    await sendShareEmail(senderName, email, shareLink, packageName);

    res.status(200).json({ message: "Invitation email sent successfully!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getSharedPassDetails = async (req, res) => {
  try {
    const { code } = req.params;
    const pass = await UserPasses.findOne({ shareCode: code, isShared: true })
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

    res.status(200).json(pass);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.acceptSharedPass = async (req, res) => {
  try {
    const { code } = req.params;
    const acceptorId = req.user._id;

    const pass = await UserPasses.findOne({ shareCode: code, isShared: true });
    if (!pass)
      return res
        .status(404)
        .json({ message: "Invalid or expired share link." });
    if (!pass.isActive)
      return res
        .status(400)
        .json({ message: "This pass is no longer active." });

    if (pass.userId.toString() === acceptorId.toString()) {
      return res
        .status(400)
        .json({ message: "You are the owner of this pass." });
    }

    if (pass.sharedWith.includes(acceptorId)) {
      return res
        .status(400)
        .json({ message: "You are already sharing this pass." });
    }

    pass.sharedWith.push(acceptorId);
    pass.shareCode = null;

    await pass.save();

    res
      .status(200)
      .json({ message: "Pass successfully added to your account!", pass });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
