const UserPasses = require("../../models/UserData/User_Passes");
const mongoose = require("mongoose");

// 1. Assign a New Pass
exports.assignPassToUser = async (req, res) => {
  try {
    const {
      userId,
      packageId,
      credits,
      durationInDays, // e.g., 30
      instructorType,
      classType,
    } = req.body;

    const purchaseDate = new Date();

    // 1. Set Initial Expiry based on Purchase Date
    const expiryDate = new Date(purchaseDate);
    expiryDate.setDate(expiryDate.getDate() + durationInDays);

    const instructorArray = Array.isArray(instructorType)
      ? instructorType
      : [instructorType];
    const classArray = Array.isArray(classType) ? classType : [classType];

    const newPass = new UserPasses({
      userId,
      packageId,
      purchaseDate,
      expiryDate, // Starts as Purchase + 30 days
      validityDuration: durationInDays, // Save the "30" for later
      firstUsageDate: null, // Not used yet

      remainingCredits: credits,
      initialCredits: credits,
      instructorType: instructorArray,
      classType: classArray,
      isActive: true,
    });

    const savedPass = await newPass.save();

    res.status(201).json({
      message:
        "Pass assigned. Expiry set to purchase date, will update on first use.",
      pass: savedPass,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 4. Deduct Credits (THE UPDATE LOGIC IS HERE)
exports.deductCredits = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId, passId, creditsToDeduct } = req.body;

    const userPass = await UserPasses.findOne({
      _id: passId,
      userId: userId,
    }).session(session);

    // Basic Validation
    if (!userPass) throw new Error("Pass not found.");
    if (!userPass.isActive) throw new Error("This pass is inactive.");
    if (new Date() > userPass.expiryDate)
      throw new Error("This pass has expired.");
    if (userPass.remainingCredits < creditsToDeduct)
      throw new Error("Insufficient credits.");

    // --- LOGIC: UPDATE EXPIRY ON FIRST CHECK-IN ---
    if (!userPass.firstUsageDate) {
      const now = new Date();

      // 1. Mark as used
      userPass.firstUsageDate = now;

      // 2. Recalculate Expiry: New Expiry = Check-in Date + Validity Duration
      const newExpiry = new Date(now);
      newExpiry.setDate(newExpiry.getDate() + userPass.validityDuration);

      userPass.expiryDate = newExpiry;

      console.log(`First use detected. Expiry updated to: ${newExpiry}`);
    }
    // ----------------------------------------------

    userPass.remainingCredits -= creditsToDeduct;

    if (userPass.remainingCredits === 0) userPass.isActive = false;

    await userPass.save({ session });
    await session.commitTransaction();

    res.status(200).json({
      message: "Credits deducted successfully",
      remaining: userPass.remainingCredits,
      expiryDate: userPass.expiryDate, // Return new date to frontend
      firstUsage: userPass.firstUsageDate,
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ error: error.message });
  } finally {
    session.endSession();
  }
};

// ... (Keep existing getMyActivePasses, getMyInactivePasses, updateUserPass, getUserPassHistory) ...

// 6. Admin: Update User Pass (Standard Update)
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
    if (validityDuration) pass.validityDuration = Number(validityDuration); // Allow Admin to fix duration

    if (instructorType) pass.instructorType = instructorType;
    if (classType) pass.classType = classType;

    const now = new Date();
    const isNotExpired = pass.expiryDate > now;
    const hasCredits = pass.remainingCredits > 0;

    pass.isActive = isNotExpired && hasCredits;

    await pass.save();

    res.status(200).json({ message: "Pass updated successfully", pass });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getMyActivePasses = async (req, res) => {
  try {
    const { userId } = req.params;

    const activePasses = await UserPasses.find({
      userId: userId,
    })
      .populate("userId", "fullName")
      .populate("issuingStudio", "studioName")
      .populate("packageId", "packageName")
      .sort({ isActive: -1, expiryDate: 1 });

    res.status(200).json(activePasses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getMyInactivePasses = async (req, res) => {
  try {
    const userId = req.user._id;

    const inactivePasses = await UserPasses.find({
      userId: userId,
      $or: [
        { isActive: false },
        { remainingCredits: 0 },
        { expiryDate: { $lt: new Date() } },
      ],
    })
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
      .populate("userId", "fullName email");
    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
