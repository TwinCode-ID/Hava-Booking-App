const User = require("../../models/UserData/User");
const jwt = require("jsonwebtoken");
const appleSignin = require("apple-signin-auth");
const { OAuth2Client } = require("google-auth-library");

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "60d" });
};

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.loginWithGoogle = async (req, res) => {
  try {
    const { idToken } = req.body;

    // 1. Verify the Identity Token with Google
    const ticket = await googleClient.verifyIdToken({
      idToken: idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    const { sub: googleUserId, email, name, picture } = payload;

    console.log("GOOGLE PAYLOAD:", payload);

    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
      name || email.split("@")[0],
    )}&background=047857&color=fff`;

    const finalAvatarUrl = picture || defaultAvatar;

    let user = await User.findOne({ googleUserId });

    if (user) {
      if (!user.avatar) {
        user.avatar = finalAvatarUrl;
        await user.save();
      }

      return res.status(200).json({
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        avatar: user.avatar || "",
        token: generateToken(user._id),
      });
    }

    user = await User.findOne({ email });

    if (user) {
      user.googleUserId = googleUserId;

      if (!user.avatar) {
        user.avatar = finalAvatarUrl;
      }

      await user.save();

      return res.status(200).json({
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        avatar: user.avatar || "",
        token: generateToken(user._id),
      });
    }

    user = await User.create({
      fullName: name || email.split("@")[0],
      email: email,
      googleUserId: googleUserId,
      password: "",
      role: "client",
      phoneNumber: "",
      avatar: finalAvatarUrl,
    });

    res.status(201).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      avatar: user.avatar || "",
      token: generateToken(user._id),
    });
  } catch (err) {
    console.error("Google Login Error:", err);
    res.status(500).json({ message: "Failed to authenticate with Google" });
  }
};

exports.checkUserStatus = async (req, res) => {
  try {
    const { email } = req.body;

    // 1. Find user by email
    const user = await User.findOne({ email }).select("+password");

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
    const {
      fullName,
      email,
      password,
      phoneNumber,
      role,
      avatar,
      adminStudioLocation,
    } = req.body;
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
      adminStudioLocation,
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
    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid Credentials" });
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

exports.loginWithApple = async (req, res) => {
  try {
    const { identityToken, fullName } = req.body;

    // 1. Verify the Identity Token with Apple
    // This ensures the request is coming from a real Apple user
    const { sub: appleUserId, email } = await appleSignin.verifyIdToken(
      identityToken,
      {
        // Optional: Add your Client ID (Bundle ID) to be extra secure
        audience: process.env.APPLE_CLIENT_ID,
        ignoreExpiration: true, // Sometimes helps with slight clock skews
      },
    );

    // 2. Check if user exists by Apple ID
    let user = await User.findOne({ appleUserId });

    if (user) {
      // User found! Log them in.
      return res.status(200).json({
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        avatar: user.avatar || "",
        token: generateToken(user._id),
      });
    }

    // 3. If not found by Apple ID, check by Email (Link Accounts)
    // If a user previously signed up with email/pass, update them to add Apple ID
    user = await User.findOne({ email });

    if (user) {
      user.appleUserId = appleUserId;
      await user.save();

      return res.status(200).json({
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        avatar: user.avatar || "",
        token: generateToken(user._id),
      });
    }
    user = await User.create({
      fullName: fullName || email.split("@")[0],
      email: email,
      appleUserId: appleUserId,
      password: "", // No password for Apple users
      role: "client", // Default role
      phoneNumber: "",
    });

    res.status(201).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      avatar: user.avatar || "",
      token: generateToken(user._id),
    });
  } catch (err) {
    console.error("Apple Login Error:", err);
    res.status(500).json({ message: "Failed to authenticate with Apple" });
  }
};

exports.loginWithAppleWeb = async (req, res) => {
  try {
    const { identityToken, fullName } = req.body;

    // 1. Verify the Identity Token with Apple
    // This ensures the request is coming from a real Apple user
    const { sub: appleUserId, email } = await appleSignin.verifyIdToken(
      identityToken,
      {
        // Optional: Add your Client ID (Bundle ID) to be extra secure
        audience: process.env.APPLE_CLIENT_ID_WEB,
        ignoreExpiration: true, // Sometimes helps with slight clock skews
      },
    );

    // 2. Check if user exists by Apple ID
    let user = await User.findOne({ appleUserId });

    if (user) {
      // User found! Log them in.
      return res.status(200).json({
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        avatar: user.avatar || "",
        token: generateToken(user._id),
      });
    }

    // 3. If not found by Apple ID, check by Email (Link Accounts)
    // If a user previously signed up with email/pass, update them to add Apple ID
    user = await User.findOne({ email });

    if (user) {
      user.appleUserId = appleUserId;
      await user.save();

      return res.status(200).json({
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        avatar: user.avatar || "",
        token: generateToken(user._id),
      });
    }
    user = await User.create({
      fullName: fullName || email.split("@")[0],
      email: email,
      appleUserId: appleUserId,
      password: "", // No password for Apple users
      role: "client", // Default role
      phoneNumber: "",
    });

    res.status(201).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      avatar: user.avatar || "",
      token: generateToken(user._id),
    });
  } catch (err) {
    console.error("Apple Login Error:", err);
    res.status(500).json({ message: "Failed to authenticate with Apple" });
  }
};

exports.checkAuth = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid Credentials" });
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
