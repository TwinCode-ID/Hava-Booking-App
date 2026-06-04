const mongoose = require("mongoose");

const packagesSchema = new mongoose.Schema(
  {
    packageName: { type: String, required: true },
    packageDescription: { type: String, required: true },
    packagePrice: { type: Number, required: true },
    currency: { type: String, default: "IDR" },

    // NEW: Days client has to start using the package before it becomes invalid
    activationPeriodDays: { type: Number, required: true, default: 30 },
    // EXISTING: Days package remains valid AFTER the first use
    validityDays: { type: Number, required: true },

    isActive: { type: Boolean, default: true },
    studioLocation: { type: mongoose.Schema.Types.ObjectId, ref: "Studios" },

    packageCategory: {
      type: [String],
      enum: ["Regular", "Student"],
      default: ["Regular"],
    },

    enableExpiryReminder: { type: Boolean, default: false },
    reminderDaysBefore: { type: Number, default: 7 },

    isStudentPackage: { type: Boolean, default: false },
    isOneTimePurchase: { type: Boolean, default: false },
    isAvailableToFreeze: { type: Boolean, default: false },

    isPromo: { type: Boolean, default: false },
    promoPrice: { type: Number },

    isCombo: { type: Boolean, default: false },

    credits: { type: Number },
    instructorType: { type: [String] },
    classType: { type: [String] },

    comboItems: [
      {
        credits: { type: Number, required: true },
        instructorType: { type: [String], required: true },
        classType: { type: [String], required: true },
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Packages", packagesSchema);
