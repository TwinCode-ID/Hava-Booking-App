const mongoose = require("mongoose");

const ClassScheduleSchema = new mongoose.Schema(
  {
    // ... basic info ...
    className: { type: String, required: true }, // Fixed typo
    description: { type: String, required: true },

    // ... relationships ...
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

    // ... enums ...
    instructorType: {
      type: String,
      enum: [
        "Principal Instructor",
        "Master Instructor",
        "Senior Instructor",
        "Junior Instructor",
        "Apprentice Instructor",
        "Special Instructor",
      ],
      required: true,
    },
    classType: {
      type: String,
      enum: ["Private", "Duet", "Group", "Special Class"], // Fixed duplicate key "classType"
      required: true,
    },

    // ... Date & Time ...
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    duration: { type: Number, required: true },

    // ... Capacity ...
    capacity: { type: Number, required: true },
    currentEnrollment: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },

    // ... RECURRENCE FIELDS ...
    isRecurring: { type: Boolean, default: false },
    recurrenceGroupId: { type: String, index: true }, // Links the series
    recurrenceRule: {
      type: String,
      enum: ["None", "Daily", "Weekly", "Monthly"],
      default: "None",
    }, // e.g. "Weekly"
  },
  { timestamps: true }
);

// Compound Index to prevent double booking the same room at the same time
ClassScheduleSchema.index({ studioId: 1, startTime: 1 }, { unique: true });

module.exports = mongoose.model("Class_Schedule", ClassScheduleSchema);
