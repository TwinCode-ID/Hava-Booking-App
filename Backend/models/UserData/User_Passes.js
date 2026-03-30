const mongoose = require("mongoose");

const user_passesSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    packageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Packages",
      required: true,
    },
    freeze: {
      hasBeenFrozen: { type: Boolean, default: false }, // Enforces 1-time freeze rule
      startDate: { type: Date, default: null },
      endDate: { type: Date, default: null },
      status: {
        type: String,
        enum: ["none", "requested", "approved", "rejected"],
        default: "none",
      },
    },
    issuingStudio: { type: mongoose.Schema.Types.ObjectId, ref: "Studios" },
    purchaseDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    validityDuration: { type: Number, required: true },
    firstUsageDate: { type: Date, default: null },
    initialCredits: { type: Number, required: true },
    remainingCredits: { type: Number, required: true },
    isActive: { type: Boolean, required: true, default: true },
    instructorType: { type: [String], required: true, default: [] },
    classType: { type: [String], required: true, default: [] },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User_Passes", user_passesSchema);
