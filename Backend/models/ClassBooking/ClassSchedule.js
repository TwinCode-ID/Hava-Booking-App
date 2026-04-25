const mongoose = require("mongoose");

const ClassScheduleSchema = new mongoose.Schema(
  {
    className: { type: String, required: true },
    description: { type: String, required: true },
    instructorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Instructors",
      required: true,
    },
    studioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Studios",
      required: true,
    },
    instructorType: { type: String, required: true },
    classType: { type: String, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    duration: { type: Number, required: true }, // in minutes
    capacity: { type: Number, required: true },
    currentEnrollment: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isRecurring: { type: Boolean, default: false },
    recurrenceGroupId: { type: String, index: true },
    recurrenceRule: {
      type: String,
      enum: ["None", "Daily", "Weekly", "Monthly"],
      default: "None",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ClassSchedule", ClassScheduleSchema);
