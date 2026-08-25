const express = require("express");
const router = express.Router();
const {
  createPurchase,
  uploadProof,
  adminReviewPayment,
  getMyPurchases,
  getStudioPurchasesHistory,
  createCashierBulkPurchase,
  verifyTransaction,
} = require("../../controllers/StudioDataController/packagePurchaseController");
const {
  protect,
  requireStepUp,
  studioAdmin,
} = require("../../middlewares/authMiddleware");
const { FINANCIAL_READ_SCOPE } = require("../../helper/authToken");

const requireFinancialRead = requireStepUp(
  FINANCIAL_READ_SCOPE,
  "Please verify your identity again before viewing financial data.",
);
const requireFinancialStepUpForStaff = (req, res, next) => {
  if (req.user?.role === "studioAdmin" || req.user?.role === "devTeam") {
    return requireFinancialRead(req, res, next);
  }
  return next();
};

router.post("/", protect, requireFinancialStepUpForStaff, createPurchase);
router.get(
  "/verify/:transactionId",
  protect,
  requireFinancialStepUpForStaff,
  verifyTransaction,
);
router.get(
  "/user/:userId",
  protect,
  requireFinancialStepUpForStaff,
  getMyPurchases,
);
router.get(
  "/studio/:studioId",
  protect,
  studioAdmin,
  requireFinancialRead,
  getStudioPurchasesHistory,
);
router.put(
  "/:purchaseId/proof",
  protect,
  requireFinancialStepUpForStaff,
  uploadProof,
);
// POST /api/purchases/:purchaseId/review - Admin approves or rejects payment
router.post(
  "/:purchaseId/review",
  protect,
  studioAdmin,
  requireFinancialRead,
  adminReviewPayment,
);
router.post(
  "/cashier-bulk",
  protect,
  studioAdmin,
  requireFinancialRead,
  createCashierBulkPurchase,
);

module.exports = router;
