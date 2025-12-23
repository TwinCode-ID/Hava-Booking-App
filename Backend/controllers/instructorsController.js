const Instructor = require("../models/Instructors");

exports.createInstructor = async (req, res) => {
  try {
    const {
      fullName,
      bio,
      assignedStudiosId,
      avatar,
      workingHours,
      instructorType,
      instructorTier,
    } = req.body;
    if (!fullName) {
      return res.status(400).json({ message: "Instructor name is required" });
    }
    const instructor = await Instructor.create({
      fullName,
      bio,
      assignedStudiosId,
      avatar,
      workingHours,
      instructorType,
      instructorTier,
    });

    res.status(201).json({
      _id: instructor._id,
      fullName: instructor.fullName,
      bio: instructor.bio,
      assignedStudiosId: instructor.assignedStudiosId,
      avatar: instructor.avatar,
      workingHours: instructor.workingHours,
      instructorType: instructor.instructorType,
      instructorTier: instructor.instructorTier,
      isActive: instructor.isActive,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const {
      fullName,
      bio,
      assignedStudiosId,
      avatar,
      workingHours,
      instructorType,
      instructorTier,
      isActive,
    } = req.body;
    const instructor = await Instructor.findById(req.params.id);
    if (!instructor)
      return res.status(400).json({ message: "Instructor not found" });

    instructor.fullName = fullName || instructor.fullName;
    instructor.phoneNumber = bio || instructor.bio;
    instructor.assignedStudiosId =
      assignedStudiosId || instructor.assignedStudiosId;
    instructor.avatar = avatar || instructor.avatar;
    instructor.workingHours = workingHours || instructor.workingHours;
    instructor.instructorType = instructorType || instructor.instructorType;
    instructor.instructorTier = instructorTier || instructor.instructorTier;
    instructor.isActive = isActive || instructor.isActive;

    await instructor.save();

    res.status(201).json({
      _id: instructor._id,
      fullName: instructor.fullName,
      bio: instructor.bio,
      assignedStudiosId: instructor.assignedStudiosId,
      avatar: instructor.avatar,
      workingHours: instructor.workingHours,
      instructorType: instructor.instructorType,
      instructorTier: instructor.instructorTier,
      isActive: instructor.isActive,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getPublicProfile = async (req, res) => {
  try {
    const instructor = await Instructor.findById(req.params.id)
      .populate("assignedStudiosId", "studioName address")
      .populate("workingHours.monday.location", "studioName address")
      .populate("workingHours.tuesday.location", "studioName address")
      .populate("workingHours.wednesday.location", "studioName address")
      .populate("workingHours.thursday.location", "studioName address")
      .populate("workingHours.friday.location", "studioName address")
      .populate("workingHours.saturday.location", "studioName address")
      .populate("workingHours.sunday.location", "studioName address");

    if (!instructor) return res.status(404).json({ message: "User not found" });

    res.json(instructor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteInstructor = async (req, res) => {
  try {
    const instructor = await Instructor.findByIdAndDelete(req.params.id);
    if (!instructor) {
      return res.status(404).json({ message: "Instructor not found" });
    }
    res.json({ message: "Instructor deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.instructorStatus = async (req, res) => {
  try {
    const instructor = await Instructor.findById(req.params.id);
    if (!instructor) {
      return res.status(404).json({ message: "Instructor not found" });
    }

    if (instructor.isActive) {
      instructor.isActive = false;
      await instructor.save();

      res.json({ message: "Instructor inactive" });
    } else {
      instructor.isActive = true;
      await instructor.save();

      res.json({ message: "Instructor active" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAllInstructors = async (req, res) => {
  try {
    const instructor = await Instructor.find()
      .populate("assignedStudiosId", "studioName address")
      .populate("workingHours.monday.location", "studioName address")
      .populate("workingHours.tuesday.location", "studioName address")
      .populate("workingHours.wednesday.location", "studioName address")
      .populate("workingHours.thursday.location", "studioName address")
      .populate("workingHours.friday.location", "studioName address")
      .populate("workingHours.saturday.location", "studioName address")
      .populate("workingHours.sunday.location", "studioName address");
    res.json(instructor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
