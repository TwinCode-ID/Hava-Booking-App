const express = require("express");
const router = express.Router();
const {
  createBooking,
  cancelBooking,
  getMyBooking,
  getStudioBooking,
  studentCheckIn,
  getClassBookings,
  getUserBookings,
} = require("../../controllers/ClassBookingController/classBookingController");
const { protect, studioAdmin } = require("../../middlewares/authMiddleware");

// POST /api/bookings - User books a class
router.get("/", protect, getMyBooking);
router.get("/studio", protect, studioAdmin, getStudioBooking);
router.post("/", protect, createBooking);
router.post("/bookings", protect, studioAdmin, getUserBookings);
router.post("/cancel", protect, cancelBooking);
router.put("/:bookingId", protect, studioAdmin, studentCheckIn);
router.get("/class/:classId", protect, studioAdmin, getClassBookings);

module.exports = router;
