const express = require("express");
const router = express.Router();
const {
  assignPassToUser,
  getMyActivePasses,
  deductCredits,
  updateUserPass,
  getUserPassHistory,
  getMyInactivePasses,
} = require("../../controllers/UserController/user_passesController");

const {
  generatePass,
} = require("../../controllers/UserController/passController");

const { protect } = require("../../middlewares/authMiddleware");

router.get("/user/passes/:id", protect, generatePass);

// GET /api/passes/user/:userId - Get active passes (Wallet)
router.get("/user/active/:userId", protect, getMyActivePasses);

// GET /api/passes/user/:userId - Get active passes (Wallet)
router.get("/user/inactive/:userId", protect, getMyInactivePasses);

// GET /api/passes/history/:userId - Get all pass history (Debug/Admin)
router.get("/history/:studioId", protect, getUserPassHistory);

// PUT /api/passes/update/:passId - Update a user pass (Admin)
router.put("/update/:passId", protect, updateUserPass);

// POST /api/passes/assign - Manually assign a pass (Admin/System)
router.post("/assign", protect, assignPassToUser);

// POST /api/passes/deduct - Deduct credits (Usually internal use or Admin)
router.post("/deduct", protect, deductCredits);

module.exports = router;
