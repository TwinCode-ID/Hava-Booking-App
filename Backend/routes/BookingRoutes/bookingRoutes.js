const express = require("express");
const router = express.Router();
const {
  createBooking,
  cancelBooking,
  getMyBooking,
  getStudioBooking,
  studentCheckIn,
} = require("../../controllers/ClassBookingController/classBookingController");
const { protect } = require("../../middlewares/authMiddleware");

// POST /api/bookings - User books a class
router.get("/", protect, getMyBooking);
router.get("/studio", protect, getStudioBooking);
router.post("/", protect, createBooking);
router.post("/cancel", protect, cancelBooking);
router.put("/:bookingId", protect, studentCheckIn);

module.exports = router;
