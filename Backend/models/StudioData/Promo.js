const mongoose = require("mongoose");

const voucherSchema = new mongoose.Schema({
  code: { type: String, required: true, uppercase: true },
  isUsed: { type: Boolean, default: false },
  usedAt: { type: Date },
});

const promoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },

    // ADDED "admin" to the enum
    promoType: {
      type: String,
      enum: ["bulk", "static", "admin"],
      default: "bulk",
    },

    // FOR BULK PROMOS
    prefix: { type: String, uppercase: true, trim: true },
    codes: [voucherSchema],

    // FOR STATIC & ADMIN PROMOS
    staticCode: { type: String, uppercase: true, trim: true },
    maxUsageLimit: { type: Number, default: 0 },
    currentUsageCount: { type: Number, default: 0 },
    usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],

    discountType: {
      type: String,
      enum: ["percentage", "fixed", "buy_x_get_y"],
      required: true,
    },
    discountValue: { type: Number, default: 0 },
    buyX: { type: Number, default: 0 },
    getY: { type: Number, default: 0 },
    minItemsRequired: { type: Number, default: 1 },
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
