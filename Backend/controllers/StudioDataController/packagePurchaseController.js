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
  try {
    const {
      packageId,
      totalAmount,
      paymentMethod,
      paymentIssuer,
      issuingStudio,
    } = req.body;

    const packageInfo = await Packages.findById(packageId);
    if (!packageInfo) throw new Error("Package not found");

    // Set 24 Hour Payment Window
    const paymentDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const { _id: userId } = req.user;
    const newPurchase = new PackagePurchase({
      transactionId: `TRX-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId,
      packageId,
      paymentWindowExpiry: paymentDeadline, // The 24h timer
      creditsPurchased: packageInfo.credits,
      totalAmount,
      paymentMethod,
      paymentIssuer,
      issuingStudio,
      status: "pending", // Initial status
    });

    await newPurchase.save();

    res.status(201).json({
      message: "Purchase initiated. Please upload proof within 24 hours.",
      purchaseId: newPurchase._id,
      purchase: newPurchase,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// --- 2. UPLOAD PROOF (User Action) ---
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

// --- 3. ADMIN REVIEW (Approve or Reject) ---
exports.adminReviewPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { purchaseId } = req.params;
    // Get rejectionReason from body
    const { action, rejectionReason } = req.body;

    let purchase = await PackagePurchase.findById(purchaseId).session(session);
    if (!purchase) throw new Error("Purchase record not found.");

    // 1. Manual Time Check inside Transaction
    if (new Date() > purchase.paymentWindowExpiry) {
      purchase.status = "expired";
      await purchase.save({ session });
      await session.commitTransaction();
      return res.status(400).json({
        error: "Payment window expired during review.",
        status: "expired",
      });
    }

    // --- SCENARIO A: APPROVE ---
    if (action === "approve") {
      if (purchase.status === "confirmed") throw new Error("Already confirmed");

      const packageDetails = await Packages.findById(
        purchase.packageId
      ).session(session);

      const passExpiry = new Date();
      passExpiry.setDate(
        passExpiry.getDate() + (packageDetails.validityDays || 30)
      );

      const newUserPass = new UserPasses({
        userId: purchase.userId,
        packageId: purchase.packageId,
        purchaseDate: new Date(),
        expiryDate: passExpiry,
        remainingCredits: purchase.creditsPurchased,
        issuingStudio: purchase.issuingStudio,
        isActive: true,
        instructorType: packageDetails.instructorType,
      });

      await newUserPass.save({ session });

      purchase.status = "confirmed";
      purchase.rejectionReason = null; // Ensure clean slate
      await purchase.save({ session });

      await session.commitTransaction();
      return res
        .status(200)
        .json({ message: "Payment confirmed.", passId: newUserPass._id });
    }

    // --- SCENARIO B: REJECT ---
    else if (action === "reject") {
      const now = new Date();

      // If time is up, force expire
      if (now > purchase.paymentWindowExpiry) {
        purchase.status = "expired";
        purchase.rejectionReason = "Payment window expired.";
      } else {
        // Time remains: Allow re-upload
        purchase.status = "payment_rejected";
        // Save the admin's note
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

// --- 4. GET MY PURCHASES (With Auto-Expiry Check) ---
exports.getMyPurchases = async (req, res) => {
  try {
    const { userId } = req.params;

    // 1. First, find any "pending" or "payment_rejected" items that have passed their deadline
    // and bulk update them to "expired" so the user sees the correct status.
    await PackagePurchase.updateMany(
      {
        userId: userId,
        status: { $in: ["pending", "payment_rejected"] },
        paymentWindowExpiry: { $lt: new Date() }, // Time is up
      },
      {
        $set: { status: "expired" },
      }
    );

    // 2. Fetch the updated list
    const history = await PackagePurchase.find({ userId })
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

    // 1. First, find any "pending" or "payment_rejected" items that have passed their deadline
    // and bulk update them to "expired" so the user sees the correct status.
    await PackagePurchase.updateMany(
      {
        issuingStudio: studioId,
        status: { $in: ["pending", "payment_rejected"] },
        paymentWindowExpiry: { $lt: new Date() }, // Time is up
      },
      {
        $set: { status: "expired" },
      }
    );

    // 2. Fetch the updated list
    const history = await PackagePurchase.find({ issuingStudio: studioId })
      .populate("userId", "fullName")
      .populate("packageId", "packageName price")
      .sort({ createdAt: -1 });

    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
