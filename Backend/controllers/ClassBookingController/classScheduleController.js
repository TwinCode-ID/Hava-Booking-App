const ClassSchedule = require("../../models/ClassBooking/ClassSchedule");
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

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

const localCheckConflicts = async (
  instructorId,
  start,
  end,
  excludeClassId = null,
  studioId = null,
  isSingleClass = false,
) => {
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

  if (studioId) {
    const Instructor = mongoose.model("Instructors");
    const instructor = await Instructor.findById(instructorId);

    if (!instructor) return "Instructor not found.";
    if (instructor.isActive === false)
      return "Instructor profile is globally inactive. They cannot be scheduled.";

    const startParts = getLocalTimeParts(start);
    const endParts = getLocalTimeParts(end);
    const shifts = instructor.workingHours[startParts.day] || [];
    const startMins = startParts.hour * 60 + startParts.min;
    const endMins = endParts.hour * 60 + endParts.min;

    if (!isSingleClass) {
      const hasValidShift = shifts.some((shift) => {
        if (shift.isActive === false) return false;
        if (String(shift.location) !== String(studioId)) return false;
        const shiftStartMins =
          parseInt(shift.start.split(":")[0]) * 60 +
          parseInt(shift.start.split(":")[1]);
        const shiftEndMins =
          parseInt(shift.end.split(":")[0]) * 60 +
          parseInt(shift.end.split(":")[1]);
        return startMins >= shiftStartMins && endMins <= shiftEndMins;
      });

      if (!hasValidShift) {
        const minStr =
          startParts.min < 10 ? `0${startParts.min}` : startParts.min;
        return `This recurring time (${startParts.day}, ${startParts.hour}:${minStr}) falls outside of the instructor's active working hours for this studio.`;
      }
    } else {
      const conflictingOtherStudioShift = shifts.some((shift) => {
        if (shift.isActive === false) return false;
        if (String(shift.location) === String(studioId)) return false;
        const shiftStartMins =
          parseInt(shift.start.split(":")[0]) * 60 +
          parseInt(shift.start.split(":")[1]);
        const shiftEndMins =
          parseInt(shift.end.split(":")[0]) * 60 +
          parseInt(shift.end.split(":")[1]);
        return startMins < shiftEndMins && endMins > shiftStartMins;
      });

      if (conflictingOtherStudioShift)
        return `Instructor is bound to active working hours at another studio during this time.`;
    }
  }
  return null;
};

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
      scheduleDates,
    } = req.body;
    const classesToCreate = [];
    const batchId = isRecurring ? uuidv4() : null;
    const datesToProcess =
      scheduleDates && scheduleDates.length > 0
        ? scheduleDates.map((d) => new Date(d))
        : [new Date(startTime)];
    const isSingleClass = datesToProcess.length === 1;

    for (let i = 0; i < datesToProcess.length; i++) {
      const currentStart = datesToProcess[i];
      const currentEnd = new Date(currentStart.getTime() + duration * 60000);

      const conflictMsg = await localCheckConflicts(
        instructorId,
        currentStart,
        currentEnd,
        null,
        studioId,
        isSingleClass,
      );
      if (conflictMsg)
        throw new Error(
          `Conflict detected on ${currentStart.toDateString()}: ${conflictMsg}`,
        );

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
            true,
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
            false,
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

exports.toggleClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { toggleMode, targetDate } = req.body;
    const targetClass = await ClassSchedule.findById(id);
    if (!targetClass) throw new Error("Class not found");

    const willBeActive = !targetClass.isActive;

    if (toggleMode === "single" && targetDate) {
      const d = new Date(targetDate);
      const targetInstance = await ClassSchedule.findOne({
        recurrenceGroupId: targetClass.recurrenceGroupId || targetClass._id,
        startTime: {
          $gte: new Date(d.setHours(0, 0, 0, 0)),
          $lt: new Date(d.setHours(23, 59, 59, 999)),
        },
      });

      if (targetInstance) {
        if (willBeActive) {
          const conflictMsg = await localCheckConflicts(
            targetInstance.instructorId,
            targetInstance.startTime,
            targetInstance.endTime,
            targetInstance._id,
            targetInstance.studioId,
            true,
          );
          if (conflictMsg)
            throw new Error(`Cannot activate class: ${conflictMsg}`);
        }
        targetInstance.isActive = willBeActive;
        await targetInstance.save();
        return res
          .status(200)
          .json({ message: `Class on specific date updated.` });
      } else {
        throw new Error("Could not find class instance for that exact date.");
      }
    }

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
            false,
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
        true,
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

exports.deleteClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { deleteMode, targetDate } = req.body;
    const targetClass = await ClassSchedule.findById(id);
    if (!targetClass) throw new Error("Class not found");

    if (deleteMode === "single" && targetDate) {
      const d = new Date(targetDate);
      await ClassSchedule.deleteOne({
        recurrenceGroupId: targetClass.recurrenceGroupId || targetClass._id,
        startTime: {
          $gte: new Date(d.setHours(0, 0, 0, 0)),
          $lt: new Date(d.setHours(23, 59, 59, 999)),
        },
      });
      return res
        .status(200)
        .json({ message: "Specific class instance deleted" });
    }

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
