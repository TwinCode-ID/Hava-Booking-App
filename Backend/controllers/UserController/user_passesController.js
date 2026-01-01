const UserPasses = require("../../models/UserData/User_Passes");
const mongoose = require("mongoose");

// 1. Assign a New Pass (Usually called after successful payment)
exports.assignPassToUser = async (req, res) => {
  try {
    const { userId, packageId, credits, durationInDays, instructorType } =
      req.body;

    // Calculate Expiry Date automatically
    const purchaseDate = new Date();
    const expiryDate = new Date();
    expiryDate.setDate(purchaseDate.getDate() + durationInDays);

    const newPass = new UserPasses({
      userId,
      packageId,
      purchaseDate,
      expiryDate,
      remainingCredits: credits,
      instructorType, // e.g., "Senior Instructor"
      isActive: true,
    });

    const savedPass = await newPass.save();

    res.status(201).json({
      message: "Pass assigned successfully",
      pass: savedPass,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 2. Get User's "Wallet" (Active Passes only)
exports.getMyActivePasses = async (req, res) => {
  try {
    const { userId } = req.params;

    // Find passes that are Active AND Not Expired AND Have Credits
    const activePasses = await UserPasses.find({
      userId: userId,
      // isActive: true,
      // remainingCredits: { $gt: 0 }, // Greater than 0
      // expiryDate: { $gte: new Date() }, // Future date
    })
      .populate("issuingStudio", "studioName")
      .populate("packageId", "packageName") // Optional: show package name
      .sort({ isActive: -1, expiryDate: 1 }); // Show passes expiring soonest first

    res.status(200).json(activePasses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 2. Get User's "Wallet" (Active Passes only)
exports.getMyInactivePasses = async (req, res) => {
  try {
    const { userId } = req.params;

    // Find passes that are Active AND Not Expired AND Have Credits
    const activePasses = await UserPasses.find({
      userId: userId,
      isActive: false,
    })
      .populate("issuingStudio", "studioName")
      .populate("packageId", "packageName") // Optional: show package name
      .sort({ expiryDate: 1 }); // Show passes expiring soonest first

    res.status(200).json(activePasses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 3. Deduct Credits (Called when Booking a Class)
exports.deductCredits = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId, passId, creditsToDeduct } = req.body;

    // Find the pass safely
    const userPass = await UserPasses.findOne({
      _id: passId,
      userId: userId,
    }).session(session);

    if (!userPass) {
      throw new Error("Pass not found.");
    }

    // Validation Checks
    if (!userPass.isActive) {
      throw new Error("This pass is inactive.");
    }
    if (new Date() > userPass.expiryDate) {
      throw new Error("This pass has expired.");
    }
    if (userPass.remainingCredits < creditsToDeduct) {
      throw new Error("Insufficient credits on this pass.");
    }

    // Perform Deduction
    userPass.remainingCredits -= creditsToDeduct;

    // Optional: Auto-deactivate if 0 credits left
    if (userPass.remainingCredits === 0) userPass.isActive = false;

    await userPass.save({ session });
    await session.commitTransaction();

    res.status(200).json({
      message: "Credits deducted successfully",
      remaining: userPass.remainingCredits,
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ error: error.message });
  } finally {
    session.endSession();
  }
};

// 4. Admin/Debug: Get All History for a User (Including expired)
exports.getUserPassHistory = async (req, res) => {
  try {
    const { studioId } = req.params;
    const history = await UserPasses.find({ issuingStudio: studioId })
      .sort({
        createdAt: -1,
      })
      .populate("packageId")
      .populate("userId", "fullName email");
    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
