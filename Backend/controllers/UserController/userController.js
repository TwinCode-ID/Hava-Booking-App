const fs = require("fs");
const path = require("path");
const User = require("../../models/UserData/User");
const Studios = require("../../models/StudioData/Studios");

exports.updateProfile = async (req, res) => {
  try {
    const {
      fullName,
      phoneNumber,
      preferredStudioId,
      adminStudioLocation,
      avatar,
      role,
    } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(400).json({ message: "User not found" });

    user.fullName = fullName || user.fullName;
    user.phoneNumber = phoneNumber || user.phoneNumber;
    user.avatar = avatar || user.avatar;

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
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.setUserPassword = async (req, res) => {
  const { password, oldPassword } = req.body;
  try {
    const user = await User.findById(req.params.id);
    if (!user.password) {
      user.password = password;
    } else {
      if (user.password !== oldPassword) {
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
    const user = await User.findById(req.user._id);
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
    const user = await User.findById(req.user._id);
    if (await user.matchPassword(password)) {
      user.password = newPassword;
      await user.save();
      res.status(201).json({ message: "Success" });
    } else {
      throw new Error("Old password not matched.");
    }
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
    const studioLocation = req.user.adminStudioLocation;
    if (!studioLocation) {
      return res.status(401).json({ message: "Unauthorized user" });
    }
    const users = await User.find({ role: "client" })
      .select("fullName email phoneNumber _id")
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await Studios.findByIdAndDelete(req.params.id);
    if (!studio) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
