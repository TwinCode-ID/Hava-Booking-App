const test = require("node:test");
const assert = require("node:assert/strict");
const User = require("../models/UserData/User");
const { toAuthenticatedUser } = require("../helper/userResponse");
const { checkAuth } = require("../controllers/UserController/authController");
const {
  updatePassword,
} = require("../controllers/UserController/userController");

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

test("authenticated user response detects a stored password without exposing it", () => {
  const responseUser = toAuthenticatedUser({
    _id: "user-id",
    email: "user@example.com",
    password: "$2b$10$stored-password-hash",
    authenticators: [
      {
        credentialID: "credential-id",
        credentialPublicKey: Buffer.from("public-key"),
      },
    ],
    currentChallenge: "challenge",
  });

  assert.equal(responseUser.hasPassword, true);
  assert.equal(Object.hasOwn(responseUser, "password"), false);
  assert.equal(Object.hasOwn(responseUser, "authenticators"), false);
  assert.equal(Object.hasOwn(responseUser, "currentChallenge"), false);
});

test("authenticated user response reports when no password exists", () => {
  const responseUser = toAuthenticatedUser({
    _id: "user-id",
    email: "user@example.com",
    password: "",
  });

  assert.equal(responseUser.hasPassword, false);
  assert.equal(Object.hasOwn(responseUser, "password"), false);
});

test("user model excludes authentication secrets from queries and serialized JSON", () => {
  assert.equal(User.schema.path("password").options.select, false);
  assert.equal(User.schema.path("authenticators").options.select, false);
  assert.equal(User.schema.path("currentChallenge").options.select, false);

  const user = new User({
    fullName: "Test User",
    email: "user@example.com",
    password: "$2b$10$stored-password-hash",
    authenticators: [
      {
        credentialID: "credential-id",
        credentialPublicKey: Buffer.from("public-key"),
      },
    ],
    currentChallenge: "challenge",
  });
  const serializedUser = user.toJSON();

  assert.equal(Object.hasOwn(serializedUser, "password"), false);
  assert.equal(Object.hasOwn(serializedUser, "authenticators"), false);
  assert.equal(Object.hasOwn(serializedUser, "currentChallenge"), false);
});

test("financial unlock tells authenticated users without a password to create one", async () => {
  const originalFindById = User.findById;
  User.findById = (id) => ({
    select: async () => ({ _id: id, password: "" }),
  });

  try {
    const response = createResponse();
    await checkAuth(
      {
        user: { _id: "authenticated-user" },
        body: { email: "another-user@example.com", password: "secret" },
      },
      response,
    );

    assert.equal(response.statusCode, 409);
    assert.equal(response.body.code, "PASSWORD_NOT_SET");
    assert.equal(response.body.hasPassword, false);
  } finally {
    User.findById = originalFindById;
  }
});

test("financial unlock verifies the authenticated account rather than a supplied email", async () => {
  const originalFindById = User.findById;
  let requestedUserId;
  User.findById = (id) => {
    requestedUserId = id;
    return {
      select: async () => ({
        password: "stored-hash",
        matchPassword: async (password) => password === "correct-password",
      }),
    };
  };

  try {
    const response = createResponse();
    await checkAuth(
      {
        user: { _id: "authenticated-user" },
        body: {
          email: "another-user@example.com",
          password: "correct-password",
        },
      },
      response,
    );

    assert.equal(requestedUserId, "authenticated-user");
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, true);
  } finally {
    User.findById = originalFindById;
  }
});

test("password update creates a password without requiring a current password", async () => {
  const originalFindById = User.findById;
  let saved = false;
  const user = {
    password: "",
    save: async () => {
      saved = true;
    },
  };
  User.findById = () => ({ select: async () => user });

  try {
    const response = createResponse();
    await updatePassword(
      {
        user: { _id: "authenticated-user" },
        body: { password: "", newPassword: "new-password" },
      },
      response,
    );

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.hasPassword, true);
    assert.equal(user.password, "new-password");
    assert.equal(saved, true);
  } finally {
    User.findById = originalFindById;
  }
});

test("password update requires the current password when one exists", async () => {
  const originalFindById = User.findById;
  User.findById = () => ({
    select: async () => ({ password: "stored-hash" }),
  });

  try {
    const response = createResponse();
    await updatePassword(
      {
        user: { _id: "authenticated-user" },
        body: { newPassword: "new-password" },
      },
      response,
    );

    assert.equal(response.statusCode, 400);
    assert.equal(response.body.code, "CURRENT_PASSWORD_REQUIRED");
  } finally {
    User.findById = originalFindById;
  }
});
