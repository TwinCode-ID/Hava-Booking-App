const mongoose = require("mongoose");

const OtpLogSchema = new mongoose.Schema({
  email: { type: String, required: true },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 3600, // Auto-delete this document after 1 hour (3600 seconds)
  },
});

module.exports = mongoose.model("OtpLog", OtpLogSchema);
