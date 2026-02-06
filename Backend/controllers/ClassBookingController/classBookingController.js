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

exports.getClassBookings = async (req, res) => {
  try {
    const { classId } = req.params;
    const bookings = await ClassBooking.find({
      classId,
      status: "Booked",
    })
      .populate("userId", "fullName email phoneNumber")
      .populate("passId", "passName remainingCredits")
      .sort({ bookingDate: -1 });

    res.json(bookings);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// --- MODIFIED: Create Booking (Handle Admin Logic) ---
exports.createBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. ROBUST ROLE CHECK (Updated to include studioAdmin)
    const userRole = req.user.role ? req.user.role.toLowerCase() : "user";

    // FIX: Added "studioadmin" and "devteam" to the allowed list
    const isAdmin = [
      "admin",
      "superadmin",
      "owner",
      "studioadmin",
      "devteam",
    ].includes(userRole);

    // 2. DETERMINE TARGET USER
    let userId = req.user._id;
    // If admin is performing the action, use the target student's ID
    if (req.body.targetUserId && isAdmin) {
      userId = req.body.targetUserId;
    }

    const { classId, passId } = req.body;

    // --- A. GET CLASS ---
    const classSession = await ClassSchedule.findById(classId).session(session);
    if (!classSession || !classSession.isActive)
      throw new Error("Class not available or inactive.");

    if (classSession.currentEnrollment >= classSession.capacity) {
      throw new Error("Class is full.");
    }

    const existingBooking = await ClassBooking.findOne({
      userId,
      classId,
      status: "Booked",
    }).session(session);

    if (existingBooking)
      throw new Error("This student is already booked in this class.");

    // --- B. GET PASS ---
    // Now that 'userId' is correctly set to the student's ID, this query will work
    const userPass = await UserPasses.findOne({ _id: passId, userId }).session(
      session,
    );

    if (!userPass) {
      throw new Error("Pass not found for this specific user.");
    }
    if (!userPass.isActive) throw new Error("This pass is inactive.");
    if (userPass.remainingCredits < 1)
      throw new Error("Insufficient credits on pass.");
    if (new Date() > new Date(userPass.expiryDate))
      throw new Error("Pass has expired.");

    // --- C. HIERARCHY VALIDATION ---
    const passRank = INSTRUCTOR_RANKS[userPass.instructorType] || 0;
    const classRank = INSTRUCTOR_RANKS[classSession.instructorType] || 0;

    if (passRank < classRank) {
      throw new Error(
        `Pass tier (${userPass.instructorType}) is too low for this ${classSession.instructorType} class.`,
      );
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
      .json({ message: "Booking successful!", booking: newBooking });
  } catch (error) {
    await session.abortTransaction();
    console.error("Booking Error:", error);
    res.status(400).json({ error: error.message });
  } finally {
    session.endSession();
  }
};

// --- MODIFIED: Cancel Booking (Allow Admin Override) ---
exports.cancelBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { bookingId } = req.body;

    const booking = await ClassBooking.findById(bookingId).session(session);
    if (!booking || booking.status === "Cancelled") {
      throw new Error("Booking not found or already cancelled.");
    }

    // 1. ROBUST SECURITY CHECK (Updated)
    const userRole = req.user.role ? req.user.role.toLowerCase() : "user";

    // FIX: Added "studioadmin" and "devteam"
    const isAdmin = ["studioAdmin", "devTeam"].includes(userRole);

    const isOwner = booking.userId.toString() === req.user._id.toString();

    // If you are not an admin AND you are not the owner, reject.
    if (!isAdmin && !isOwner) {
      throw new Error("You are not authorized to cancel this booking.");
    }

    const classSession = await ClassSchedule.findById(booking.classId).session(
      session,
    );

    // 2. 24-HOUR RULE (Skip for Admin)
    if (!isAdmin && classSession) {
      const currentTime = new Date();
      const classStartTime = new Date(classSession.startTime);
      const hoursDifference = (classStartTime - currentTime) / (1000 * 60 * 60);

      if (hoursDifference < 0) {
        throw new Error("Cannot cancel a past class.");
      }

      if (hoursDifference < 24) {
        throw new Error(
          "Late Cancellation: Cancellations are only allowed 24 hours before class.",
        );
      }
    }

    // 3. REFUND PASS
    const userPass = await UserPasses.findById(booking.passId).session(session);
    if (userPass) {
      userPass.remainingCredits += 1;
      await userPass.save({ session });
    }

    // 4. UPDATE STATUS & COUNT
    booking.status = "Cancelled";
    // Optional: Reset check-in status if cancelling
    booking.isAttend = false;
    await booking.save({ session });

    if (classSession) {
      classSession.currentEnrollment = Math.max(
        0,
        classSession.currentEnrollment - 1,
      );
      await classSession.save({ session });
    }

    await session.commitTransaction();
    res.status(200).json({ message: "Booking cancelled. Credit refunded." });
  } catch (error) {
    await session.abortTransaction();
    console.error("Cancel Error:", error);
    res.status(400).json({ error: error.message });
  } finally {
    session.endSession();
  }
};

// ... (keep getMyBooking, getStudioBooking, studentCheckIn as they were) ...
exports.getMyBooking = async (req, res) => {
  try {
    const userId = req.user._id;
    const bookings = await ClassBooking.find({ userId })
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

exports.getStudioBooking = async (req, res) => {
  try {
    const userId = req.user.adminStudioLocation;
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
    const bookings = await ClassBooking.findById(bookingId);
    if (!bookings) throw new Error("Booking not found");

    bookings.isAttend = !bookings.isAttend;
    await bookings.save();
    res.json({ message: "Success", isAttend: bookings.isAttend });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
