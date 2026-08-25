const mongoose = require("mongoose");
const UserMedicalRecords = require("../../models/UserData/User_Medical_Records");
const User = require("../../models/UserData/User");
const UserPasses = require("../../models/UserData/User_Passes");
const ClassBooking = require("../../models/ClassBooking/ClassBooking");
const SecurityAuditEvent = require("../../models/Security/SecurityAuditEvent");
const {
  idsEqual,
  isDevTeam,
  isStudioAdmin,
} = require("../../helper/authorization");

const MEDICAL_FIELDS = [
  "dateOfBirth",
  "sex",
  "maritalStatus",
  "occupation",
  "address",
  "dailyActivity",
  "physicalConcern",
  "termsAndConditions",
];
const ACTIVE_RELATIONSHIP_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const pickMedicalFields = (body = {}) =>
  Object.fromEntries(
    MEDICAL_FIELDS.filter((field) => body[field] !== undefined).map((field) => [
      field,
      body[field],
    ]),
  );

const validateMedicalFields = (data) => {
  const textLimits = {
    occupation: 120,
    address: 500,
    dailyActivity: 1000,
    physicalConcern: 2000,
  };
  for (const [field, limit] of Object.entries(textLimits)) {
    if (data[field] === undefined) continue;
    if (typeof data[field] !== "string" || data[field].trim().length > limit) {
      return `${field} is invalid.`;
    }
    data[field] = data[field].trim();
  }

  if (
    data.sex !== undefined &&
    !["Male", "Female", "Prefer not to say"].includes(data.sex)
  ) {
    return "sex is invalid.";
  }
  if (
    data.maritalStatus !== undefined &&
    !["Single", "Married", "Divorced", "Widowed", "Others"].includes(
      data.maritalStatus,
    )
  ) {
    return "maritalStatus is invalid.";
  }
  if (
    data.termsAndConditions !== undefined &&
    typeof data.termsAndConditions !== "boolean"
  ) {
    return "termsAndConditions is invalid.";
  }
  if (data.dateOfBirth !== undefined) {
    const dateOfBirth = new Date(data.dateOfBirth);
    if (
      Number.isNaN(dateOfBirth.getTime()) ||
      dateOfBirth < new Date("1900-01-01T00:00:00.000Z") ||
      dateOfBirth > new Date()
    ) {
      return "dateOfBirth is invalid.";
    }
    data.dateOfBirth = dateOfBirth;
  }
  return null;
};

const auditStaffAccess = async (user, userId, action) => {
  if (!isStudioAdmin(user) && !isDevTeam(user)) return;
  await SecurityAuditEvent.create({
    action,
    actorId: user._id,
    targetUserId: userId,
    studioId: user.adminStudioLocation || null,
  });
};

const canReadMedicalRecord = async (user, userId) => {
  if (idsEqual(user?._id, userId) || isDevTeam(user)) return true;
  if (!isStudioAdmin(user) || !user.adminStudioLocation) return false;

  const now = new Date();
  const retainedAfter = new Date(
    now.getTime() - ACTIVE_RELATIONSHIP_RETENTION_MS,
  );
  const [targetUser, relatedPass, relatedBooking] = await Promise.all([
    User.findById(userId).select("preferredStudioId").lean(),
    UserPasses.exists({
      issuingStudio: user.adminStudioLocation,
      isActive: true,
      remainingCredits: { $gt: 0 },
      $and: [
        { $or: [{ expiryDate: null }, { expiryDate: { $gte: now } }] },
        { $or: [{ userId }, { sharedWith: userId }] },
      ],
    }),
    ClassBooking.exists({
      userId,
      studioId: user.adminStudioLocation,
      status: { $ne: "Cancelled" },
      bookingDate: { $gte: retainedAfter },
    }),
  ]);

  return Boolean(
    idsEqual(targetUser?.preferredStudioId, user.adminStudioLocation) ||
      relatedPass ||
      relatedBooking,
  );
};

const canWriteMedicalRecord = async (user, userId) => {
  if (idsEqual(user?._id, userId) || isDevTeam(user)) return true;
  if (!isStudioAdmin(user) || !user.adminStudioLocation) return false;

  const targetUser = await User.findById(userId)
    .select("preferredStudioId")
    .lean();
  return idsEqual(targetUser?.preferredStudioId, user.adminStudioLocation);
};

exports.upsertMedicalRecord = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user." });
    }
    if (!(await canWriteMedicalRecord(req.user, userId))) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const data = pickMedicalFields(req.body);
    const validationError = validateMedicalFields(data);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }
    if (!idsEqual(req.user._id, userId)) {
      delete data.termsAndConditions;
    }

    await auditStaffAccess(req.user, userId, "medical_record_write");
    const record = await UserMedicalRecords.findOneAndUpdate(
      { userId },
      { $set: { ...data, userId } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    return res.status(200).json({
      message: "Medical record saved successfully",
      record,
    });
  } catch (error) {
    console.error("Medical record update failed", error);
    return res.status(500).json({ message: "Unable to save medical record." });
  }
};

exports.getMedicalRecord = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user." });
    }
    if (!(await canReadMedicalRecord(req.user, userId))) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await auditStaffAccess(req.user, userId, "medical_record_read");
    const record = await UserMedicalRecords.findOne({ userId });
    if (!record) {
      return res.status(404).json({ message: "No medical record found." });
    }

    return res.status(200).json(record);
  } catch (error) {
    console.error("Medical record lookup failed", error);
    return res.status(500).json({ message: "Unable to load medical record." });
  }
};
