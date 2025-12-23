export const checkConflicts = async (
  studioId,
  startTime,
  endTime,
  excludeClassId = null
) => {
  const query = {
    studioId,
    isActive: true, // Only check against active classes
    $or: [
      // New class starts during an existing class
      { startTime: { $lt: endTime, $gte: startTime } },
      // New class ends during an existing class
      { endTime: { $gt: startTime, $lte: endTime } },
      // New class completely encompasses an existing class
      { startTime: { $lte: startTime }, endTime: { $gte: endTime } },
    ],
  };

  if (excludeClassId) {
    query._id = { $ne: excludeClassId };
  }

  const conflict = await ClassSchedule.findOne(query);
  return conflict;
};
