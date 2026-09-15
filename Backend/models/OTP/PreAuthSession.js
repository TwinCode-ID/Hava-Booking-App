const mongoose = require("mongoose");

const PHONE_PREAUTH_PURPOSE_VALUES = [
  "phone_password_login",
  "phone_password_setup",
];

const PREAUTH_PURPOSE_VALUES = [
  "password_login",
  "passwordless_login",
  ...PHONE_PREAUTH_PURPOSE_VALUES,
  "registration",
  "email_claim",
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
    // Phone flows are addressed by number, and an account added at the front
    // desk may have no mailbox at all, so only the mailbox flows require one.
    // An absent address is stored as undefined rather than "".
    email: {
      type: String,
      required: function () {
        return !PHONE_PREAUTH_PURPOSE_VALUES.includes(this.purpose);
      },
      lowercase: true,
      trim: true,
      index: true,
      default: undefined,
      set: (value) =>
        typeof value === "string" && value.trim() ? value : undefined,
    },
    // Only set for phone flows, which are addressed by number instead of by
    // mailbox. The account's email is still recorded so every session has one
    // subject regardless of how it was started.
    phoneNumberE164: {
      type: String,
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

  const isPhoneFlow = PHONE_PREAUTH_PURPOSE_VALUES.includes(this.purpose);
  if (isPhoneFlow !== Boolean(this.phoneNumberE164)) {
    this.invalidate(
      "phoneNumberE164",
      "Only phone flows may be addressed by phone number.",
    );
  }
});

PreAuthSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("PreAuthSession", PreAuthSessionSchema);
module.exports.PREAUTH_PURPOSE_VALUES = PREAUTH_PURPOSE_VALUES;
module.exports.PHONE_PREAUTH_PURPOSE_VALUES = PHONE_PREAUTH_PURPOSE_VALUES;
