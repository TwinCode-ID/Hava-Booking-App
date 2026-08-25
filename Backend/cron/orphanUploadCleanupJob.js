const fs = require("fs/promises");
const path = require("path");
const cron = require("node-cron");
const PackagePurchase = require("../models/StudioData/PackagePurchase");
const { normalizePrivateUploadPath } = require("../helper/privateUpload");

const ORPHAN_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;
const PROOF_ROOT = path.resolve(__dirname, "../uploads/ProofOfPurchase");
let cleanupRunning = false;

const getProofCandidates = async (proofRoot = PROOF_ROOT) => {
  let owners;
  try {
    owners = await fs.readdir(proofRoot, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  const candidates = [];
  for (const owner of owners) {
    if (!owner.isDirectory() || !/^[a-f\d]{24}$/i.test(owner.name)) continue;
    const ownerDirectory = path.join(proofRoot, owner.name);
    const files = await fs.readdir(ownerDirectory, { withFileTypes: true });
    for (const file of files) {
      if (!file.isFile()) continue;
      const relativePath = normalizePrivateUploadPath(
        `/uploads/ProofOfPurchase/${owner.name}/${file.name}`,
      );
      if (!relativePath) continue;
      candidates.push({
        absolutePath: path.join(ownerDirectory, file.name),
        ownerDirectory,
        relativePath,
      });
    }
  }
  return candidates;
};

const cleanupOrphanProofs = async ({
  now = Date.now(),
  proofRoot = PROOF_ROOT,
} = {}) => {
  const candidates = await getProofCandidates(proofRoot);
  let deleted = 0;

  for (const candidate of candidates) {
    let stats;
    try {
      stats = await fs.stat(candidate.absolutePath);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    if (now - stats.mtimeMs < ORPHAN_GRACE_PERIOD_MS) continue;

    const referenced = await PackagePurchase.exists({
      proofOfPayment: candidate.relativePath,
    });
    if (referenced) continue;

    try {
      await fs.unlink(candidate.absolutePath);
      deleted += 1;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }

    try {
      await fs.rmdir(candidate.ownerDirectory);
    } catch (error) {
      if (!["ENOENT", "ENOTEMPTY"].includes(error?.code)) throw error;
    }
  }

  return deleted;
};

const runScheduledCleanup = async () => {
  if (cleanupRunning) return;
  cleanupRunning = true;
  try {
    await cleanupOrphanProofs();
  } catch (error) {
    console.error("[uploads] Orphan proof cleanup failed", {
      name: error?.name || "Error",
      code: error?.code,
    });
  } finally {
    cleanupRunning = false;
  }
};

cron.schedule("17 3 * * *", runScheduledCleanup);

module.exports = {
  ORPHAN_GRACE_PERIOD_MS,
  PROOF_ROOT,
  cleanupOrphanProofs,
  getProofCandidates,
  runScheduledCleanup,
};
