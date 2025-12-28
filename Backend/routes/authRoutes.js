const express = require("express");
const { register, login, getMe } = require("../controllers/authController");
const { protect } = require("../middlewares/authMiddleware");
const { uploadProfile } = require("../middlewares/uploadMiddleware");
const { requestOTP, verifyOTP } = require("../controllers/otpController");
const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, getMe);
router.post("/otp/request", requestOTP);
router.post("/otp/verify", verifyOTP);

router.post("/upload-profile", uploadProfile.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  // Use req.body.userId to build the URL since req.user is missing
  const userId = req.body.userId || "unassigned";

  const imageUrl = `${req.protocol}://${req.get(
    "host"
  )}/uploads/UserProfile/${userId}/${req.file.filename}`;

  res.status(200).json({ imageUrl });
});

module.exports = router;
