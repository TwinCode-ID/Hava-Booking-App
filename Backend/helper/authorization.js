const getId = (value) => {
  if (value === null || value === undefined) return null;
  // BSON ObjectId exposes an `_id` getter that returns itself. Recursing on
  // that getter overflows the stack for real database identifiers.
  if (value._id !== undefined && value._id !== value) return getId(value._id);
  return String(value);
};

const idsEqual = (left, right) => {
  const leftId = getId(left);
  const rightId = getId(right);
  return Boolean(leftId && rightId && leftId === rightId);
};

const isDevTeam = (user) => user?.role === "devTeam";
const isStudioAdmin = (user) => user?.role === "studioAdmin";
const isStudioStaff = (user) => isStudioAdmin(user) || isDevTeam(user);

const canManageStudio = (user, studioId) =>
  isDevTeam(user) ||
  (isStudioAdmin(user) && idsEqual(user.adminStudioLocation, studioId));

const canAccessUser = (user, targetUser) =>
  isDevTeam(user) ||
  idsEqual(user?._id, targetUser?._id) ||
  (isStudioAdmin(user) &&
    targetUser?.role === "client" &&
    idsEqual(user.adminStudioLocation, targetUser.preferredStudioId));

module.exports = {
  getId,
  idsEqual,
  isDevTeam,
  isStudioAdmin,
  isStudioStaff,
  canManageStudio,
  canAccessUser,
};
