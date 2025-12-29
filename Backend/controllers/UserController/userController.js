const fs = require("fs");
const path = require("path");
const User = require("../../models/UserData/User");

exports.updateProfile = async (req, res) => {
  try {
    const {
      fullName,
      phoneNumber,
      preferredStudioId,
      adminStudioLocation,
      avatar,
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
      user.preferredStudioId = preferredStudioId || user.preferredStudioId;
      user.adminStudioLocation =
        adminStudioLocation || user.adminStudioLocation;
    }

    await user.save();

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

exports.deleteUser = async (req, res) => {
  try {
    const user = await Studio.findByIdAndDelete(req.params.id);
    if (!studio) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
