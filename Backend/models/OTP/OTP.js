const mongoose = require("mongoose");

const OTPSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  pendingRegistrationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PendingRegistration",
  },
  registrationVersion: { type: String, select: false },
  purpose: {
    type: String,
    enum: [
      "password_login",
      "passwordless_login",
      "phone_password_login",
      "phone_password_setup",
      "registration",
    ],
    required: true,
  },
  preAuthSessionHash: { type: String, required: true, select: false },
  otpHash: { type: String, required: true, select: false },
  attempts: { type: Number, default: 0, min: 0, select: false },
  createdAt: { type: Date, default: Date.now, expires: 300 },
});

OTPSchema.pre("validate", function () {
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
      "OTP records require exactly one matching authentication subject.",
    );
  }
});

module.exports = mongoose.model("OTP", OTPSchema);
