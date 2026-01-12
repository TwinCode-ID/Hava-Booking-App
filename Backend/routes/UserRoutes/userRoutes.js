const express = require("express");
const {
  updateProfile,
  getPublicProfile,
  deleteUser,
  getAllUsers,
  setNewUserPassword,
  updatePassword,
} = require("../../controllers/UserController/userController");
const { protect, devTeam } = require("../../middlewares/authMiddleware");

const router = express.Router();
router.put("/update-password", protect, updatePassword);
router.put("/set-password", protect, setNewUserPassword);
router.get("/all", protect, getAllUsers);
router.put("/profile", protect, updateProfile);
router.get("/:id", protect, getPublicProfile);
router.delete("/:id", protect, devTeam, deleteUser);

module.exports = router;
