const UserPasses = require("../../models/UserData/User_Passes");
const mongoose = require("mongoose");

// 1. Assign a New Pass
exports.assignPassToUser = async (req, res) => {
  try {
    const {
      userId,
      packageId,
      credits,
      durationInDays,
      instructorType, // Expecting Array: ["Junior", "Senior"]
      classType, // Expecting Array: ["Mat", "Reformer"]
    } = req.body;

    const purchaseDate = new Date();
    const expiryDate = new Date();
    expiryDate.setDate(purchaseDate.getDate() + durationInDays);

    // Ensure inputs are arrays (handling legacy data or single string inputs)
    const instructorArray = Array.isArray(instructorType)
      ? instructorType
      : [instructorType];
    const classArray = Array.isArray(classType) ? classType : [classType];

    const newPass = new UserPasses({
      userId,
      packageId,
      purchaseDate,
      expiryDate,
      remainingCredits: credits,
      initialCredits: credits,
      instructorType: instructorArray,
      classType: classArray,
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

// 6. Admin: Update User Pass
exports.updateUserPass = async (req, res) => {
  try {
    const { passId } = req.params;
    const { remainingCredits, expiryDate, instructorType, classType } =
      req.body;

    const pass = await UserPasses.findById(passId);
    if (!pass) return res.status(404).json({ error: "Pass not found" });

    if (remainingCredits !== undefined)
      pass.remainingCredits = Number(remainingCredits);
    if (expiryDate) pass.expiryDate = new Date(expiryDate);

    // Update Arrays directly
    if (instructorType) pass.instructorType = instructorType;
    if (classType) pass.classType = classType;

    // Recalculate Active Status
    const now = new Date();
    const currentExpiry = pass.expiryDate;
    const isNotExpired = currentExpiry > now;
    const hasCredits = pass.remainingCredits > 0;

    pass.isActive = isNotExpired && hasCredits;

    await pass.save();

    res.status(200).json({
      message: "Pass updated successfully",
      pass,
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
      userId: userId,
    }).session(session);

    if (!userPass) throw new Error("Pass not found.");
    if (!userPass.isActive) throw new Error("This pass is inactive.");
    if (new Date() > userPass.expiryDate)
      throw new Error("This pass has expired.");
    if (userPass.remainingCredits < creditsToDeduct)
      throw new Error("Insufficient credits.");

    userPass.remainingCredits -= creditsToDeduct;

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

exports.getMyActivePasses = async (req, res) => {
  try {
    const { userId } = req.params; // SECURITY FIX: Use token ID

    const activePasses = await UserPasses.find({
      userId: userId,
    })
      .populate("userId", "fullName")
      .populate("issuingStudio", "studioName")
      .populate("packageId", "packageName")
      // Sort: Active First (Logic: -1), then by Earliest Expiry (Logic: 1)
      .sort({ isActive: -1, expiryDate: 1 });

    res.status(200).json(activePasses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 3. Get User's Inactive History
exports.getMyInactivePasses = async (req, res) => {
  try {
    const userId = req.user._id; // SECURITY FIX

    const inactivePasses = await UserPasses.find({
      userId: userId,
      // Either manually inactive OR 0 credits OR expired
      $or: [
        { isActive: false },
        { remainingCredits: 0 },
        { expiryDate: { $lt: new Date() } },
      ],
    })
      .populate("issuingStudio", "studioName")
      .populate("packageId", "packageName")
      .sort({ expiryDate: -1 }); // Show most recently expired first

    res.status(200).json(inactivePasses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// 5. Admin: Get User History
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
