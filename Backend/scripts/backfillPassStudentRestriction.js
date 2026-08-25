require("dotenv").config();

const mongoose = require("mongoose");
const UserPasses = require("../models/UserData/User_Passes");
const Package = require("../models/StudioData/Packages");

const APPLY_CHANGES = process.argv.includes("--apply");
const missingSnapshotFilter = {
  $or: [
    { isStudentRestrictedSnapshot: { $exists: false } },
    { isStudentRestrictedSnapshot: null },
  ],
};

const classifyLegacyPass = async (pass, packageCache) => {
  if (pass.packageCategorySnapshot?.includes("Student")) return true;
  const packageId = pass.packageId?.toString();
  if (!packageId) return null;

  if (!packageCache.has(packageId)) {
    const pkg = await Package.findById(packageId)
      .select("isStudentPackage packageCategory")
      .lean();
    packageCache.set(packageId, pkg || null);
  }
  const pkg = packageCache.get(packageId);
  if (!pkg) return null;
  return Boolean(
    pkg.isStudentPackage === true || pkg.packageCategory?.includes("Student"),
  );
};

const backfill = async () => {
  if (typeof process.env.MONGO_URI !== "string" || !process.env.MONGO_URI) {
    throw new Error("MONGO_URI must be configured.");
  }

  await mongoose.connect(process.env.MONGO_URI);
  const packageCache = new Map();
  const summary = {
    restricted: 0,
    unclassifiable: 0,
    unrestricted: 0,
    updated: 0,
    wouldUpdate: 0,
  };
  const cursor = UserPasses.find(missingSnapshotFilter)
    .select("_id packageId packageCategorySnapshot")
    .lean()
    .cursor();

  for await (const pass of cursor) {
    const restricted = await classifyLegacyPass(pass, packageCache);
    if (restricted === null) {
      summary.unclassifiable += 1;
      continue;
    }

    summary[restricted ? "restricted" : "unrestricted"] += 1;
    if (!APPLY_CHANGES) {
      summary.wouldUpdate += 1;
      continue;
    }

    // Raw collection access is deliberate: the field is immutable for normal
    // application writes but this one-time migration must initialize it.
    const result = await UserPasses.collection.updateOne(
      { _id: pass._id, ...missingSnapshotFilter },
      { $set: { isStudentRestrictedSnapshot: restricted } },
    );
    summary.updated += result.modifiedCount;
  }

  return summary;
};

backfill()
  .then((summary) => {
    console.log(
      APPLY_CHANGES
        ? "Student restriction backfill result:"
        : "Student restriction backfill dry-run:",
      summary,
    );
    if (!APPLY_CHANGES) {
      console.log(
        "No records were changed. Use --apply only after a database backup; unclassifiable passes remain fail-closed for sharing.",
      );
    }
  })
  .catch((error) => {
    console.error("Student restriction backfill failed", {
      code: error?.code,
      name: error?.name || "Error",
    });
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());

