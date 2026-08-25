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
const { protect, studioAdmin } = require("../../middlewares/authMiddleware");

router.get("/", getClasses);
router.post("/", protect, studioAdmin, createClass);
router.get("/:id", protect, getStudioClasses);
router.put("/:id", protect, studioAdmin, updateClass);
router.put("/toggle/:id", protect, studioAdmin, toggleClass);
router.delete("/:id", protect, studioAdmin, deleteClass);

module.exports = router;
