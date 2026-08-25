const mongoose = require("mongoose");

const packagesSchema = new mongoose.Schema(
  {
    packageName: { type: String, required: true, trim: true, maxlength: 120 },
    packageDescription: { type: String, required: true, maxlength: 2000 },
    packagePrice: { type: Number, required: true, min: 0, max: 1_000_000_000_000 },
    currency: { type: String, enum: ["IDR"], default: "IDR" },

    // NEW: Days client has to start using the package before it becomes invalid
    activationPeriodDays: { type: Number, required: true, min: 1, max: 365, default: 30 },
    // EXISTING: Days package remains valid AFTER the first use
    validityDays: { type: Number, required: true, min: 1, max: 3650 },

    isActive: { type: Boolean, default: true },
    studioLocation: { type: mongoose.Schema.Types.ObjectId, ref: "Studios" },

    packageCategory: {
      type: [String],
      enum: ["Regular", "Student"],
      default: ["Regular"],
    },

    enableExpiryReminder: { type: Boolean, default: false },
    reminderDaysBefore: { type: Number, min: 1, max: 365, default: 7 },

    isStudentPackage: { type: Boolean, default: false },
    isOneTimePurchase: { type: Boolean, default: false },
    isAvailableToFreeze: { type: Boolean, default: false },

    isPromo: { type: Boolean, default: false },
    promoPrice: { type: Number, min: 0, max: 1_000_000_000_000 },

    isCombo: { type: Boolean, default: false },

    credits: { type: Number, min: 1, max: 100000 },
    instructorType: [{ type: String, maxlength: 80 }],
    classType: [{ type: String, maxlength: 80 }],

    comboItems: [
      {
        credits: { type: Number, required: true, min: 1, max: 100000 },
        instructorType: [{ type: String, maxlength: 80, required: true }],
        classType: [{ type: String, maxlength: 80, required: true }],
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Packages", packagesSchema);
