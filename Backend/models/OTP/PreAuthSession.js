const mongoose = require("mongoose");

const PREAUTH_PURPOSE_VALUES = [
  "password_login",
  "passwordless_login",
  "registration",
];

const PreAuthSessionSchema = new mongoose.Schema(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    pendingRegistrationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PendingRegistration",
      index: true,
    },
    registrationVersion: { type: String, select: false },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    purpose: {
      type: String,
      enum: PREAUTH_PURPOSE_VALUES,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

PreAuthSessionSchema.pre("validate", function () {
  const hasUser = Boolean(this.userId);
  const hasPendingRegistration = Boolean(this.pendingRegistrationId);
  const isRegistration = this.purpose === "registration";

  if (
    hasUser === hasPendingRegistration ||
    isRegistration !== hasPendingRegistration ||
    (isRegistration && !this.registrationVersion) ||
    (!isRegistration && this.registrationVersion)
  ) {
    this.invalidate(
      "purpose",
      "Pre-authentication sessions require exactly one matching subject.",
    );
  }
});

PreAuthSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("PreAuthSession", PreAuthSessionSchema);
module.exports.PREAUTH_PURPOSE_VALUES = PREAUTH_PURPOSE_VALUES;
