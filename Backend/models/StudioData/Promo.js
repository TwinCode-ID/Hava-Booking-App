const mongoose = require("mongoose");

const voucherSchema = new mongoose.Schema({
  code: { type: String, required: true, uppercase: true },
  isUsed: { type: Boolean, default: false },
  usedAt: { type: Date },
});

const promoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, maxlength: 1000 },

    // ADDED "admin" to the enum
    promoType: {
      type: String,
      enum: ["bulk", "static", "admin"],
      default: "bulk",
    },

    // FOR BULK PROMOS
    prefix: {
      type: String,
      uppercase: true,
      trim: true,
      maxlength: 20,
      match: /^[A-Z0-9_-]*$/,
    },
    codes: [voucherSchema],

    // FOR STATIC & ADMIN PROMOS
    staticCode: {
      type: String,
      uppercase: true,
      trim: true,
      maxlength: 64,
      match: /^[A-Z0-9_-]*$/,
    },
    maxUsageLimit: { type: Number, min: 1, max: 1_000_000, default: 100 },
    currentUsageCount: { type: Number, min: 0, default: 0 },
    usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],

    discountType: {
      type: String,
      enum: ["percentage", "fixed", "buy_x_get_y"],
      required: true,
    },
    discountValue: { type: Number, min: 0, max: 1_000_000_000_000, default: 0 },
    buyX: { type: Number, min: 0, max: 1000, default: 0 },
    getY: { type: Number, min: 0, max: 1000, default: 0 },
    minItemsRequired: { type: Number, min: 1, max: 1000, default: 1 },
    isActive: { type: Boolean, default: true },
    studioLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Studios",
      required: true,
    },
    validUntil: { type: Date },
  },
  { timestamps: true },
);

promoSchema.index({ title: 1, studioLocation: 1 }, { unique: true });

module.exports = mongoose.model("Promo", promoSchema);
