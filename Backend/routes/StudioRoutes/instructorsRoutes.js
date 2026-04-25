const express = require("express");
const {
  createInstructor,
  updateProfile,
  getPublicProfile,
  deleteInstructor,
  instructorStatus,
  getAllInstructors,
  toggleInstructorShift,
} = require("../../controllers/StudioDataController/instructorsController");
const { protect, studioAdmin } = require("../../middlewares/authMiddleware");

const router = express.Router();

router.post("/create-instructor", protect, studioAdmin, createInstructor);
// NOTE: Shift route must be above /:id to prevent 404 errors
router.put(
  "/:id/shift/:shiftId/toggle",
  protect,
  studioAdmin,
  toggleInstructorShift,
);
router.put("/:id/update-profile", protect, studioAdmin, updateProfile);
router.get("/:id", protect, getPublicProfile);
router.delete("/:id", protect, studioAdmin, deleteInstructor);
router.put("/:id", protect, studioAdmin, instructorStatus);
router.get("/", getAllInstructors);

module.exports = router;
