require("dotenv").config();

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/UserData/User");

const APPLY_CHANGES = process.argv.includes("--apply");
const LEGACY_PASSWORD = process.env.LEGACY_CASHIER_PASSWORD;

const revokeLegacyCashierPassword = async () => {
  if (typeof process.env.MONGO_URI !== "string" || !process.env.MONGO_URI) {
    throw new Error("MONGO_URI must be configured.");
  }
  if (typeof LEGACY_PASSWORD !== "string" || LEGACY_PASSWORD.length < 8) {
    throw new Error(
      "LEGACY_CASHIER_PASSWORD must contain the previously deployed shared password.",
    );
  }

  await mongoose.connect(process.env.MONGO_URI);
  const users = await User.find({ role: "client" }).select(
    "+password +authenticators +authVersion",
  );
  const matchedIds = [];

  for (const user of users) {
    if (
      typeof user.password === "string" &&
      user.password &&
      (await bcrypt.compare(LEGACY_PASSWORD, user.password))
    ) {
      matchedIds.push(user._id);
    }
  }

  if (!APPLY_CHANGES || matchedIds.length === 0) {
    return { matched: matchedIds.length, revoked: 0 };
  }

  const result = await User.updateMany(
    { _id: { $in: matchedIds }, role: "client" },
    {
      $set: {
        authenticators: [],
        password: "",
        passwordChangedAt: new Date(),
      },
    },
  );

  return { matched: matchedIds.length, revoked: result.modifiedCount };
};

revokeLegacyCashierPassword()
  .then((summary) => {
    console.log(
      APPLY_CHANGES
        ? "Legacy cashier credential revocation result:"
        : "Legacy cashier credential revocation dry-run:",
      summary,
    );
    if (!APPLY_CHANGES) {
      console.log(
        "No accounts were changed. Back up the database, notify affected users, then rerun with --apply.",
      );
    }
  })
  .catch((error) => {
    console.error("Legacy cashier credential revocation failed", {
      code: error?.code,
      name: error?.name || "Error",
    });
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
