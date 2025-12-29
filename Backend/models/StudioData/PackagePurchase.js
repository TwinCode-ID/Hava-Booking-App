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

    status: {
      type: String,
      enum: [
        "pending",
        "waiting_confirmation",
        "payment_rejected",
        "confirmed",
        "expired",
      ],
      default: "pending",
    },

    rejectionReason: { type: String, default: null },

    creditsPurchased: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    paymentMethod: {
      type: String,
      enum: ["Bank Transfer", "QRIS", "Pay At Studio"],
      required: true,
    },
    paymentIssuer: { type: String, required: true },
    proofOfPayment: { type: String, default: null },
    issuingStudio: { type: mongoose.Schema.Types.ObjectId, ref: "Studios" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Package_Purchase", PackagePurchaseSchema);
