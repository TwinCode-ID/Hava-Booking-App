const ClassSchedule = require("../models/ClassBooking/ClassSchedule");

const checkConflicts = async (
  instructorId, // 1. Add instructorId as a parameter
  startTime,
  endTime,
  excludeClassId = null
) => {
  const query = {
    instructorId, // 2. Add it to the query filters
    isActive: true,
    $or: [
      { startTime: { $lt: endTime, $gte: startTime } },
      { endTime: { $gt: startTime, $lte: endTime } },
      { startTime: { $lte: startTime }, endTime: { $gte: endTime } },
    ],
  };

  if (excludeClassId) {
    query._id = { $ne: excludeClassId };
  }

  const conflict = await ClassSchedule.findOne(query);
  return conflict;
};

module.exports = { checkConflicts };
