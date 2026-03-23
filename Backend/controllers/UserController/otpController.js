const { sendEmail } = require("../../helper/sendEmail");
const User = require("../../models/UserData/User");
const OTP = require("../../models/OTP/OTP");
const OtpLog = require("../../models/OTP/OtpLog");
const jwt = require("jsonwebtoken");

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "60d" });
};

// --- A. REQUEST OTP ---
exports.requestOTP = async (req, res) => {
  try {
    const { email } = req.body;

    // 1. Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // --- APPLE REVIEW BYPASS ---
    // Check if the requesting email is the dedicated Apple Reviewer account
    if (email === process.env.APPLE_REVIEW_EMAIL) {
      // Skip rate limits, DB logging, and email sending entirely.
      // Just tell the app it succeeded so the UI moves to the verification screen.
      return res.status(200).json({ message: "OTP sent to your email." });
    }
    // ---------------------------

    // --- CHECK 1: 1-MINUTE INTERVAL ---
    const lastRequest = await OtpLog.findOne({ email }).sort({ createdAt: -1 });

    if (lastRequest) {
      const timeDiff = Date.now() - lastRequest.createdAt.getTime();
      if (timeDiff < 60 * 1000) {
        const secondsLeft = Math.ceil((60000 - timeDiff) / 1000);
        return res.status(429).json({
          error: `Please wait ${secondsLeft} seconds before requesting again.`,
        });
      }
    }

    // --- CHECK 2: MAX 5 PER HOUR ---
    const requestCount = await OtpLog.countDocuments({ email });

    if (requestCount >= 5) {
      return res.status(429).json({
        error:
          "Too many attempts. You can only request 5 OTPs per hour. Please try again later.",
      });
    }

    // --- ALL CHECKS PASSED: GENERATE OTP ---
    const generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();

    await OTP.deleteOne({ email });

    await OTP.create({
      email,
      otp: generatedOTP,
    });

    await OtpLog.create({ email });

    await sendEmail(user.fullName || "User", email, generatedOTP);

    res.status(200).json({ message: "OTP sent to your email." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- B. VERIFY OTP ---
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // --- APPLE REVIEW BYPASS ---
    if (email === process.env.APPLE_REVIEW_EMAIL) {
      if (otp !== process.env.APPLE_REVIEW_OTP) {
        return res.status(400).json({ error: "Invalid or expired OTP." });
      }

      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ error: "User not found." });
      }

      // Login successful for Apple Reviewer
      return res.status(200).json({
        message: "Login successful",
        fullName: user.fullName,
        email: user.email,
        userId: user._id,
        role: user.role,
        token: generateToken(user._id),
      });
    }
    // ---------------------------

    // 1. Find the OTP record for normal users
    const validOTP = await OTP.findOne({ email, otp });

    // 2. Validation
    if (!validOTP) {
      return res.status(400).json({ error: "Invalid or expired OTP." });
    }

    // 3. OTP is correct! -> Log them in
    const user = await User.findOne({ email });

    // 4. SECURITY CRITICAL: Delete the OTP immediately
    await OTP.deleteOne({ _id: validOTP._id });

    res.status(200).json({
      message: "Login successful",
      fullName: user.fullName,
      email: user.email,
      userId: user._id,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
