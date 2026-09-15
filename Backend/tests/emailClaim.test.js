const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-only-jwt-secret-that-is-at-least-32-characters";

const User = require("../models/UserData/User");
const PreAuthSession = require("../models/OTP/PreAuthSession");
const { startEmailClaim } = require("../controllers/UserController/userController");
const { PREAUTH_PURPOSES } = require("../helper/preAuthSession");

const USER_ID = "507f1f77bcf86cd799439011";
const NEW_EMAIL = "member@example.com";

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

const withStubs = async (stubs, run) => {
  const originals = stubs.map(([owner, key]) => [owner, key, owner[key]]);
  stubs.forEach(([owner, key, value]) => {
    owner[key] = value;
  });
  try {
    return await run();
  } finally {
    originals.forEach(([owner, key, value]) => {
      owner[key] = value;
    });
  }
};

const request = (email) => ({ body: { email }, user: { _id: USER_ID } });

test("a mailbox is only attached to an account after it is proved", async (t) => {
  await t.test("starting a claim never stores the address", async () => {
    let saved = false;
    let session = null;
    const res = createResponse();

    await withStubs(
      [
        [
          User,
          "findById",
          async () => ({
            _id: USER_ID,
            email: undefined,
            save: async () => {
              saved = true;
            },
          }),
        ],
        [User, "exists", async () => null],
        [
          PreAuthSession,
          "create",
          async (created) => {
            session = created;
            return created;
          },
        ],
      ],
      () => startEmailClaim(request(NEW_EMAIL), res),
    );

    assert.equal(res.statusCode, 200);
    assert.ok(res.body.preAuthToken);
    // The grant carries the claimed address; the account is untouched until
    // the code sent to that address is verified.
    assert.equal(saved, false);
    assert.equal(session.email, NEW_EMAIL);
    assert.equal(session.userId, USER_ID);
    assert.equal(session.purpose, PREAUTH_PURPOSES.EMAIL_CLAIM);
  });

  await t.test("an account that already has an email is refused", async () => {
    let issued = false;
    const res = createResponse();

    await withStubs(
      [
        [
          User,
          "findById",
          async () => ({ _id: USER_ID, email: "existing@example.com" }),
        ],
        [User, "exists", async () => null],
        [
          PreAuthSession,
          "create",
          async () => {
            issued = true;
          },
        ],
      ],
      () => startEmailClaim(request(NEW_EMAIL), res),
    );

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.code, "EMAIL_ALREADY_SET");
    assert.equal(issued, false);
  });

  await t.test("an address already in use cannot be claimed", async () => {
    let issued = false;
    const res = createResponse();

    await withStubs(
      [
        [User, "findById", async () => ({ _id: USER_ID, email: undefined })],
        // Social sign-in links accounts by email, so letting a second account
        // claim a taken address would hand over the first account's identity.
        [User, "exists", async () => ({ _id: "507f1f77bcf86cd799439012" })],
        [
          PreAuthSession,
          "create",
          async () => {
            issued = true;
          },
        ],
      ],
      () => startEmailClaim(request(NEW_EMAIL), res),
    );

    assert.equal(res.statusCode, 409);
    assert.equal(issued, false);
  });

  await t.test("a malformed address is refused", async () => {
    for (const invalid of ["", "   ", "not-an-email", null, undefined, 42]) {
      const res = createResponse();
      await withStubs(
        [
          [
            User,
            "findById",
            async () => {
              throw new Error("must not reach the account lookup");
            },
          ],
        ],
        () => startEmailClaim(request(invalid), res),
      );
      assert.equal(res.statusCode, 400, JSON.stringify(invalid));
    }
  });
});
