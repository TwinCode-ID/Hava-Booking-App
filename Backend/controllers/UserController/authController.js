const User = require("../../models/UserData/User");
const jwt = require("jsonwebtoken");

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "60d" });
};

exports.checkUserStatus = async (req, res) => {
  try {
    const { email } = req.body;

    // 1. Find user by email
    const user = await User.findOne({ email });

    // 2. If user doesn't exist
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        hasPassword: false,
      });
    }

    // 3. Check if password field is populated
    // (Assuming empty string "" means no password)
    const hasPassword = !!user.password && user.password.length > 0;

    // 4. Return status
    res.status(200).json({
      success: true,
      hasPassword: hasPassword,
      role: user.role, // Optional: useful if you want to redirect based on role early
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.register = async (req, res) => {
  try {
    const { fullName, email, password, phoneNumber, role, avatar } = req.body;
    const emailExists = await User.findOne({ email });

    // const phoneNumberExists = await User.findOne({ phoneNumber });

    if (emailExists)
      return res.status(400).json({ message: "User already exists" });

    const user = await User.create({
      fullName,
      email,
      password: password || "",
      phoneNumber,
      role,
      avatar,
    });

    res.status(201).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber || "",
      preferredStudioId: user.preferredStudioId || "",
      role: user.role,
      adminStudioLocation: user.adminStudioLocation || "",
      avatar: user.avatar || "",
      token: generateToken(user._id),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      res.status(401).json({ message: "Invalid Credentials" });
    }

    res.status(201).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      preferredStudioId: user.preferredStudioId || "",
      role: user.role,
      adminStudioLocation: user.adminStudioLocation || "",
      avatar: user.avatar || "",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.checkAuth = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      res.status(401).json({ message: "Invalid Credentials" });
    }

    res.status(201).json({
      success: "true",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMe = async (req, res) => {
  res.json(req.user);
};
