const mongoose = require("mongoose");
const PackagePurchase = require("../../models/StudioData/PackagePurchase");
const UserPasses = require("../../models/UserData/User_Passes");
const Packages = require("../../models/StudioData/Packages");

// --- HELPER: CHECK EXPIRY ---
const checkAndExpire = async (purchase) => {
  if (["confirmed", "expired"].includes(purchase.status)) return purchase;

  const now = new Date();
  if (now > purchase.paymentWindowExpiry) {
    purchase.status = "expired";
    await purchase.save();
  }
  return purchase;
};

// --- 1. CREATE PURCHASE ---
exports.createPurchase = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      packageId,
      totalAmount,
      paymentMethod,
      paymentIssuer,
      issuingStudio,
      proofOfPayment,
      userId,
    } = req.body;

    const finalUserId = userId || req.user._id;

    const packageInfo = await Packages.findById(packageId).session(session);
    if (!packageInfo) throw new Error("Package not found");

    let paymentStatus;
    const paymentDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);

    if (paymentMethod === "pay_at_studio" || paymentMethod === "manual_admin") {
      paymentStatus = req.body.status || "pending";
    } else if (paymentMethod === "direct_payment") {
      paymentStatus = "confirmed";
    } else {
      paymentStatus = "waiting_confirmation";
    }

    const newPurchase = new PackagePurchase({
      transactionId: `TRX-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId: finalUserId,
      packageId,
      paymentWindowExpiry: paymentDeadline,
      creditsPurchased: packageInfo.credits,
      totalAmount,
      paymentMethod,
      paymentIssuer,
      proofOfPayment,
      issuingStudio,
      status: paymentStatus,
    });

    await newPurchase.save({ session });

    // --- PREPARE NOTIFICATION DATA ---
    const notificationData = await PackagePurchase.findById(newPurchase._id)
      .populate("userId", "fullName")
      .populate("packageId", "packageName")
      .session(session);

    const sendNotification = () => {
      const io = req.app.get("io");
      if (io) {
        io.to(issuingStudio._id.toString()).emit("purchase_notification", {
          role: "admin",
          type: "NEW_PURCHASE",
          message: `New purchase initiated by ${notificationData.userId?.fullName || "Client"}`,
          data: notificationData,
        });
      }
    };

    // --- AUTO-CONFIRM LOGIC ---
    if (paymentStatus === "confirmed") {
      const passExpiry = new Date();
      passExpiry.setDate(
        passExpiry.getDate() + (packageInfo.validityDays || 30),
      );

      const newUserPass = new UserPasses({
        userId: finalUserId,
        packageId: packageId,
        purchaseDate: new Date(),
        expiryDate: passExpiry,
        remainingCredits: newPurchase.creditsPurchased,
        validityDuration: packageInfo.validityDays || 30,
        initialCredits: newPurchase.creditsPurchased,
        issuingStudio: newPurchase.issuingStudio,
        isActive: true,
        classType: packageInfo.classType,
        instructorType: packageInfo.instructorType,
      });

      await newUserPass.save({ session });

      await session.commitTransaction();
      return res.status(200).json({
        message: "Purchase confirmed & Pass created.",
        purchase: newPurchase,
      });
    }

    // --- STANDARD FLOW ---
    sendNotification();

    await session.commitTransaction();
    res.status(201).json({
      message: "Purchase initiated.",
      purchaseId: newPurchase._id,
      purchase: newPurchase,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Purchase Error:", error);
    res.status(400).json({ error: error.message });
  } finally {
    session.endSession();
  }
};

// --- 2. UPLOAD PROOF ---
exports.uploadProof = async (req, res) => {
  try {
    const { purchaseId } = req.params;
    const { proofUrl } = req.body;

    let purchase = await PackagePurchase.findById(purchaseId);
    if (!purchase) throw new Error("Purchase not found");

    purchase = await checkAndExpire(purchase);

    if (purchase.status === "expired") {
      return res.status(400).json({ error: "Payment window has expired." });
    }
    if (purchase.status === "confirmed") {
      return res.status(400).json({ error: "Payment already confirmed." });
    }

    purchase.proofOfPayment = proofUrl;
    purchase.status = "waiting_confirmation";
    purchase.rejectionReason = null;

    await purchase.save();

    // Notify Admin
    const io = req.app.get("io");
    if (io) {
      await purchase.populate("userId", "fullName");
      io.to(purchase.issuingStudio.toString()).emit("purchase_notification", {
        role: "admin",
        type: "PROOF_UPLOADED",
        message: `Payment proof uploaded by ${purchase.userId?.fullName}`,
        data: purchase,
      });
    }

    res.status(200).json({ message: "Proof uploaded.", purchase });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// --- 3. ADMIN REVIEW ---
exports.adminReviewPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { purchaseId } = req.params;
    const { action, rejectionReason, paymentIssuer } = req.body;

    let purchase = await PackagePurchase.findById(purchaseId).session(session);
    if (!purchase) throw new Error("Purchase record not found.");

    if (action === "approve") {
      if (purchase.status === "confirmed") throw new Error("Already confirmed");

      const packageDetails = await Packages.findById(
        purchase.packageId,
      ).session(session);
      const passExpiry = new Date();
      passExpiry.setDate(
        passExpiry.getDate() + (packageDetails.validityDays || 30),
      );

      const newUserPass = new UserPasses({
        userId: purchase.userId,
        packageId: purchase.packageId,
        purchaseDate: new Date(),
        expiryDate: passExpiry,
        remainingCredits: purchase.creditsPurchased,
        validityDuration: packageDetails.validityDays || 30,
        initialCredits: purchase.creditsPurchased,
        issuingStudio: purchase.issuingStudio,
        isActive: true,
        classType: packageDetails.classType,
        instructorType: packageDetails.instructorType,
      });

      await newUserPass.save({ session });

      purchase.status = "confirmed";
      purchase.rejectionReason = null;
      purchase.paymentIssuer = paymentIssuer;
      await purchase.save({ session });

      // Notify Client
      const io = req.app.get("io");
      if (io) {
        io.to(purchase.userId.toString()).emit("purchase_notification", {
          role: "client",
          type: "PAYMENT_APPROVED",
          message: `Your payment for ${packageDetails.packageName} has been confirmed!`,
        });
      }

      await session.commitTransaction();
      return res
        .status(200)
        .json({ message: "Payment confirmed.", passId: newUserPass._id });
    } else if (action === "reject") {
      purchase.status = "payment_rejected";
      purchase.rejectionReason = rejectionReason || "Proof rejected.";
      await purchase.save({ session });

      // Notify Client
      const io = req.app.get("io");
      if (io) {
        io.to(purchase.userId.toString()).emit("purchase_notification", {
          role: "client",
          type: "PAYMENT_REJECTED",
          message: `Payment rejected: ${purchase.rejectionReason}`,
        });
      }

      await session.commitTransaction();
      return res
        .status(200)
        .json({ message: "Payment rejected.", status: purchase.status });
    }
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ error: error.message });
  } finally {
    session.endSession();
  }
};

// ... (Rest of exports like getMyPurchases remain unchanged)
exports.getMyPurchases = async (req, res) => {
  try {
    const { userId } = req.params;
    await PackagePurchase.updateMany(
      {
        userId: userId,
        status: { $in: ["pending", "payment_rejected"] },
        paymentWindowExpiry: { $lt: new Date() },
      },
      {
        $set: { status: "expired" },
      },
    );

    const history = await PackagePurchase.find({ userId })
      .populate("issuingStudio", "studioName")
      .populate("userId", "fullName")
      .populate("packageId", "packageName price")
      .sort({ createdAt: -1 });

    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getStudioPurchasesHistory = async (req, res) => {
  try {
    const { studioId } = req.params;
    await PackagePurchase.updateMany(
      {
        issuingStudio: studioId,
        status: { $in: ["pending", "payment_rejected"] },
        paymentWindowExpiry: { $lt: new Date() },
      },
      {
        $set: { status: "expired" },
      },
    );

    const history = await PackagePurchase.find({ issuingStudio: studioId })
      .populate("userId", "fullName")
      .populate("packageId", "packageName price")
      .sort({ createdAt: -1 });

    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
