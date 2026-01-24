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
    if (await checkConflicts(instructorId, start, end)) {
      throw new Error(
        `Instructor conflict detected on ${start.toDateString()} at ${start.toTimeString()}`,
      );
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
        if (await checkConflicts(instructorId, currentStart, currentEnd)) {
          throw new Error(
            `Conflict detected for recurrence #${i + 1} at ${currentStart}`,
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
      .populate("instructorId", "fullName")
      .populate("studioId", "studioName") // Adjusted based on your likely Studio model
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
      .populate("studioId", "studioName") // Adjusted based on your likely Studio model
      .sort({ startTime: 1 });

    res.status(200).json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- 3. UPDATE CLASS ---
exports.updateClass = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { updateMode, ...updateData } = req.body;

    const targetClass = await ClassSchedule.findById(id).session(session);
    if (!targetClass) throw new Error("Class not found");

    // --- CASE A: Update Single Class ---
    if (!updateMode || updateMode === "single") {
      if (updateData.startTime || updateData.duration) {
        const newStart = updateData.startTime
          ? new Date(updateData.startTime)
          : new Date(targetClass.startTime);

        const dur = updateData.duration || targetClass.duration;
        const newEnd = new Date(newStart.getTime() + dur * 60000);

        // Conflict Check
        const hasConflict = await checkConflicts(
          updateData.instructorId || targetClass.instructorId,
          newStart,
          newEnd,
          id,
        );

        if (hasConflict) {
          throw new Error(`Time conflict detected for this class.`);
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

    // --- CASE B: Update Entire Series ---
    if (updateMode === "all" && targetClass.recurrenceGroupId) {
      // 1. Fetch all classes in the series
      const seriesClasses = await ClassSchedule.find({
        recurrenceGroupId: targetClass.recurrenceGroupId,
      }).session(session);

      const bulkOps = [];

      // 2. Iterate through EVERY class in the series
      for (const currentClass of seriesClasses) {
        let newStart = new Date(currentClass.startTime);
        let newEnd = new Date(currentClass.endTime);
        let isTimeChanged = false;

        // A. Handle Time Change (Apply new HH:MM to existing Date)
        if (updateData.startTime) {
          const requestedTime = new Date(updateData.startTime);

          // Set the hours/minutes from the request, but keep the original Year/Month/Day
          newStart.setHours(
            requestedTime.getHours(),
            requestedTime.getMinutes(),
            0,
            0,
          );
          isTimeChanged = true;
        }

        // B. Handle Duration Change
        if (updateData.duration || isTimeChanged) {
          const duration = updateData.duration || currentClass.duration;
          newEnd = new Date(newStart.getTime() + duration * 60000);
        }

        // C. Check Conflicts for THIS specific instance
        if (
          updateData.startTime ||
          updateData.duration ||
          updateData.instructorId
        ) {
          const instructorToCheck =
            updateData.instructorId || currentClass.instructorId;

          // We must check if this specific calculated slot is free
          const hasConflict = await checkConflicts(
            instructorToCheck,
            newStart,
            newEnd,
            currentClass._id, // Exclude itself
          );

          if (hasConflict) {
            throw new Error(
              `Conflict detected for class on ${newStart.toDateString()} at ${newStart.toTimeString()}. Update aborted.`,
            );
          }
        }

        // D. Prepare the update object
        const finalUpdateData = { ...updateData };

        // If we calculated new times, explicitly set them
        if (isTimeChanged || updateData.duration) {
          finalUpdateData.startTime = newStart;
          finalUpdateData.endTime = newEnd;
        } else {
          // If time wasn't touched, remove startTime from updateData
          // to prevent overwriting dates with the single date from req.body
          delete finalUpdateData.startTime;
          delete finalUpdateData.endTime;
        }

        // E. Add to Bulk Operations
        bulkOps.push({
          updateOne: {
            filter: { _id: currentClass._id },
            update: { $set: finalUpdateData },
          },
        });
      }

      // 3. Execute all updates at once
      if (bulkOps.length > 0) {
        await ClassSchedule.bulkWrite(bulkOps, { session });
      }

      await session.commitTransaction();
      return res.status(200).json({
        message: "Series updated successfully",
        modifiedCount: bulkOps.length,
      });
    }

    res.status(400).json({ error: "Invalid update mode" });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ error: error.message });
  } finally {
    session.endSession();
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
          { isActive: false },
        );
      } else {
        await ClassSchedule.updateMany(
          { recurrenceGroupId: targetClass.recurrenceGroupId },
          { isActive: true },
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
