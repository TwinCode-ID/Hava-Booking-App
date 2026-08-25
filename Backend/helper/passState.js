const isPassCurrentlyFrozen = (pass, now = new Date()) => {
  if (pass?.freeze?.status !== "approved") return false;

  const start = new Date(pass.freeze.startDate);
  const end = new Date(pass.freeze.endDate);
  const current = new Date(now);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    Number.isNaN(current.getTime())
  ) {
    // An approved record with malformed dates is safer to treat as frozen.
    return true;
  }
  return start <= current && current < end;
};

const notCurrentlyFrozenFilter = (now = new Date()) => ({
  $or: [
    { "freeze.status": { $ne: "approved" } },
    { "freeze.startDate": { $gt: now } },
    { "freeze.endDate": { $lte: now } },
  ],
});

module.exports = { isPassCurrentlyFrozen, notCurrentlyFrozenFilter };
