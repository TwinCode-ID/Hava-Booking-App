const express = require("express");
const router = express.Router();
const {
  assignPassToUser,
  getMyActivePasses,
  deductCredits,
  getUserPassHistory,
} = require("../../controllers/UserController/user_passesController");
const { protect } = require("../../middlewares/authMiddleware");

// GET /api/passes/user/:userId - Get active passes (Wallet)
router.get("/user/:userId", protect, getMyActivePasses);

// GET /api/passes/history/:userId - Get all pass history (Debug/Admin)
router.get("/history/:studioId", protect, getUserPassHistory);

// POST /api/passes/assign - Manually assign a pass (Admin/System)
router.post("/assign", protect, assignPassToUser);

// POST /api/passes/deduct - Deduct credits (Usually internal use or Admin)
router.post("/deduct", protect, deductCredits);

module.exports = router;
