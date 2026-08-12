const test = require("node:test");
const assert = require("node:assert/strict");
const User = require("../models/UserData/User");
const {} = require("../helper/userResponse");

test("authenticated user response detects a stored password without exposing it", () => {
  const responseUser = toAuthenticatedUser({
    _id: "user-id",
    email: "user@example.com",
    password: "$2b$10$stored-password-hash",
  });

  assert.equal(responseUser.hasPassword, true);
  assert.equal(Object.hasOwn(responseUser, "password"), false);
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

test("user model excludes password from queries and serialized JSON", () => {
  assert.equal(User.schema.path("password").options.select, false);

  const user = new User({
    fullName: "Test User",
    email: "user@example.com",
    password: "$2b$10$stored-password-hash",
  });
  const serializedUser = user.toJSON();

  assert.equal(Object.hasOwn(serializedUser, "password"), false);
});
