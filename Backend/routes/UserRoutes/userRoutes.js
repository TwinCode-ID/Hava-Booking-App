const express = require("express");
const {
  updateProfile,
  getPublicProfile,
  deleteUser,
} = require("../../controllers/UserController/userController");
const { protect, devTeam } = require("../../middlewares/authMiddleware");

const router = express.Router();

router.put("/profile", protect, updateProfile);
router.get("/:id", protect, getPublicProfile);
router.delete("/:id", protect, devTeam, deleteUser);

module.exports = router;
