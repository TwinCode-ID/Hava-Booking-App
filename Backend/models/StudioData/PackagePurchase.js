const mongoose = require("mongoose");

const PackagePurchaseSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, unique: true },
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

    // NEW: Snapshot the name so it isn't lost if the package is deleted
    packageNameSnapshot: { type: String, required: true },

    paymentWindowExpiry: { type: Date, required: true },
    status: { type: String, default: "pending" },
    rejectionReason: { type: String, default: null },

    creditsPurchased: { type: Number, required: true, default: 0 },
    remainingCredits: { type: Number, required: true, default: 0 },

    mustActivateBy: { type: Date },
    activationDate: { type: Date },
    expiryDate: { type: Date },

    isFrozen: { type: Boolean, default: false },
    freezeStartDate: { type: Date, default: null },
    totalFrozenDays: { type: Number, default: 0 },

    totalAmount: { type: Number, required: true },

    // Promo Tracking
    promoCodeApplied: { type: String, default: null },
    discountAmount: { type: Number, default: 0 },

    paymentMethod: { type: String, required: true },
    paymentIssuer: { type: String, default: null },
    proofOfPayment: { type: String, default: null },
    issuingStudio: { type: mongoose.Schema.Types.ObjectId, ref: "Studios" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Package_Purchase", PackagePurchaseSchema);
