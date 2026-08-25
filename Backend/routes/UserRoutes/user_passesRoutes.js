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
const {
  protect,
  requireStepUp,
  studioAdmin,
} = require("../../middlewares/authMiddleware");
const { FINANCIAL_READ_SCOPE } = require("../../helper/authToken");
const {
  sensitiveActionLimiter,
} = require("../../middlewares/rateLimitMiddleware");

const requireFinancialAccess = requireStepUp(
  FINANCIAL_READ_SCOPE,
  "Please verify your identity again before changing pass value.",
);
const requireFinancialStepUpForStaff = (req, res, next) => {
  if (req.user?.role === "studioAdmin" || req.user?.role === "devTeam") {
    return requireFinancialAccess(req, res, next);
  }
  return next();
};

router.get("/user/passes/:id", protect, generatePass);
router.get("/user/active/:userId", protect, getMyActivePasses);
router.get("/user/inactive/:userId", protect, getMyInactivePasses);
router.get(
  "/history/:studioId",
  protect,
  studioAdmin,
  requireFinancialAccess,
  getUserPassHistory,
);

router.post("/:passId/reminder", protect, studioAdmin, passReminder);
// Sharing endpoints
router.post(
  "/share/:passId",
  protect,
  sensitiveActionLimiter,
  generateShareLink,
);
router.post(
  "/share/:passId/email",
  protect,
  sensitiveActionLimiter,
  sendShareLinkViaEmail,
);
router.get("/shared/:code", getSharedPassDetails);
router.post("/shared/:code/accept", protect, acceptSharedPass);

router.put(
  "/update/:passId",
  protect,
  studioAdmin,
  requireFinancialAccess,
  updateUserPass,
);
router.put(
  "/freeze/:passId",
  protect,
  requireFinancialStepUpForStaff,
  managePassFreeze,
);
router.post(
  "/assign",
  protect,
  studioAdmin,
  requireFinancialAccess,
  assignPassToUser,
);
router.post(
  "/deduct",
  protect,
  studioAdmin,
  requireFinancialAccess,
  deductCredits,
);

router.put("/shared/:passId/detach", protect, detachSharedPass);

router.get("/admin/scan/:passId", protect, studioAdmin, getPassForAdminScan);

module.exports = router;
