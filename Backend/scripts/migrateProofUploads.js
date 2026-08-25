require("dotenv").config();

const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const mongoose = require("mongoose");
const sharp = require("sharp");
const PackagePurchase = require("../models/StudioData/PackagePurchase");
const {
  PRIVATE_UPLOAD_PREFIX,
  normalizePrivateUploadPath,
  normalizeStoredPrivateUploadPath,
} = require("../helper/privateUpload");

const PROOF_ROOT = path.resolve(__dirname, "../uploads/ProofOfPurchase");
const APPLY_CHANGES = process.argv.includes("--apply");
const MAX_INPUT_PIXELS = 40 * 1000 * 1000;

const getLegacySourcePath = (storedValue) => {
  const normalized = normalizeStoredPrivateUploadPath(storedValue);
  if (!normalized || normalizePrivateUploadPath(normalized)) return null;
  const relativePath = normalized.slice(PRIVATE_UPLOAD_PREFIX.length);
  const absolutePath = path.resolve(PROOF_ROOT, relativePath);
  return absolutePath.startsWith(`${PROOF_ROOT}${path.sep}`)
    ? absolutePath
    : null;
};

const migrateProofUploads = async () => {
  if (typeof process.env.MONGO_URI !== "string" || !process.env.MONGO_URI) {
    throw new Error("MONGO_URI must be configured.");
  }

  await mongoose.connect(process.env.MONGO_URI);
  const purchases = await PackagePurchase.find({
    proofOfPayment: { $type: "string", $ne: "" },
  }).select("_id userId proofOfPayment");

  const summary = {
    alreadyMigrated: 0,
    failed: 0,
    migrated: 0,
    missingOrExternal: 0,
    wouldMigrate: 0,
  };

  for (const purchase of purchases) {
    if (normalizePrivateUploadPath(purchase.proofOfPayment)) {
      summary.alreadyMigrated += 1;
      continue;
    }

    const sourcePath = getLegacySourcePath(purchase.proofOfPayment);
    if (!sourcePath) {
      summary.missingOrExternal += 1;
      continue;
    }
    try {
      await fs.access(sourcePath);
    } catch {
      summary.missingOrExternal += 1;
      continue;
    }

    if (!APPLY_CHANGES) {
      summary.wouldMigrate += 1;
      continue;
    }

    const ownerId = purchase.userId?.toString();
    if (!/^[a-f\d]{24}$/i.test(ownerId || "")) {
      summary.failed += 1;
      continue;
    }
    const ownerDirectory = path.join(PROOF_ROOT, ownerId);
    const filename = `${crypto.randomUUID()}.jpeg`;
    const destinationPath = path.join(ownerDirectory, filename);
    const storedPath = `${PRIVATE_UPLOAD_PREFIX}${ownerId}/${filename}`;

    try {
      await fs.mkdir(ownerDirectory, { recursive: true, mode: 0o750 });
      await sharp(sourcePath, {
        failOn: "warning",
        limitInputPixels: MAX_INPUT_PIXELS,
        sequentialRead: true,
      })
        .rotate()
        .resize({
          width: 2400,
          height: 2400,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80, mozjpeg: true })
        .toFile(destinationPath);

      const result = await PackagePurchase.updateOne(
        { _id: purchase._id, proofOfPayment: purchase.proofOfPayment },
        { $set: { proofOfPayment: storedPath } },
      );
      if (result.modifiedCount !== 1) {
        await fs.unlink(destinationPath);
        summary.failed += 1;
        continue;
      }
      summary.migrated += 1;
    } catch {
      await fs.unlink(destinationPath).catch(() => {});
      summary.failed += 1;
    }
  }

  return summary;
};

migrateProofUploads()
  .then((summary) => {
    console.log(APPLY_CHANGES ? "Proof migration result:" : "Proof migration dry-run:", summary);
    if (!APPLY_CHANGES) {
      console.log("No files or database records were changed. Use --apply after taking backups.");
    }
  })
  .catch((error) => {
    console.error("Proof migration failed", {
      code: error?.code,
      name: error?.name || "Error",
    });
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
