const mongoose = require("mongoose");

const PackagePurchaseSchema = new mongoose.Schema(
  {
    transactionId: { type: String, require: true, unique: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      require: true,
    },
    packageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Packages",
      require: true,
    },
    purchaseDate: { type: Date, require: true },
    expiryDate: { type: Date, require: true },
    creditsPurchased: { type: Number, require: true },
    totalAmount: { type: Number, require: true },
    paymentMethod: {
      type: String,
      enum: ["Bank Transfer", "QRIS", "Pay At Studio"],
      require: true,
    },
    paymentIssuer: { type: String, require: true },
    proofOfPayment: { type: String, default: null },
    isPaymentConfirmed: { type: Boolean, default: false },
    issuingStudio: { type: mongoose.Schema.Types.ObjectId, ref: "Studios" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Package_Purchase", PackagePurchaseSchema);
