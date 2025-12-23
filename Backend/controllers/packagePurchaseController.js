const mongoose = require("mongoose");
const PackagePurchase = require("../models/PackagePurchase");
const UserPasses = require("../models/User_Passes");
const Packages = require("../models/Packages"); // Assuming you have this model

// --- 1. CREATE PURCHASE (User initiates request) ---
exports.createPurchase = async (req, res) => {
  try {
    const {
      userId,
      packageId,
      totalAmount,
      paymentMethod,
      paymentIssuer,
      issuingStudio,
    } = req.body;

    // 1. Get Package Details (to calculate credits/expiry if needed later)
    const packageInfo = await Packages.findById(packageId);
    if (!packageInfo) throw new Error("Package not found");

    // 2. Create the Purchase Record (Status: Unconfirmed)
    const newPurchase = new PackagePurchase({
      transactionId: `TRX-${Date.now()}-${Math.floor(Math.random() * 1000)}`, // Simple auto-gen ID
      userId,
      packageId,
      purchaseDate: new Date(),
      expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24), // Temp expiry for payment window (24h)
      creditsPurchased: packageInfo.credits, // Assuming Package schema has 'credits'
      totalAmount,
      paymentMethod,
      paymentIssuer,
      issuingStudio,
      isPaymentConfirmed: false, // Pending Admin Approval
    });

    await newPurchase.save();

    res.status(201).json({
      message: "Purchase initiated. Waiting for payment confirmation.",
      purchase: newPurchase,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// --- 2. CONFIRM PAYMENT (Admin Action) ---
// This is the magic step: It verifies payment AND gives the user their credits.
exports.confirmPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { purchaseId } = req.params;
    // const { adminId } = req.user; // If you have auth

    // A. Find the Purchase
    const purchase = await PackagePurchase.findById(purchaseId).session(
      session
    );
    if (!purchase) throw new Error("Purchase record not found.");
    if (purchase.isPaymentConfirmed)
      throw new Error("This payment is already confirmed.");

    // B. Get Package Details (To know duration & rules)
    const packageDetails = await Packages.findById(purchase.packageId).session(
      session
    );
    if (!packageDetails) throw new Error("Associated package data missing.");

    // C. Calculate Real Expiry Date (e.g., Purchase Date + 30 Days)
    // Assuming packageDetails.validityDays exists
    const validUntil = new Date();
    validUntil.setDate(
      validUntil.getDate() + (packageDetails.validityDays || 30)
    );

    // D. Create the USER PASS (The actual credits)
    const newUserPass = new UserPasses({
      userId: purchase.userId,
      packageId: purchase.packageId,
      purchaseDate: new Date(),
      expiryDate: validUntil,
      remainingCredits: purchase.creditsPurchased,
      isActive: true,
      instructorType: packageDetails.instructorType, // Inherit from Package
    });

    await newUserPass.save({ session });

    // E. Update Purchase Status
    purchase.isPaymentConfirmed = true;
    purchase.expiryDate = validUntil; // Update to real expiry
    await purchase.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      message: "Payment confirmed and Credits assigned to user.",
      passId: newUserPass._id,
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ error: error.message });
  } finally {
    session.endSession();
  }
};

// --- 3. UPLOAD PROOF OF PAYMENT (User Action) ---
exports.uploadProof = async (req, res) => {
  try {
    const { purchaseId } = req.params;
    const { proofUrl } = req.body; // URL from S3/Cloudinary

    const purchase = await PackagePurchase.findByIdAndUpdate(
      purchaseId,
      { proofOfPayment: proofUrl },
      { new: true }
    );

    res.status(200).json({ message: "Proof uploaded", purchase });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// --- 4. GET MY PURCHASES ---
exports.getMyPurchases = async (req, res) => {
  try {
    const { userId } = req.params;
    const history = await PackagePurchase.find({ userId })
      .populate("packageId", "packageName price")
      .sort({ createdAt: -1 });

    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
