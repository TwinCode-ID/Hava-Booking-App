const express = require("express");
const router = express.Router();
const {
  assignPassToUser,
  getMyActivePasses,
  deductCredits,
  updateUserPass,
  getUserPassHistory,
  getMyInactivePasses,
  managePassFreeze,
  generateShareLink,
  sendShareLinkViaEmail,
  getSharedPassDetails,
  acceptSharedPass,
  passReminder,
  detachSharedPass,
  getPassForAdminScan,
} = require("../../controllers/UserController/user_passesController");
const {
  generatePass,
} = require("../../controllers/UserController/passController");
const { protect } = require("../../middlewares/authMiddleware");

router.get("/user/passes/:id", protect, generatePass);
router.get("/user/active/:userId", protect, getMyActivePasses);
router.get("/user/inactive/:userId", protect, getMyInactivePasses);
router.get("/history/:studioId", protect, getUserPassHistory);

router.post("/:passId/reminder", protect, passReminder);
// Sharing endpoints
router.post("/share/:passId", protect, generateShareLink);
router.post("/share/:passId/email", protect, sendShareLinkViaEmail);
router.get("/shared/:code", getSharedPassDetails);
router.post("/shared/:code/accept", protect, acceptSharedPass);

router.put("/update/:passId", protect, updateUserPass);
router.put("/freeze/:passId", protect, managePassFreeze);
router.post("/assign", protect, assignPassToUser);
router.post("/deduct", protect, deductCredits);

router.put("/shared/:passId/detach", protect, detachSharedPass);

router.get("/admin/scan/:passId", protect, getPassForAdminScan);

module.exports = router;
