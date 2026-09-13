require("dotenv").config();

const mongoose = require("mongoose");
const User = require("../models/UserData/User");
const {
  getDefaultDialCode,
  maskPhoneNumber,
  normalizePhoneNumber,
} = require("../helper/phoneNumber");

// Existing profiles were captured before phone numbers could sign in, so their
// canonical form has to be derived once. New writes keep themselves in sync
// through the model hooks.
const APPLY_CHANGES = process.argv.includes("--apply");

const backfill = async () => {
  if (typeof process.env.MONGO_URI !== "string" || !process.env.MONGO_URI) {
    throw new Error("MONGO_URI must be configured.");
  }

  await mongoose.connect(process.env.MONGO_URI);
  const summary = {
    alreadyCurrent: 0,
    unparseable: 0,
    updated: 0,
    wouldUpdate: 0,
  };
  const duplicates = new Map();
  const cursor = User.find({
    phoneNumber: { $exists: true, $nin: [null, ""] },
  })
    .select("_id phoneNumber phoneNumberE164")
    .lean()
    .cursor();

  for await (const user of cursor) {
    const normalized = normalizePhoneNumber(user.phoneNumber);
    if (!normalized) {
      summary.unparseable += 1;
      continue;
    }

    duplicates.set(normalized, (duplicates.get(normalized) || 0) + 1);

    if (user.phoneNumberE164 === normalized) {
      summary.alreadyCurrent += 1;
      continue;
    }
    if (!APPLY_CHANGES) {
      summary.wouldUpdate += 1;
      continue;
    }

    const result = await User.collection.updateOne(
      { _id: user._id },
      { $set: { phoneNumberE164: normalized } },
    );
    summary.updated += result.modifiedCount;
  }

  // A number on more than one account cannot identify a member, so phone
  // sign-in refuses it. Those accounts need the duplicate cleaned up by hand.
  summary.sharedNumbers = [...duplicates.entries()]
    .filter(([, count]) => count > 1)
    .map(([number, count]) => `${maskPhoneNumber(number)} (${count} accounts)`);

  return summary;
};

backfill()
  .then((summary) => {
    console.log(
      APPLY_CHANGES
        ? "Phone number backfill result:"
        : "Phone number backfill dry-run:",
      summary,
    );
    console.log(
      `Numbers without a country code were read as ${
        getDefaultDialCode() || "(no default country configured)"
      }. Set PHONE_DEFAULT_COUNTRY_CODE before applying if that is wrong.`,
    );
    if (!APPLY_CHANGES) {
      console.log("No records were changed. Re-run with --apply to write.");
    }
  })
  .catch((error) => {
    console.error("Phone number backfill failed", {
      code: error?.code,
      name: error?.name || "Error",
    });
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
