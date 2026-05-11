const mongoose = require("mongoose");

const exceptionSchema = new mongoose.Schema({
  startDate: { type: String, required: true },
  endDate: { type: String, required: true },
  type: {
    type: String,
    enum: ["pause", "reassign", "temp_incoming"],
    required: true,
  },
  targetStudioId: { type: mongoose.Schema.Types.ObjectId, ref: "Studios" },
  originalShiftId: { type: String },
  originalStudioId: { type: mongoose.Schema.Types.ObjectId, ref: "Studios" },
});

const workingHoursSchema = new mongoose.Schema({
  start: { type: String, require: true, match: /^([0-1]\d|2[0-3]):([0-5]\d)$/ },
  end: { type: String, require: true, match: /^([0-1]\d|2[0-3]):([0-5]\d)$/ },
  location: { type: mongoose.Schema.Types.ObjectId, ref: "Studios" },
  isActive: { type: Boolean, default: true },
  exceptions: [exceptionSchema],
});

const InstructorsSchema = new mongoose.Schema(
  {
    fullName: { type: String, require: true },
    bio: { type: String, default: "" },
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
