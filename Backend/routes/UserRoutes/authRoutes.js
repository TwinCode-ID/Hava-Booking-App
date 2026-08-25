const express = require("express");
const {
  register,
  login,
  getMe,
  checkAuth,
  checkUserStatus,
  loginWithApple,
  loginWithAppleWeb,
  loginWithGoogle,
} = require("../../controllers/UserController/authController");
const {
  optionalProtect,
  protect,
  studioAdmin,
} = require("../../middlewares/authMiddleware");
const {
  authAccountLimiter,
  authIpLimiter,
  otpRequestLimiter,
  otpVerifyLimiter,
  sensitiveActionLimiter,
} = require("../../middlewares/rateLimitMiddleware");
const {
  uploadProfile,
  uploadProof,
  uploadStudio,
} = require("../../middlewares/uploadMiddleware");
const {
  requestOTP,
  verifyOTP,
} = require("../../controllers/OTPController/otpController");
const { getPublicApiOrigin } = require("../../config/security");
const router = express.Router();

router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

router.post(
  "/register",
  authIpLimiter,
  authAccountLimiter,
  optionalProtect,
  register,
);
router.post("/login", authIpLimiter, authAccountLimiter, login);
router.get("/me", protect, getMe);
router.post("/apple", authIpLimiter, loginWithApple);
router.post("/apple-web", authIpLimiter, loginWithAppleWeb);
router.post("/otp/request", authIpLimiter, otpRequestLimiter, requestOTP);
router.post("/otp/verify", authIpLimiter, otpVerifyLimiter, verifyOTP);
router.post(
  "/verify-password",
  protect,
  sensitiveActionLimiter,
  checkAuth,
);
router.post(
  "/check-status",
  authIpLimiter,
  authAccountLimiter,
  checkUserStatus,
);
router.post("/google", authIpLimiter, loginWithGoogle);

const getUploadedImageUrl = (req) => {
  const normalizedPath = req.file.path.replace(/\\/g, "/");
  const uploadsIndex = normalizedPath.lastIndexOf("uploads/");
  const relativePath =
    uploadsIndex >= 0 ? normalizedPath.slice(uploadsIndex) : normalizedPath;
  const encodedPath = relativePath
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  return new URL(`/${encodedPath}`, getPublicApiOrigin()).toString();
};

router.post(
  "/upload-profile",
  protect,
  sensitiveActionLimiter,
  uploadProfile.single("image"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    return res.status(200).json({ imageUrl: getUploadedImageUrl(req) });
  },
);

router.post(
  "/upload-proof",
  protect,
  sensitiveActionLimiter,
  uploadProof.single("image"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    return res.status(200).json({ imageUrl: getUploadedImageUrl(req) });
  },
);

router.post(
  "/upload-studio",
  protect,
  studioAdmin,
  sensitiveActionLimiter,
  uploadStudio.single("image"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    return res.status(200).json({ imageUrl: getUploadedImageUrl(req) });
  },
);

module.exports = router;
