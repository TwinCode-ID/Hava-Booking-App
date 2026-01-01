const ClassSchedule = require("../../models/ClassBooking/ClassSchedule");
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
// Make sure this helper exists in your project
const { checkConflicts } = require("../../helper/ScheduleHelper");

// --- 1. CREATE CLASS ---
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

    // Initial Conflict Check
    if (await checkConflicts(studioId, start, end)) {
      throw new Error(`Room conflict detected at ${start.toISOString()}`);
    }

    const classesToCreate = [];
    const batchId = isRecurring ? uuidv4() : null;
    const loopCount = isRecurring ? recurrenceCount || 1 : 1;

    for (let i = 0; i < loopCount; i++) {
      const currentStart = new Date(start);
      const currentEnd = new Date(end);

      // Calculate Dates for Recurrence
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

        // Check Conflict for this specific instance
        if (await checkConflicts(studioId, currentStart, currentEnd)) {
          throw new Error(
            `Conflict detected for recurrence #${i + 1} at ${currentStart}`
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

// --- 2. GET CLASSES ---
exports.getClasses = async (req, res) => {
  try {
    const { start, end, studioId, instructorId } = req.query;

    if (start && end) {
      startTime = { $gte: new Date(start), $lte: new Date(end) };
    }
    if (studioId) studioId = studioId;
    if (instructorId) instructorId = instructorId;

    const classes = await ClassSchedule.find()
      .populate("instructorId", "name")
      .populate("studioId", "studioName") // Adjusted based on your likely Studio model
      .sort({ startTime: 1 });

    res.status(200).json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- 3. UPDATE CLASS ---
exports.updateClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { updateMode, ...updateData } = req.body;

    const targetClass = await ClassSchedule.findById(id);
    if (!targetClass) throw new Error("Class not found");

    // Case A: Update Single
    if (!updateMode || updateMode === "single") {
      if (updateData.startTime || updateData.duration) {
        const newStart = updateData.startTime
          ? new Date(updateData.startTime)
          : targetClass.startTime;
        const dur = updateData.duration || targetClass.duration;
        const newEnd = new Date(newStart.getTime() + dur * 60000);

        if (await checkConflicts(targetClass.studioId, newStart, newEnd, id)) {
          throw new Error("Cannot move class: Time conflict.");
        }
        updateData.endTime = newEnd;
      }

      const updated = await ClassSchedule.findByIdAndUpdate(id, updateData, {
        new: true,
      });
      return res.status(200).json(updated);
    }

    // Case B: Update Series
    if (updateMode === "all" && targetClass.recurrenceGroupId) {
      if (updateData.startTime) {
        return res
          .status(400)
          .json({ error: "Cannot update Start Time for bulk series." });
      }
      const result = await ClassSchedule.updateMany(
        { recurrenceGroupId: targetClass.recurrenceGroupId },
        { $set: updateData }
      );
      return res.status(200).json({
        message: "Series updated",
        modifiedCount: result.modifiedCount,
      });
    }

    res.status(400).json({ error: "Invalid update mode" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// --- 4. DELETE CLASS ---
exports.toggleClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { toggleMode } = req.body;

    const targetClass = await ClassSchedule.findById(id);
    if (!targetClass) throw new Error("Class not found");

    if (toggleMode === "all" && targetClass.recurrenceGroupId) {
      const status = !targetClass.isActive ? "Active" : "Inactive";
      if (targetClass.isActive) {
        await ClassSchedule.updateMany(
          { recurrenceGroupId: targetClass.recurrenceGroupId },
          { isActive: false }
        );
      } else {
        await ClassSchedule.updateMany(
          { recurrenceGroupId: targetClass.recurrenceGroupId },
          { isActive: true }
        );
      }

      res.status(200).json({ message: `Entire Class ${status}` });
    }
    if (targetClass.isActive) {
      targetClass.isActive = false;
    } else {
      targetClass.isActive = true;
    }
    await targetClass.save();
    const status = targetClass.isActive ? "Active" : "Inactive";
    res.status(200).json({ message: `Class ${status}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

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
