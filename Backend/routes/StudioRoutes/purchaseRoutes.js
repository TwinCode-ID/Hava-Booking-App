const express = require("express");
const router = express.Router();
const {
  createPurchase,
  uploadProof,
  adminReviewPayment,
  getMyPurchases,
  getStudioPurchasesHistory,
  createCashierBulkPurchase,
} = require("../../controllers/StudioDataController/packagePurchaseController");
const { protect } = require("../../middlewares/authMiddleware");

// POST /api/purchases - Initiate a new purchase
router.post("/", protect, createPurchase);

// GET /api/purchases/user/:userId - Get purchase history for a specific user
router.get("/user/:userId", protect, getMyPurchases);

router.get("/studio/:studioId", protect, getStudioPurchasesHistory);

// POST /api/purchases/:purchaseId/proof - User uploads proof of payment URL
router.put("/:purchaseId/proof", protect, uploadProof);

// POST /api/purchases/:purchaseId/review - Admin approves or rejects payment
router.post("/:purchaseId/review", protect, adminReviewPayment);

router.post("/cashier-bulk", protect, createCashierBulkPurchase);

module.exports = router;
