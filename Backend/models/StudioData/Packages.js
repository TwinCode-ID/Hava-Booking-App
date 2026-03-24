const mongoose = require("mongoose");

const packagesSchema = new mongoose.Schema(
  {
    packageName: { type: String, required: true },
    packageDescription: { type: String, required: true },
    packagePrice: { type: Number, required: true },
    currency: { type: String, default: "IDR" },
    validityDays: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
    studioLocation: { type: mongoose.Schema.Types.ObjectId, ref: "Studios" },

    // Combo Package Flags
    isCombo: { type: Boolean, default: false },

    // Standard Package Fields (Optional if combo)
    credits: { type: Number },
    instructorType: { type: [String] },
    classType: { type: [String] },

    // Combo Package Fields
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
