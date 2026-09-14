const mongoose = require("mongoose");

const PendingRegistrationSchema = new mongoose.Schema(
  {
    // A candidate is identified by whichever contact it registered with. Email
    // candidates prove ownership through the mailbox OTP; phone candidates
    // cannot, because no SMS gateway exists, so they wait for staff instead.
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      default: undefined,
      set: (value) =>
        typeof value === "string" && value.trim() ? value : undefined,
    },
    fullName: { type: String, required: true, maxlength: 120 },
    passwordHash: { type: String, required: true, select: false },
    phoneNumber: { type: String, default: "", maxlength: 32 },
    phoneNumberE164: {
      type: String,
      unique: true,
      sparse: true,
      default: undefined,
    },
    // "emailOtp" candidates activate themselves by verifying the mailbox code.
    // "awaitingStaff" candidates are only ever activated by a cashier or an
    // admin, who confirms the person and the number at the front desk.
    approvalStatus: {
      type: String,
      enum: ["emailOtp", "awaitingStaff"],
      default: "emailOtp",
      required: true,
      index: true,
    },
    isStudent: { type: Boolean, default: false },
    avatar: { type: String, default: "", maxlength: 2048 },
    role: {
      type: String,
      enum: ["client"],
      default: "client",
      required: true,
    },
    registrationVersion: {
      type: String,
      required: true,
      select: false,
    },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

PendingRegistrationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// A candidate that identifies nobody can never be activated by either route.
PendingRegistrationSchema.pre("validate", function () {
  if (!this.email && !this.phoneNumberE164) {
    throw new Error("A registration needs an email address or a phone number.");
  }
});

const removeSecrets = (_document, returnedObject) => {
  delete returnedObject.passwordHash;
  delete returnedObject.registrationVersion;
  return returnedObject;
};

PendingRegistrationSchema.set("toJSON", { transform: removeSecrets });
PendingRegistrationSchema.set("toObject", { transform: removeSecrets });

module.exports = mongoose.model(
  "PendingRegistration",
  PendingRegistrationSchema,
);
