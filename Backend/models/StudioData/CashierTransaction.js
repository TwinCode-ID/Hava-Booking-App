const mongoose = require("mongoose");

const CashierTransactionSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, unique: true },
    issuingStudio: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Studios",
      required: true,
    },
    cashierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // UPDATED: Added qty to properly track cart items
    packages: [
      {
        packageId: { type: mongoose.Schema.Types.ObjectId, ref: "Packages" },
        priceAtPurchase: { type: Number },
        qty: { type: Number, default: 1 },
      },
    ],

    // --- FINANCIAL LOGGING ---
    totalAmount: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    promoCodeApplied: { type: String, default: null },

    // --- PAYMENT DETAILS ---
    paymentMethod: {
      type: String,
      enum: ["cash", "edc", "bank_transfer", "qris", "other"],
      required: true,
    },
    paymentDetails: {
      edcType: { type: String, enum: ["credit", "debit", null] },
      last4: { type: String },
      approvalCode: { type: String },
      bank: { type: String },
    },

    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("CashierTransaction", CashierTransactionSchema);
