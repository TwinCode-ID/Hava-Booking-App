const UserMedicalRecords = require("../../models/UserData/User_Medical_Records");

// --- 1. CREATE OR UPDATE RECORD ---
exports.upsertMedicalRecord = async (req, res) => {
  try {
    const { userId } = req.params; // or req.user.id
    const data = req.body;

    // Use findOneAndUpdate with "upsert: true"
    // This means: "Find it. If found, update it. If not found, create it."
    const record = await UserMedicalRecords.findOneAndUpdate(
      { userId: userId },
      {
        $set: {
          ...data,
          userId: userId, // Ensure userId is set on create
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({
      message: "Medical record saved successfully",
      record,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// --- 2. GET RECORD ---
exports.getMedicalRecord = async (req, res) => {
  try {
    const { userId } = req.params;
    const record = await UserMedicalRecords.findOne({ userId });

    if (!record) {
      return res.status(404).json({ message: "No medical record found." });
    }

    res.status(200).json(record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
