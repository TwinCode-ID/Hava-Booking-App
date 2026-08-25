const OneTimePackageEntitlement = require(
  "../models/UserData/OneTimePackageEntitlement",
);
const PackagePurchase = require("../models/StudioData/PackagePurchase");
const UserPasses = require("../models/UserData/User_Passes");

const RESERVATION_PURCHASE_STATUSES = ["pending", "waiting_confirmation"];

const alreadyClaimed = () => {
  const error = new Error(
    "This one-time package has already been purchased or is awaiting payment.",
  );
  error.status = 409;
  error.code = "ONE_TIME_PACKAGE_ALREADY_CLAIMED";
  return error;
};

const isDuplicateKey = (error) =>
  error?.code === 11000 || error?.code === 11001;

const claimOneTimeEntitlement = async ({
  userId,
  packageId,
  purchaseId = null,
  source,
  state,
  releaseAt = null,
  session,
}) => {
  const now = new Date();
  const document = {
    userId,
    packageId,
    purchaseId,
    source,
    state,
    ...(state === "reserved" ? { releaseAt } : { consumedAt: now }),
  };

  if (state === "reserved" && !(releaseAt instanceof Date)) {
    throw new Error("A one-time package reservation requires an expiry.");
  }

  const reusable = [{ state: "reserved", releaseAt: { $lte: now } }];
  if (purchaseId) {
    reusable.push(
      state === "consumed"
        ? { purchaseId }
        : { purchaseId, state: "reserved" },
    );
  }

  try {
    // This is intentionally one upsert. A create-then-read duplicate-key
    // strategy cannot safely continue inside a MongoDB transaction because a
    // duplicate key aborts that transaction. The unique compound index makes
    // competing claims converge here; an existing live entitlement makes the
    // upsert attempt collide and is translated to the domain-level conflict.
    return await OneTimePackageEntitlement.findOneAndUpdate(
      { userId, packageId, $or: reusable },
      {
        $set: document,
        $unset:
          state === "consumed" ? { releaseAt: 1 } : { consumedAt: 1 },
      },
      { upsert: true, new: true, session, setDefaultsOnInsert: true },
    );
  } catch (error) {
    if (isDuplicateKey(error)) throw alreadyClaimed();
    throw error;
  }
};

const assertNoLegacyOneTimeEntitlement = async ({
  userId,
  packageId,
  excludePurchaseId = null,
  session,
}) => {
  const purchaseQuery = {
    userId,
    packageId,
    $or: [
      { status: "confirmed" },
      {
        status: { $in: RESERVATION_PURCHASE_STATUSES },
        paymentWindowExpiry: { $gt: new Date() },
      },
    ],
  };
  if (excludePurchaseId) purchaseQuery._id = { $ne: excludePurchaseId };

  // MongoDB does not support parallel operations on one transaction session.
  const existingPurchase = await PackagePurchase.findOne(purchaseQuery).session(
    session,
  );
  const existingPass = await UserPasses.findOne({ userId, packageId }).session(
    session,
  );
  if (existingPurchase || existingPass) throw alreadyClaimed();
};

const reserveOneTimeEntitlement = async ({
  userId,
  packageId,
  purchaseId,
  releaseAt,
  session,
}) => {
  await assertNoLegacyOneTimeEntitlement({
    userId,
    packageId,
    excludePurchaseId: purchaseId,
    session,
  });
  return claimOneTimeEntitlement({
    userId,
    packageId,
    purchaseId,
    releaseAt,
    source: "purchase",
    state: "reserved",
    session,
  });
};

const consumeOneTimeEntitlement = async ({
  userId,
  packageId,
  purchaseId = null,
  source,
  session,
}) => {
  await assertNoLegacyOneTimeEntitlement({
    userId,
    packageId,
    excludePurchaseId: purchaseId,
    session,
  });
  return claimOneTimeEntitlement({
    userId,
    packageId,
    purchaseId,
    source,
    state: "consumed",
    session,
  });
};

const releaseOneTimeReservation = async ({ purchaseId, session }) => {
  if (!purchaseId) return;
  const query = OneTimePackageEntitlement.deleteOne({
    purchaseId,
    state: "reserved",
  });
  if (session) query.session(session);
  await query;
};

module.exports = {
  RESERVATION_PURCHASE_STATUSES,
  assertNoLegacyOneTimeEntitlement,
  claimOneTimeEntitlement,
  consumeOneTimeEntitlement,
  releaseOneTimeReservation,
  reserveOneTimeEntitlement,
};
