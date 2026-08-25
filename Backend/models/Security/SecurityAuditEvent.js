const mongoose = require("mongoose");

const securityAuditEventSchema = new mongoose.Schema({
  action: {
    type: String,
    enum: ["medical_record_read", "medical_record_write"],
    required: true,
  },
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  targetUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  studioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Studios",
    default: null,
    index: true,
  },
  createdAt: { type: Date, default: Date.now },
});

securityAuditEventSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 365 * 24 * 60 * 60 },
);

module.exports = mongoose.model("Security_Audit_Event", securityAuditEventSchema);
