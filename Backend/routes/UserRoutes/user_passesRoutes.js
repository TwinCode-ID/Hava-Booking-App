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
router.get("/user/active/:userId", protect, getMyActivePasses);
router.get("/user/inactive/:userId", protect, getMyInactivePasses);
router.get("/history/:studioId", protect, getUserPassHistory);
router.put("/update/:passId", protect, updateUserPass);
router.post("/assign", protect, assignPassToUser);
router.post("/deduct", protect, deductCredits);

module.exports = router;
