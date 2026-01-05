const mongoose = require("mongoose");
const ClassBooking = require("../../models/ClassBooking/ClassBooking");
const ClassSchedule = require("../../models/ClassBooking/ClassSchedule");
const UserPasses = require("../../models/UserData/User_Passes");

// 1. DEFINE THE HIERARCHY
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
    // SECURITY FIX: Get userId from the token, not the body
    const userId = req.user._id;
    const { classId, passId } = req.body;

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

    // --- C. HIERARCHY VALIDATION ---
    const passRank = INSTRUCTOR_RANKS[userPass.instructorType] || 0;
    const classRank = INSTRUCTOR_RANKS[classSession.instructorType] || 0;

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
    if (userPass.remainingCredits === 1) {
      userPass.remainingCredits -= 1;
      userPass.isActive = false;
    } else {
      userPass.remainingCredits -= 1;
    }

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

exports.getMyBooking = async (req, res) => {
  try {
    const userId = req.user._id;

    // Populated specifically for the "Manage Bookings" UI
    const bookings = await ClassBooking.find({ userId })
      .populate({
        path: "classId",
        select: "className classType startTime endTime duration",
      })
      .populate("studioId", "studioName")
      .sort({ bookingDate: -1 });

    res.json(bookings);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getStudioBooking = async (req, res) => {
  try {
    const userId = req.user.adminStudioLocation;

    // Populated specifically for the "Manage Bookings" UI
    const bookings = await ClassBooking.find({ studioId: userId })
      .populate("userId", "fullName phoneNumber email")
      .populate({
        path: "classId",
        select: "className classType startTime endTime duration",
      })
      .populate("studioId", "studioName")
      .populate("instructorId", "fullName")
      .sort({ bookingDate: -1 });

    res.json(bookings);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.studentCheckIn = async (req, res) => {
  try {
    const { bookingId } = req.params;

    // Populated specifically for the "Manage Bookings" UI
    const bookings = await ClassBooking.findById(bookingId);

    if (bookings.isAttend) {
      bookings.isAttend = false;
      await bookings.save();
      res.json({ message: "Success" });
    } else {
      bookings.isAttend = true;
      await bookings.save();
      res.json({ message: "Success" });
    }
    res.json(bookings);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.cancelBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user._id; // SECURITY FIX
    const { bookingId } = req.body; // Expect bookingId

    // 1. GET BOOKING
    const booking = await ClassBooking.findOne({
      _id: bookingId,
      userId,
    }).session(session);

    if (!booking || booking.status === "Cancelled") {
      throw new Error("Booking not found or already cancelled.");
    }

    // 2. GET CLASS (To check time)
    const classSession = await ClassSchedule.findById(booking.classId).session(
      session
    );
    if (!classSession) throw new Error("Class details not found.");

    // --- 24-HOUR CANCELLATION RULE ---
    const currentTime = new Date();
    const classStartTime = new Date(classSession.startTime);
    const timeDifference = classStartTime - currentTime;
    const hoursDifference = timeDifference / (1000 * 60 * 60);

    if (hoursDifference < 24) {
      throw new Error(
        "Late Cancellation: Cancellations are only allowed 24 hours before class. Please contact studio admin."
      );
    }

    // 3. GET PASS (To Refund)
    const userPass = await UserPasses.findById(booking.passId).session(session);
    if (userPass) {
      userPass.remainingCredits += 1;
      if (!userPass.isActive) {
        userPass.isActive = true;
      }
      await userPass.save({ session });
    }

    // 4. UPDATE BOOKING STATUS
    booking.status = "Cancelled";
    await booking.save({ session });

    // 5. UPDATE CLASS CAPACITY
    classSession.currentEnrollment -= 1;
    await classSession.save({ session });

    await session.commitTransaction();
    res
      .status(200)
      .json({ message: "Booking cancelled successfully. Credit refunded." });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ error: error.message });
  } finally {
    session.endSession();
  }
};
