const mongoose = require("mongoose");

const studioConfigSchema = new mongoose.Schema(
  {
    studioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Studios",
      required: true,
      unique: true,
    },
    // Dynamic Arrays
    classTypes: {
      type: [String],
      default: ["Group", "Mat Group", "Private", "Duet"],
    },
    instructorTypes: {
      type: [String],
      default: [
        "Apprentice Instructor",
        "Junior Instructor",
        "Senior Instructor",
        "Master Instructor",
      ],
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("StudioConfig", studioConfigSchema);
