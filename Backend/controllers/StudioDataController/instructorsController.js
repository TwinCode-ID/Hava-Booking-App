const Instructor = require("../../models/StudioData/Instructors");
const ClassSchedule = require("../../models/ClassBooking/ClassSchedule");

const getLocalTimeParts = (dateObj) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(dateObj);
  const day = parts.find((p) => p.type === "weekday").value.toLowerCase();
  let hourStr = parts.find((p) => p.type === "hour").value;
  let hour = parseInt(hourStr);
  if (hour === 24) hour = 0;
  const min = parseInt(parts.find((p) => p.type === "minute").value);
  return { day, hour, min };
};

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
    if (!fullName)
      return res.status(400).json({ message: "Instructor name is required" });
    const instructor = await Instructor.create({
      fullName,
      bio,
      assignedStudiosId,
      avatar,
      workingHours,
      instructorType,
      instructorTier,
    });
    res.status(201).json(instructor);
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
    instructor.bio = bio || instructor.bio;
    instructor.assignedStudiosId =
      assignedStudiosId || instructor.assignedStudiosId;
    instructor.avatar = avatar || instructor.avatar;
    instructor.workingHours = workingHours || instructor.workingHours;
    instructor.instructorType = instructorType || instructor.instructorType;
    instructor.instructorTier = instructorTier || instructor.instructorTier;
    instructor.isActive =
      isActive !== undefined ? isActive : instructor.isActive;

    instructor.markModified("workingHours");
    await instructor.save();
    res.status(201).json(instructor);
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
    if (!instructor)
      return res.status(404).json({ message: "Instructor not found" });
    res.json({ message: "Instructor deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.instructorStatus = async (req, res) => {
  try {
    const instructor = await Instructor.findById(req.params.id);
    if (!instructor)
      return res.status(404).json({ message: "Instructor not found" });
    instructor.isActive = !instructor.isActive;
    await instructor.save();
    res.json({
      message: instructor.isActive
        ? "Instructor active"
        : "Instructor inactive",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAllInstructors = async (req, res) => {
  try {
    const instructors = await Instructor.find()
      .populate("assignedStudiosId", "studioName address")
      .populate("workingHours.monday.location", "studioName address")
      .populate("workingHours.tuesday.location", "studioName address")
      .populate("workingHours.wednesday.location", "studioName address")
      .populate("workingHours.thursday.location", "studioName address")
      .populate("workingHours.friday.location", "studioName address")
      .populate("workingHours.saturday.location", "studioName address")
      .populate("workingHours.sunday.location", "studioName address");
    res.json(instructors);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.toggleInstructorShift = async (req, res) => {
  try {
    const { id, shiftId } = req.params;
    const { day, updateMode, targetDate, isActive } = req.body;

    const instructor = await Instructor.findById(id);
    if (!instructor) throw new Error("Instructor not found");

    const shiftArray = instructor.workingHours[day];
    if (!shiftArray) throw new Error("Invalid day");

    const shift = shiftArray.id(shiftId);
    if (!shift) throw new Error("Shift not found");

    if (updateMode !== "single") {
      shift.isActive = isActive;
      instructor.markModified("workingHours");
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
        const clsLocal = getLocalTimeParts(cls.startTime);
        if (clsLocal.day !== day) return false;
        const clsStartMins = clsLocal.hour * 60 + clsLocal.min;
        const clsEndMins = clsStartMins + cls.duration;
        return clsStartMins >= shiftStartMins && clsEndMins <= shiftEndMins;
      });

      if (updateMode === "single" && targetDate) {
        const formatter = new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Jakarta",
          year: "numeric",
          month: "numeric",
          day: "numeric",
        });
        const targetFormatted = formatter.format(new Date(targetDate));
        const singleClass = classesToUpdate.find(
          (cls) => formatter.format(cls.startTime) === targetFormatted,
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
