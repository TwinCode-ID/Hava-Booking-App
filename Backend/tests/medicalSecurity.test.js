const test = require("node:test");
const assert = require("node:assert/strict");

const User = require("../models/UserData/User");
const UserPasses = require("../models/UserData/User_Passes");
const ClassBooking = require("../models/ClassBooking/ClassBooking");
const UserMedicalRecords = require("../models/UserData/User_Medical_Records");
const SecurityAuditEvent = require("../models/Security/SecurityAuditEvent");
const {
  getMedicalRecord,
  upsertMedicalRecord,
} = require("../controllers/UserController/medicalRecordController");

const ADMIN_ID = "507f1f77bcf86cd799439011";
const USER_ID = "507f1f77bcf86cd799439012";
const STUDIO_A = "507f1f77bcf86cd799439013";
const STUDIO_B = "507f1f77bcf86cd799439014";

const createResponse = () => ({
  body: undefined,
  statusCode: 200,
  json(body) {
    this.body = body;
    return this;
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
});

const mockUserLookup = (preferredStudioId) => {
  User.findById = () => {
    const query = {
      lean: async () => ({ preferredStudioId }),
      select() {
        return query;
      },
    };
    return query;
  };
};

const adminRequest = (body = {}) => ({
  body,
  params: { userId: USER_ID },
  user: {
    _id: ADMIN_ID,
    adminStudioLocation: STUDIO_A,
    role: "studioAdmin",
  },
});

test("historical relationships do not grant indefinite medical-record access", async () => {
  const originals = {
    auditCreate: SecurityAuditEvent.create,
    bookingExists: ClassBooking.exists,
    findById: User.findById,
    medicalFind: UserMedicalRecords.findOne,
    passExists: UserPasses.exists,
  };
  let auditCalls = 0;
  let medicalCalls = 0;
  mockUserLookup(STUDIO_B);
  UserPasses.exists = async () => null;
  ClassBooking.exists = async () => null;
  SecurityAuditEvent.create = async () => {
    auditCalls += 1;
  };
  UserMedicalRecords.findOne = async () => {
    medicalCalls += 1;
    return { userId: USER_ID };
  };

  try {
    const response = createResponse();
    await getMedicalRecord(adminRequest(), response);
    assert.equal(response.statusCode, 403);
    assert.equal(auditCalls, 0);
    assert.equal(medicalCalls, 0);
  } finally {
    SecurityAuditEvent.create = originals.auditCreate;
    ClassBooking.exists = originals.bookingExists;
    User.findById = originals.findById;
    UserMedicalRecords.findOne = originals.medicalFind;
    UserPasses.exists = originals.passExists;
  }
});

test("current-studio medical reads are audited before disclosure", async () => {
  const originals = {
    auditCreate: SecurityAuditEvent.create,
    bookingExists: ClassBooking.exists,
    findById: User.findById,
    medicalFind: UserMedicalRecords.findOne,
    passExists: UserPasses.exists,
  };
  let auditRecord;
  const record = { userId: USER_ID, physicalConcern: "Example" };
  mockUserLookup(STUDIO_A);
  UserPasses.exists = async () => null;
  ClassBooking.exists = async () => null;
  SecurityAuditEvent.create = async (value) => {
    auditRecord = value;
  };
  UserMedicalRecords.findOne = async () => record;

  try {
    const response = createResponse();
    await getMedicalRecord(adminRequest(), response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body, record);
    assert.equal(auditRecord.action, "medical_record_read");
    assert.equal(auditRecord.actorId, ADMIN_ID);
    assert.equal(auditRecord.targetUserId, USER_ID);
    assert.equal(auditRecord.studioId, STUDIO_A);
  } finally {
    SecurityAuditEvent.create = originals.auditCreate;
    ClassBooking.exists = originals.bookingExists;
    User.findById = originals.findById;
    UserMedicalRecords.findOne = originals.medicalFind;
    UserPasses.exists = originals.passExists;
  }
});

test("staff cannot alter records outside their client's current affiliation", async () => {
  const originals = {
    auditCreate: SecurityAuditEvent.create,
    findById: User.findById,
    medicalUpdate: UserMedicalRecords.findOneAndUpdate,
  };
  let auditCalls = 0;
  let updateCalls = 0;
  mockUserLookup(STUDIO_B);
  SecurityAuditEvent.create = async () => {
    auditCalls += 1;
  };
  UserMedicalRecords.findOneAndUpdate = async () => {
    updateCalls += 1;
  };

  try {
    const response = createResponse();
    await upsertMedicalRecord(
      adminRequest({ physicalConcern: "Changed" }),
      response,
    );
    assert.equal(response.statusCode, 403);
    assert.equal(auditCalls, 0);
    assert.equal(updateCalls, 0);
  } finally {
    SecurityAuditEvent.create = originals.auditCreate;
    User.findById = originals.findById;
    UserMedicalRecords.findOneAndUpdate = originals.medicalUpdate;
  }
});

test("medical inputs are bounded before any write or audit", async () => {
  const originals = {
    auditCreate: SecurityAuditEvent.create,
    findById: User.findById,
    medicalUpdate: UserMedicalRecords.findOneAndUpdate,
  };
  let sideEffects = 0;
  mockUserLookup(STUDIO_A);
  SecurityAuditEvent.create = async () => {
    sideEffects += 1;
  };
  UserMedicalRecords.findOneAndUpdate = async () => {
    sideEffects += 1;
  };

  try {
    const response = createResponse();
    await upsertMedicalRecord(
      adminRequest({ address: "x".repeat(501) }),
      response,
    );
    assert.equal(response.statusCode, 400);
    assert.equal(sideEffects, 0);
  } finally {
    SecurityAuditEvent.create = originals.auditCreate;
    User.findById = originals.findById;
    UserMedicalRecords.findOneAndUpdate = originals.medicalUpdate;
  }
});

test("medical choices offered by the client UI are accepted", async () => {
  const originalUpdate = UserMedicalRecords.findOneAndUpdate;
  let capturedUpdate;
  UserMedicalRecords.findOneAndUpdate = async (_filter, update) => {
    capturedUpdate = update;
    return { userId: USER_ID, ...update.$set };
  };

  try {
    const response = createResponse();
    await upsertMedicalRecord(
      {
        body: {
          maritalStatus: "Widowed",
          sex: "Prefer not to say",
        },
        params: { userId: USER_ID },
        user: { _id: USER_ID, role: "client" },
      },
      response,
    );

    assert.equal(response.statusCode, 200);
    assert.equal(capturedUpdate.$set.sex, "Prefer not to say");
    assert.equal(capturedUpdate.$set.maritalStatus, "Widowed");
  } finally {
    UserMedicalRecords.findOneAndUpdate = originalUpdate;
  }
});
