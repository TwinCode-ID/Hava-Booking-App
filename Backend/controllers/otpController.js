const { sendEmail } = require("../helper/sendEmail");
const User = require("../models/User");
const OTP = require("../models/OTP"); // Your User Model

// --- A. REQUEST OTP (User enters email) ---
exports.requestOTP = async (req, res) => {
  try {
    const { email } = req.body;

    // 1. Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // 2. Generate a random 6-digit number
    const generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();

    // 3. Clear any existing OTPs for this email (prevent duplicates)
    await OTP.deleteOne({ email });

    // 4. Save to Database (The TTL index handles auto-expiry)
    await OTP.create({
      email,
      otp: generatedOTP,
    });

    // 5. Send via Email
    // (In production, wrap this in a try-catch so DB save isn't rolled back if email fails)
    await sendEmail(email, generatedOTP);

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
      // token: token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
