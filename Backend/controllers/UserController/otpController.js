// Backward-compatible import path. The canonical implementation lives under
// OTPController so there is only one OTP policy and no static bypass account.
module.exports = require("../OTPController/otpController");
