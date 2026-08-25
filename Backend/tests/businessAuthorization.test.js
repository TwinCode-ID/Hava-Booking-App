const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const {
  canAccessUser,
  canManageStudio,
  idsEqual,
} = require("../helper/authorization");
const User = require("../models/UserData/User");
const UserPasses = require("../models/UserData/User_Passes");
const UserMedicalRecords = require("../models/UserData/User_Medical_Records");
const Conversation = require("../models/Messaging/Conversation");
const Message = require("../models/Messaging/Message");
const Packages = require("../models/StudioData/Packages");
const PackagePurchase = require("../models/StudioData/PackagePurchase");
const ClassBooking = require("../models/ClassBooking/ClassBooking");
const ClassSchedule = require("../models/ClassBooking/ClassSchedule");
const Promo = require("../models/StudioData/Promo");

const {
  getMedicalRecord,
  upsertMedicalRecord,
} = require("../controllers/UserController/medicalRecordController");
const {
  getMessages,
} = require("../controllers/MessagingController/chatController");
const {
  adminReviewPayment,
  createCashierBulkPurchase,
  createPurchase,
} = require("../controllers/StudioDataController/packagePurchaseController");
const {
  getAllUsers,
  getPublicProfile,
  updateProfile,
  updateProfileDeveloper,
} = require("../controllers/UserController/userController");
const {
  createBooking,
} = require("../controllers/ClassBookingController/classBookingController");
const {
  assignPassToUser,
} = require("../controllers/UserController/user_passesController");
const {
  updateClass,
} = require("../controllers/ClassBookingController/classScheduleController");
const {
  updatePromo,
} = require("../controllers/StudioDataController/promoController");

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
  startTransaction() {},
  async commitTransaction() {},
  async abortTransaction() {},
  endSession() {},
});

const sessionQuery = (value) => {
  const result = Promise.resolve(value);
  const query = {
    lean() {
      return query;
    },
    populate() {
      return query;
    },
    select() {
      return query;
    },
    session() {
      return query;
    },
    sort() {
      return query;
    },
    then(resolve, reject) {
      return result.then(resolve, reject);
    },
    catch(reject) {
      return result.catch(reject);
    },
  };
  return query;
};

test("studio authorization is tenant-scoped while devTeam remains global", () => {
  const studioAdmin = {
    role: "studioAdmin",
    adminStudioLocation: "studio-a",
  };

  assert.equal(canManageStudio(studioAdmin, "studio-a"), true);
  assert.equal(canManageStudio(studioAdmin, "studio-b"), false);
  assert.equal(canManageStudio({ role: "client" }, "studio-a"), false);
  assert.equal(canManageStudio({ role: "devTeam" }, "studio-b"), true);
  assert.equal(
    canAccessUser(studioAdmin, {
      _id: "client-a",
      role: "client",
      preferredStudioId: "studio-a",
    }),
    true,
  );
  assert.equal(
    canAccessUser(studioAdmin, {
      _id: "client-b",
      role: "client",
      preferredStudioId: "studio-b",
    }),
    false,
  );
});

test("authorization compares real BSON ObjectIds without recursive overflow", () => {
  const id = new mongoose.Types.ObjectId();
  assert.equal(idsEqual(id, id.toString()), true);
  assert.equal(idsEqual({ _id: id }, id.toString()), true);
  assert.equal(idsEqual(id, new mongoose.Types.ObjectId()), false);
});

test("a studio admin cannot read a client from another studio", async () => {
  const originalFindById = User.findById;
  User.findById = () =>
    sessionQuery({
      _id: "client-b",
      role: "client",
      preferredStudioId: "studio-b",
    });

  try {
    const response = createResponse();
    await getPublicProfile(
      {
        user: {
          _id: "admin-a",
          role: "studioAdmin",
          adminStudioLocation: "studio-a",
        },
        params: { id: "client-b" },
      },
      response,
    );

    assert.equal(response.statusCode, 403);
    assert.equal(response.body.message, "Not authorized.");
  } finally {
    User.findById = originalFindById;
  }
});

test("a studio admin cannot update a client from another studio", async () => {
  const originalFindById = User.findById;
  let saveCount = 0;
  const targetUser = {
    _id: "client-b",
    role: "client",
    preferredStudioId: "studio-b",
    isStudent: false,
    save: async () => {
      saveCount += 1;
    },
  };
  User.findById = async () => targetUser;

  try {
    const response = createResponse();
    await updateProfileDeveloper(
      {
        user: {
          _id: "admin-a",
          role: "studioAdmin",
          adminStudioLocation: "studio-a",
        },
        params: { id: "client-b" },
        body: { isStudent: true, fullName: "Changed" },
      },
      response,
    );

    assert.equal(response.statusCode, 403);
    assert.equal(targetUser.isStudent, false);
    assert.equal(Object.hasOwn(targetUser, "fullName"), false);
    assert.equal(saveCount, 0);
  } finally {
    User.findById = originalFindById;
  }
});

test("studio client lists are filtered to the admin's studio", async () => {
  const originalFind = User.find;
  let capturedQuery;
  User.find = (query) => {
    capturedQuery = query;
    return sessionQuery([]);
  };

  try {
    const response = createResponse();
    await getAllUsers(
      {
        user: {
          _id: "admin-a",
          role: "studioAdmin",
          adminStudioLocation: "studio-a",
        },
      },
      response,
    );

    assert.equal(response.statusCode, 200);
    assert.deepEqual(capturedQuery, {
      role: "client",
      preferredStudioId: "studio-a",
    });
  } finally {
    User.find = originalFind;
  }
});

test("a studio admin without an assigned studio cannot list clients", async () => {
  const originalFind = User.find;
  let findRan = false;
  User.find = () => {
    findRan = true;
    return sessionQuery([]);
  };

  try {
    const response = createResponse();
    await getAllUsers(
      { user: { _id: "admin-a", role: "studioAdmin" } },
      response,
    );

    assert.equal(response.statusCode, 403);
    assert.equal(findRan, false);
  } finally {
    User.find = originalFind;
  }
});

test("a studio admin can verify a same-studio client without changing affiliation", async () => {
  const originalFindById = User.findById;
  let saveCount = 0;
  const targetUser = {
    _id: "client-a",
    role: "client",
    preferredStudioId: "studio-a",
    isStudent: false,
    save: async () => {
      saveCount += 1;
    },
  };
  User.findById = async () => targetUser;

  try {
    const response = createResponse();
    await updateProfileDeveloper(
      {
        user: {
          _id: "admin-a",
          role: "studioAdmin",
          adminStudioLocation: "studio-a",
        },
        params: { id: "client-a" },
        body: { isStudent: true, preferredStudioId: "studio-b" },
      },
      response,
    );

    assert.equal(response.statusCode, 200);
    assert.equal(targetUser.isStudent, true);
    assert.equal(targetUser.preferredStudioId, "studio-a");
    assert.equal(saveCount, 1);
  } finally {
    User.findById = originalFindById;
  }
});

test("a client cannot self-assert student eligibility", async () => {
  const originalFindById = User.findById;
  let saveCount = 0;
  const client = {
    _id: "client-a",
    role: "client",
    fullName: "Client A",
    email: "client-a@example.com",
    isStudent: false,
    save: async () => {
      saveCount += 1;
    },
  };
  User.findById = async () => client;

  try {
    const response = createResponse();
    await updateProfile(
      {
        user: { _id: "client-a", role: "client" },
        body: { isStudent: true },
      },
      response,
    );

    assert.equal(response.statusCode, 201);
    assert.equal(client.isStudent, false);
    assert.equal(response.body.isStudent, false);
    assert.equal(saveCount, 1);
  } finally {
    User.findById = originalFindById;
  }
});

test("a client cannot read another user's medical record", async () => {
  const response = createResponse();
  const requesterId = new mongoose.Types.ObjectId().toString();
  const targetId = new mongoose.Types.ObjectId().toString();

  await getMedicalRecord(
    {
      user: { _id: requesterId, role: "client" },
      params: { userId: targetId },
    },
    response,
  );

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.message, "Not authorized");
});

test("medical upsert ignores identity and privilege fields from the body", async () => {
  const originalFindOneAndUpdate = UserMedicalRecords.findOneAndUpdate;
  const ownerId = new mongoose.Types.ObjectId().toString();
  let captured;
  UserMedicalRecords.findOneAndUpdate = async (...args) => {
    captured = args;
    return { userId: ownerId, physicalConcern: "Back pain" };
  };

  try {
    const response = createResponse();
    await upsertMedicalRecord(
      {
        user: { _id: ownerId, role: "client" },
        params: { userId: ownerId },
        body: {
          physicalConcern: "Back pain",
          userId: "victim",
          role: "devTeam",
          studioId: "studio-b",
        },
      },
      response,
    );

    assert.equal(response.statusCode, 200);
    assert.deepEqual(captured[0], { userId: ownerId });
    assert.deepEqual(captured[1], {
      $set: { physicalConcern: "Back pain", userId: ownerId },
    });
    assert.equal(Object.hasOwn(captured[1].$set, "role"), false);
    assert.equal(Object.hasOwn(captured[1].$set, "studioId"), false);
  } finally {
    UserMedicalRecords.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test("chat messages are not queried for a non-participant", async () => {
  const originalConversationFindById = Conversation.findById;
  const originalMessageFind = Message.find;
  let messageQueryRan = false;

  Conversation.findById = async () => ({
    client: "different-client",
    studio: "studio-b",
  });
  Message.find = () => {
    messageQueryRan = true;
    throw new Error("message query should not run");
  };

  try {
    const response = createResponse();
    await getMessages(
      {
        user: { _id: "client-a", role: "client" },
        params: { conversationId: "conversation-a" },
      },
      response,
    );

    assert.equal(response.statusCode, 403);
    assert.equal(messageQueryRan, false);
  } finally {
    Conversation.findById = originalConversationFindById;
    Message.find = originalMessageFind;
  }
});

test("a client cannot mint a pass with the direct-payment method", async () => {
  const originalStartSession = mongoose.startSession;
  const originalPackageFindById = Packages.findById;
  mongoose.startSession = async () => createSession();
  Packages.findById = () =>
    sessionQuery({
      _id: "package-a",
      studioLocation: "studio-a",
      packagePrice: 100,
    });

  try {
    const response = createResponse();
    await createPurchase(
      {
        user: { _id: "client-a", role: "client" },
        body: {
          packageId: "package-a",
          userId: "victim",
          paymentMethod: "direct_payment",
          status: "confirmed",
          totalAmount: 0,
        },
      },
      response,
    );

    assert.equal(response.statusCode, 403);
    assert.match(response.body.error, /restricted to studio staff/i);
  } finally {
    mongoose.startSession = originalStartSession;
    Packages.findById = originalPackageFindById;
  }
});

test("an inactive package cannot be purchased by direct ID", async () => {
  const originalStartSession = mongoose.startSession;
  const originalPackageFindById = Packages.findById;
  mongoose.startSession = async () => createSession();
  Packages.findById = () =>
    sessionQuery({
      _id: "inactive-package",
      isActive: false,
      studioLocation: "studio-a",
      packagePrice: 100,
    });

  try {
    const response = createResponse();
    await createPurchase(
      {
        user: { _id: "client-a", role: "client" },
        body: {
          packageId: "inactive-package",
          paymentMethod: "bank_transfer",
        },
      },
      response,
    );

    assert.equal(response.statusCode, 400);
    assert.match(response.body.error, /not available/i);
  } finally {
    mongoose.startSession = originalStartSession;
    Packages.findById = originalPackageFindById;
  }
});

test("a non-student cannot purchase a student package", async () => {
  const originalStartSession = mongoose.startSession;
  const originalPackageFindById = Packages.findById;
  const originalUserFindById = User.findById;
  mongoose.startSession = async () => createSession();
  Packages.findById = () =>
    sessionQuery({
      _id: "student-package",
      studioLocation: "studio-a",
      packagePrice: 100,
      packageCategory: ["Student"],
      isStudentPackage: false,
    });
  User.findById = () =>
    sessionQuery({
      _id: "client-a",
      isStudent: false,
      preferredStudioId: "studio-a",
      role: "client",
    });

  try {
    const response = createResponse();
    await createPurchase(
      {
        user: { _id: "client-a", role: "client" },
        body: {
          packageId: "student-package",
          paymentMethod: "bank_transfer",
        },
      },
      response,
    );

    assert.equal(response.statusCode, 403);
    assert.match(response.body.error, /restricted to verified students/i);
  } finally {
    mongoose.startSession = originalStartSession;
    Packages.findById = originalPackageFindById;
    User.findById = originalUserFindById;
  }
});

test("cashier bulk assignment also rejects student packages for non-students", async () => {
  const originalStartSession = mongoose.startSession;
  const originalPackageFindById = Packages.findById;
  const originalUserFindById = User.findById;
  mongoose.startSession = async () => createSession();
  Packages.findById = () =>
    sessionQuery({
      _id: "student-package",
      studioLocation: "studio-a",
      isStudentPackage: true,
    });
  User.findById = () =>
    sessionQuery({
      _id: "client-a",
      isStudent: false,
      preferredStudioId: "studio-a",
      role: "client",
    });

  try {
    const response = createResponse();
    await createCashierBulkPurchase(
      {
        user: {
          _id: "admin-a",
          role: "studioAdmin",
          adminStudioLocation: "studio-a",
        },
        body: {
          userIds: ["client-a"],
          purchasedPackages: [{ packageId: "student-package", qty: 1 }],
          paymentMethod: "direct_payment",
        },
      },
      response,
    );

    assert.equal(response.statusCode, 403);
    assert.match(response.body.error, /restricted to verified students/i);
  } finally {
    mongoose.startSession = originalStartSession;
    Packages.findById = originalPackageFindById;
    User.findById = originalUserFindById;
  }
});

test("payment approval rechecks student eligibility before issuing passes", async () => {
  const originalStartSession = mongoose.startSession;
  const originalPurchaseFindById = PackagePurchase.findById;
  const originalPackageFindById = Packages.findById;
  const originalUserFindById = User.findById;
  let purchaseSaveCount = 0;

  mongoose.startSession = async () => createSession();
  PackagePurchase.findById = () =>
    sessionQuery({
      _id: "purchase-a",
      userId: "client-a",
      packageId: "student-package",
      issuingStudio: "studio-a",
      status: "waiting_confirmation",
      save: async () => {
        purchaseSaveCount += 1;
      },
    });
  Packages.findById = () =>
    sessionQuery({
      _id: "student-package",
      isStudentPackage: true,
    });
  User.findById = () =>
    sessionQuery({
      _id: "client-a",
      isStudent: false,
      preferredStudioId: "studio-a",
      role: "client",
    });

  try {
    const response = createResponse();
    await adminReviewPayment(
      {
        user: {
          _id: "admin-a",
          role: "studioAdmin",
          adminStudioLocation: "studio-a",
        },
        params: { purchaseId: "purchase-a" },
        body: { action: "approve" },
      },
      response,
    );

    assert.equal(response.statusCode, 403);
    assert.match(response.body.error, /restricted to verified students/i);
    assert.equal(purchaseSaveCount, 0);
  } finally {
    mongoose.startSession = originalStartSession;
    PackagePurchase.findById = originalPurchaseFindById;
    Packages.findById = originalPackageFindById;
    User.findById = originalUserFindById;
  }
});

test("direct pass assignment rejects student packages for non-students", async () => {
  const originalStartSession = mongoose.startSession;
  const originalPackageFindById = Packages.findById;
  const originalUserFindById = User.findById;
  mongoose.startSession = async () => createSession();
  Packages.findById = () =>
    sessionQuery({
      _id: "student-package",
      studioLocation: "studio-a",
      isStudentPackage: true,
    });
  User.findById = () =>
    sessionQuery({
      _id: "client-a",
      isStudent: false,
      preferredStudioId: "studio-a",
      role: "client",
    });

  try {
    const response = createResponse();
    await assignPassToUser(
      {
        user: {
          _id: "admin-a",
          role: "studioAdmin",
          adminStudioLocation: "studio-a",
        },
        body: {
          userId: "client-a",
          packageId: "student-package",
        },
      },
      response,
    );

    assert.equal(response.statusCode, 403);
    assert.match(response.body.error, /restricted to verified students/i);
  } finally {
    mongoose.startSession = originalStartSession;
    Packages.findById = originalPackageFindById;
    User.findById = originalUserFindById;
  }
});

test("a studio admin cannot sell a package to another studio's client", async () => {
  const originalStartSession = mongoose.startSession;
  const originalPackageFindById = Packages.findById;
  const originalUserFindById = User.findById;
  mongoose.startSession = async () => createSession();
  Packages.findById = () =>
    sessionQuery({
      _id: "package-a",
      studioLocation: "studio-a",
      packagePrice: 100,
    });
  User.findById = () =>
    sessionQuery({
      _id: "client-b",
      preferredStudioId: "studio-b",
      role: "client",
    });

  try {
    const response = createResponse();
    await createPurchase(
      {
        user: {
          _id: "admin-a",
          role: "studioAdmin",
          adminStudioLocation: "studio-a",
        },
        body: {
          packageId: "package-a",
          paymentMethod: "direct_payment",
          totalAmount: 100,
          userId: "client-b",
        },
      },
      response,
    );

    assert.equal(response.statusCode, 403);
    assert.match(response.body.error, /affiliated with your studio/i);
  } finally {
    mongoose.startSession = originalStartSession;
    Packages.findById = originalPackageFindById;
    User.findById = originalUserFindById;
  }
});

test("a studio admin cannot assign a pass to another studio's client", async () => {
  const originalStartSession = mongoose.startSession;
  const originalPackageFindById = Packages.findById;
  const originalUserFindById = User.findById;
  mongoose.startSession = async () => createSession();
  Packages.findById = () =>
    sessionQuery({
      _id: "package-a",
      studioLocation: "studio-a",
      isStudentPackage: false,
    });
  User.findById = () =>
    sessionQuery({
      _id: "client-b",
      preferredStudioId: "studio-b",
      role: "client",
    });

  try {
    const response = createResponse();
    await assignPassToUser(
      {
        user: {
          _id: "admin-a",
          role: "studioAdmin",
          adminStudioLocation: "studio-a",
        },
        body: {
          userId: "client-b",
          packageId: "package-a",
        },
      },
      response,
    );

    assert.equal(response.statusCode, 403);
    assert.match(response.body.error, /affiliated with your studio/i);
  } finally {
    mongoose.startSession = originalStartSession;
    Packages.findById = originalPackageFindById;
    User.findById = originalUserFindById;
  }
});

test("a pass cannot be spent on a class at another studio", async () => {
  const originalStartSession = mongoose.startSession;
  const originalScheduleFindById = ClassSchedule.findById;
  const originalBookingFindOne = ClassBooking.findOne;
  const originalPassFindById = UserPasses.findById;
  const originalConsoleError = console.error;
  let passSaveCount = 0;
  let classSaveCount = 0;

  mongoose.startSession = async () => createSession();
  ClassSchedule.findById = () =>
    sessionQuery({
      _id: "class-b",
      studioId: "studio-b",
      isActive: true,
      currentEnrollment: 0,
      capacity: 10,
      instructorType: "Junior Instructor",
      classType: "Reformer",
      save: async () => {
        classSaveCount += 1;
      },
    });
  ClassBooking.findOne = () => sessionQuery(null);
  UserPasses.findById = () =>
    sessionQuery({
      _id: "pass-a",
      userId: "client-a",
      sharedWith: [],
      issuingStudio: "studio-a",
      isActive: true,
      remainingCredits: 2,
      save: async () => {
        passSaveCount += 1;
      },
    });
  console.error = () => {};

  try {
    const response = createResponse();
    await createBooking(
      {
        user: { _id: "client-a", role: "client" },
        body: { classId: "class-b", passId: "pass-a" },
      },
      response,
    );

    assert.equal(response.statusCode, 403);
    assert.match(response.body.error, /another studio/i);
    assert.equal(passSaveCount, 0);
    assert.equal(classSaveCount, 0);
  } finally {
    mongoose.startSession = originalStartSession;
    ClassSchedule.findById = originalScheduleFindById;
    ClassBooking.findOne = originalBookingFindOne;
    UserPasses.findById = originalPassFindById;
    console.error = originalConsoleError;
  }
});

test("a studio admin cannot update another studio's class", async () => {
  const originalStartSession = mongoose.startSession;
  const originalFindById = ClassSchedule.findById;
  const originalFindByIdAndUpdate = ClassSchedule.findByIdAndUpdate;
  let updateRan = false;
  mongoose.startSession = async () => createSession();
  ClassSchedule.findById = () =>
    sessionQuery({ _id: "class-a", studioId: "studio-b" });
  ClassSchedule.findByIdAndUpdate = async () => {
    updateRan = true;
  };

  try {
    const response = createResponse();
    await updateClass(
      {
        user: {
          _id: "admin-a",
          role: "studioAdmin",
          adminStudioLocation: "studio-a",
        },
        params: { id: "class-a" },
        body: { updateMode: "single", capacity: 100 },
      },
      response,
    );

    assert.equal(response.statusCode, 403);
    assert.equal(updateRan, false);
  } finally {
    mongoose.startSession = originalStartSession;
    ClassSchedule.findById = originalFindById;
    ClassSchedule.findByIdAndUpdate = originalFindByIdAndUpdate;
  }
});

test("class updates discard studio and enrollment mass-assignment fields", async () => {
  const originalStartSession = mongoose.startSession;
  const originalFindById = ClassSchedule.findById;
  const originalFindByIdAndUpdate = ClassSchedule.findByIdAndUpdate;
  let capturedUpdate;
  mongoose.startSession = async () => createSession();
  ClassSchedule.findById = () =>
    sessionQuery({ _id: "class-a", studioId: "studio-a" });
  ClassSchedule.findByIdAndUpdate = async (_id, update) => {
    capturedUpdate = update;
    return { _id };
  };

  try {
    const response = createResponse();
    await updateClass(
      {
        user: {
          _id: "admin-a",
          role: "studioAdmin",
          adminStudioLocation: "studio-a",
        },
        params: { id: "class-a" },
        body: {
          updateMode: "single",
          studioId: "studio-b",
          currentEnrollment: 999,
          className: "Allowed name",
        },
      },
      response,
    );

    assert.equal(response.statusCode, 200);
    assert.deepEqual(capturedUpdate, { className: "Allowed name" });
  } finally {
    mongoose.startSession = originalStartSession;
    ClassSchedule.findById = originalFindById;
    ClassSchedule.findByIdAndUpdate = originalFindByIdAndUpdate;
  }
});

test("a studio admin cannot update another studio's promo", async () => {
  const originalFindById = Promo.findById;
  let saveRan = false;
  Promo.findById = async () => ({
    studioLocation: "studio-b",
    save: async () => {
      saveRan = true;
    },
  });

  try {
    const response = createResponse();
    await updatePromo(
      {
        user: {
          _id: "admin-a",
          role: "studioAdmin",
          adminStudioLocation: "studio-a",
        },
        params: { id: "promo-a" },
        body: { discountValue: 100 },
      },
      response,
    );

    assert.equal(response.statusCode, 403);
    assert.equal(saveRan, false);
  } finally {
    Promo.findById = originalFindById;
  }
});

test("sensitive business mutations include the studioAdmin middleware", () => {
  const bookingRoutes = require("../routes/BookingRoutes/bookingRoutes");
  const scheduleRoutes = require("../routes/BookingRoutes/scheduleRoutes");
  const purchaseRoutes = require("../routes/StudioRoutes/purchaseRoutes");

  const assertStudioAdmin = (router, method, path) => {
    const layer = router.stack.find(
      (candidate) =>
        candidate.route?.path === path && candidate.route.methods[method],
    );
    assert.ok(layer, `${method.toUpperCase()} ${path} route is registered`);
    assert.ok(
      layer.route.stack.some((handler) => handler.handle.name === "studioAdmin"),
      `${method.toUpperCase()} ${path} requires studioAdmin`,
    );
  };

  assertStudioAdmin(bookingRoutes, "get", "/studio");
  assertStudioAdmin(bookingRoutes, "put", "/:bookingId");
  assertStudioAdmin(scheduleRoutes, "post", "/");
  assertStudioAdmin(scheduleRoutes, "put", "/:id");
  assertStudioAdmin(scheduleRoutes, "delete", "/:id");
  assertStudioAdmin(purchaseRoutes, "get", "/studio/:studioId");
  assertStudioAdmin(purchaseRoutes, "post", "/:purchaseId/review");
  assertStudioAdmin(purchaseRoutes, "post", "/cashier-bulk");
});
