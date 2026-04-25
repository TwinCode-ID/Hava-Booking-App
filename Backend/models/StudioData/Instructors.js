const mongoose = require("mongoose");

const workingHoursSchema = new mongoose.Schema({
  start: { type: String, require: true, match: /^([0-1]\d|2[0-3]):([0-5]\d)$/ },
  end: { type: String, require: true, match: /^([0-1]\d|2[0-3]):([0-5]\d)$/ },
  location: { type: mongoose.Schema.Types.ObjectId, ref: "Studios" },
  isActive: { type: Boolean, default: true },
});

const InstructorsSchema = new mongoose.Schema(
  {
    fullName: { type: String, require: true },
    bio: { type: String, require: true },
    assignedStudiosId: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Studios",
      require: true,
    },
    avatar: String,
    workingHours: {
      monday: [workingHoursSchema],
      tuesday: [workingHoursSchema],
      wednesday: [workingHoursSchema],
      thursday: [workingHoursSchema],
      friday: [workingHoursSchema],
      saturday: [workingHoursSchema],
      sunday: [workingHoursSchema],
    },
    instructorType: { type: String, require: true },
    instructorTier: {
      type: Number,
      enum: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      default: 1,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Instructors", InstructorsSchema);
