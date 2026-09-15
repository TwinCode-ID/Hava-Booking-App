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
  studioAdmin,
} = require("../../middlewares/authMiddleware");

router.post("/", protect, createPurchase);
router.get("/verify/:transactionId", protect, verifyTransaction);
router.get("/user/:userId", protect, getMyPurchases);
router.get(
  "/studio/:studioId",
  protect,
  studioAdmin,
  getStudioPurchasesHistory,
);
router.put("/:purchaseId/proof", protect, uploadProof);
// POST /api/purchases/:purchaseId/review - Admin approves or rejects payment
router.post("/:purchaseId/review", protect, studioAdmin, adminReviewPayment);
router.post(
  "/cashier-bulk",
  protect,
  studioAdmin,
  createCashierBulkPurchase,
);

module.exports = router;
