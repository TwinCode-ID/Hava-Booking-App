const mongoose = require("mongoose");

// A one-time package is a business entitlement, not merely an active pass.
// Reservations protect purchases that are still awaiting payment; consumed
// rows remain permanently so deleting or expiring a pass cannot make the
// package purchasable again.
const oneTimePackageEntitlementSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    packageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Packages",
      required: true,
    },
    state: {
      type: String,
      enum: ["reserved", "consumed"],
      required: true,
    },
    purchaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Package_Purchase",
      default: null,
    },
    source: {
      type: String,
      enum: ["purchase", "cashier", "direct_assignment", "legacy"],
      required: true,
    },
    // Only reservations expire. Consumed entitlements deliberately keep this
    // null so the TTL index can never remove the permanent purchase history.
    releaseAt: { type: Date, default: null },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: true, autoIndex: true },
);

oneTimePackageEntitlementSchema.index(
  { userId: 1, packageId: 1 },
  { unique: true, name: "one_time_entitlement_per_user_package" },
);
oneTimePackageEntitlementSchema.index(
  { releaseAt: 1 },
  {
    expireAfterSeconds: 0,
    partialFilterExpression: { state: "reserved" },
    name: "expire_abandoned_one_time_reservations",
  },
);

oneTimePackageEntitlementSchema.pre("findOneAndUpdate", async function () {
  // Do not allow the first entitlement write to race index creation on a new
  // deployment. Model.init() is cached by Mongoose after the index is ready.
  await this.model.init();
});

module.exports = mongoose.model(
  "One_Time_Package_Entitlement",
  oneTimePackageEntitlementSchema,
);
