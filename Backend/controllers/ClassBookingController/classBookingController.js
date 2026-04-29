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
      .populate({
        path: "passId",
        populate: { path: "packageId", select: "packageName" },
      })
      .sort({ bookingDate: -1 });

    res.json(bookings);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getUserBookings = async (req, res) => {
  try {
    const { userId, classId } = req.body;
    const bookings = await ClassBooking.find({
      userId,
      classId,
      status: "Booked",
    })
      .populate({
        path: "classId",
        populate: { path: "studioId", select: "studioName" },
      })
      .populate({
        path: "passId",
        populate: { path: "packageId", select: "packageName" },
      })
      .sort({ bookingDate: -1 });

    res.json(bookings);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// --- MODIFIED: Create Booking (Just Deduct, Don't Activate) ---
exports.createBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userRole = req.user.role ? req.user.role.toLowerCase() : "user";
    const isAdmin = [
      "admin",
      "superadmin",
      "owner",
      "studioadmin",
      "devteam",
    ].includes(userRole);

    let userId = req.user._id;
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
    const userPass = await UserPasses.findOne({
      _id: passId,
      $or: [{ userId: req.user._id }, { sharedWith: req.user._id }],
    }).session(session);

    if (!userPass) throw new Error("Pass not found.");
    if (!userPass.isActive) throw new Error("This pass is inactive.");
    if (userPass.remainingCredits < 1) throw new Error("Insufficient credits.");

    // --- CHANGED: EXPIRY CHECK ---
    // If expiryDate is NULL, it means the pass hasn't started yet. We ALLOW booking.
    // If expiryDate EXISTS, we check if it has passed.
    if (userPass.expiryDate && new Date() > new Date(userPass.expiryDate)) {
      throw new Error("Pass has expired.");
    }

    // --- C. HIERARCHY VALIDATION ---
    const allowedInstructors = userPass.instructorType || [];
    if (!allowedInstructors.includes(classSession.instructorType)) {
      throw new Error(
        `Pass restricted. Cannot use for ${classSession.instructorType} classes.`,
      );
    }

    const allowedClasses = userPass.classType || [];
    if (!allowedClasses.includes(classSession.classType)) {
      throw new Error(
        `Pass restricted. Cannot use for ${classSession.classType} classes.`,
      );
    }

    // --- D. DEDUCT & BOOK (No Activation Here) ---
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

// --- MODIFIED: Check-In (ACTIVATE PASS HERE) ---
exports.studentCheckIn = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await ClassBooking.findById(bookingId);
    if (!booking) throw new Error("Booking not found");

    // We are about to check them IN (Status changing from False -> True)
    if (!booking.isAttend) {
      // 1. Fetch the pass used for this booking
      const userPass = await UserPasses.findById(booking.passId);

      if (userPass) {
        // 2. CHECK: Is this the first time the pass is being used?
        // If expiryDate is null (or firstUsageDate is null), activate it now.
        if (!userPass.firstUsageDate && userPass.validityDuration) {
          const now = new Date();

          // Set First Usage
          userPass.firstUsageDate = now;

          // Calculate Expiry: Now + Duration (e.g. 30 days)
          const newExpiry = new Date(now);
          newExpiry.setDate(newExpiry.getDate() + userPass.validityDuration);

          userPass.expiryDate = newExpiry;

          await userPass.save();
          console.log(`Pass Activated via Check-in. New Expiry: ${newExpiry}`);
        }
      }
    }

    // 3. Toggle Attendance Status
    booking.isAttend = !booking.isAttend;
    await booking.save();

    res.json({
      message: booking.isAttend
        ? "Checked In Successfully"
        : "Check-in Cancelled",
      isAttend: booking.isAttend,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ... (Cancel Booking, Get My Booking, Get Studio Booking remain unchanged) ...
exports.cancelBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { bookingId } = req.body;
    const booking = await ClassBooking.findById(bookingId).session(session);
    if (!booking || booking.status === "Cancelled") {
      throw new Error("Booking not found or already cancelled.");
    }

    const userRole = req.user.role ? req.user.role.toLowerCase() : "user";
    const isAdmin = [
      "studioadmin",
      "devteam",
      "admin",
      "superadmin",
      "owner",
    ].includes(userRole);
    const isOwner = booking.userId.toString() === req.user._id.toString();

    if (!isAdmin && !isOwner) throw new Error("Unauthorized.");

    const classSession = await ClassSchedule.findById(booking.classId).session(
      session,
    );

    if (!isAdmin && classSession) {
      const hoursDiff =
        (new Date(classSession.startTime) - new Date()) / (1000 * 60 * 60);
      if (hoursDiff < 0) throw new Error("Cannot cancel past class.");
      if (hoursDiff < 24) throw new Error("Late cancellation not allowed.");
    }

    const userPass = await UserPasses.findById(booking.passId).session(session);
    if (userPass) {
      userPass.remainingCredits += 1;
      await userPass.save({ session });
    }

    booking.status = "Cancelled";
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
    res.status(400).json({ error: error.message });
  } finally {
    session.endSession();
  }
};

exports.getMyBooking = async (req, res) => {
  try {
    const bookings = await ClassBooking.find({ userId: req.user._id })
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
    const bookings = await ClassBooking.find({
      studioId: req.user.adminStudioLocation,
    })
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
