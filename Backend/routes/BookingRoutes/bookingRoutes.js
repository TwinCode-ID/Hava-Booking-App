const express = require("express");
const router = express.Router();
const {
  createBooking,
  cancelBooking,
  getMyBooking,
} = require("../../controllers/ClassBookingController/classBookingController");
const { protect } = require("../../middlewares/authMiddleware");

// POST /api/bookings - User books a class
router.get("/", protect, getMyBooking);
router.post("/", protect, createBooking);
router.post("/cancel", protect, cancelBooking);

module.exports = router;
