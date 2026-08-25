const mongoose = require("mongoose");

const PendingRegistrationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    fullName: { type: String, required: true, maxlength: 120 },
    passwordHash: { type: String, required: true, select: false },
    phoneNumber: { type: String, default: "", maxlength: 32 },
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
