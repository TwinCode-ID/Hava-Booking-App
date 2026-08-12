const fs = require("fs");
const path = require("path");
const os = require("os");
const User = require("../../models/UserData/User");
const Studios = require("../../models/StudioData/Studios");

exports.updateProfile = async (req, res) => {
  try {
    const {
      fullName,
      phoneNumber,
      preferredStudioId,
      adminStudioLocation,
      isStudent,
      avatar,
      role,
    } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(400).json({ message: "User not found" });

    user.fullName = fullName || user.fullName;
    user.phoneNumber = phoneNumber || user.phoneNumber;
    user.avatar = avatar || user.avatar;

    // FIX: Allow both clients and studioAdmins to change student registration status
    if (isStudent !== undefined) {
      user.isStudent = isStudent;
    }

    if (user.role === "client") {
      user.preferredStudioId = preferredStudioId || user.preferredStudioId;
    }

    if (user.role === "devTeam") {
      user.role = role || user.role;
      user.preferredStudioId = preferredStudioId || user.preferredStudioId;
      user.adminStudioLocation =
        adminStudioLocation || user.adminStudioLocation;
    }

    await user.save();

    res.status(201).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber || "",
      preferredStudioId: user.preferredStudioId || "",
      role: user.role,
      adminStudioLocation: user.adminStudioLocation || "",
      avatar: user.avatar || "",
      isStudent: user.isStudent, // added to response snapshot payload
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateProfileDeveloper = async (req, res) => {
  try {
    const {
      fullName,
      phoneNumber,
      preferredStudioId,
      adminStudioLocation,
      avatar,
      isStudent,
      role,
    } = req.body;
    const user = await User.findById(req.params.id || req.user._id);
    if (!user) return res.status(400).json({ message: "User not found" });

    user.fullName = fullName || user.fullName;
    user.phoneNumber = phoneNumber || user.phoneNumber;
    user.avatar = avatar || user.avatar;

    // FIX: Allow updating student registration status for clients as well
    if (isStudent !== undefined) {
      user.isStudent = isStudent;
    }

    // DevTeam specific overrides
    if (req.user.role === "devTeam") {
      user.role = role || user.role;
      user.adminStudioLocation =
        adminStudioLocation || user.adminStudioLocation;
    }

    if (user.role === "client") {
      user.preferredStudioId = preferredStudioId || user.preferredStudioId;
    }

    await user.save();
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.setUserPassword = async (req, res) => {
  const { password, oldPassword } = req.body;
  try {
    const user = await User.findById(req.params.id).select("+password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.password) {
      user.password = password;
    } else {
      if (!(await user.matchPassword(oldPassword))) {
        return res.status(404).json({ message: "Password not matched" });
      } else {
        user.password = password;
      }
    }
    await user.save();
    res.status(201).json({ message: "Success" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.setNewUserPassword = async (req, res) => {
  const { password } = req.body;
  try {
    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.password) {
      return res
        .status(400)
        .json({
          message: "Password already exists. Use update password instead.",
        });
    }

    user.password = password;
    await user.save();
    res.status(201).json({ message: "Success" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updatePassword = async (req, res) => {
  const { password, newPassword } = req.body;
  try {
    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const hasExistingPassword = user.password && user.password !== "";

    if (hasExistingPassword) {
      const isMatch = await user.matchPassword(password);
      if (!isMatch) {
        return res
          .status(400)
          .json({ message: "Old password does not match." });
      }
    }

    // Update to new password
    user.password = newPassword;
    await user.save();

    res.status(201).json({ message: "Success" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.getPublicProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password")
      .populate("preferredStudioId", "studioName address")
      .populate("adminStudioLocation", "studioName address");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const query = req.user.role === "devTeam" ? {} : { role: "client" };
    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getSystemMetrics = async (req, res) => {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ramUsagePercent = Math.round((usedMem / totalMem) * 100);

    const yesterday = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
    const activeUsersCount = await User.countDocuments({
      updatedAt: { $gte: yesterday },
    });

    res.status(200).json({
      activeVisitors: activeUsersCount || 0,
      serverLoad: ramUsagePercent,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.saveFcmToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    const userId = req.user._id;

    if (!fcmToken) return res.status(400).json({ message: "Token required" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Prevent duplicates
    if (!user.fcmTokens.includes(fcmToken)) {
      user.fcmTokens.push(fcmToken);
      await user.save();
    }

    res.status(200).json({ message: "FCM Token saved successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
