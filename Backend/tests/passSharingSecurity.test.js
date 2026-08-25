const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const mongoose = require("mongoose");

const sendEmailPath = require.resolve("../helper/sendEmail");
const realSendEmail = require(sendEmailPath);
const sentShareEmails = [];
require.cache[sendEmailPath].exports = {
  ...realSendEmail,
  sendShareEmail: async (...args) => {
    sentShareEmails.push(args);
  },
};

const UserPasses = require("../models/UserData/User_Passes");
const User = require("../models/UserData/User");
const Package = require("../models/StudioData/Packages");
const {
  acceptSharedPass,
  detachSharedPass,
  generateShareLink,
  getSharedPassDetails,
  sendShareLinkViaEmail,
} = require("../controllers/UserController/user_passesController");

const SHARE_TOKEN = "A".repeat(43);
const OTHER_SHARE_TOKEN = "B".repeat(43);
const PUBLIC_ORIGIN = "https://app.example.test";
const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const originalPublicOrigin = process.env.PUBLIC_APP_ORIGIN;
process.env.PUBLIC_APP_ORIGIN = PUBLIC_ORIGIN;
test.after(() => {
  require.cache[sendEmailPath].exports = realSendEmail;
  if (originalPublicOrigin === undefined) {
    delete process.env.PUBLIC_APP_ORIGIN;
  } else {
    process.env.PUBLIC_APP_ORIGIN = originalPublicOrigin;
  }
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

const createQuery = (value) => {
  const result = Promise.resolve(value);
  const query = {
    populate() {
      return query;
    },
    lean() {
      return query;
    },
    select() {
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

test("pass share secrets are hidden and indexed as unique hashes", () => {
  assert.equal(UserPasses.schema.path("shareCode").options.select, false);
  assert.equal(UserPasses.schema.path("shareCodeHash").options.select, false);
  assert.equal(UserPasses.schema.path("shareCodeHash").options.unique, true);
  assert.equal(UserPasses.schema.path("shareCodeHash").options.sparse, true);
  assert.equal(UserPasses.schema.path("shareExpiresAt").instance, "Date");
  assert.equal(
    UserPasses.schema.path("isStudentRestrictedSnapshot").options.immutable,
    true,
  );
});

test("share-link generation returns a random token but stores only its hash", async () => {
  const originalFindById = UserPasses.findById;
  const originalNow = Date.now;
  let saveCount = 0;
  const fixedNow = 1_700_000_000_000;
  const pass = {
    _id: "pass-a",
    userId: "owner-a",
    shareCode: "legacy-plaintext",
    shareCodeHash: null,
    shareExpiresAt: null,
    isShared: false,
    isActive: true,
    expiryDate: new Date("2099-01-01T00:00:00.000Z"),
    remainingCredits: 1,
    async save() {
      saveCount += 1;
    },
    toObject() {
      return {
        _id: this._id,
        userId: this.userId,
        shareCode: this.shareCode,
        shareCodeHash: this.shareCodeHash,
        shareExpiresAt: this.shareExpiresAt,
        isShared: this.isShared,
      };
    },
  };
  UserPasses.findById = async () => pass;
  Date.now = () => fixedNow;

  try {
    const response = createResponse();
    await generateShareLink(
      {
        user: { _id: "owner-a" },
        params: { passId: "pass-a" },
      },
      response,
    );

    const token = response.body.pass.shareCode;
    assert.equal(response.statusCode, 200);
    assert.match(token, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(pass.shareCode, null);
    assert.equal(pass.shareCodeHash, hashToken(token));
    assert.notEqual(pass.shareCodeHash, token);
    assert.equal(pass.shareCodeHash.length, 64);
    assert.equal(
      pass.shareExpiresAt.toISOString(),
      new Date(fixedNow + 24 * 60 * 60 * 1000).toISOString(),
    );
    assert.equal(pass.isShared, true);
    assert.equal(saveCount, 1);
    assert.equal(Object.hasOwn(response.body.pass, "shareCodeHash"), false);
  } finally {
    UserPasses.findById = originalFindById;
    Date.now = originalNow;
  }
});

test("expired or malformed share tokens disclose no pass details", async () => {
  const originalFindOne = UserPasses.findOne;
  let capturedQuery;
  let findCount = 0;
  UserPasses.findOne = (query) => {
    findCount += 1;
    capturedQuery = query;
    return createQuery(null);
  };

  try {
    const malformedResponse = createResponse();
    await getSharedPassDetails(
      { params: { code: "short-token" } },
      malformedResponse,
    );
    assert.equal(malformedResponse.statusCode, 404);
    assert.equal(findCount, 0);

    const expiredResponse = createResponse();
    await getSharedPassDetails(
      { params: { code: SHARE_TOKEN } },
      expiredResponse,
    );
    assert.equal(expiredResponse.statusCode, 404);
    assert.equal(findCount, 1);
    assert.equal(capturedQuery.shareCodeHash, hashToken(SHARE_TOKEN));
    assert.ok(capturedQuery.shareExpiresAt.$gt instanceof Date);
    assert.equal(capturedQuery.isShared, true);
  } finally {
    UserPasses.findOne = originalFindOne;
  }
});

test("an atomic share claim permits exactly one winner", async () => {
  const originalFindOne = UserPasses.findOne;
  const originalFindOneAndUpdate = UserPasses.findOneAndUpdate;
  const originalPackageFindById = Package.findById;
  const calls = [];
  let claimed = false;
  UserPasses.findOne = () =>
    createQuery({
      _id: "pass-a",
      packageId: "package-a",
      packageCategorySnapshot: ["Regular"],
      expiryDate: new Date(Date.now() + 60_000),
      remainingCredits: 1,
    });
  Package.findById = () =>
    createQuery({ isStudentPackage: false, packageCategory: ["Regular"] });
  UserPasses.findOneAndUpdate = async (filter, update, options) => {
    calls.push({ filter, update, options });
    if (claimed) return null;
    claimed = true;
    return {
      _id: "pass-a",
      isActive: true,
      sharedWith: ["claimant-a"],
    };
  };

  try {
    const firstResponse = createResponse();
    const secondResponse = createResponse();
    await Promise.all([
      acceptSharedPass(
        {
          user: { _id: "claimant-a", role: "client" },
          params: { code: SHARE_TOKEN },
        },
        firstResponse,
      ),
      acceptSharedPass(
        {
          user: { _id: "claimant-b", role: "client" },
          params: { code: SHARE_TOKEN },
        },
        secondResponse,
      ),
    ]);

    assert.deepEqual(
      [firstResponse.statusCode, secondResponse.statusCode].sort(),
      [200, 404],
    );
    assert.equal(calls.length, 2);
    for (const { filter, update, options } of calls) {
      assert.equal(filter.shareCodeHash, hashToken(SHARE_TOKEN));
      assert.ok(filter.shareExpiresAt.$gt instanceof Date);
      assert.equal(filter.isShared, true);
      assert.equal(filter.isActive, true);
      assert.ok(Array.isArray(filter.$or));
      assert.equal(filter._id, "pass-a");
      assert.ok(filter.expiryDate.$gt instanceof Date);
      assert.equal(filter.remainingCredits.$gt, 0);
      assert.ok(filter.userId.$ne);
      assert.ok(filter.sharedWith.$ne);
      assert.deepEqual(update.$addToSet, {
        sharedWith: filter.userId.$ne,
      });
      assert.equal(update.$set.isShared, false);
      assert.equal(update.$set.shareCode, null);
      assert.equal(update.$set.shareExpiresAt, null);
      assert.deepEqual(update.$unset, { shareCodeHash: 1 });
      assert.deepEqual(options, { new: true });
    }
  } finally {
    UserPasses.findOne = originalFindOne;
    UserPasses.findOneAndUpdate = originalFindOneAndUpdate;
    Package.findById = originalPackageFindById;
  }
});

test("a non-member cannot self-target an arbitrary pass for detachment", async () => {
  const originalFindOneAndUpdate = UserPasses.findOneAndUpdate;
  const passId = new mongoose.Types.ObjectId().toString();
  const attackerId = new mongoose.Types.ObjectId().toString();
  let capturedFilter;
  UserPasses.findOneAndUpdate = async (filter) => {
    capturedFilter = filter;
    return null;
  };

  try {
    const response = createResponse();
    await detachSharedPass(
      {
        user: { _id: attackerId },
        params: { passId },
        body: { userIdToDetach: attackerId },
      },
      response,
    );

    assert.equal(response.statusCode, 404);
    assert.deepEqual(capturedFilter.$or, [
      { userId: attackerId },
      { sharedWith: attackerId },
    ]);
    assert.equal(capturedFilter.sharedWith, attackerId);
    assert.equal(Object.hasOwn(response.body, "pass"), false);
  } finally {
    UserPasses.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test("an owner detaches only an actual member with an atomic pull and minimal response", async () => {
  const originalFindOneAndUpdate = UserPasses.findOneAndUpdate;
  const passId = new mongoose.Types.ObjectId().toString();
  const ownerId = new mongoose.Types.ObjectId().toString();
  const memberId = new mongoose.Types.ObjectId().toString();
  let captured;
  UserPasses.findOneAndUpdate = async (filter, update, options) => {
    captured = { filter, update, options };
    return { _id: passId, proofOfPayment: "must-not-leak" };
  };

  try {
    const response = createResponse();
    await detachSharedPass(
      {
        user: { _id: ownerId },
        params: { passId },
        body: { userIdToDetach: memberId },
      },
      response,
    );

    assert.equal(response.statusCode, 200);
    assert.equal(captured.filter.userId, ownerId);
    assert.equal(captured.filter.sharedWith, memberId);
    assert.deepEqual(captured.update, { $pull: { sharedWith: memberId } });
    assert.deepEqual(captured.options, {
      new: false,
      projection: { _id: 1 },
    });
    assert.deepEqual(response.body, {
      message: "User successfully detached from pass.",
      detachedUserId: memberId,
    });
  } finally {
    UserPasses.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test("an actively frozen pass cannot generate a share link", async () => {
  const originalFindById = UserPasses.findById;
  let saveCount = 0;
  UserPasses.findById = async () => ({
    _id: "pass-a",
    userId: "owner-a",
    isActive: true,
    expiryDate: new Date(Date.now() + 86_400_000),
    remainingCredits: 2,
    freeze: {
      status: "approved",
      startDate: new Date(Date.now() - 1_000),
      endDate: new Date(Date.now() + 60_000),
    },
    async save() {
      saveCount += 1;
    },
  });

  try {
    const response = createResponse();
    await generateShareLink(
      { user: { _id: "owner-a" }, params: { passId: "pass-a" } },
      response,
    );

    assert.equal(response.statusCode, 400);
    assert.match(response.body.message, /frozen/i);
    assert.equal(saveCount, 0);
  } finally {
    UserPasses.findById = originalFindById;
  }
});

test("tampered share tokens cannot claim a pass", async () => {
  const originalFindOne = UserPasses.findOne;
  let capturedHash;
  UserPasses.findOne = (filter) => {
    capturedHash = filter.shareCodeHash;
    return createQuery(null);
  };

  try {
    const response = createResponse();
    await acceptSharedPass(
      {
        user: { _id: "claimant-a", role: "client" },
        params: { code: OTHER_SHARE_TOKEN },
      },
      response,
    );

    assert.equal(response.statusCode, 404);
    assert.equal(capturedHash, hashToken(OTHER_SHARE_TOKEN));
    assert.notEqual(capturedHash, hashToken(SHARE_TOKEN));
  } finally {
    UserPasses.findOne = originalFindOne;
  }
});

test("a student-restricted shared pass cannot be claimed by an unverified user", async () => {
  const originalFindOne = UserPasses.findOne;
  const originalFindOneAndUpdate = UserPasses.findOneAndUpdate;
  const originalUserExists = User.exists;
  let updateRan = false;

  UserPasses.findOne = () =>
    createQuery({
      _id: "student-pass",
      packageId: "student-package",
      packageCategorySnapshot: ["Student"],
      isStudentRestrictedSnapshot: true,
      expiryDate: new Date(Date.now() + 60_000),
      remainingCredits: 1,
    });
  User.exists = async () => null;
  UserPasses.findOneAndUpdate = async () => {
    updateRan = true;
    return null;
  };

  try {
    const response = createResponse();
    await acceptSharedPass(
      {
        user: { _id: "claimant-a", role: "client" },
        params: { code: SHARE_TOKEN },
      },
      response,
    );

    assert.equal(response.statusCode, 403);
    assert.equal(response.body.code, "STUDENT_VERIFICATION_REQUIRED");
    assert.equal(updateRan, false);
  } finally {
    UserPasses.findOne = originalFindOne;
    UserPasses.findOneAndUpdate = originalFindOneAndUpdate;
    User.exists = originalUserExists;
  }
});

test("an unclassifiable legacy pass fails closed when its package is gone", async () => {
  const originalFindOne = UserPasses.findOne;
  const originalFindOneAndUpdate = UserPasses.findOneAndUpdate;
  const originalPackageFindById = Package.findById;
  let updateRan = false;

  UserPasses.findOne = () =>
    createQuery({
      _id: "legacy-pass",
      packageId: "deleted-package",
      packageCategorySnapshot: ["Regular"],
      expiryDate: new Date(Date.now() + 60_000),
      remainingCredits: 1,
    });
  Package.findById = () => createQuery(null);
  UserPasses.findOneAndUpdate = async () => {
    updateRan = true;
    return null;
  };

  try {
    const response = createResponse();
    await acceptSharedPass(
      {
        user: { _id: "claimant-a", role: "client" },
        params: { code: SHARE_TOKEN },
      },
      response,
    );

    assert.equal(response.statusCode, 409);
    assert.equal(response.body.code, "PASS_REVIEW_REQUIRED");
    assert.equal(updateRan, false);
  } finally {
    UserPasses.findOne = originalFindOne;
    UserPasses.findOneAndUpdate = originalFindOneAndUpdate;
    Package.findById = originalPackageFindById;
  }
});

test("staff accounts cannot claim a client shared pass", async () => {
  const originalFindOne = UserPasses.findOne;
  let lookupRan = false;
  UserPasses.findOne = () => {
    lookupRan = true;
    return createQuery(null);
  };

  try {
    for (const role of ["studioAdmin", "devTeam"]) {
      const response = createResponse();
      await acceptSharedPass(
        {
          user: { _id: `${role}-a`, role },
          params: { code: SHARE_TOKEN },
        },
        response,
      );

      assert.equal(response.statusCode, 403);
      assert.equal(response.body.code, "CLIENT_ACCOUNT_REQUIRED");
    }
    assert.equal(lookupRan, false);
  } finally {
    UserPasses.findOne = originalFindOne;
  }
});

test("share email uses only a configured-origin link whose token matches storage", async () => {
  const originalFindById = UserPasses.findById;
  const emailCountBefore = sentShareEmails.length;
  const pass = {
    _id: "pass-a",
    userId: { _id: "owner-a", fullName: "Owner A" },
    packageId: { packageName: "Starter Pack" },
    shareCodeHash: hashToken(SHARE_TOKEN),
    shareExpiresAt: new Date(Date.now() + 60_000),
    isActive: true,
    expiryDate: new Date(Date.now() + 60_000),
    remainingCredits: 1,
  };
  UserPasses.findById = () => createQuery(pass);

  try {
    const response = createResponse();
    await sendShareLinkViaEmail(
      {
        user: { _id: "owner-a" },
        params: { passId: "pass-a" },
        body: {
          email: " Recipient@Example.COM ",
          shareLink: `${PUBLIC_ORIGIN}/shared-pass/${SHARE_TOKEN}`,
        },
      },
      response,
    );

    assert.equal(response.statusCode, 200);
    assert.equal(sentShareEmails.length, emailCountBefore + 1);
    assert.deepEqual(sentShareEmails.at(-1), [
      "Owner A",
      "recipient@example.com",
      `${PUBLIC_ORIGIN}/shared-pass/${SHARE_TOKEN}`,
      "Starter Pack",
    ]);
  } finally {
    UserPasses.findById = originalFindById;
  }
});

test("share email rejects foreign-origin, decorated, and mismatched links", async () => {
  const originalFindById = UserPasses.findById;
  const emailCountBefore = sentShareEmails.length;
  let findCount = 0;
  const pass = {
    _id: "pass-a",
    userId: { _id: "owner-a", fullName: "Owner A" },
    packageId: { packageName: "Starter Pack" },
    shareCodeHash: hashToken(SHARE_TOKEN),
    shareExpiresAt: new Date(Date.now() + 60_000),
    isActive: true,
    expiryDate: new Date(Date.now() + 60_000),
    remainingCredits: 1,
  };
  UserPasses.findById = () => {
    findCount += 1;
    return createQuery(pass);
  };

  try {
    const invalidLinks = [
      `https://evil.example/shared-pass/${SHARE_TOKEN}`,
      `${PUBLIC_ORIGIN}/shared-pass/${SHARE_TOKEN}?redirect=https://evil.example`,
      `${PUBLIC_ORIGIN}/shared-pass/${SHARE_TOKEN}#fragment`,
      `${PUBLIC_ORIGIN}/shared-pass/not-valid`,
    ];
    for (const shareLink of invalidLinks) {
      const response = createResponse();
      await sendShareLinkViaEmail(
        {
          user: { _id: "owner-a" },
          params: { passId: "pass-a" },
          body: { email: "recipient@example.com", shareLink },
        },
        response,
      );
      assert.equal(response.statusCode, 400, shareLink);
    }
    assert.equal(findCount, 0);

    const mismatchResponse = createResponse();
    await sendShareLinkViaEmail(
      {
        user: { _id: "owner-a" },
        params: { passId: "pass-a" },
        body: {
          email: "recipient@example.com",
          shareLink: `${PUBLIC_ORIGIN}/shared-pass/${OTHER_SHARE_TOKEN}`,
        },
      },
      mismatchResponse,
    );
    assert.equal(mismatchResponse.statusCode, 400);
    assert.equal(findCount, 1);
    assert.equal(sentShareEmails.length, emailCountBefore);
  } finally {
    UserPasses.findById = originalFindById;
  }
});
