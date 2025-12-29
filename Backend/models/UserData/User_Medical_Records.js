const mongoose = require("mongoose");

const UserMedicalRecordsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      require: true,
    },
    dateOfBirth: { type: Date, require: true },
    sex: { type: String, enum: ["Male", "Female"], require: true },
    maritalStatus: {
      type: String,
      enum: ["Single", "Married", "Others"],
      require: true,
    },
    occupation: { type: String, require: true },
    address: { type: String, require: true },
    dailyActivity: { type: String, require: true },
    physicalConcern: { type: String, require: true },
    termsAndConditions: { type: Boolean, require: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "User_Medical_Records",
  UserMedicalRecordsSchema
);
