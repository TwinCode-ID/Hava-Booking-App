const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const Package = require("../models/StudioData/Packages");
const PackagePurchase = require("../models/StudioData/PackagePurchase");
const CashierTransaction = require("../models/StudioData/CashierTransaction");
const Promo = require("../models/StudioData/Promo");
const User = require("../models/UserData/User");
const UserPasses = require("../models/UserData/User_Passes");
const OneTimePackageEntitlement = require(
  "../models/UserData/OneTimePackageEntitlement",
);
const {
  claimOneTimeEntitlement,
} = require("../helper/oneTimePackageEntitlement");
const {
  adminReviewPayment,
  createCashierBulkPurchase,
  createPurchase,
  uploadProof,
} = require("../controllers/StudioDataController/packagePurchaseController");
const {
  assignPassToUser,
} = require("../controllers/UserController/user_passesController");

const IDS = {
  admin: new mongoose.Types.ObjectId(),
  user: new mongoose.Types.ObjectId(),
  package: new mongoose.Types.ObjectId(),
  purchase: new mongoose.Types.ObjectId(),
  promo: new mongoose.Types.ObjectId(),
  studio: new mongoose.Types.ObjectId(),
};

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
    select() {
      return result;
    },
    populate() {
      return result;
    },
    lean() {
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

const regularPackage = (overrides = {}) => ({
  _id: IDS.package,
  packageName: "Starter",
  packagePrice: 100,
  studioLocation: IDS.studio,
  isActive: true,
  isStudentPackage: false,
  packageCategory: ["Regular"],
  isOneTimePurchase: false,
  isCombo: false,
  credits: 3,
  validityDays: 30,
  instructorType: ["Junior Instructor"],
  classType: ["Reformer"],
  ...overrides,
});

test("one-time entitlement storage has a permanent compound uniqueness boundary", () => {
  const indexes = OneTimePackageEntitlement.schema.indexes();
  const unique = indexes.find(
    ([keys, options]) =>
      keys.userId === 1 && keys.packageId === 1 && options.unique === true,
  );
  const ttl = indexes.find(
    ([keys, options]) =>
      keys.releaseAt === 1 && options.expireAfterSeconds === 0,
  );

  assert.ok(unique);
  assert.equal(unique[1].name, "one_time_entitlement_per_user_package");
  assert.ok(ttl);
  assert.deepEqual(ttl[1].partialFilterExpression, { state: "reserved" });
});

test("the atomic entitlement claim permits one mocked concurrent winner", async () => {
  const originalFindOneAndUpdate = OneTimePackageEntitlement.findOneAndUpdate;
  const calls = [];
  let claimed = false;
  OneTimePackageEntitlement.findOneAndUpdate = async (
    filter,
    update,
    options,
  ) => {
    calls.push({ filter, update, options });
    if (claimed) {
      const duplicate = new Error("duplicate key");
      duplicate.code = 11000;
      throw duplicate;
    }
    claimed = true;
    return { ...update.$set };
  };

  try {
    const attempts = await Promise.allSettled([
      claimOneTimeEntitlement({
        userId: IDS.user,
        packageId: IDS.package,
        source: "direct_assignment",
        state: "consumed",
        session: { id: "session-a" },
      }),
      claimOneTimeEntitlement({
        userId: IDS.user,
        packageId: IDS.package,
        source: "cashier",
        state: "consumed",
        session: { id: "session-b" },
      }),
    ]);

    assert.deepEqual(
      attempts.map((attempt) => attempt.status).sort(),
      ["fulfilled", "rejected"],
    );
    const rejection = attempts.find((attempt) => attempt.status === "rejected");
    assert.equal(rejection.reason.status, 409);
    assert.equal(rejection.reason.code, "ONE_TIME_PACKAGE_ALREADY_CLAIMED");
    assert.equal(calls.length, 2);
    for (const call of calls) {
      assert.equal(call.options.upsert, true);
      assert.equal(call.options.new, true);
      assert.equal(call.filter.userId, IDS.user);
      assert.equal(call.filter.packageId, IDS.package);
      assert.ok(call.filter.$or.some((part) => part.releaseAt?.$lte));
    }
  } finally {
    OneTimePackageEntitlement.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test("a pending one-time purchase reserves entitlement and emits only an invalidation ID", async () => {
  const originalStartSession = mongoose.startSession;
  const originalPackageFindById = Package.findById;
  const originalPurchaseFindOne = PackagePurchase.findOne;
  const originalPassFindOne = UserPasses.findOne;
  const originalEntitlementUpdate = OneTimePackageEntitlement.findOneAndUpdate;
  const originalPurchaseSave = PackagePurchase.prototype.save;
  const session = createSession();
  const emitted = [];
  let entitlementCall;

  mongoose.startSession = async () => session;
  Package.findById = () => query(regularPackage({ isOneTimePurchase: true }));
  PackagePurchase.findOne = () => query(null);
  UserPasses.findOne = () => query(null);
  OneTimePackageEntitlement.findOneAndUpdate = async (...args) => {
    entitlementCall = args;
    return { state: "reserved" };
  };
  PackagePurchase.prototype.save = async function save() {
    return this;
  };

  try {
    const response = createResponse();
    await createPurchase(
      {
        user: { _id: IDS.user, role: "client" },
        body: {
          packageId: IDS.package,
          paymentMethod: "bank_transfer",
        },
        app: {
          get: () => ({
            to: () => ({
              emit: (...args) => emitted.push(args),
            }),
          }),
        },
      },
      response,
    );

    assert.equal(response.statusCode, 201);
    assert.equal(entitlementCall[1].$set.state, "reserved");
    assert.equal(entitlementCall[1].$set.source, "purchase");
    assert.ok(entitlementCall[1].$set.releaseAt instanceof Date);
    assert.equal(session.commits, 1);
    assert.equal(emitted.length, 1);
    const notification = emitted[0][1];
    assert.equal(notification.type, "NEW_PURCHASE");
    assert.deepEqual(notification.data, {
      purchaseId: response.body.purchaseId.toString(),
    });
    assert.equal(Object.hasOwn(notification.data, "proofOfPayment"), false);
    assert.equal(Object.hasOwn(notification.data, "totalAmount"), false);
  } finally {
    mongoose.startSession = originalStartSession;
    Package.findById = originalPackageFindById;
    PackagePurchase.findOne = originalPurchaseFindOne;
    UserPasses.findOne = originalPassFindOne;
    OneTimePackageEntitlement.findOneAndUpdate = originalEntitlementUpdate;
    PackagePurchase.prototype.save = originalPurchaseSave;
  }
});

test("cashier and direct assignment consume a one-time entitlement", async () => {
  const originalStartSession = mongoose.startSession;
  const originalPackageFindById = Package.findById;
  const originalUserFindById = User.findById;
  const originalPurchaseFindOne = PackagePurchase.findOne;
  const originalPurchaseSave = PackagePurchase.prototype.save;
  const originalCashierSave = CashierTransaction.prototype.save;
  const originalPassFindOne = UserPasses.findOne;
  const originalPassInsertMany = UserPasses.insertMany;
  const originalEntitlementUpdate = OneTimePackageEntitlement.findOneAndUpdate;
  const calls = [];

  mongoose.startSession = async () => createSession();
  Package.findById = () => query(regularPackage({ isOneTimePurchase: true }));
  User.findById = () =>
    query({
      _id: IDS.user,
      role: "client",
      preferredStudioId: IDS.studio,
      isStudent: false,
    });
  PackagePurchase.findOne = () => query(null);
  PackagePurchase.prototype.save = async function save() {
    return this;
  };
  CashierTransaction.prototype.save = async function save() {
    return this;
  };
  UserPasses.findOne = () => query(null);
  UserPasses.insertMany = async (documents) => documents;
  OneTimePackageEntitlement.findOneAndUpdate = async (_filter, update) => {
    calls.push(update.$set);
    return update.$set;
  };

  try {
    const cashierResponse = createResponse();
    await createCashierBulkPurchase(
      {
        user: {
          _id: IDS.admin,
          role: "studioAdmin",
          adminStudioLocation: IDS.studio,
        },
        body: {
          userIds: [IDS.user],
          purchasedPackages: [
            { packageId: IDS.package, qty: 1, priceAtPurchase: 100 },
          ],
          paymentMethod: "cash",
          totalAmount: 100,
        },
      },
      cashierResponse,
    );
    assert.equal(cashierResponse.statusCode, 200);

    const directResponse = createResponse();
    await assignPassToUser(
      {
        user: {
          _id: IDS.admin,
          role: "studioAdmin",
          adminStudioLocation: IDS.studio,
        },
        body: { userId: IDS.user, packageId: IDS.package },
      },
      directResponse,
    );
    assert.equal(directResponse.statusCode, 201);

    assert.deepEqual(
      calls.map((call) => call.source),
      ["cashier", "direct_assignment"],
    );
    assert.ok(calls.every((call) => call.state === "consumed"));
  } finally {
    mongoose.startSession = originalStartSession;
    Package.findById = originalPackageFindById;
    User.findById = originalUserFindById;
    PackagePurchase.findOne = originalPurchaseFindOne;
    PackagePurchase.prototype.save = originalPurchaseSave;
    CashierTransaction.prototype.save = originalCashierSave;
    UserPasses.findOne = originalPassFindOne;
    UserPasses.insertMany = originalPassInsertMany;
    OneTimePackageEntitlement.findOneAndUpdate = originalEntitlementUpdate;
  }
});

test("cashier and direct assignment both reject an inactive package", async () => {
  const originalStartSession = mongoose.startSession;
  const originalPackageFindById = Package.findById;
  const originalUserFindById = User.findById;
  const originalInsertMany = UserPasses.insertMany;
  let inserts = 0;

  mongoose.startSession = async () => createSession();
  Package.findById = () => query(regularPackage({ isActive: false }));
  User.findById = () =>
    query({
      _id: IDS.user,
      role: "client",
      preferredStudioId: IDS.studio,
      isStudent: false,
    });
  UserPasses.insertMany = async () => {
    inserts += 1;
  };

  try {
    const cashierResponse = createResponse();
    await createCashierBulkPurchase(
      {
        user: {
          _id: IDS.admin,
          role: "studioAdmin",
          adminStudioLocation: IDS.studio,
        },
        body: {
          userIds: [IDS.user],
          purchasedPackages: [
            { packageId: IDS.package, qty: 1, priceAtPurchase: 100 },
          ],
          paymentMethod: "cash",
          totalAmount: 100,
        },
      },
      cashierResponse,
    );

    const directResponse = createResponse();
    await assignPassToUser(
      {
        user: {
          _id: IDS.admin,
          role: "studioAdmin",
          adminStudioLocation: IDS.studio,
        },
        body: { userId: IDS.user, packageId: IDS.package },
      },
      directResponse,
    );

    assert.equal(cashierResponse.statusCode, 400);
    assert.match(cashierResponse.body.error, /not available/i);
    assert.equal(directResponse.statusCode, 400);
    assert.match(directResponse.body.error, /not available/i);
    assert.equal(inserts, 0);
  } finally {
    mongoose.startSession = originalStartSession;
    Package.findById = originalPackageFindById;
    User.findById = originalUserFindById;
    UserPasses.insertMany = originalInsertMany;
  }
});

test("approval rejects an inactive package before issuing a pass", async () => {
  const originalStartSession = mongoose.startSession;
  const originalPurchaseFindById = PackagePurchase.findById;
  const originalPackageFindById = Package.findById;
  const originalInsertMany = UserPasses.insertMany;
  let inserts = 0;

  mongoose.startSession = async () => createSession();
  PackagePurchase.findById = () =>
    query({
      _id: IDS.purchase,
      userId: IDS.user,
      packageId: IDS.package,
      issuingStudio: IDS.studio,
      status: "waiting_confirmation",
      paymentWindowExpiry: new Date(Date.now() + 60_000),
    });
  Package.findById = () => query(regularPackage({ isActive: false }));
  UserPasses.insertMany = async () => {
    inserts += 1;
  };

  try {
    const response = createResponse();
    await adminReviewPayment(
      {
        user: {
          _id: IDS.admin,
          role: "studioAdmin",
          adminStudioLocation: IDS.studio,
        },
        params: { purchaseId: IDS.purchase },
        body: { action: "approve" },
      },
      response,
    );

    assert.equal(response.statusCode, 400);
    assert.match(response.body.error, /not available/i);
    assert.equal(inserts, 0);
  } finally {
    mongoose.startSession = originalStartSession;
    PackagePurchase.findById = originalPurchaseFindById;
    Package.findById = originalPackageFindById;
    UserPasses.insertMany = originalInsertMany;
  }
});

test("one-time approval consumes its own reservation before issuing passes", async () => {
  const originalStartSession = mongoose.startSession;
  const originalPurchaseFindById = PackagePurchase.findById;
  const originalPurchaseFindOne = PackagePurchase.findOne;
  const originalPackageFindById = Package.findById;
  const originalPassFindOne = UserPasses.findOne;
  const originalPassInsertMany = UserPasses.insertMany;
  const originalEntitlementUpdate = OneTimePackageEntitlement.findOneAndUpdate;
  let entitlementCall;
  let insertCount = 0;
  const purchase = {
    _id: IDS.purchase,
    userId: IDS.user,
    packageId: IDS.package,
    issuingStudio: IDS.studio,
    status: "waiting_confirmation",
    isOneTimePurchaseSnapshot: true,
    paymentWindowExpiry: new Date(Date.now() + 60_000),
    createdAt: new Date(),
    async save() {},
  };

  mongoose.startSession = async () => createSession();
  PackagePurchase.findById = () => query(purchase);
  PackagePurchase.findOne = () => query(null);
  Package.findById = () => query(regularPackage({ isOneTimePurchase: true }));
  UserPasses.findOne = () => query(null);
  UserPasses.insertMany = async () => {
    insertCount += 1;
    return [];
  };
  OneTimePackageEntitlement.findOneAndUpdate = async (...args) => {
    entitlementCall = args;
    return args[1].$set;
  };

  try {
    const response = createResponse();
    await adminReviewPayment(
      {
        user: {
          _id: IDS.admin,
          role: "studioAdmin",
          adminStudioLocation: IDS.studio,
        },
        params: { purchaseId: IDS.purchase },
        body: { action: "approve", paymentIssuer: "Front desk" },
        app: { get: () => null },
      },
      response,
    );

    assert.equal(response.statusCode, 200);
    assert.equal(entitlementCall[1].$set.state, "consumed");
    assert.equal(entitlementCall[1].$set.purchaseId, IDS.purchase);
    assert.ok(
      entitlementCall[0].$or.some(
        (candidate) => candidate.purchaseId === IDS.purchase,
      ),
    );
    assert.equal(insertCount, 1);
    assert.equal(purchase.status, "confirmed");
  } finally {
    mongoose.startSession = originalStartSession;
    PackagePurchase.findById = originalPurchaseFindById;
    PackagePurchase.findOne = originalPurchaseFindOne;
    Package.findById = originalPackageFindById;
    UserPasses.findOne = originalPassFindOne;
    UserPasses.insertMany = originalPassInsertMany;
    OneTimePackageEntitlement.findOneAndUpdate = originalEntitlementUpdate;
  }
});

test("rejected and expired purchases release only their one-time reservation", async () => {
  const originalStartSession = mongoose.startSession;
  const originalPurchaseFindById = PackagePurchase.findById;
  const originalEntitlementDelete = OneTimePackageEntitlement.deleteOne;
  const purchases = [
    {
      _id: new mongoose.Types.ObjectId(),
      userId: IDS.user,
      packageId: IDS.package,
      issuingStudio: IDS.studio,
      status: "waiting_confirmation",
      paymentWindowExpiry: new Date(Date.now() + 60_000),
      async save() {},
    },
    {
      _id: new mongoose.Types.ObjectId(),
      userId: IDS.user,
      packageId: IDS.package,
      issuingStudio: IDS.studio,
      status: "waiting_confirmation",
      paymentWindowExpiry: new Date(Date.now() - 60_000),
      async save() {},
    },
  ];
  const deletions = [];
  let purchaseIndex = 0;

  mongoose.startSession = async () => createSession();
  PackagePurchase.findById = () => query(purchases[purchaseIndex++]);
  OneTimePackageEntitlement.deleteOne = (filter) => {
    deletions.push(filter);
    return query({ deletedCount: 1 });
  };

  try {
    const rejected = createResponse();
    await adminReviewPayment(
      {
        user: {
          _id: IDS.admin,
          role: "studioAdmin",
          adminStudioLocation: IDS.studio,
        },
        params: { purchaseId: purchases[0]._id },
        body: { action: "reject" },
        app: { get: () => null },
      },
      rejected,
    );

    const expired = createResponse();
    await adminReviewPayment(
      {
        user: {
          _id: IDS.admin,
          role: "studioAdmin",
          adminStudioLocation: IDS.studio,
        },
        params: { purchaseId: purchases[1]._id },
        body: { action: "approve" },
      },
      expired,
    );

    assert.equal(rejected.statusCode, 200);
    assert.equal(purchases[0].status, "payment_rejected");
    assert.equal(expired.statusCode, 400);
    assert.equal(purchases[1].status, "expired");
    assert.deepEqual(deletions, [
      { purchaseId: purchases[0]._id, state: "reserved" },
      { purchaseId: purchases[1]._id, state: "reserved" },
    ]);
  } finally {
    mongoose.startSession = originalStartSession;
    PackagePurchase.findById = originalPurchaseFindById;
    OneTimePackageEntitlement.deleteOne = originalEntitlementDelete;
  }
});

test("atomic promo consumption allows only one mocked concurrent approval at max usage", async () => {
  const originalStartSession = mongoose.startSession;
  const originalPurchaseFindById = PackagePurchase.findById;
  const originalPackageFindById = Package.findById;
  const originalPromoFindOne = Promo.findOne;
  const originalPromoUpdate = Promo.findOneAndUpdate;
  const originalPassInsertMany = UserPasses.insertMany;
  const sessions = [];
  const promoFilters = [];
  let promoAvailable = true;
  let inserts = 0;

  mongoose.startSession = async () => {
    const session = createSession();
    sessions.push(session);
    return session;
  };
  PackagePurchase.findById = () =>
    query({
      _id: new mongoose.Types.ObjectId(),
      userId: IDS.user,
      packageId: IDS.package,
      issuingStudio: IDS.studio,
      status: "waiting_confirmation",
      promoCodeApplied: "LIMIT1",
      paymentWindowExpiry: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      async save() {},
    });
  Package.findById = () => query(regularPackage());
  Promo.findOne = () =>
    query({
      _id: IDS.promo,
      promoType: "static",
      staticCode: "LIMIT1",
      isActive: true,
      validUntil: new Date(Date.now() + 60_000),
      maxUsageLimit: 1,
      currentUsageCount: 0,
      usedBy: [],
      discountType: "fixed",
      discountValue: 10,
    });
  Promo.findOneAndUpdate = async (filter) => {
    promoFilters.push(filter);
    if (!promoAvailable) return null;
    promoAvailable = false;
    return { discountType: "fixed", discountValue: 10 };
  };
  UserPasses.insertMany = async () => {
    inserts += 1;
    return [];
  };

  try {
    const responses = [createResponse(), createResponse()];
    await Promise.all(
      responses.map((response) =>
        adminReviewPayment(
          {
            user: {
              _id: IDS.admin,
              role: "studioAdmin",
              adminStudioLocation: IDS.studio,
            },
            params: { purchaseId: IDS.purchase },
            body: { action: "approve" },
            app: { get: () => null },
          },
          response,
        ),
      ),
    );

    assert.deepEqual(
      responses.map((response) => response.statusCode).sort(),
      [200, 400],
    );
    assert.equal(inserts, 1);
    assert.equal(promoFilters.length, 2);
    assert.ok(
      promoFilters.every((filter) =>
        filter.$and.some((constraint) => constraint.$or?.some((part) => part.$expr)),
      ),
    );
    assert.equal(sessions.filter((session) => session.commits === 1).length, 1);
    assert.equal(sessions.filter((session) => session.aborts === 1).length, 1);
  } finally {
    mongoose.startSession = originalStartSession;
    PackagePurchase.findById = originalPurchaseFindById;
    Package.findById = originalPackageFindById;
    Promo.findOne = originalPromoFindOne;
    Promo.findOneAndUpdate = originalPromoUpdate;
    UserPasses.insertMany = originalPassInsertMany;
  }
});

test("promo expiry at approval is transactional and issues no pass", async () => {
  const originalStartSession = mongoose.startSession;
  const originalPurchaseFindById = PackagePurchase.findById;
  const originalPackageFindById = Package.findById;
  const originalPromoFindOne = Promo.findOne;
  const originalPromoUpdate = Promo.findOneAndUpdate;
  const originalPassInsertMany = UserPasses.insertMany;
  const session = createSession();
  let promoMutation = 0;
  let inserts = 0;

  mongoose.startSession = async () => session;
  PackagePurchase.findById = () =>
    query({
      _id: IDS.purchase,
      userId: IDS.user,
      packageId: IDS.package,
      issuingStudio: IDS.studio,
      status: "waiting_confirmation",
      promoCodeApplied: "EXPIRED",
      paymentWindowExpiry: new Date(Date.now() + 60_000),
    });
  Package.findById = () => query(regularPackage());
  Promo.findOne = () =>
    query({
      _id: IDS.promo,
      promoType: "static",
      staticCode: "EXPIRED",
      isActive: true,
      validUntil: new Date(Date.now() - 1_000),
      maxUsageLimit: 10,
      currentUsageCount: 0,
      usedBy: [],
    });
  Promo.findOneAndUpdate = async () => {
    promoMutation += 1;
  };
  UserPasses.insertMany = async () => {
    inserts += 1;
  };

  try {
    const response = createResponse();
    await adminReviewPayment(
      {
        user: {
          _id: IDS.admin,
          role: "studioAdmin",
          adminStudioLocation: IDS.studio,
        },
        params: { purchaseId: IDS.purchase },
        body: { action: "approve" },
      },
      response,
    );

    assert.equal(response.statusCode, 400);
    assert.match(response.body.error, /expired/i);
    assert.equal(promoMutation, 0);
    assert.equal(inserts, 0);
    assert.equal(session.commits, 0);
    assert.equal(session.aborts, 1);
  } finally {
    mongoose.startSession = originalStartSession;
    PackagePurchase.findById = originalPurchaseFindById;
    Package.findById = originalPackageFindById;
    Promo.findOne = originalPromoFindOne;
    Promo.findOneAndUpdate = originalPromoUpdate;
    UserPasses.insertMany = originalPassInsertMany;
  }
});

test("proof-upload sockets contain only an invalidation ID", async () => {
  const originalFindById = PackagePurchase.findById;
  const originalSecret = process.env.UPLOAD_URL_SIGNING_SECRET;
  const emitted = [];
  const purchase = {
    _id: IDS.purchase,
    userId: IDS.user,
    issuingStudio: IDS.studio,
    status: "pending",
    totalAmount: 999,
    paymentWindowExpiry: new Date(Date.now() + 60_000),
    async save() {},
  };
  PackagePurchase.findById = async () => purchase;
  process.env.UPLOAD_URL_SIGNING_SECRET = "s".repeat(32);

  try {
    const response = createResponse();
    await uploadProof(
      {
        user: { _id: IDS.user, role: "client" },
        params: { purchaseId: IDS.purchase },
        body: {
          proofUrl: `/uploads/ProofOfPurchase/${IDS.user}/proof-123.jpeg`,
        },
        app: {
          get: () => ({
            to: () => ({ emit: (...args) => emitted.push(args) }),
          }),
        },
      },
      response,
    );

    assert.equal(response.statusCode, 200);
    assert.equal(emitted.length, 1);
    const notification = emitted[0][1];
    assert.equal(notification.type, "PROOF_UPLOADED");
    assert.deepEqual(notification.data, { purchaseId: IDS.purchase.toString() });
    assert.equal(Object.hasOwn(notification.data, "proofOfPayment"), false);
    assert.equal(Object.hasOwn(notification.data, "totalAmount"), false);
  } finally {
    PackagePurchase.findById = originalFindById;
    if (originalSecret === undefined) {
      delete process.env.UPLOAD_URL_SIGNING_SECRET;
    } else {
      process.env.UPLOAD_URL_SIGNING_SECRET = originalSecret;
    }
  }
});
