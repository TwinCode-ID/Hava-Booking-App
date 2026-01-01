const express = require("express");
const router = express.Router();
const {
  createClass,
  getClasses,
  updateClass,
  deleteClass,
  toggleClass,
} = require("../../controllers/ClassBookingController/classScheduleController");
const { protect } = require("../../middlewares/authMiddleware");
// You likely want an 'admin' middleware here too

// GET /api/schedule - Public or Protected (View Calendar)
router.get("/", getClasses);

// POST /api/schedule - Create new class (Admin only)
router.post("/", protect, createClass);

// PUT /api/schedule/:id - Update class details (Admin only)
router.put("/:id", protect, updateClass);

// DELETE /api/schedule/:id - Cancel/Delete class (Admin only)
router.put("/toggle/:id", protect, toggleClass);

router.delete("/:id", protect, deleteClass);

module.exports = router;
