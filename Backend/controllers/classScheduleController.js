const ClassSchedule = require("../models/Class_Schedule"); // Update path as needed
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const { checkConflicts } = require("../helper/ScheduleHelper");

// --- 1. CREATE CLASS (Single or Recurring) ---
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
      recurrenceCount, // e.g., 10 occurrences
    } = req.body;

    const start = new Date(startTime);
    const end = new Date(start.getTime() + duration * 60000);

    // 1. Check conflict for the FIRST class
    if (await checkConflicts(studioId, start, end)) {
      throw new Error(`Room conflict detected at ${start.toISOString()}`);
    }

    const classesToCreate = [];
    const batchId = isRecurring ? uuidv4() : null;
    const loopCount = isRecurring ? recurrenceCount || 1 : 1;

    for (let i = 0; i < loopCount; i++) {
      // Calculate date offset
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

        // Check conflict for SUBSEQUENT classes in the loop
        // (Optional: You might want to skip conflicting dates instead of failing)
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

// --- 2. GET CLASSES (Calendar View) ---
exports.getClasses = async (req, res) => {
  try {
    const { start, end, studioId, instructorId } = req.query;

    const query = { isActive: true };

    // Filter by Date Range (Crucial for Calendar UI)
    if (start && end) {
      query.startTime = { $gte: new Date(start), $lte: new Date(end) };
    }

    if (studioId) query.studioId = studioId;
    if (instructorId) query.instructorId = instructorId;

    const classes = await ClassSchedule.find(query)
      .populate("instructorId", "name") // Assuming Instructor has a 'name' field
      .populate("studioId", "name") // Assuming Studio has a 'name' field
      .sort({ startTime: 1 });

    res.status(200).json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- 3. UPDATE CLASS (Single or Series) ---
exports.updateClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { updateMode, ...updateData } = req.body;
    // updateMode: 'single' | 'future' | 'all' (Simple version: just single vs all)

    const targetClass = await ClassSchedule.findById(id);
    if (!targetClass) throw new Error("Class not found");

    // Case A: Update ONLY this specific class instance
    if (!updateMode || updateMode === "single") {
      // If changing time, check conflicts
      if (updateData.startTime || updateData.duration) {
        const newStart = updateData.startTime
          ? new Date(updateData.startTime)
          : targetClass.startTime;
        const dur = updateData.duration || targetClass.duration;
        const newEnd = new Date(newStart.getTime() + dur * 60000);

        if (await checkConflicts(targetClass.studioId, newStart, newEnd, id)) {
          throw new Error("Cannot move class: Time conflict.");
        }
        updateData.endTime = newEnd; // Ensure end time matches duration
      }

      const updated = await ClassSchedule.findByIdAndUpdate(id, updateData, {
        new: true,
      });
      return res.status(200).json(updated);
    }

    // Case B: Update the ENTIRE SERIES
    if (updateMode === "all" && targetClass.recurrenceGroupId) {
      // Note: Updating TIME for a series is complex (need to shift dates, not set fixed date).
      // For safety, we usually block bulk time updates or implement 'shift' logic.
      // Here, we block bulk time updates but allow description/instructor updates.

      if (updateData.startTime) {
        return res.status(400).json({
          error:
            "Cannot update Start Time for bulk series. Please update individually.",
        });
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

// --- 4. DELETE CLASS (Single or Series) ---
exports.deleteClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { deleteMode } = req.body; // 'single' or 'all'

    const targetClass = await ClassSchedule.findById(id);
    if (!targetClass) throw new Error("Class not found");

    // Soft Delete (isActive: false) is usually safer than remove()

    // Case A: Delete Entire Series
    if (deleteMode === "all" && targetClass.recurrenceGroupId) {
      await ClassSchedule.updateMany(
        { recurrenceGroupId: targetClass.recurrenceGroupId },
        { isActive: false }
      );
      return res.status(200).json({ message: "Entire series deleted" });
    }

    // Case B: Delete Single Instance
    targetClass.isActive = false;
    await targetClass.save();

    res.status(200).json({ message: "Class deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
