const express = require("express");
const {
    createStudio, 
    getStudioById, 
    getAllStudios, 
    updateStudio, 
    deleteStudio,
} = require("../controllers/studioController");
const {protect, studioAdmin, devTeam} = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/", protect, devTeam, createStudio);
router.get("/", getAllStudios);
router.get("/:id", getStudioById);
router.put("/:id", protect, studioAdmin, updateStudio);
router.delete("/:id", protect, devTeam, deleteStudio);

module.exports = router;