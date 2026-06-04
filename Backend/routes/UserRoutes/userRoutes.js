const express = require("express");
const {
  updateProfile,
  getPublicProfile,
  deleteUser,
  getAllUsers,
  setNewUserPassword,
  updatePassword,
  updateProfileDeveloper,
  getSystemMetrics,
  saveFcmToken,
} = require("../../controllers/UserController/userController");

const {
  registerStart,
  registerFinish,
  loginStart,
  loginFinish,
} = require("../../controllers/UserController/passkeyController");

const {
  protect,
  devTeam,
  studioAdmin,
} = require("../../middlewares/authMiddleware");

const router = express.Router();

router.post("/push-token", protect, saveFcmToken);
router.get("/metrics", protect, devTeam, getSystemMetrics);
router.put("/update-password", protect, updatePassword);
router.put("/set-password", protect, setNewUserPassword);
router.get("/all", protect, getAllUsers);
router.put("/profile/:id", protect, studioAdmin, updateProfileDeveloper);
router.put("/profile", protect, updateProfile);
router.get("/:id", protect, getPublicProfile);
router.delete("/:id", protect, devTeam, deleteUser);

router.post("/passkey/register-start", protect, registerStart);
router.post("/passkey/register-finish", protect, registerFinish);
router.post("/passkey/login-start", loginStart);
router.post("/passkey/login-finish", loginFinish);

module.exports = router;
