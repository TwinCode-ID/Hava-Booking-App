const express = require("express");
const router = express.Router();
const { createBooking } = require("../controllers/bookingController");
const { protect } = require("../middlewares/authMiddleware");

// POST /api/bookings - User books a class
router.post("/", protect, createBooking);
router.post("/cancel", protect, createBooking);

module.exports = router;
