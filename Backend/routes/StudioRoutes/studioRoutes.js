const express = require("express");
const {
  createStudio,
  getStudioById,
  getAllStudios,
  getStudioPaymentInstructions,
  updateStudio,
  deleteStudio,
} = require("../../controllers/StudioDataController/studioController");
const {
  protect,
  studioAdmin,
  devTeam,
} = require("../../middlewares/authMiddleware");

const router = express.Router();

router.post("/", protect, devTeam, createStudio);
router.get("/", getAllStudios);
router.get(
  "/:id/payment-instructions",
  protect,
  studioAdmin,
  getStudioPaymentInstructions,
);
router.get("/:id", getStudioById);
router.put("/:id", protect, studioAdmin, updateStudio);
router.delete("/:id", protect, devTeam, deleteStudio);

module.exports = router;
