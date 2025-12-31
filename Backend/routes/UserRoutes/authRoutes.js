const express = require("express");
const {
  register,
  login,
  getMe,
} = require("../../controllers/UserController/authController");
const { protect } = require("../../middlewares/authMiddleware");
const {
  uploadProfile,
  uploadProof,
  uploadStudio,
} = require("../../middlewares/uploadMiddleware");
const {
  requestOTP,
  verifyOTP,
} = require("../../controllers/OTPController/otpController");
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

router.post("/upload-proof", uploadProof.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  // Use req.body.userId to build the URL since req.user is missing
  const userId = req.body.userId || "unassigned";

  const imageUrl = `${req.protocol}://${req.get(
    "host"
  )}/uploads/ProofOfPurchase/${userId}/${req.file.filename}`;

  res.status(200).json({ imageUrl });
});

router.post("/upload-studio", uploadStudio.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  // Use req.body.userId to build the URL since req.user is missing
  const studioId = req.body.adminStudioLocation || "unassigned";

  const imageUrl = `${req.protocol}://${req.get(
    "host"
  )}/uploads/Studio/${studioId}/${req.file.filename}`;

  res.status(200).json({ imageUrl });
});

module.exports = router;
