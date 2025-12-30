const { sendEmail } = require("../../helper/sendEmail");
const User = require("../../models/UserData/User");
const OTP = require("../../models/OTP/OTP");
const OtpLog = require("../../models/OTP/OtpLog");
const jwt = require("jsonwebtoken"); // <--- Import the new model

exports.requestOTP = async (req, res) => {
  try {
    const { email } = req.body;

    // 1. Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // --- CHECK 1: 1-MINUTE INTERVAL ---
    // Get the most recent request log for this email
    const lastRequest = await OtpLog.findOne({ email }).sort({ createdAt: -1 });

    if (lastRequest) {
      const timeDiff = Date.now() - lastRequest.createdAt.getTime();
      if (timeDiff < 60 * 1000) {
        // 60,000 ms = 1 minute
        const secondsLeft = Math.ceil((60000 - timeDiff) / 1000);
        return res.status(429).json({
          error: `Please wait ${secondsLeft} seconds before requesting again.`,
        });
      }
    }

    // --- CHECK 2: MAX 5 PER HOUR ---
    // Count how many logs exist (The DB auto-deletes logs older than 1 hour)
    const requestCount = await OtpLog.countDocuments({ email });

    if (requestCount >= 5) {
      return res.status(429).json({
        error:
          "Too many attempts. You can only request 5 OTPs per hour. Please try again later.",
      });
    }

    // --- ALL CHECKS PASSED: GENERATE OTP ---

    // Generate Code
    const generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();

    // Clear old OTP (The actual code)
    await OTP.deleteOne({ email });

    // Save new OTP
    await OTP.create({
      email,
      otp: generatedOTP,
    });

    // *** IMPORTANT: Save the Log for the checks next time ***
    await OtpLog.create({ email });

    // Send Email
    // Note: Ensure your sendEmail function accepts (name, email, otp) based on your previous code
    await sendEmail(user.fullName || "User", email, generatedOTP);

    res.status(200).json({ message: "OTP sent to your email." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- B. VERIFY OTP (User enters email + code) ---
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // 1. Find the OTP record
    // We search for both email AND the otp code
    const validOTP = await OTP.findOne({ email, otp });

    // 2. Validation
    if (!validOTP) {
      return res.status(400).json({ error: "Invalid or expired OTP." });
    }

    // 3. OTP is correct! -> Log them in
    // Fetch the user to generate a token (JWT)
    const user = await User.findOne({ email });

    // ... Generate JWT Token here ...
    // const token = generateToken(user._id);

    // 4. SECURITY CRITICAL: Delete the OTP immediately
    // Prevents "Replay Attacks" (using the same code twice)
    await OTP.deleteOne({ _id: validOTP._id });

    res.status(200).json({
      message: "Login successful",
      userId: user._id,
      token: generateToken(user._id),
      // token: token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
