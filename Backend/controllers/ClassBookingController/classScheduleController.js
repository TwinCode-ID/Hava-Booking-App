const ClassSchedule = require("../../models/ClassBooking/ClassSchedule");
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

// --- PERFECTED COLLISION ENGINE ---
const localCheckConflicts = async (
  instructorId,
  start,
  end,
  excludeClassId = null,
  studioId = null,
) => {
  // 1. Check Class Schedule Overlaps (Ignores inactive classes)
  const query = {
    instructorId,
    isActive: true,
    startTime: { $lt: end },
    endTime: { $gt: start },
  };
  if (excludeClassId) query._id = { $ne: excludeClassId };

  const classConflict = await ClassSchedule.findOne(query).populate("studioId");
  if (classConflict) {
    const studioName = classConflict.studioId?.studioName || "another studio";
    return `Instructor is already booked and active at ${studioName} for this time.`;
  }

  // 2. Check Instructor Working Hours & Global Status
  if (studioId) {
    const Instructors = mongoose.model("Instructors");
    const instructor = await Instructors.findById(instructorId);

    if (!instructor) return "Instructor not found.";

    // --> NEW: Block if instructor is completely off globally
    if (instructor.isActive === false) {
      return "Instructor profile is currently globally inactive. They cannot be scheduled.";
    }

    const daysOfWeek = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const dayOfWeek = daysOfWeek[start.getDay()];
    const shifts = instructor.workingHours[dayOfWeek] || [];

    const startMins = start.getHours() * 60 + start.getMinutes();
    const endMins = end.getHours() * 60 + end.getMinutes();

    const hasValidShift = shifts.some((shift) => {
      if (shift.isActive === false) return false; // Ignore inactive shift templates
      if (String(shift.location) !== String(studioId)) return false;

      const shiftStartMins =
        parseInt(shift.start.split(":")[0]) * 60 +
        parseInt(shift.start.split(":")[1]);
      const shiftEndMins =
        parseInt(shift.end.split(":")[0]) * 60 +
        parseInt(shift.end.split(":")[1]);

      return startMins >= shiftStartMins && endMins <= shiftEndMins;
    });

    if (!hasValidShift)
      return "This time falls outside of the instructor's active working hours for your studio.";
  }

  return null;
};

// --- CREATE CLASS ---
exports.createClass = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      className,
      description,
      instructorId,
      studioId,
      instructorType,
      classType,
      startTime,
      duration,
      capacity,
      isRecurring,
      recurrenceRule,
      recurrenceCount,
    } = req.body;

    const start = new Date(startTime);
    const end = new Date(start.getTime() + duration * 60000);

    const conflictMsg = await localCheckConflicts(
      instructorId,
      start,
      end,
      null,
      studioId,
    );
    if (conflictMsg) throw new Error(conflictMsg);

    const classesToCreate = [];
    const batchId = isRecurring ? uuidv4() : null;
    const loopCount = isRecurring ? recurrenceCount || 1 : 1;

    for (let i = 0; i < loopCount; i++) {
      const currentStart = new Date(start);
      const currentEnd = new Date(end);

      if (i > 0) {
        if (recurrenceRule === "Daily") {
          currentStart.setDate(start.getDate() + i);
          currentEnd.setDate(end.getDate() + i);
        } else if (recurrenceRule === "Weekly") {
          currentStart.setDate(start.getDate() + i * 7);
          currentEnd.setDate(end.getDate() + i * 7);
        } else if (recurrenceRule === "Monthly") {
          currentStart.setMonth(start.getMonth() + i);
          currentEnd.setMonth(end.getMonth() + i);
        }

        const stepConflict = await localCheckConflicts(
          instructorId,
          currentStart,
          currentEnd,
          null,
          studioId,
        );
        if (stepConflict) {
          throw new Error(
            `Conflict detected for recurrence #${i + 1} at ${currentStart}: ${stepConflict}`,
          );
        }
      }

      classesToCreate.push({
        className,
        description,
        instructorId,
        studioId,
        instructorType,
        classType,
        startTime: currentStart,
        endTime: currentEnd,
        duration,
        capacity,
        isRecurring: isRecurring || false,
        recurrenceGroupId: batchId,
        recurrenceRule: isRecurring ? recurrenceRule : "None",
      });
    }

    await ClassSchedule.insertMany(classesToCreate, { session });
    await session.commitTransaction();

    res.status(201).json({
      message: `Created ${classesToCreate.length} classes`,
      recurrenceGroupId: batchId,
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ error: error.message });
  } finally {
    session.endSession();
  }
};

// --- GET CLASSES ---
exports.getClasses = async (req, res) => {
  try {
    const { start, end, studioId, instructorId } = req.query;
    let query = {};
    if (start && end)
      query.startTime = { $gte: new Date(start), $lte: new Date(end) };
    if (studioId) query.studioId = studioId;
    if (instructorId) query.instructorId = instructorId;

    const classes = await ClassSchedule.find(query)
      .populate("instructorId", "fullName")
      .populate("studioId", "studioName")
      .sort({ startTime: 1 });

    res.status(200).json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getStudioClasses = async (req, res) => {
  try {
    const { id } = req.params;
    const classes = await ClassSchedule.find({ studioId: id })
      .populate("instructorId", "fullName instructorType")
      .populate("studioId", "studioName")
      .sort({ startTime: 1 });

    res.status(200).json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- UPDATE CLASS ---
exports.updateClass = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { updateMode, ...updateData } = req.body;

    const targetClass = await ClassSchedule.findById(id).session(session);
    if (!targetClass) throw new Error("Class not found");

    if (!updateMode || updateMode === "single") {
      if (
        updateData.startTime ||
        updateData.duration ||
        updateData.instructorId ||
        updateData.isActive
      ) {
        const newStart = updateData.startTime
          ? new Date(updateData.startTime)
          : new Date(targetClass.startTime);
        const dur = updateData.duration || targetClass.duration;
        const newEnd = new Date(newStart.getTime() + dur * 60000);

        const checkActive = updateData.hasOwnProperty("isActive")
          ? updateData.isActive
          : targetClass.isActive;
        if (checkActive) {
          const conflictMsg = await localCheckConflicts(
            updateData.instructorId || targetClass.instructorId,
            newStart,
            newEnd,
            id,
            targetClass.studioId,
          );
          if (conflictMsg) throw new Error(conflictMsg);
        }
        updateData.endTime = newEnd;
      }

      const updated = await ClassSchedule.findByIdAndUpdate(id, updateData, {
        new: true,
        session,
      });
      await session.commitTransaction();
      return res.status(200).json(updated);
    }

    if (updateMode === "all" && targetClass.recurrenceGroupId) {
      const seriesClasses = await ClassSchedule.find({
        recurrenceGroupId: targetClass.recurrenceGroupId,
      }).session(session);
      const bulkOps = [];

      for (const currentClass of seriesClasses) {
        let newStart = new Date(currentClass.startTime);
        let newEnd = new Date(currentClass.endTime);
        let isTimeChanged = false;

        if (updateData.startTime) {
          const requestedTime = new Date(updateData.startTime);
          newStart.setHours(
            requestedTime.getHours(),
            requestedTime.getMinutes(),
            0,
            0,
          );
          isTimeChanged = true;
        }

        if (updateData.duration || isTimeChanged) {
          const duration = updateData.duration || currentClass.duration;
          newEnd = new Date(newStart.getTime() + duration * 60000);
        }

        const checkActive = updateData.hasOwnProperty("isActive")
          ? updateData.isActive
          : currentClass.isActive;

        if (
          checkActive &&
          (updateData.startTime ||
            updateData.duration ||
            updateData.instructorId ||
            updateData.isActive)
        ) {
          const conflictMsg = await localCheckConflicts(
            updateData.instructorId || currentClass.instructorId,
            newStart,
            newEnd,
            currentClass._id,
            currentClass.studioId,
          );
          if (conflictMsg)
            throw new Error(
              `Conflict for class on ${newStart.toDateString()}: ${conflictMsg}`,
            );
        }

        const finalUpdateData = { ...updateData };
        if (isTimeChanged || updateData.duration) {
          finalUpdateData.startTime = newStart;
          finalUpdateData.endTime = newEnd;
        } else {
          delete finalUpdateData.startTime;
          delete finalUpdateData.endTime;
        }

        bulkOps.push({
          updateOne: {
            filter: { _id: currentClass._id },
            update: { $set: finalUpdateData },
          },
        });
      }

      if (bulkOps.length > 0)
        await ClassSchedule.bulkWrite(bulkOps, { session });
      await session.commitTransaction();
      return res.status(200).json({ message: "Series updated successfully" });
    }

    res.status(400).json({ error: "Invalid update mode" });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ error: error.message });
  } finally {
    session.endSession();
  }
};

// --- TOGGLE CLASS ---
exports.toggleClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { toggleMode } = req.body;

    const targetClass = await ClassSchedule.findById(id);
    if (!targetClass) throw new Error("Class not found");

    const willBeActive = !targetClass.isActive;

    if (toggleMode === "all" && targetClass.recurrenceGroupId) {
      if (willBeActive) {
        const series = await ClassSchedule.find({
          recurrenceGroupId: targetClass.recurrenceGroupId,
        });
        for (let cls of series) {
          const conflictMsg = await localCheckConflicts(
            cls.instructorId,
            cls.startTime,
            cls.endTime,
            cls._id,
            cls.studioId,
          );
          if (conflictMsg)
            throw new Error(
              `Cannot activate all: Conflict on ${cls.startTime.toDateString()}: ${conflictMsg}`,
            );
        }
      }
      await ClassSchedule.updateMany(
        { recurrenceGroupId: targetClass.recurrenceGroupId },
        { isActive: willBeActive },
      );
      return res.status(200).json({
        message: `Entire Class Series ${willBeActive ? "Activated" : "Deactivated"}`,
      });
    }

    if (willBeActive) {
      const conflictMsg = await localCheckConflicts(
        targetClass.instructorId,
        targetClass.startTime,
        targetClass.endTime,
        targetClass._id,
        targetClass.studioId,
      );
      if (conflictMsg) throw new Error(`Cannot activate class: ${conflictMsg}`);
    }

    targetClass.isActive = willBeActive;
    await targetClass.save();
    res
      .status(200)
      .json({ message: `Class ${willBeActive ? "Activated" : "Deactivated"}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- DELETE CLASS ---
exports.deleteClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { deleteMode } = req.body;

    const targetClass = await ClassSchedule.findById(id);
    if (!targetClass) throw new Error("Class not found");

    if (deleteMode === "all" && targetClass.recurrenceGroupId) {
      await ClassSchedule.deleteMany({
        recurrenceGroupId: targetClass.recurrenceGroupId,
      });
      return res.status(200).json({ message: "Entire series deleted" });
    }
    await ClassSchedule.deleteOne({ _id: id });
    res.status(200).json({ message: "Class deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
