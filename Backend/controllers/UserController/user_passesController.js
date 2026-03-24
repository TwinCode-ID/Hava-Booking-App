const UserPasses = require("../../models/UserData/User_Passes");
const Package = require("../../models/StudioData/Packages");
const mongoose = require("mongoose");

exports.assignPassToUser = async (req, res) => {
  try {
    const { userId, packageId, durationInDays } = req.body;

    const selectedPackage = await Package.findById(packageId);
    if (!selectedPackage) throw new Error("Package not found");

    const purchaseDate = new Date();
    const expiryDate = new Date(purchaseDate);
    expiryDate.setDate(expiryDate.getDate() + durationInDays);

    let passesToCreate = [];

    // Check if it's a combo package to map multiple items
    if (selectedPackage.isCombo && selectedPackage.comboItems.length > 0) {
      passesToCreate = selectedPackage.comboItems.map((item) => ({
        userId,
        packageId,
        purchaseDate,
        expiryDate,
        validityDuration: durationInDays,
        firstUsageDate: null,
        remainingCredits: item.credits,
        initialCredits: item.credits,
        instructorType: item.instructorType,
        classType: item.classType,
        isActive: true,
      }));
    } else {
      passesToCreate = [
        {
          userId,
          packageId,
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
      userId: userId,
    }).session(session);

    if (!userPass) throw new Error("Pass not found.");
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

exports.getMyActivePasses = async (req, res) => {
  try {
    const { userId } = req.params;
    const activePasses = await UserPasses.find({ userId: userId })
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
