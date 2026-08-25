const test = require("node:test");
const assert = require("node:assert/strict");
const appleSignin = require("apple-signin-auth");
const bcrypt = require("bcryptjs");

process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-only-jwt-secret-that-is-at-least-32-characters";

const emailHelper = require("../helper/sendEmail");
const originalSendEmail = emailHelper.sendEmail;
const sentEmails = [];
emailHelper.sendEmail = async (...args) => {
  sentEmails.push(args);
};

const otpControllerPath = require.resolve(
  "../controllers/OTPController/otpController",
);
delete require.cache[otpControllerPath];

const User = require("../models/UserData/User");
const OTP = require("../models/OTP/OTP");
const OtpLog = require("../models/OTP/OtpLog");
const PreAuthSession = require("../models/OTP/PreAuthSession");
const PendingRegistration = require("../models/OTP/PendingRegistration");
const {
  login,
  loginWithApple,
  register,
  checkUserStatus,
} = require("../controllers/UserController/authController");
const {
  requestOTP,
  verifyOTP,
} = require("../controllers/OTPController/otpController");
const {
  PREAUTH_PURPOSES,
  createPreAuthSession,
  hashPreAuthToken,
} = require("../helper/preAuthSession");
const { hashOtp } = require("../helper/authSecurity");
const { verifyAuthToken } = require("../helper/authToken");

const USER_ID = "507f1f77bcf86cd799439011";
const EMAIL = "person@example.com";
const FLOW_TOKEN = "A".repeat(43);

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

const queryResult = (value, capture) => ({
  select: async (selection) => {
    if (capture) capture(selection);
    return value;
  },
});

test.after(() => {
  emailHelper.sendEmail = originalSendEmail;
});

test("OTP authentication requires a bound, one-time pre-auth flow", async (t) => {
  await t.test("pre-auth tokens are random and only their digest is stored", async () => {
    const originalCreate = PreAuthSession.create;
    let createdRecord;
    PreAuthSession.create = async (record) => {
      createdRecord = record;
      return record;
    };

    try {
      const result = await createPreAuthSession({
        userId: USER_ID,
        email: EMAIL,
        purpose: PREAUTH_PURPOSES.PASSWORD_LOGIN,
      });

      assert.match(result.preAuthToken, /^[A-Za-z0-9_-]{43}$/);
      assert.equal(result.purpose, PREAUTH_PURPOSES.PASSWORD_LOGIN);
      assert.equal(result.expiresIn, 600);
      assert.equal(createdRecord.tokenHash, hashPreAuthToken(result.preAuthToken));
      assert.notEqual(createdRecord.tokenHash, result.preAuthToken);
      assert.equal(createdRecord.userId, USER_ID);
      assert.equal(createdRecord.email, EMAIL);
      assert.ok(createdRecord.expiresAt > new Date());
    } finally {
      PreAuthSession.create = originalCreate;
    }
  });

  await t.test("password login issues a password-login pre-auth grant", async () => {
    const originalFindOne = User.findOne;
    const originalCreate = PreAuthSession.create;
    let createdRecord;
    User.findOne = () =>
      queryResult({
        _id: USER_ID,
        email: EMAIL,
        password: "stored-password-hash",
        matchPassword: async (password) => password === "correct-password",
      });
    PreAuthSession.create = async (record) => {
      createdRecord = record;
      return record;
    };

    try {
      const response = createResponse();
      await login(
        { body: { email: EMAIL, password: "correct-password" } },
        response,
      );

      assert.equal(response.statusCode, 200);
      assert.equal(response.body.success, true);
      assert.equal(response.body.purpose, PREAUTH_PURPOSES.PASSWORD_LOGIN);
      assert.match(response.body.preAuthToken, /^[A-Za-z0-9_-]{43}$/);
      assert.equal(createdRecord.userId, USER_ID);
      assert.equal(createdRecord.email, EMAIL);
      assert.equal(createdRecord.purpose, PREAUTH_PURPOSES.PASSWORD_LOGIN);
    } finally {
      User.findOne = originalFindOne;
      PreAuthSession.create = originalCreate;
    }
  });

  await t.test(
    "public registration stores only an expiring candidate before OTP",
    async () => {
    const originalExists = User.exists;
    const originalCreateUser = User.create;
    const originalCreateSession = PreAuthSession.create;
    const originalPendingUpdate = PendingRegistration.findOneAndUpdate;
    let createdSession;
    let pendingUpdate;
    User.exists = async () => null;
    User.create = async () => {
      throw new Error("Public registration must not create an active user");
    };
    PendingRegistration.findOneAndUpdate = (_filter, update) => {
      pendingUpdate = update;
      return queryResult({
        _id: "507f1f77bcf86cd799439099",
        ...update.$set,
      });
    };
    PreAuthSession.create = async (record) => {
      createdSession = record;
      return record;
    };

    try {
      const response = createResponse();
      await register(
        {
          body: {
            fullName: "Test Person",
            email: EMAIL,
            password: "correct-password",
            phoneNumber: "+62 81234567890",
          },
        },
        response,
      );

      assert.equal(response.statusCode, 202);
      assert.equal(response.body.purpose, PREAUTH_PURPOSES.REGISTRATION);
      assert.equal(response.body.activationRequired, true);
      assert.match(response.body.preAuthToken, /^[A-Za-z0-9_-]{43}$/);
      assert.equal(Object.hasOwn(response.body, "_id"), false);
      assert.equal(Object.hasOwn(response.body, "token"), false);
      assert.equal(Object.hasOwn(createdSession, "userId"), true);
      assert.equal(createdSession.userId, undefined);
      assert.equal(
        createdSession.pendingRegistrationId,
        "507f1f77bcf86cd799439099",
      );
      assert.match(createdSession.registrationVersion, /^[A-Za-z0-9_-]{43}$/);
      assert.equal(createdSession.email, EMAIL);
      assert.equal(createdSession.purpose, PREAUTH_PURPOSES.REGISTRATION);
      assert.notEqual(pendingUpdate.$set.passwordHash, "correct-password");
      assert.equal(
        await bcrypt.compare(
          "correct-password",
          pendingUpdate.$set.passwordHash,
        ),
        true,
      );
      assert.ok(pendingUpdate.$set.expiresAt > new Date());
    } finally {
      User.exists = originalExists;
      User.create = originalCreateUser;
      PreAuthSession.create = originalCreateSession;
      PendingRegistration.findOneAndUpdate = originalPendingUpdate;
    }
    },
  );

  await t.test(
    "re-registering replaces the candidate and invalidates the earlier grant",
    async () => {
      const originals = {
        userExists: User.exists,
        pendingUpdate: PendingRegistration.findOneAndUpdate,
        pendingFindById: PendingRegistration.findById,
        preAuthCreate: PreAuthSession.create,
        preAuthFindOne: PreAuthSession.findOne,
        otpFindOneAndUpdate: OTP.findOneAndUpdate,
      };
      const pendingId = "507f1f77bcf86cd799439099";
      const sessions = [];
      let currentPending;
      let otpStorageCalls = 0;

      User.exists = async () => null;
      PendingRegistration.findOneAndUpdate = (_filter, update) => {
        currentPending = { _id: pendingId, ...update.$set };
        return queryResult(currentPending);
      };
      PreAuthSession.create = async (record) => {
        sessions.push({ _id: `session-${sessions.length + 1}`, ...record });
        return record;
      };

      try {
        const firstResponse = createResponse();
        await register(
          {
            body: {
              fullName: "First Candidate",
              email: EMAIL,
              password: "first-candidate-password",
            },
          },
          firstResponse,
        );
        const secondResponse = createResponse();
        await register(
          {
            body: {
              fullName: "Recovered Candidate",
              email: EMAIL,
              password: "second-candidate-password",
            },
          },
          secondResponse,
        );

        assert.equal(firstResponse.statusCode, 202);
        assert.equal(secondResponse.statusCode, 202);
        assert.notEqual(
          sessions[0].registrationVersion,
          sessions[1].registrationVersion,
        );
        assert.equal(currentPending.fullName, "Recovered Candidate");
        assert.equal(
          await bcrypt.compare(
            "second-candidate-password",
            currentPending.passwordHash,
          ),
          true,
        );

        PreAuthSession.findOne = (query) => {
          const session = sessions.find(
            (candidate) => candidate.tokenHash === query.tokenHash,
          );
          return queryResult(session || null);
        };
        PendingRegistration.findById = () => queryResult(currentPending);
        OTP.findOneAndUpdate = async () => {
          otpStorageCalls += 1;
        };

        const staleResponse = createResponse();
        await requestOTP(
          {
            body: {
              email: EMAIL,
              preAuthToken: firstResponse.body.preAuthToken,
              purpose: PREAUTH_PURPOSES.REGISTRATION,
            },
          },
          staleResponse,
        );

        assert.equal(staleResponse.statusCode, 401);
        assert.equal(staleResponse.body.code, "INVALID_OTP_FLOW");
        assert.equal(otpStorageCalls, 0);
      } finally {
        User.exists = originals.userExists;
        PendingRegistration.findOneAndUpdate = originals.pendingUpdate;
        PendingRegistration.findById = originals.pendingFindById;
        PreAuthSession.create = originals.preAuthCreate;
        PreAuthSession.findOne = originals.preAuthFindOne;
        OTP.findOneAndUpdate = originals.otpFindOneAndUpdate;
      }
    },
  );

  await t.test("an active/legacy account cannot be replaced by registration", async () => {
    const originalExists = User.exists;
    const originalPendingUpdate = PendingRegistration.findOneAndUpdate;
    let pendingStorageCalls = 0;
    User.exists = async () => ({ _id: USER_ID });
    PendingRegistration.findOneAndUpdate = () => {
      pendingStorageCalls += 1;
      throw new Error("Pending storage must not run for an active account");
    };

    try {
      const response = createResponse();
      await register(
        {
          body: {
            fullName: "Duplicate Person",
            email: EMAIL,
            password: "duplicate-password",
          },
        },
        response,
      );

      assert.equal(response.statusCode, 400);
      assert.equal(response.body.message, "Unable to register with this email.");
      assert.equal(pendingStorageCalls, 0);
    } finally {
      User.exists = originalExists;
      PendingRegistration.findOneAndUpdate = originalPendingUpdate;
    }
  });

  await t.test(
    "authenticated staff can still provision a passwordless student client",
    async () => {
      const originalExists = User.exists;
      const originalCreate = User.create;
      const originalPendingUpdate = PendingRegistration.findOneAndUpdate;
      const studioId = "507f1f77bcf86cd799439088";
      let createdUserAttributes;
      let pendingStorageCalls = 0;

      User.exists = async () => null;
      User.create = async (attributes) => {
        createdUserAttributes = attributes;
        return { _id: USER_ID, ...attributes };
      };
      PendingRegistration.findOneAndUpdate = () => {
        pendingStorageCalls += 1;
      };

      try {
        const response = createResponse();
        await register(
          {
            user: {
              _id: "507f1f77bcf86cd799439077",
              role: "studioAdmin",
              adminStudioLocation: studioId,
            },
            body: {
              fullName: "Managed Client",
              email: EMAIL,
              password: "",
              isStudent: true,
              phoneNumber: "+64 21 000 000",
              role: "client",
            },
          },
          response,
        );

        assert.equal(response.statusCode, 201);
        assert.equal(response.body._id, USER_ID);
        assert.equal(response.body.activationRequired, false);
        assert.equal(response.body.isStudent, true);
        assert.equal(createdUserAttributes.password, "");
        assert.equal(createdUserAttributes.preferredStudioId, studioId);
        assert.equal(createdUserAttributes.isStudent, true);
        assert.equal(pendingStorageCalls, 0);
      } finally {
        User.exists = originalExists;
        User.create = originalCreate;
        PendingRegistration.findOneAndUpdate = originalPendingUpdate;
      }
    },
  );

  await t.test("Apple email claims must be verified before account creation", async () => {
    const originalAudience = process.env.APPLE_CLIENT_ID;
    const originalVerify = appleSignin.verifyIdToken;
    const originalFindOne = User.findOne;
    const originalCreate = User.create;
    let userLookupCalls = 0;
    let userCreateCalls = 0;

    process.env.APPLE_CLIENT_ID = "com.example.test";
    appleSignin.verifyIdToken = async () => ({
      sub: "apple-subject",
      email: EMAIL,
      email_verified: "false",
    });
    User.findOne = async () => {
      userLookupCalls += 1;
      return null;
    };
    User.create = async () => {
      userCreateCalls += 1;
      throw new Error("Unverified Apple email must not create an account");
    };

    try {
      const response = createResponse();
      await loginWithApple(
        { body: { identityToken: "signed-apple-token" } },
        response,
      );

      assert.equal(response.statusCode, 401);
      assert.equal(response.body.message, "Apple authentication failed.");
      assert.equal(userLookupCalls, 1);
      assert.equal(userCreateCalls, 0);
    } finally {
      if (originalAudience === undefined) delete process.env.APPLE_CLIENT_ID;
      else process.env.APPLE_CLIENT_ID = originalAudience;
      appleSignin.verifyIdToken = originalVerify;
      User.findOne = originalFindOne;
      User.create = originalCreate;
    }
  });

  await t.test(
    "an existing account without a password receives a passwordless grant",
    async () => {
      const originalFindOne = User.findOne;
      const originalCreate = PreAuthSession.create;
      let createdRecord;
      User.findOne = () =>
        queryResult({ _id: USER_ID, email: EMAIL, password: "" });
      PreAuthSession.create = async (record) => {
        createdRecord = record;
        return record;
      };

      try {
        const response = createResponse();
        await checkUserStatus({ body: { email: EMAIL } }, response);

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.hasPassword, false);
        assert.equal(
          response.body.purpose,
          PREAUTH_PURPOSES.PASSWORDLESS_LOGIN,
        );
        assert.equal(
          createdRecord.purpose,
          PREAUTH_PURPOSES.PASSWORDLESS_LOGIN,
        );
      } finally {
        User.findOne = originalFindOne;
        PreAuthSession.create = originalCreate;
      }
    },
  );

  await t.test(
    "unknown emails receive the same status shape as password accounts",
    async () => {
      const originalFindOne = User.findOne;
      User.findOne = () => queryResult(null);

      try {
        const response = createResponse();
        await checkUserStatus(
          { body: { email: "unknown@example.com" } },
          response,
        );

        assert.equal(response.statusCode, 200);
        assert.deepEqual(response.body, {
          success: true,
          hasPassword: true,
        });
      } finally {
        User.findOne = originalFindOne;
      }
    },
  );

  await t.test("unbound OTP request and verification cannot reach OTP storage", async () => {
    const originalFindOne = OTP.findOne;
    const originalFindOneAndUpdate = OTP.findOneAndUpdate;
    let otpStorageCalls = 0;
    OTP.findOne = () => {
      otpStorageCalls += 1;
      throw new Error("OTP lookup must not run");
    };
    OTP.findOneAndUpdate = async () => {
      otpStorageCalls += 1;
      throw new Error("OTP write must not run");
    };

    try {
      const requestResponse = createResponse();
      await requestOTP({ body: { email: EMAIL } }, requestResponse);
      assert.equal(requestResponse.statusCode, 401);
      assert.equal(requestResponse.body.code, "INVALID_OTP_FLOW");

      const verifyResponse = createResponse();
      await verifyOTP(
        { body: { email: EMAIL, otp: "123456" } },
        verifyResponse,
      );
      assert.equal(verifyResponse.statusCode, 401);
      assert.equal(verifyResponse.body.code, "INVALID_OTP_FLOW");
      assert.equal(otpStorageCalls, 0);
    } finally {
      OTP.findOne = originalFindOne;
      OTP.findOneAndUpdate = originalFindOneAndUpdate;
    }
  });

  await t.test("OTP creation stores the session, purpose, and user binding", async () => {
    const originals = {
      preAuthFindOne: PreAuthSession.findOne,
      userFindById: User.findById,
      logFindOne: OtpLog.findOne,
      logCount: OtpLog.countDocuments,
      logCreate: OtpLog.create,
      otpFindOneAndUpdate: OTP.findOneAndUpdate,
    };
    const tokenHash = hashPreAuthToken(FLOW_TOKEN);
    const session = {
      _id: "preauth-session-id",
      userId: USER_ID,
      email: EMAIL,
      purpose: PREAUTH_PURPOSES.PASSWORD_LOGIN,
    };
    const user = { _id: USER_ID, email: EMAIL, fullName: "Test Person" };
    let storedUpdate;
    let preAuthQuery;

    PreAuthSession.findOne = (query) => {
      preAuthQuery = query;
      return queryResult(session);
    };
    User.findById = async () => user;
    OtpLog.findOne = () => ({ sort: async () => null });
    OtpLog.countDocuments = async () => 0;
    OtpLog.create = async () => ({});
    OTP.findOneAndUpdate = async (_filter, update) => {
      storedUpdate = update;
      return {};
    };

    try {
      sentEmails.length = 0;
      const response = createResponse();
      await requestOTP(
        {
          body: {
            email: EMAIL,
            preAuthToken: FLOW_TOKEN,
            purpose: PREAUTH_PURPOSES.PASSWORD_LOGIN,
          },
        },
        response,
      );

      assert.equal(response.statusCode, 200);
      assert.equal(preAuthQuery.tokenHash, tokenHash);
      assert.equal(preAuthQuery.email, EMAIL);
      assert.equal(preAuthQuery.purpose, PREAUTH_PURPOSES.PASSWORD_LOGIN);
      assert.ok(preAuthQuery.expiresAt.$gt instanceof Date);
      assert.equal(storedUpdate.$set.preAuthSessionHash, tokenHash);
      assert.equal(storedUpdate.$set.purpose, PREAUTH_PURPOSES.PASSWORD_LOGIN);
      assert.equal(storedUpdate.$set.userId, USER_ID);
      assert.equal(sentEmails.length, 1);
      assert.equal(sentEmails[0][1], EMAIL);
      assert.match(sentEmails[0][2], /^\d{6}$/);
    } finally {
      PreAuthSession.findOne = originals.preAuthFindOne;
      User.findById = originals.userFindById;
      OtpLog.findOne = originals.logFindOne;
      OtpLog.countDocuments = originals.logCount;
      OtpLog.create = originals.logCreate;
      OTP.findOneAndUpdate = originals.otpFindOneAndUpdate;
    }
  });

  await t.test(
    "registration OTP activates exactly one user and cannot be replayed",
    async () => {
      const originals = {
        preAuthFindOne: PreAuthSession.findOne,
        preAuthDelete: PreAuthSession.findOneAndDelete,
        pendingFindById: PendingRegistration.findById,
        pendingDelete: PendingRegistration.findOneAndDelete,
        otpFindOne: OTP.findOne,
        otpDelete: OTP.findOneAndDelete,
        userCreateWithHash: User.createWithPasswordHash,
      };
      const pendingId = "507f1f77bcf86cd799439099";
      const suppliedOtp = "654321";
      const tokenHash = hashPreAuthToken(FLOW_TOKEN);
      const registrationVersion = "R".repeat(43);
      const passwordHash = await bcrypt.hash("activation-password", 10);
      const session = {
        _id: "registration-preauth-id",
        pendingRegistrationId: pendingId,
        email: EMAIL,
        purpose: PREAUTH_PURPOSES.REGISTRATION,
        registrationVersion,
      };
      const pendingRegistration = {
        _id: pendingId,
        email: EMAIL,
        fullName: "Pending Person",
        phoneNumber: "+64 21 123 456",
        avatar: "",
        role: "client",
        passwordHash,
        registrationVersion,
        expiresAt: new Date(Date.now() + 60_000),
      };
      const otpRecord = {
        _id: "registration-otp-id",
        attempts: 0,
        otpHash: hashOtp(EMAIL, suppliedOtp),
      };
      let preAuthActive = true;
      let otpActive = true;
      let pendingActive = true;
      let activeUserCreates = 0;
      let activationAttributes;

      PreAuthSession.findOne = () =>
        queryResult(preAuthActive ? session : null);
      PreAuthSession.findOneAndDelete = async (filter) => {
        assert.equal(filter.pendingRegistrationId, pendingId);
        assert.equal(filter.registrationVersion, registrationVersion);
        if (!preAuthActive) return null;
        preAuthActive = false;
        return session;
      };
      PendingRegistration.findById = () => queryResult(pendingRegistration);
      PendingRegistration.findOneAndDelete = (filter) => ({
        select: async () => {
          assert.equal(filter.registrationVersion, registrationVersion);
          if (!pendingActive) return null;
          pendingActive = false;
          return pendingRegistration;
        },
      });
      OTP.findOne = (filter) => {
        assert.equal(filter.pendingRegistrationId, pendingId);
        assert.equal(filter.registrationVersion, registrationVersion);
        assert.equal(filter.userId, undefined);
        return queryResult(otpActive ? otpRecord : null);
      };
      OTP.findOneAndDelete = async (filter) => {
        assert.equal(filter.preAuthSessionHash, tokenHash);
        assert.equal(filter.pendingRegistrationId, pendingId);
        assert.equal(filter.registrationVersion, registrationVersion);
        if (!otpActive) return null;
        otpActive = false;
        return otpRecord;
      };
      User.createWithPasswordHash = async (attributes) => {
        activeUserCreates += 1;
        activationAttributes = attributes;
        return {
          _id: USER_ID,
          authVersion: 0,
          ...attributes,
        };
      };

      try {
        const request = {
          body: {
            email: EMAIL,
            otp: suppliedOtp,
            preAuthToken: FLOW_TOKEN,
            purpose: PREAUTH_PURPOSES.REGISTRATION,
          },
        };
        const responses = [createResponse(), createResponse()];
        await Promise.all(
          responses.map((response) => verifyOTP(request, response)),
        );

        assert.deepEqual(
          responses.map((response) => response.statusCode).sort(),
          [200, 400],
        );
        assert.equal(activeUserCreates, 1);
        assert.equal(activationAttributes.email, EMAIL);
        assert.equal(activationAttributes.password, passwordHash);
        assert.equal(
          await bcrypt.compare(
            "activation-password",
            activationAttributes.password,
          ),
          true,
        );
        const winner = responses.find(
          (response) => response.statusCode === 200,
        );
        assert.equal(winner.body.purpose, PREAUTH_PURPOSES.REGISTRATION);
        assert.equal(winner.body._id, USER_ID);
        const decoded = verifyAuthToken(winner.body.token);
        assert.equal(decoded.id, USER_ID);
        assert.deepEqual(decoded.amr, ["registration_otp"]);

        const replayResponse = createResponse();
        await verifyOTP(request, replayResponse);
        assert.equal(replayResponse.statusCode, 401);
        assert.equal(replayResponse.body.code, "INVALID_OTP_FLOW");
        assert.equal(activeUserCreates, 1);
      } finally {
        PreAuthSession.findOne = originals.preAuthFindOne;
        PreAuthSession.findOneAndDelete = originals.preAuthDelete;
        PendingRegistration.findById = originals.pendingFindById;
        PendingRegistration.findOneAndDelete = originals.pendingDelete;
        OTP.findOne = originals.otpFindOne;
        OTP.findOneAndDelete = originals.otpDelete;
        User.createWithPasswordHash = originals.userCreateWithHash;
      }
    },
  );

  await t.test("parallel valid OTP verification has exactly one winner", async () => {
    const originals = {
      preAuthFindOne: PreAuthSession.findOne,
      preAuthDelete: PreAuthSession.findOneAndDelete,
      userFindById: User.findById,
      otpFindOne: OTP.findOne,
      otpDelete: OTP.findOneAndDelete,
    };
    const suppliedOtp = "123456";
    const tokenHash = hashPreAuthToken(FLOW_TOKEN);
    const session = {
      _id: "preauth-session-id",
      userId: USER_ID,
      email: EMAIL,
      purpose: PREAUTH_PURPOSES.PASSWORD_LOGIN,
    };
    const user = {
      _id: USER_ID,
      email: EMAIL,
      fullName: "Test Person",
      role: "client",
    };
    const otpRecord = {
      _id: "otp-record-id",
      attempts: 0,
      otpHash: hashOtp(EMAIL, suppliedOtp),
    };
    let otpActive = true;
    let preAuthActive = true;
    let otpDeleteCalls = 0;
    let preAuthDeleteCalls = 0;

    PreAuthSession.findOne = () =>
      queryResult(preAuthActive ? session : null);
    PreAuthSession.findOneAndDelete = async (filter) => {
      preAuthDeleteCalls += 1;
      assert.equal(filter.tokenHash, tokenHash);
      if (!preAuthActive) return null;
      preAuthActive = false;
      return session;
    };
    User.findById = async () => user;
    OTP.findOne = () => queryResult(otpActive ? otpRecord : null);
    OTP.findOneAndDelete = async (filter) => {
      otpDeleteCalls += 1;
      assert.equal(filter.preAuthSessionHash, tokenHash);
      assert.equal(filter.purpose, PREAUTH_PURPOSES.PASSWORD_LOGIN);
      if (!otpActive) return null;
      otpActive = false;
      return otpRecord;
    };

    try {
      const request = {
        body: {
          email: EMAIL,
          otp: suppliedOtp,
          preAuthToken: FLOW_TOKEN,
          purpose: PREAUTH_PURPOSES.PASSWORD_LOGIN,
        },
      };
      const responses = [createResponse(), createResponse()];
      await Promise.all(
        responses.map((response) => verifyOTP(request, response)),
      );

      assert.deepEqual(
        responses.map((response) => response.statusCode).sort(),
        [200, 400],
      );
      const winner = responses.find((response) => response.statusCode === 200);
      const decoded = verifyAuthToken(winner.body.token);
      assert.equal(decoded.id, USER_ID);
      assert.deepEqual(decoded.amr, ["password_otp"]);
      assert.equal(preAuthDeleteCalls, 1);
      assert.ok(otpDeleteCalls >= 1);

      const replayResponse = createResponse();
      await verifyOTP(request, replayResponse);
      assert.equal(replayResponse.statusCode, 401);
      assert.equal(replayResponse.body.code, "INVALID_OTP_FLOW");
    } finally {
      PreAuthSession.findOne = originals.preAuthFindOne;
      PreAuthSession.findOneAndDelete = originals.preAuthDelete;
      User.findById = originals.userFindById;
      OTP.findOne = originals.otpFindOne;
      OTP.findOneAndDelete = originals.otpDelete;
    }
  });

  await t.test("a grant cannot be substituted into another OTP purpose", async () => {
    const originalFindOne = PreAuthSession.findOne;
    const originalOtpFindOne = OTP.findOne;
    let otpLookupRan = false;
    PreAuthSession.findOne = (query) =>
      queryResult(
        query.purpose === PREAUTH_PURPOSES.PASSWORD_LOGIN
          ? {
              _id: "preauth-session-id",
              userId: USER_ID,
              email: EMAIL,
              purpose: PREAUTH_PURPOSES.PASSWORD_LOGIN,
            }
          : null,
      );
    OTP.findOne = () => {
      otpLookupRan = true;
      throw new Error("OTP lookup must not run for a purpose mismatch");
    };

    try {
      const response = createResponse();
      await verifyOTP(
        {
          body: {
            email: EMAIL,
            otp: "123456",
            preAuthToken: FLOW_TOKEN,
            purpose: PREAUTH_PURPOSES.REGISTRATION,
          },
        },
        response,
      );

      assert.equal(response.statusCode, 401);
      assert.equal(response.body.code, "INVALID_OTP_FLOW");
      assert.equal(otpLookupRan, false);
    } finally {
      PreAuthSession.findOne = originalFindOne;
      OTP.findOne = originalOtpFindOne;
    }
  });
});
