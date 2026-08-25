const mongoose = require("mongoose");

const rateLimitCounterSchema = new mongoose.Schema(
  {
    _id: { type: String },
    totalHits: { type: Number, required: true, min: 0 },
    resetAt: { type: Date, required: true },
  },
  { versionKey: false },
);

rateLimitCounterSchema.index({ resetAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("RateLimitCounter", rateLimitCounterSchema);
