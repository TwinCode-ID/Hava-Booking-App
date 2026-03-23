const mongoose = require("mongoose");

const promoSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, uppercase: true, trim: true },
    title: { type: String, required: true },
    description: { type: String },

    // Type of discount: 'percentage', 'fixed', or 'buy_x_get_y'
    discountType: {
      type: String,
      enum: ["percentage", "fixed", "buy_x_get_y"],
      required: true,
    },

    // For percentage (e.g., 10 for 10%) or fixed (e.g., 50000 for Rp50k)
    discountValue: { type: Number, default: 0 },

    // For "Buy X Get Y" logic (e.g., Buy 4 Get 1 -> buyX: 4, getY: 1)
    buyX: { type: Number, default: 0 },
    getY: { type: Number, default: 0 },

    // Minimum items in cart required to apply this promo
    minItemsRequired: { type: Number, default: 1 },

    isActive: { type: Boolean, default: true },

    // Tie the promo to a specific studio
    studioLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Studios",
      required: true,
    },

    validUntil: { type: Date }, // Optional expiration date
  },
  { timestamps: true },
);

// Ensure promo codes are unique per studio
promoSchema.index({ code: 1, studioLocation: 1 }, { unique: true });

module.exports = mongoose.model("Promo", promoSchema);
