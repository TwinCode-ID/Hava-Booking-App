const express = require("express");
const { register, login, getMe } = require("../controllers/authController");
const { protect } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, getMe);

router.post(
  "/upload-profile",
  protect,
  uploadProfile.single("image"),
  (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    // Construct URL based on the dynamic path
    // Result: http://localhost:5000/uploads/UserProfile/USER_ID_123/170000-me.jpg
    const imageUrl = `${req.protocol}://${req.get(
      "host"
    )}/uploads/UserProfile/${req.user._id}/${req.file.filename}`;

    // Logic to save imageUrl to your User DB...

    res.status(200).json({ imageUrl });
  }
);

module.exports = router;
