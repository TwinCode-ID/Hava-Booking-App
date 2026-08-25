const mongoose = require("mongoose");

const passkeyCeremonySchema = new mongoose.Schema(
  {
    ceremonyIdHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    challenge: { type: String, required: true, select: false },
    type: {
      type: String,
      enum: ["authentication", "registration"],
      required: true,
      index: true,
    },
    userId: { type: String, select: false },
    sessionBindingHash: { type: String, select: false },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false },
);

passkeyCeremonySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("PasskeyCeremony", passkeyCeremonySchema);
