const express = require("express");
const router = express.Router();
const {
  createPromo,
  getPromosByStudio,
  updatePromo,
  deletePromo,
  togglePromoStatus,
} = require("../../controllers/StudioDataController/promoController");
const { protect, studioAdmin } = require("../../middlewares/authMiddleware");

router.post("/", protect, studioAdmin, createPromo);
router.get("/studio/:studioId", protect, getPromosByStudio);
router.put("/:id", protect, studioAdmin, updatePromo);
router.delete("/:id", protect, studioAdmin, deletePromo);
router.patch("/:id/status", protect, studioAdmin, togglePromoStatus);

module.exports = router;
