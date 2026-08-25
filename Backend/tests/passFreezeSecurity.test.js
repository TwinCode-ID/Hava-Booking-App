const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const UserPasses = require("../models/UserData/User_Passes");
const Package = require("../models/StudioData/Packages");
const ClassBooking = require("../models/ClassBooking/ClassBooking");
const ClassSchedule = require("../models/ClassBooking/ClassSchedule");
const {
  deductCredits,
  managePassFreeze,
} = require("../controllers/UserController/user_passesController");
const {
  createBooking,
} = require("../controllers/ClassBookingController/classBookingController");
const { isPassCurrentlyFrozen } = require("../helper/passState");

const createResponse = () => ({
  statusCode: 200,
  body: undefined,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

const createSession = () => ({
  commits: 0,
  aborts: 0,
  startTransaction() {},
  async commitTransaction() {
    this.commits += 1;
  },
  async abortTransaction() {
    this.aborts += 1;
  },
  endSession() {},
});

const query = (value) => {
  const promise = Promise.resolve(value);
  const result = {
    session() {
      return result;
    },
    populate() {
      return result;
    },
    select() {
      return result;
    },
    then(resolve, reject) {
      return promise.then(resolve, reject);
    },
    catch(reject) {
      return promise.catch(reject);
    },
  };
  return result;
};

test("approved freeze state blocks only its explicit active date range", () => {
  const now = new Date("2030-01-10T12:00:00.000Z");
  const base = {
    freeze: {
      status: "approved",
      startDate: new Date("2030-01-10T11:00:00.000Z"),
      endDate: new Date("2030-01-10T13:00:00.000Z"),
    },
  };

  assert.equal(isPassCurrentlyFrozen(base, now), true);
  assert.equal(
    isPassCurrentlyFrozen(
      {
        freeze: {
          ...base.freeze,
          startDate: new Date("2030-01-10T13:00:00.000Z"),
          endDate: new Date("2030-01-10T14:00:00.000Z"),
        },
      },
      now,
    ),
    false,
  );
  assert.equal(
    isPassCurrentlyFrozen(
      {
        freeze: {
          ...base.freeze,
          startDate: new Date("2030-01-10T10:00:00.000Z"),
          endDate: now,
        },
      },
      now,
    ),
    false,
  );
  assert.equal(
    isPassCurrentlyFrozen({ freeze: { ...base.freeze, status: "requested" } }, now),
    false,
  );
  assert.equal(
    isPassCurrentlyFrozen({ freeze: { status: "approved" } }, now),
    true,
  );
});

test("freeze approval stores the effective dates and extends expiry by exactly that range", async () => {
  const originalFindById = UserPasses.findById;
  const originalPackageFindById = Package.findById;
  const oldExpiry = new Date(Date.now() + 20 * 86_400_000);
  const pass = {
    _id: "pass-a",
    userId: "owner-a",
    issuingStudio: "studio-a",
    packageId: "package-a",
    isActive: true,
    remainingCredits: 2,
    expiryDate: new Date(oldExpiry),
    freeze: {
      hasBeenFrozen: false,
      status: "requested",
      startDate: new Date(Date.now() - 60_000),
      endDate: new Date(Date.now() + 3_600_000),
    },
    saves: 0,
    async save() {
      this.saves += 1;
    },
  };
  UserPasses.findById = async () => pass;
  Package.findById = () => query({ isAvailableToFreeze: true });

  try {
    const response = createResponse();
    await managePassFreeze(
      {
        user: {
          _id: "admin-a",
          role: "studioAdmin",
          adminStudioLocation: "studio-a",
        },
        params: { passId: "pass-a" },
        body: { action: "approve" },
        app: { get: () => null },
      },
      response,
    );

    assert.equal(response.statusCode, 200);
    assert.equal(pass.freeze.status, "approved");
    assert.equal(pass.freeze.hasBeenFrozen, true);
    assert.equal(pass.saves, 1);
    assert.equal(isPassCurrentlyFrozen(pass), true);
    assert.equal(
      pass.expiryDate.getTime() - oldExpiry.getTime(),
      pass.freeze.endDate.getTime() - pass.freeze.startDate.getTime(),
    );
  } finally {
    UserPasses.findById = originalFindById;
    Package.findById = originalPackageFindById;
  }
});

test("freeze requests require an eligible source package and stay within 90 days", async () => {
  const originalFindById = UserPasses.findById;
  const originalPackageFindById = Package.findById;
  let saveCount = 0;
  const pass = {
    _id: "pass-a",
    userId: "owner-a",
    issuingStudio: "studio-a",
    packageId: "package-a",
    isActive: true,
    remainingCredits: 2,
    expiryDate: new Date(Date.now() + 200 * 86_400_000),
    freeze: { hasBeenFrozen: false, status: "none" },
    async save() {
      saveCount += 1;
    },
  };
  UserPasses.findById = async () => pass;

  try {
    Package.findById = () => query({ isAvailableToFreeze: false });
    const ineligible = createResponse();
    await managePassFreeze(
      {
        user: { _id: "owner-a", role: "client" },
        params: { passId: "pass-a" },
        body: { action: "request" },
        app: { get: () => null },
      },
      ineligible,
    );
    assert.equal(ineligible.statusCode, 400);
    assert.match(ineligible.body.message, /not eligible/i);

    Package.findById = () => query({ isAvailableToFreeze: true });
    const tooLong = createResponse();
    await managePassFreeze(
      {
        user: { _id: "owner-a", role: "client" },
        params: { passId: "pass-a" },
        body: {
          action: "request",
          startDate: new Date(Date.now() + 60_000).toISOString(),
          endDate: new Date(Date.now() + 91 * 86_400_000).toISOString(),
        },
        app: { get: () => null },
      },
      tooLong,
    );
    assert.equal(tooLong.statusCode, 400);
    assert.match(tooLong.body.message, /90 days/i);
    assert.equal(saveCount, 0);
  } finally {
    UserPasses.findById = originalFindById;
    Package.findById = originalPackageFindById;
  }
});

test("unfreezing a scheduled freeze removes only the duration previously added", async () => {
  const originalFindById = UserPasses.findById;
  const freezeStart = new Date(Date.now() + 86_400_000);
  const freezeEnd = new Date(freezeStart.getTime() + 2 * 86_400_000);
  const originalExpiry = new Date(Date.now() + 30 * 86_400_000);
  const extendedExpiry = new Date(
    originalExpiry.getTime() + (freezeEnd.getTime() - freezeStart.getTime()),
  );
  const pass = {
    _id: "pass-a",
    userId: "owner-a",
    issuingStudio: "studio-a",
    expiryDate: extendedExpiry,
    freeze: {
      hasBeenFrozen: true,
      status: "approved",
      startDate: freezeStart,
      endDate: freezeEnd,
    },
    async save() {},
  };
  UserPasses.findById = async () => pass;

  try {
    const response = createResponse();
    await managePassFreeze(
      {
        user: { _id: "owner-a", role: "client" },
        params: { passId: "pass-a" },
        body: { action: "unfreeze" },
        app: { get: () => null },
      },
      response,
    );

    assert.equal(response.statusCode, 200);
    assert.equal(pass.freeze.status, "unfrozen");
    assert.equal(pass.expiryDate.getTime(), originalExpiry.getTime());
  } finally {
    UserPasses.findById = originalFindById;
  }
});

test("credit deduction rejects an actively frozen pass without mutating credits", async () => {
  const originalStartSession = mongoose.startSession;
  const originalFindById = UserPasses.findById;
  const session = createSession();
  let saveCount = 0;
  const pass = {
    userId: "client-a",
    sharedWith: [],
    issuingStudio: "studio-a",
    isActive: true,
    remainingCredits: 4,
    expiryDate: new Date(Date.now() + 86_400_000),
    freeze: {
      status: "approved",
      startDate: new Date(Date.now() - 1_000),
      endDate: new Date(Date.now() + 60_000),
    },
    async save() {
      saveCount += 1;
    },
  };
  mongoose.startSession = async () => session;
  UserPasses.findById = () => query(pass);

  try {
    const response = createResponse();
    await deductCredits(
      {
        user: {
          _id: "admin-a",
          role: "studioAdmin",
          adminStudioLocation: "studio-a",
        },
        body: { userId: "client-a", passId: "pass-a", creditsToDeduct: 1 },
      },
      response,
    );

    assert.equal(response.statusCode, 400);
    assert.match(response.body.error, /currently frozen/i);
    assert.equal(pass.remainingCredits, 4);
    assert.equal(saveCount, 0);
    assert.equal(session.commits, 0);
    assert.equal(session.aborts, 1);
  } finally {
    mongoose.startSession = originalStartSession;
    UserPasses.findById = originalFindById;
  }
});

test("booking rejects an actively frozen pass before deducting a credit", async () => {
  const originalStartSession = mongoose.startSession;
  const originalScheduleFindById = ClassSchedule.findById;
  const originalBookingFindOne = ClassBooking.findOne;
  const originalPassFindById = UserPasses.findById;
  const originalConsoleError = console.error;
  const session = createSession();
  let passSaveCount = 0;
  let classSaveCount = 0;
  const classRecord = {
    _id: "class-a",
    isActive: true,
    studioId: "studio-a",
    currentEnrollment: 0,
    capacity: 10,
    instructorType: "Junior Instructor",
    classType: "Reformer",
    async save() {
      classSaveCount += 1;
    },
  };
  const pass = {
    userId: "client-a",
    sharedWith: [],
    issuingStudio: "studio-a",
    isActive: true,
    remainingCredits: 3,
    expiryDate: new Date(Date.now() + 86_400_000),
    packageId: { activationPeriodDays: 30 },
    freeze: {
      status: "approved",
      startDate: new Date(Date.now() - 1_000),
      endDate: new Date(Date.now() + 60_000),
    },
    async save() {
      passSaveCount += 1;
    },
  };
  mongoose.startSession = async () => session;
  ClassSchedule.findById = () => query(classRecord);
  ClassBooking.findOne = () => query(null);
  UserPasses.findById = () => query(pass);
  console.error = () => {};

  try {
    const response = createResponse();
    await createBooking(
      {
        user: { _id: "client-a", role: "client" },
        body: { classId: "class-a", passId: "pass-a" },
      },
      response,
    );

    assert.equal(response.statusCode, 400);
    assert.match(response.body.error, /currently frozen/i);
    assert.equal(pass.remainingCredits, 3);
    assert.equal(passSaveCount, 0);
    assert.equal(classSaveCount, 0);
    assert.equal(session.aborts, 1);
  } finally {
    mongoose.startSession = originalStartSession;
    ClassSchedule.findById = originalScheduleFindById;
    ClassBooking.findOne = originalBookingFindOne;
    UserPasses.findById = originalPassFindById;
    console.error = originalConsoleError;
  }
});
