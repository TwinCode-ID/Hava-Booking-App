const express = require("express");
const router = express.Router();
const { protect, studioAdmin } = require("../../middlewares/authMiddleware"); // Adjust path as needed
const {
  getStudioConfig,
  addConfigType,
  removeConfigType,
} = require("../../controllers/StudioDataController/studioConfigController");

// Base path: /api/config
router.get("/:studioId", protect, getStudioConfig);
router.post("/add/:studioId", protect, studioAdmin, addConfigType);
router.post("/remove/:studioId", protect, studioAdmin, removeConfigType);

module.exports = router;
