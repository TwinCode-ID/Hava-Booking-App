const Instructor = require("../../models/StudioData/Instructors");
const ClassSchedule = require("../../models/ClassBooking/ClassSchedule");
const ClassBooking = require("../../models/ClassBooking/ClassBooking");
const UserPasses = require("../../models/UserData/User_Passes");
const {
  canManageStudio,
  idsEqual,
  isDevTeam,
} = require("../../helper/authorization");

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const getInstructorStudioIds = (instructor) => {
  const studioIds = [...(instructor.assignedStudiosId || [])];
  for (const level of instructor.studioLevels || []) {
    studioIds.push(level.studioId);
  }
  for (const day of DAYS) {
    for (const shift of instructor.workingHours?.[day] || []) {
      studioIds.push(shift.location);
    }
  }
  return studioIds.filter(Boolean);
};

const canGloballyManageInstructor = (user, instructor) => {
  if (isDevTeam(user)) return true;
  const studioIds = getInstructorStudioIds(instructor);
  return (
    studioIds.length > 0 &&
    studioIds.every((studioId) => canManageStudio(user, studioId))
  );
};

const scopeWorkingHours = (workingHours = {}, studioId) =>
  Object.fromEntries(
    DAYS.map((day) => [
      day,
      (workingHours[day] || []).map((shift) => ({
        start: shift.start,
        end: shift.end,
        isActive: shift.isActive !== false,
        location: studioId,
        exceptions: [],
      })),
    ]),
  );

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

const getMinutes = (timeStr) => {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
};

exports.createInstructor = async (req, res) => {
  try {
    const {
      fullName,
      bio,
      assignedStudiosId,
      avatar,
      workingHours,
      studioLevels,
    } = req.body;

    if (!fullName)
      return res.status(400).json({ message: "Instructor name is required" });

    const requestedStudios = assignedStudiosId || [];
    const studioId = req.user.adminStudioLocation;
    if (!isDevTeam(req.user) && !studioId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const instructor = await Instructor.create({
      fullName,
      bio,
      assignedStudiosId: isDevTeam(req.user)
        ? requestedStudios
        : [studioId],
      avatar,
      workingHours: isDevTeam(req.user)
        ? workingHours
        : scopeWorkingHours(workingHours, studioId),
      studioLevels: isDevTeam(req.user)
        ? studioLevels
        : (studioLevels || [])
            .filter((level) => idsEqual(level.studioId, studioId))
            .map((level) => ({ ...level, studioId })),
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
      isActive,
      studioLevels,
    } = req.body; // <- Removed instructorType & instructorTier

    const instructor = await Instructor.findById(req.params.id);
    if (!instructor)
      return res.status(400).json({ message: "Instructor not found" });
    if (!canGloballyManageInstructor(req.user, instructor)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (fullName !== undefined) instructor.fullName = fullName;
    if (bio !== undefined) instructor.bio = bio;
    if (isDevTeam(req.user) && assignedStudiosId !== undefined)
      instructor.assignedStudiosId = assignedStudiosId;
    if (avatar !== undefined) instructor.avatar = avatar;
    if (isDevTeam(req.user) && workingHours !== undefined)
      instructor.workingHours = workingHours;
    if (isDevTeam(req.user) && isActive !== undefined)
      instructor.isActive = isActive;
    if (isDevTeam(req.user) && studioLevels !== undefined)
      instructor.studioLevels = studioLevels;

    instructor.markModified("workingHours");
    instructor.markModified("studioLevels");
    await instructor.save();
    res.status(200).json(instructor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.toggleInstructorShift = async (req, res) => {
  try {
    const { id, shiftId } = req.params;
    const {
      day,
      updateMode,
      startDate,
      endDate,
      isActive,
      isReassign,
      targetStudioId,
      sourceStudioId,
    } = req.body;

    const instructor = await Instructor.findById(id);
    if (!instructor) throw new Error("Instructor not found");

    // BULK ASSIGN OR BULK UNDO LOGIC
    if (shiftId === "bulk_reassign" || shiftId === "bulk_undo") {
      if (!isDevTeam(req.user)) {
        return res.status(403).json({
          error: "Cross-studio reassignments require developer access.",
        });
      }
      const startBounds = new Date(startDate).getTime();
      const endBounds = new Date(endDate || startDate).setHours(
        23,
        59,
        59,
        999,
      );

      if (shiftId === "bulk_undo") {
        let hasActiveTargetClasses = false;
        // Validate undo safely by checking the target studios
        for (const d of [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ]) {
          for (const s of instructor.workingHours[d] || []) {
            const loc =
              typeof s.location === "object" ? s.location._id : s.location;
            if (String(loc) === String(sourceStudioId)) {
              for (const ex of s.exceptions || []) {
                if (
                  (ex.type === "reassign" || ex.type === "pause") &&
                  new Date(ex.startDate).getTime() === startBounds
                ) {
                  if (ex.type === "reassign") {
                    const targetClassesCount =
                      await ClassSchedule.countDocuments({
                        instructorId: id,
                        studioId: ex.targetStudioId,
                        startTime: {
                          $gte: new Date(ex.startDate),
                          $lte: new Date(ex.endDate),
                        },
                        isActive: true,
                      });
                    if (targetClassesCount > 0) hasActiveTargetClasses = true;
                  }
                }
              }
            }
          }
        }

        if (hasActiveTargetClasses) {
          return res.status(400).json({
            error:
              "Cannot cancel reassignment. Active schedules exist in the target studio. Please delete them first.",
          });
        }

        // Perform cleanup
        [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ].forEach((d) => {
          // Clean outbound exceptions
          (instructor.workingHours[d] || []).forEach((s) => {
            const loc =
              typeof s.location === "object" ? s.location._id : s.location;
            if (String(loc) === String(sourceStudioId)) {
              s.exceptions = (s.exceptions || []).filter((ex) => {
                return !(
                  (ex.type === "reassign" || ex.type === "pause") &&
                  new Date(ex.startDate).getTime() === startBounds
                );
              });
            }
          });

          // Clean target studio incoming exceptions (Remove the dummy shift completely)
          instructor.workingHours[d] = (
            instructor.workingHours[d] || []
          ).filter((s) => {
            const tempEx = (s.exceptions || []).find(
              (e) =>
                e.type === "temp_incoming" &&
                String(e.originalStudioId) === String(sourceStudioId) &&
                new Date(e.startDate).getTime() === startBounds,
            );
            return !tempEx;
          });
        });

        instructor.markModified("workingHours");
        await instructor.save(); // Save the shift fixes first

        // [PATCHED]: Auto-reactivate the originally affected classes in the source studio
        const affectedClassesToReactivate = await ClassSchedule.find({
          instructorId: id,
          studioId: sourceStudioId,
          startTime: { $gte: new Date(startBounds), $lte: new Date(endBounds) },
          isActive: false, // Only re-activate those that were deactivated
        });

        for (let cls of affectedClassesToReactivate) {
          cls.isActive = true;
          await cls.save();
        }

        return res.status(200).json({
          message: "Bulk exception undone and classes reactivated successfully",
        });
      }

      if (shiftId === "bulk_reassign") {
        const daysWithShifts = new Set();

        [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ].forEach((d) => {
          (instructor.workingHours[d] || []).forEach((slot) => {
            const loc =
              typeof slot.location === "object"
                ? slot.location._id
                : slot.location;
            if (
              String(loc) === String(sourceStudioId) &&
              slot.isActive !== false
            ) {
              if (!slot.exceptions) slot.exceptions = [];
              slot.exceptions.push({
                startDate: new Date(startBounds).toISOString(),
                endDate: new Date(endBounds).toISOString(),
                type: "reassign",
                targetStudioId: targetStudioId || null,
              });
              daysWithShifts.add(d);
            }
          });

          // If no shift existed on this day, we still want the target studio to have access
          if (!instructor.workingHours[d]) instructor.workingHours[d] = [];
          instructor.workingHours[d].push({
            start: "00:00",
            end: "23:59",
            location: targetStudioId,
            isActive: true,
            exceptions: [
              {
                type: "temp_incoming",
                startDate: new Date(startBounds).toISOString(),
                endDate: new Date(endBounds).toISOString(),
                originalStudioId: sourceStudioId,
              },
            ],
          });
        });

        let newAssignedStudios = [...(instructor.assignedStudiosId || [])].map(
          (s) => (typeof s === "object" ? s._id : s),
        );
        if (!newAssignedStudios.includes(targetStudioId)) {
          newAssignedStudios.push(targetStudioId);
        }
        instructor.assignedStudiosId = newAssignedStudios;

        // cancel and refund affected existing classes
        const classes = await ClassSchedule.find({
          instructorId: id,
          studioId: sourceStudioId,
          startTime: { $gte: new Date(startBounds), $lte: new Date(endBounds) },
        });

        for (let cls of classes) {
          const bookings = await ClassBooking.find({
            classId: cls._id,
            status: "Booked",
          });
          for (let booking of bookings) {
            const userPass = await UserPasses.findById(booking.passId);
            if (userPass) {
              userPass.remainingCredits += 1;
              await userPass.save();
            }
            booking.status = "Cancelled";
            booking.isAttend = false;
            await booking.save();
          }
          cls.currentEnrollment = 0;
          cls.isActive = false;
          await cls.save();
        }

        instructor.markModified("workingHours");
        await instructor.save();
        return res
          .status(200)
          .json({ message: "Instructor globally reassigned" });
      }
    }

    const shiftArray = instructor.workingHours[day];
    if (!shiftArray) throw new Error("Invalid day");

    const shift = shiftArray.id(shiftId);
    if (!shift) throw new Error("Shift not found");
    if (!canManageStudio(req.user, shift.location)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const cancelAndRefundClass = async (classId) => {
      const bookings = await ClassBooking.find({ classId, status: "Booked" });
      for (let booking of bookings) {
        const userPass = await UserPasses.findById(booking.passId);
        if (userPass) {
          userPass.remainingCredits += 1;
          await userPass.save();
        }
        booking.status = "Cancelled";
        booking.isAttend = false;
        await booking.save();
      }
    };

    if (updateMode === "range" && startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const classes = await ClassSchedule.find({
        instructorId: id,
        studioId: shift.location,
        startTime: { $gte: start, $lte: end },
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

      if (isActive === false) {
        for (let cls of classesToUpdate) {
          await cancelAndRefundClass(cls._id);
          cls.currentEnrollment = 0;
          cls.isActive = false;
          await cls.save();
        }

        if (!shift.exceptions) shift.exceptions = [];
        shift.exceptions.push({
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          type: "pause",
          targetStudioId: null,
        });

        instructor.markModified("workingHours");
        await instructor.save();
      }
    } else if (updateMode === "all") {
      shift.isActive = isActive;
      const classes = await ClassSchedule.find({
        instructorId: id,
        studioId: shift.location,
        startTime: { $gte: new Date() },
      });

      const shiftStartMins = getMinutes(shift.start);
      const shiftEndMins = getMinutes(shift.end);

      for (let cls of classes) {
        const clsLocal = getLocalTimeParts(cls.startTime);
        if (clsLocal.day === day) {
          const clsStartMins = clsLocal.hour * 60 + clsLocal.min;
          const clsEndMins = clsStartMins + cls.duration;
          if (clsStartMins >= shiftStartMins && clsEndMins <= shiftEndMins) {
            if (isActive === false) {
              await cancelAndRefundClass(cls._id);
              cls.currentEnrollment = 0;
            }
            cls.isActive = isActive;
            await cls.save();
          }
        }
      }
      instructor.markModified("workingHours");
      await instructor.save();
    }
    res.status(200).json({ message: "Shift updated successfully", shift });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    const instructor = await Instructor.findById(req.params.id);
    if (!instructor)
      return res.status(404).json({ message: "Instructor not found" });
    if (!canGloballyManageInstructor(req.user, instructor)) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    await instructor.deleteOne();
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
    if (!canGloballyManageInstructor(req.user, instructor)) {
      return res.status(403).json({ message: "Unauthorized" });
    }
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

exports.assignInstructorShift = async (req, res) => {
  try {
    const { id } = req.params;
    const { day, start, end, studioId } = req.body;
    const instructor = await Instructor.findById(id);
    if (!instructor) throw new Error("Instructor not found");

    const newStart = getMinutes(start);
    const newEnd = getMinutes(end);
    const existingShifts = instructor.workingHours[day] || [];

    const hasConflict = existingShifts.some((shift) => {
      const sStart = getMinutes(shift.start);
      const sEnd = getMinutes(shift.end);
      return newStart < sEnd && newEnd > sStart;
    });

    if (hasConflict)
      return res.status(400).json({
        error:
          "Instructor has a conflicting schedule. They must be signed off from their previous schedule first.",
      });

    instructor.workingHours[day].push({
      start,
      end,
      location: studioId,
      isActive: true,
    });
    if (!instructor.assignedStudiosId.includes(studioId))
      instructor.assignedStudiosId.push(studioId);

    instructor.markModified("workingHours");
    await instructor.save();
    res.status(200).json({
      message: "Instructor assigned to studio successfully.",
      instructor,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.removeInstructorShift = async (req, res) => {
  try {
    const { id, shiftId } = req.params;
    const { day } = req.body;
    const instructor = await Instructor.findById(id);
    if (!instructor) throw new Error("Instructor not found");

    const shiftArray = instructor.workingHours[day];
    if (!shiftArray) throw new Error("Invalid day");

    instructor.workingHours[day] = shiftArray.filter(
      (shift) => shift._id.toString() !== shiftId,
    );
    instructor.markModified("workingHours");
    await instructor.save();
    res
      .status(200)
      .json({ message: "Instructor signed off from schedule successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
