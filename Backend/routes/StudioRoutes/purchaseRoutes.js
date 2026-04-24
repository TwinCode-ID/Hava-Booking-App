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
const { protect } = require("../../middlewares/authMiddleware");

router.post("/", protect, createPurchase);
router.get("/verify/:transactionId", verifyTransaction);
router.get("/user/:userId", protect, getMyPurchases);
router.get("/studio/:studioId", protect, getStudioPurchasesHistory);
router.put("/:purchaseId/proof", protect, uploadProof);
// POST /api/purchases/:purchaseId/review - Admin approves or rejects payment
router.post("/:purchaseId/review", protect, adminReviewPayment);
router.post("/cashier-bulk", protect, createCashierBulkPurchase);

module.exports = router;
