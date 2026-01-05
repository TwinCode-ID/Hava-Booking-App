const mongoose = require("mongoose");

const ClassBookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      require: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassSchedule",
      require: true,
    },
    isAttend: { type: Boolean, default: "false" },
    passId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User_Passes",
      require: true,
    },
    bookingDate: { type: Date, require: true },
    status: {
      type: String,
      default: "Booked",
    },
    studioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Studios",
      require: true,
    },
    instructorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Instructors",
      require: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ClassBooking", ClassBookingSchema);
