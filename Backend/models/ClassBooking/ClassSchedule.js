const mongoose = require("mongoose");

const ClassScheduleSchema = new mongoose.Schema(
  {
    className: { type: String, required: true },
    description: { type: String, required: true },

    // Relationships
    instructorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Instructors", // Ensure this matches your Instructor model name
      required: true,
    },
    studioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Studios", // Ensure this matches your Studio model name
      required: true,
    },

    // Class Details
    instructorType: {
      type: String,
      required: true,
    },
    classType: {
      type: String,
      required: true,
    },

    // Date & Time
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    duration: { type: Number, required: true }, // in minutes

    // Capacity & Status
    capacity: { type: Number, required: true },
    currentEnrollment: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },

    // Recurrence Logic
    isRecurring: { type: Boolean, default: false },
    recurrenceGroupId: { type: String, index: true }, // Links recurring series together
    recurrenceRule: {
      type: String,
      enum: ["None", "Daily", "Weekly", "Monthly"],
      default: "None",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ClassSchedule", ClassScheduleSchema);
