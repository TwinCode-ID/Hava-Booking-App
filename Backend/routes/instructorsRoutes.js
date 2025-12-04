const express = require("express");
const {
    createInstructor,
    updateProfile,
    getPublicProfile,
    deleteInstructor,
    instructorStatus,
    getAllInstructors,
} = require("../controllers/instructorsController");
const {protect, studioAdmin} = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/create-instructor", protect, studioAdmin, createInstructor);
router.put("/:id/update-profile", protect, studioAdmin, updateProfile);
router.get("/:id", protect, getPublicProfile);
router.delete("/:id", protect, studioAdmin, deleteInstructor);
router.put("/:id", protect, studioAdmin, instructorStatus);
router.get("/", getAllInstructors);

module.exports = router;