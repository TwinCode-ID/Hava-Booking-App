const express = require("express");
const router = express.Router();
const {
  createPurchase,
  uploadProof,
  adminReviewPayment,
  getMyPurchases,
} = require("../controllers/purchaseController");
const { protect } = require("../middlewares/authMiddleware");

// POST /api/purchases - Initiate a new purchase
router.post("/", protect, createPurchase);

// GET /api/purchases/user/:userId - Get purchase history for a specific user
router.get("/user/:userId", protect, getMyPurchases);

// POST /api/purchases/:purchaseId/proof - User uploads proof of payment URL
router.post("/:purchaseId/proof", protect, uploadProof);

// POST /api/purchases/:purchaseId/review - Admin approves or rejects payment
router.post("/:purchaseId/review", protect, adminReviewPayment);

module.exports = router;
