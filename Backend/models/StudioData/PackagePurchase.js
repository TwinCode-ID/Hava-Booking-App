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
    paymentWindowExpiry: { type: Date, required: true },

    // UPDATED: Supports queuing (pending -> queued -> active -> completed/expired/frozen)
    status: {
      type: String,
      default: "pending",
    },

    rejectionReason: { type: String, default: null },

    // NEW: Track credits to know when the "first package is done"
    creditsPurchased: { type: Number, required: true, default: 0 },
    remainingCredits: { type: Number, required: true, default: 0 },

    // NEW: Timeline and Queuing logic
    mustActivateBy: { type: Date }, // Set when payment is approved (Approval Date + activationPeriodDays)
    activationDate: { type: Date }, // Set when first class is attended OR when the previous queued package finishes
    expiryDate: { type: Date }, // Set upon activation (activationDate + validityDays)

    // NEW: Freeze logic specific to THIS purchase instance
    isFrozen: { type: Boolean, default: false },
    freezeStartDate: { type: Date, default: null },
    totalFrozenDays: { type: Number, default: 0 },

    totalAmount: { type: Number, required: true },
    paymentMethod: {
      type: String,
      required: true,
    },
    paymentIssuer: { type: String, default: null },
    proofOfPayment: { type: String, default: null },
    issuingStudio: { type: mongoose.Schema.Types.ObjectId, ref: "Studios" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Package_Purchase", PackagePurchaseSchema);