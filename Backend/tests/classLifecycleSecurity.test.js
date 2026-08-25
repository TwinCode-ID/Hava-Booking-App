const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const ClassBooking = require("../models/ClassBooking/ClassBooking");
const ClassSchedule = require("../models/ClassBooking/ClassSchedule");
const UserPasses = require("../models/UserData/User_Passes");
const {
  cancelBooking,
} = require("../controllers/ClassBookingController/classBookingController");
const {
  deleteClass,
} = require("../controllers/ClassBookingController/classScheduleController");

const query = (value) => ({
  select() {
    return this;
  },
  session() {
    return this;
  },
  then(resolve, reject) {
    return Promise.resolve(value).then(resolve, reject);
  },
});

const createSession = () => ({
  commits: 0,
  aborts: 0,
  ended: false,
  startTransaction() {},
  async commitTransaction() {
    this.commits += 1;
  },
  async abortTransaction() {
    this.aborts += 1;
  },
  endSession() {
    this.ended = true;
  },
});

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

test("a missing class cannot be used to refund an old booking credit", async () => {
  const originalStartSession = mongoose.startSession;
  const originalBookingFindById = ClassBooking.findById;
  const originalScheduleFindById = ClassSchedule.findById;
  const originalPassFindById = UserPasses.findById;
  const session = createSession();
  let passLookupRan = false;

  mongoose.startSession = async () => session;
  ClassBooking.findById = () =>
    query({
      _id: "booking-a",
      userId: "client-a",
      classId: "deleted-class",
      passId: "pass-a",
      studioId: "studio-a",
      status: "Booked",
    });
  ClassSchedule.findById = () => query(null);
  UserPasses.findById = () => {
    passLookupRan = true;
    return query(null);
  };

  try {
    const response = createResponse();
    await cancelBooking(
      {
        user: { _id: "client-a", role: "client" },
        body: { bookingId: "booking-a" },
        app: { get: () => null },
      },
      response,
    );

    assert.equal(response.statusCode, 409);
    assert.match(response.body.error, /class no longer exists/i);
    assert.equal(passLookupRan, false);
    assert.equal(session.commits, 0);
    assert.equal(session.aborts, 1);
  } finally {
    mongoose.startSession = originalStartSession;
    ClassBooking.findById = originalBookingFindById;
    ClassSchedule.findById = originalScheduleFindById;
    UserPasses.findById = originalPassFindById;
  }
});

test("a class with booking history cannot be deleted", async () => {
  const originalStartSession = mongoose.startSession;
  const originalScheduleFindById = ClassSchedule.findById;
  const originalScheduleFind = ClassSchedule.find;
  const originalScheduleDeleteMany = ClassSchedule.deleteMany;
  const originalBookingExists = ClassBooking.exists;
  const session = createSession();
  let deleteRan = false;

  mongoose.startSession = async () => session;
  ClassSchedule.findById = () =>
    query({ _id: "class-a", studioId: "studio-a" });
  ClassSchedule.find = () => query([{ _id: "class-a" }]);
  ClassBooking.exists = () => query({ _id: "booking-a" });
  ClassSchedule.deleteMany = async () => {
    deleteRan = true;
  };

  try {
    const response = createResponse();
    await deleteClass(
      {
        user: {
          _id: "admin-a",
          role: "studioAdmin",
          adminStudioLocation: "studio-a",
        },
        params: { id: "class-a" },
        body: { deleteMode: "single" },
      },
      response,
    );

    assert.equal(response.statusCode, 409);
    assert.match(response.body.error, /booking history cannot be deleted/i);
    assert.equal(deleteRan, false);
    assert.equal(session.commits, 0);
    assert.equal(session.aborts, 1);
  } finally {
    mongoose.startSession = originalStartSession;
    ClassSchedule.findById = originalScheduleFindById;
    ClassSchedule.find = originalScheduleFind;
    ClassSchedule.deleteMany = originalScheduleDeleteMany;
    ClassBooking.exists = originalBookingExists;
  }
});

