const mongoose = require("mongoose");

const packagesSchema = new mongoose.Schema(
  {
    packageName: { type: String, require: true },
    packageDescription: { type: String, require: true },
    packagePrice: { type: String, require: true },
    currency: { type: String, default: "IDR" },
    validityDays: { type: Number, require: true },
    isActive: { type: Boolean, default: true },
    instructorType: {
      type: String,
      enum: [
        "Principal Instructor",
        "Master Instructor",
        "Junior Instructor",
        "Apprentice Instructor",
      ],
      require: true,
    },
    studioLocation: { type: mongoose.Schema.Types.ObjectId, ref: "Studios" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Packages", packagesSchema);
