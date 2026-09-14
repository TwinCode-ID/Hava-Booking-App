require("dotenv").config();

const mongoose = require("mongoose");
const User = require("../models/UserData/User");

// Email used to be required, so its unique index is not sparse. A non-sparse
// unique index stores a missing field as null, which means the first
// phone-only account inserts and every one after it collides on null. The
// index has to be rebuilt as sparse before phone-only accounts can exist.
//
// Run it once, against the same database the API uses:
//   node scripts/migrateOptionalEmailIndex.js           (report only)
//   node scripts/migrateOptionalEmailIndex.js --apply   (rebuild the index)
const APPLY_CHANGES = process.argv.includes("--apply");

const EMAIL_INDEX_NAME = "email_1";

const describeIndex = (indexes, name) =>
  indexes.find((index) => index.name === name) || null;

const migrate = async () => {
  if (typeof process.env.MONGO_URI !== "string" || !process.env.MONGO_URI) {
    throw new Error("MONGO_URI must be configured.");
  }

  await mongoose.connect(process.env.MONGO_URI);
  const collection = User.collection;

  // Documents already carrying an explicit null or "" would each be indexed as
  // a value and collide with one another even after the index is sparse.
  const blankEmails = await collection.countDocuments({
    email: { $in: [null, ""] },
  });
  if (blankEmails > 0) {
    console.log(
      `${blankEmails} account(s) store an empty email. Unset the field on ` +
        "them before rebuilding the index:",
    );
    console.log(
      '  db.users.updateMany({ email: { $in: [null, ""] } }, ' +
        "{ $unset: { email: 1 } })",
    );
    if (APPLY_CHANGES) {
      const result = await collection.updateMany(
        { email: { $in: [null, ""] } },
        { $unset: { email: 1 } },
      );
      console.log(`Unset email on ${result.modifiedCount} account(s).`);
    }
  }

  const indexes = await collection.indexes();
  const existing = describeIndex(indexes, EMAIL_INDEX_NAME);

  if (!existing) {
    console.log(`No ${EMAIL_INDEX_NAME} index exists yet; nothing to rebuild.`);
  } else if (existing.sparse === true && existing.unique === true) {
    console.log(`${EMAIL_INDEX_NAME} is already unique and sparse.`);
  } else {
    console.log(
      `${EMAIL_INDEX_NAME} is unique=${existing.unique === true} ` +
        `sparse=${existing.sparse === true} and must be rebuilt.`,
    );
    if (APPLY_CHANGES) {
      await collection.dropIndex(EMAIL_INDEX_NAME);
      await collection.createIndex({ email: 1 }, { unique: true, sparse: true });
      console.log(`Rebuilt ${EMAIL_INDEX_NAME} as unique and sparse.`);
    }
  }

  // Sign-in refuses to authenticate a number held by more than one account, so
  // duplicates silently lock those members out and are worth surfacing here.
  const duplicateNumbers = await collection
    .aggregate([
      { $match: { phoneNumberE164: { $exists: true, $ne: null } } },
      { $group: { _id: "$phoneNumberE164", count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  if (duplicateNumbers.length > 0) {
    console.log(
      `${duplicateNumbers.length} phone number(s) are shared by more than one ` +
        "account. Those members cannot sign in by phone until it is resolved.",
    );
  }

  if (!APPLY_CHANGES) {
    console.log("Report only. Re-run with --apply to make these changes.");
  }

  await mongoose.disconnect();
};

migrate().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
