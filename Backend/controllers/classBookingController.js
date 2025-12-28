const mongoose = require("mongoose");
const ClassBooking = require("../models/ClassBooking");
const ClassSchedule = require("../models/ClassSchedule");
const UserPasses = require("../models/User_Passes");

// 1. DEFINE THE HIERARCHY
// Higher number = Higher rank
const INSTRUCTOR_RANKS = {
  "Apprentice Instructor": 1,
  "Junior Instructor": 2,
  "Senior Instructor": 3,
  "Master Instructor": 4,
  "Principal Instructor": 5,
  "Special Instructor": 6,
};

exports.createBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId, classId, passId } = req.body;

    // --- A. GET CLASS ---
    const classSession = await ClassSchedule.findById(classId).session(session);
    if (!classSession || !classSession.isActive)
      throw new Error("Class not available.");
    if (classSession.currentEnrollment >= classSession.capacity)
      throw new Error("Class full.");

    const existingBooking = await ClassBooking.findOne({
      userId,
      classId,
      status: "Booked",
    }).session(session);

    if (existingBooking) throw new Error("You have already booked this class.");

    // --- B. GET PASS ---
    const userPass = await UserPasses.findOne({ _id: passId, userId }).session(
      session
    );
    if (!userPass || !userPass.isActive) throw new Error("Invalid pass.");
    if (userPass.remainingCredits < 1) throw new Error("Insufficient credits.");
    if (new Date() > userPass.expiryDate) throw new Error("Pass expired.");

    // --- C. HIERARCHY VALIDATION (The Logic You Wanted) ---

    // 1. Get rank of the PASS the user is holding
    const passRank = INSTRUCTOR_RANKS[userPass.instructorType] || 0;

    // 2. Get rank of the CLASS they are trying to book
    // (We use classSession.instructorType because it's already in the schedule schema)
    const classRank = INSTRUCTOR_RANKS[classSession.instructorType] || 0;

    // 3. Compare
    if (passRank < classRank) {
      throw new Error(
        `This pass (${userPass.instructorType}) is not valid for ${classSession.instructorType} classes. Please purchase a higher tier pass.`
      );
    }

    if (
      classSession.instructorType === "Special Instructor" &&
      userPass.instructorType !== "Special Instructor"
    ) {
      throw new Error("This class requires a Special Instructor pass.");
    }

    // --- D. DEDUCT & BOOK ---
    userPass.remainingCredits -= 1;
    await userPass.save({ session });

    const newBooking = new ClassBooking({
      userId,
      classId,
      passId,
      bookingDate: new Date(),
      status: "Booked",
      studioId: classSession.studioId,
      instructorId: classSession.instructorId,
    });

    await newBooking.save({ session });

    classSession.currentEnrollment += 1;
    await classSession.save({ session });

    await session.commitTransaction();
    res
      .status(201)
      .json({ message: "Booking successful!", bookingId: newBooking._id });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ error: error.message });
  } finally {
    session.endSession();
  }
};

exports.cancelBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId, classId, passId } = req.body;

    // --- A. GET CLASS ---
    const classSession = await ClassSchedule.findById(classId).session(session);
    if (!classSession || !classSession.isActive)
      throw new Error("Class not available.");
    if (classSession.currentEnrollment >= classSession.capacity)
      throw new Error("Class full.");

    const existingBooking = await ClassBooking.findOne({
      userId,
      classId,
      status: "Booked",
    }).session(session);

    if (!existingBooking) throw new Error("You haven't booked this class.");

    // --- B. GET PASS ---
    const userPass = await UserPasses.findOne({ _id: passId, userId }).session(
      session
    );
    if (!userPass || !userPass.isActive) throw new Error("Invalid pass.");

    // --- D. CANCELLATION ---
    userPass.remainingCredits += 1;
    await userPass.save({ session });

    const newBooking = new ClassBooking({
      userId,
      classId,
      passId,
      bookingDate: new Date(),
      status: "Cancelled",
      studioId: classSession.studioId,
      instructorId: classSession.instructorId,
    });

    await newBooking.save({ session });

    classSession.currentEnrollment -= 1;
    await classSession.save({ session });

    await session.commitTransaction();
    res.status(201).json({
      message: "Booking cancelled successfully!",
      bookingId: newBooking._id,
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ error: error.message });
  } finally {
    session.endSession();
  }
};
