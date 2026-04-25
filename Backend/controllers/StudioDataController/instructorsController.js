const Instructor = require("../../models/StudioData/Instructors");

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

exports.toggleInstructorShift = async (req, res) => {
  try {
    const { id, shiftId } = req.params;
    const { day, updateMode, targetDate, isActive } = req.body;

    const instructor = await Instructors.findById(id);
    if (!instructor) throw new Error("Instructor not found");

    const shiftArray = instructor.workingHours[day];
    if (!shiftArray) throw new Error("Invalid day");

    const shift = shiftArray.id(shiftId);
    if (!shift) throw new Error("Shift not found");

    // --> FIX: ONLY modify the recurring template if we are updating "all" or "none"
    if (updateMode !== "single") {
      shift.isActive = isActive;
      await instructor.save();
    }

    if (updateMode === "all" || updateMode === "single") {
      const getMinutes = (timeStr) => {
        const [h, m] = timeStr.split(":").map(Number);
        return h * 60 + m;
      };

      const classes = await ClassSchedule.find({
        instructorId: id,
        studioId: shift.location,
        startTime: { $gte: new Date() },
      });

      const shiftStartMins = getMinutes(shift.start);
      const shiftEndMins = getMinutes(shift.end);

      const classesToUpdate = classes.filter((cls) => {
        const daysOfWeek = [
          "sunday",
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
        ];
        const clsDay = daysOfWeek[cls.startTime.getDay()];

        if (clsDay !== day) return false;

        const clsStartMins =
          cls.startTime.getHours() * 60 + cls.startTime.getMinutes();
        const clsEndMins = clsStartMins + cls.duration;

        return clsStartMins >= shiftStartMins && clsEndMins <= shiftEndMins;
      });

      if (updateMode === "single" && targetDate) {
        const tDate = new Date(targetDate);
        const singleClass = classesToUpdate.find(
          (cls) =>
            cls.startTime.getFullYear() === tDate.getFullYear() &&
            cls.startTime.getMonth() === tDate.getMonth() &&
            cls.startTime.getDate() === tDate.getDate(),
        );

        if (singleClass) {
          singleClass.isActive = isActive;
          await singleClass.save();
        }
      } else if (updateMode === "all") {
        for (let cls of classesToUpdate) {
          cls.isActive = isActive;
          await cls.save();
        }
      }
    }

    res.status(200).json({ message: "Shift updated successfully", shift });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
