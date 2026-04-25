const express = require("express");
const router = express.Router();
const {
  createClass,
  getClasses,
  updateClass,
  deleteClass,
  toggleClass,
  getStudioClasses,
} = require("../../controllers/ClassBookingController/classScheduleController");
const { protect } = require("../../middlewares/authMiddleware");

router.get("/", getClasses);
router.post("/", protect, createClass);
router.get("/:id", protect, getStudioClasses);
router.put("/:id", protect, updateClass);
router.put("/toggle/:id", protect, toggleClass);
router.delete("/:id", protect, deleteClass);

module.exports = router;
