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
  // 1. Initialize Session at the very start
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
      userId, // Allow passing userId directly (for Admin Assign)
    } = req.body;

    // Use req.user._id only if userId is not in body (User Purchase flow)
    const finalUserId = userId || req.user._id;

    const packageInfo = await Packages.findById(packageId).session(session);
    if (!packageInfo) throw new Error("Package not found");

    // Set 24 Hour Payment Window
    let paymentStatus;
    const paymentDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Determine status
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

    // --- AUTO-CONFIRM LOGIC (For Direct Payment or Manual Admin) ---
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
        // FIX 1: Use 'newPurchase' instead of undefined 'purchase'
        remainingCredits: newPurchase.creditsPurchased,
        initialCredits: newPurchase.creditsPurchased,
        issuingStudio: newPurchase.issuingStudio,
        isActive: true,
        // FIX 2: Use 'packageInfo' instead of undefined 'packageDetails'
        classType: packageInfo.classType,
        instructorType: packageInfo.instructorType,
      });

      await newUserPass.save({ session });

      await session.commitTransaction(); // Commit here for confirmed flow
      return res.status(200).json({
        message: "Purchase confirmed & Pass created.",
        purchase: newPurchase,
      });
    }

    // --- STANDARD FLOW ---
    await session.commitTransaction(); // Commit for standard flow
    res.status(201).json({
      message: "Purchase initiated.",
      purchaseId: newPurchase._id,
      purchase: newPurchase,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Purchase Error:", error); // Helpful for debugging
    res.status(400).json({ error: error.message });
  } finally {
    session.endSession();
  }
};

// ... (Rest of the file remains unchanged: uploadProof, adminReviewPayment, getMyPurchases, etc.)
exports.uploadProof = async (req, res) => {
  try {
    const { purchaseId } = req.params;
    const { proofUrl } = req.body;

    let purchase = await PackagePurchase.findById(purchaseId);
    if (!purchase) throw new Error("Purchase not found");

    // Check if expired
    purchase = await checkAndExpire(purchase);

    if (purchase.status === "expired") {
      return res.status(400).json({
        error: "Payment window has expired. Please make a new purchase.",
      });
    }

    if (purchase.status === "confirmed") {
      return res.status(400).json({ error: "Payment already confirmed." });
    }

    // Update status
    purchase.proofOfPayment = proofUrl;
    purchase.status = "waiting_confirmation";

    // --- IMPORTANT: Clear any previous rejection reason on new upload ---
    purchase.rejectionReason = null;

    await purchase.save();

    res.status(200).json({
      message: "Proof uploaded. Waiting for admin confirmation.",
      purchase,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.adminReviewPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { purchaseId } = req.params;
    const { action, rejectionReason, paymentIssuer } = req.body;

    let purchase = await PackagePurchase.findById(purchaseId).session(session);
    if (!purchase) throw new Error("Purchase record not found.");

    if (new Date() > purchase.paymentWindowExpiry) {
      purchase.status = "expired";
      await purchase.save({ session });
      await session.commitTransaction();
      return res.status(400).json({
        error: "Payment window expired during review.",
        status: "expired",
      });
    }

    if (action === "approve") {
      if (purchase.status === "confirmed") throw new Error("Already confirmed");

      // Here 'packageDetails' IS defined correctly because we fetch it freshly
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

      await session.commitTransaction();
      return res
        .status(200)
        .json({ message: "Payment confirmed.", passId: newUserPass._id });
    } else if (action === "reject") {
      const now = new Date();

      if (now > purchase.paymentWindowExpiry) {
        purchase.status = "expired";
        purchase.rejectionReason = "Payment window expired.";
      } else {
        purchase.status = "payment_rejected";
        purchase.rejectionReason =
          rejectionReason || "Proof rejected. Please upload a valid proof.";
      }

      await purchase.save({ session });
      await session.commitTransaction();

      return res.status(200).json({
        message: "Payment status updated.",
        status: purchase.status,
        reason: purchase.rejectionReason,
      });
    }
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ error: error.message });
  } finally {
    session.endSession();
  }
};

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
