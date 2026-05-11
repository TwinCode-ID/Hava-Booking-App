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

const isShiftActiveOnDate = (shift, targetMs) => {
  if (shift.isActive === false) return false;
  const exceptions = shift.exceptions || [];
  const tempIncoming = exceptions.find((e) => e.type === "temp_incoming");

  if (tempIncoming) {
    const exStart = new Date(tempIncoming.startDate).setHours(0, 0, 0, 0);
    const exEnd = new Date(tempIncoming.endDate).setHours(23, 59, 59, 999);
    return targetMs >= exStart && targetMs <= exEnd;
  } else {
    const isPaused = exceptions.some((e) => {
      if (e.type !== "pause" && e.type !== "reassign") return false;
      const exStart = new Date(e.startDate).setHours(0, 0, 0, 0);
      const exEnd = new Date(e.endDate).setHours(23, 59, 59, 999);
      return targetMs >= exStart && targetMs <= exEnd;
    });
    return !isPaused;
  }
};

const localCheckConflicts = async (
  instructorId,
  start,
  end,
  excludeClassId = null,
  studioId = null,
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

    const targetDateMs = new Date(start).setHours(0, 0, 0, 0);

    const hasValidShift = shifts.some((shift) => {
      if (!isShiftActiveOnDate(shift, targetDateMs)) return false;
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
      return `Instructor is not available at this studio for this time (${startParts.day}, ${startParts.hour}:${minStr}).`;
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

    for (let i = 0; i < datesToProcess.length; i++) {
      const currentStart = datesToProcess[i];
      const currentEnd = new Date(currentStart.getTime() + duration * 60000);
      const conflictMsg = await localCheckConflicts(
        instructorId,
        currentStart,
        currentEnd,
        null,
        studioId,
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
    const classes = await ClassSchedule.find({ studioId: req.params.id })
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

    // Logic for recurring bulk edits
    if (updateMode === "all") {
      if (
        updateData.startTime ||
        updateData.duration ||
        updateData.instructorId ||
        updateData.isActive
      ) {
        const classesInSeries = await ClassSchedule.find({
          recurrenceGroupId: targetClass.recurrenceGroupId,
          startTime: { $gte: targetClass.startTime },
        }).session(session);

        for (let cls of classesInSeries) {
          const newStart = updateData.startTime
            ? (() => {
                const updatedTime = new Date(updateData.startTime);
                const currentClsStart = new Date(cls.startTime);
                currentClsStart.setHours(
                  updatedTime.getHours(),
                  updatedTime.getMinutes(),
                );
                return currentClsStart;
              })()
            : new Date(cls.startTime);
          const dur = updateData.duration || cls.duration;
          const newEnd = new Date(newStart.getTime() + dur * 60000);

          const checkActive = updateData.hasOwnProperty("isActive")
            ? updateData.isActive
            : cls.isActive;

          if (checkActive) {
            const conflictMsg = await localCheckConflicts(
              updateData.instructorId || cls.instructorId,
              newStart,
              newEnd,
              cls._id,
              cls.studioId,
            );
            if (conflictMsg)
              throw new Error(
                `Conflict in series at ${newStart.toDateString()}: ${conflictMsg}`,
              );
          }

          updateData.endTime = newEnd;
          await ClassSchedule.findByIdAndUpdate(cls._id, updateData, {
            session,
          });
        }
      }
    }

    await session.commitTransaction();
    res.status(200).json({ message: "Series updated successfully" });
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
    const { deleteMode } = req.body;
    const targetClass = await ClassSchedule.findById(req.params.id);
    if (!targetClass) throw new Error("Class not found");

    if (deleteMode === "all" && targetClass.recurrenceGroupId) {
      await ClassSchedule.deleteMany({
        recurrenceGroupId: targetClass.recurrenceGroupId,
        startTime: { $gte: targetClass.startTime },
      });
    } else {
      await ClassSchedule.deleteOne({ _id: req.params.id });
    }
    res.status(200).json({ message: "Class deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
