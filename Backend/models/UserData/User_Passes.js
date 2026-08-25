const mongoose = require("mongoose");

const user_passesSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sharedWith: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User", default: [] },
    ],
    packageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Packages",
      required: true,
    },
    packageNameSnapshot: { type: String, default: "Unknown Package" },
    packageCategorySnapshot: { type: [String], default: [] },
    // Set at issuance so later package edits/deletion cannot weaken eligibility.
    // No default is intentional: legacy rows without a trustworthy snapshot
    // are classified from their source package or rejected during sharing.
    isStudentRestrictedSnapshot: { type: Boolean, immutable: true },
    freeze: {
      hasBeenFrozen: { type: Boolean, default: false },
      startDate: { type: Date, default: null },
      endDate: { type: Date, default: null },
      status: {
        type: String,
        enum: [
          "none",
          "requested",
          "approved",
          "rejected",
          "frozen",
          "unfrozen",
        ],
        default: "none",
      },
    },
    // Legacy plaintext codes are retained only so old records deserialize; all
    // new links use a non-reversible hash and explicit expiry.
    shareCode: { type: String, default: null, select: false },
    shareCodeHash: {
      type: String,
      select: false,
      unique: true,
      sparse: true,
    },
    shareExpiresAt: { type: Date, default: null },
    isShared: { type: Boolean, default: false },
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
