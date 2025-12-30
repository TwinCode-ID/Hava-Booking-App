const mongoose = require("mongoose");

const user_passesSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    packageId: { type: mongoose.Schema.Types.ObjectId, ref: "Packages" },
    purchaseDate: { type: Date, require: true },
    expiryDate: { type: Date, require: true },
    remainingCredits: { type: Number, require: true },
    issuingStudio: { type: mongoose.Schema.Types.ObjectId, ref: "Studios" },
    isActive: { type: Boolean, require: true },
    instructorType: {
      type: String,
      enum: [
        "Principal Instructor",
        "Master Instructor",
        "Junior Instructor",
        "Apprentice Instructor",
        "Special Instructor",
      ],
      require: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User_Passes", user_passesSchema);
