const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-only-jwt-secret-that-is-at-least-32-characters";

const User = require("../models/UserData/User");
const OTP = require("../models/OTP/OTP");
const PreAuthSession = require("../models/OTP/PreAuthSession");
const { startEmailClaim } = require("../controllers/UserController/userController");
const { verifyOTP } = require("../controllers/OTPController/otpController");
const { PREAUTH_PURPOSES } = require("../helper/preAuthSession");
const { hashOtp } = require("../helper/authSecurity");
const { verifyAuthToken } = require("../helper/authToken");

const FLOW_TOKEN = "A".repeat(43);
const OTP_CODE = "123456";

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

test("confirming a claimed mailbox keeps the member signed in", async () => {
  // Attaching an email is an authentication change, so the model revokes every
  // existing token by raising authVersion. The reply therefore has to carry a
  // replacement minted after that bump — a token cut before it is already dead,
  // which logs the member straight out of the tab they are sitting in.
  const savedUser = {
    _id: USER_ID,
    fullName: "Walk In Member",
    role: "client",
    email: undefined,
    authVersion: 4,
    save: async function () {
      this.authVersion += 1;
    },
  };

  const res = createResponse();
  await withStubs(
    [
      [
        PreAuthSession,
        "findOne",
        () => ({
          select: async () => ({
            _id: "507f1f77bcf86cd799439055",
            userId: USER_ID,
            email: NEW_EMAIL,
            purpose: PREAUTH_PURPOSES.EMAIL_CLAIM,
          }),
        }),
      ],
      [PreAuthSession, "findOneAndDelete", async () => ({ _id: "consumed" })],
      [User, "findById", async () => savedUser],
      [User, "exists", async () => null],
      [
        OTP,
        "findOne",
        () => ({
          select: async () => ({
            _id: "507f1f77bcf86cd799439066",
            attempts: 0,
            otpHash: hashOtp(NEW_EMAIL, OTP_CODE),
          }),
        }),
      ],
      [OTP, "findOneAndDelete", async () => ({ _id: "507f1f77bcf86cd799439066" })],
    ],
    () =>
      verifyOTP(
        {
          body: {
            email: NEW_EMAIL,
            otp: OTP_CODE,
            preAuthToken: FLOW_TOKEN,
            purpose: PREAUTH_PURPOSES.EMAIL_CLAIM,
          },
        },
        res,
      ),
  );

  assert.equal(res.statusCode, 200);
  assert.equal(savedUser.email, NEW_EMAIL);
  assert.equal(savedUser.authVersion, 5);
  assert.ok(res.body.token);
  // The access token carries the version as "ver"; it must match the account
  // as it stands after the save, or the middleware rejects it immediately.
  assert.equal(verifyAuthToken(res.body.token).ver, savedUser.authVersion);
});
