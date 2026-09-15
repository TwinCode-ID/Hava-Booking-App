const express = require("express");
const {
  updateProfile,
  startEmailClaim,
  getPublicProfile,
  deleteUser,
  getAllUsers,
  setNewUserPassword,
  updatePassword,
  updateProfileDeveloper,
  getSystemMetrics,
  logoutAllSessions,
  saveFcmToken,
} = require("../../controllers/UserController/userController");

const {
  registerStart,
  registerFinish,
  loginStart,
  loginFinish,
  listPasskeys,
  deletePasskey,
} = require("../../controllers/UserController/passkeyController");

const {
  protect,
  requireRecentAuth,
  devTeam,
  studioAdmin,
} = require("../../middlewares/authMiddleware");
const {
  authIpLimiter,
  sensitiveActionLimiter,
} = require("../../middlewares/rateLimitMiddleware");

const router = express.Router();

router.post(
  "/push-token",
  protect,
  sensitiveActionLimiter,
  saveFcmToken,
);
router.post(
  "/logout-all",
  protect,
  sensitiveActionLimiter,
  logoutAllSessions,
);
router.get("/metrics", protect, devTeam, getSystemMetrics);
router.put(
  "/update-password",
  protect,
  requireRecentAuth,
  sensitiveActionLimiter,
  updatePassword,
);
router.put(
  "/set-password",
  protect,
  requireRecentAuth,
  sensitiveActionLimiter,
  setNewUserPassword,
);
router.get("/passkey", protect, listPasskeys);
router.delete(
  "/passkey/:authenticatorId",
  protect,
  requireRecentAuth,
  sensitiveActionLimiter,
  deletePasskey,
);
router.post(
  "/passkey/register-start",
  protect,
  requireRecentAuth,
  sensitiveActionLimiter,
  registerStart,
);
router.post(
  "/passkey/register-finish",
  protect,
  sensitiveActionLimiter,
  registerFinish,
);
router.post(
  "/passkey/login-start",
  authIpLimiter,
  loginStart,
);
router.post(
  "/passkey/login-finish",
  authIpLimiter,
  loginFinish,
);
router.get("/all", protect, studioAdmin, getAllUsers);
router.put(
  "/profile/:id",
  protect,
  studioAdmin,
  updateProfileDeveloper,
);
router.put("/profile", protect, updateProfile);
// Adds a mailbox to an account that has none. This only starts the flow; the
// code sent to the address is what actually attaches it.
router.post(
  "/email/claim",
  protect,
  sensitiveActionLimiter,
  startEmailClaim,
);
router.get("/:id", protect, getPublicProfile);
router.delete("/:id", protect, devTeam, deleteUser);

module.exports = router;
