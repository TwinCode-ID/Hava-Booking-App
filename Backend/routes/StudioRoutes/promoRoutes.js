const express = require("express");
const router = express.Router();
const {
  createPromo,
  getPromosByStudio,
  updatePromo,
  deletePromo,
  togglePromoStatus,
  validatePromo,
} = require("../../controllers/StudioDataController/promoController");
const { protect, studioAdmin } = require("../../middlewares/authMiddleware");

// Public (Requires auth, but not necessarily studio admin)
router.post("/validate", protect, validatePromo);

// Admin Only
router.post("/", protect, studioAdmin, createPromo);
router.get("/studio/:studioId", protect, getPromosByStudio);
router.put("/:id", protect, studioAdmin, updatePromo);
router.delete("/:id", protect, studioAdmin, deletePromo);
router.put("/:id/status", protect, studioAdmin, togglePromoStatus);

module.exports = router;
