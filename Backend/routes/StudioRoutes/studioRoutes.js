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
  requireStepUp,
  studioAdmin,
  devTeam,
} = require("../../middlewares/authMiddleware");
const { FINANCIAL_READ_SCOPE } = require("../../helper/authToken");

const router = express.Router();
const requireFinancialBankChange = requireStepUp(
  FINANCIAL_READ_SCOPE,
  "Verify your identity before changing payment instructions.",
);
const protectBankDetails = (req, res, next) =>
  Object.prototype.hasOwnProperty.call(req.body || {}, "bankDetails")
    ? requireFinancialBankChange(req, res, next)
    : next();

router.post("/", protect, devTeam, createStudio);
router.get("/", getAllStudios);
router.get(
  "/:id/payment-instructions",
  protect,
  studioAdmin,
  requireFinancialBankChange,
  getStudioPaymentInstructions,
);
router.get("/:id", getStudioById);
router.put(
  "/:id",
  protect,
  studioAdmin,
  protectBankDetails,
  updateStudio,
);
router.delete("/:id", protect, devTeam, deleteStudio);

module.exports = router;
