// SMS delivery is not contracted yet. Everything downstream of this module is
// already written against it, so enabling text-message OTP is a matter of
// setting SMS_OTP_ENABLED=true, choosing SMS_PROVIDER, and implementing the
// matching branch in sendSms. Until then the flag stays off and the phone
// sign-in flow authenticates with a password only.

const { maskPhoneNumber, normalizePhoneNumber } = require("./phoneNumber");

const OTP_SMS_SENDER = "Pilates Studio Indonesia";

const smsError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const getSmsProvider = () =>
  typeof process.env.SMS_PROVIDER === "string"
    ? process.env.SMS_PROVIDER.trim().toLowerCase()
    : "";

// The flag alone decides whether the product behaves as if SMS exists, so it
// must never report enabled without a provider behind it.
const isSmsOtpEnabled = () =>
  process.env.SMS_OTP_ENABLED === "true" && getSmsProvider() !== "";

const sendSms = async (phoneNumber, message) => {
  const recipient = normalizePhoneNumber(phoneNumber);
  if (!recipient) {
    throw smsError("SMS_INVALID_RECIPIENT", "A valid phone number is required.");
  }
  if (typeof message !== "string" || !message.trim()) {
    throw smsError("SMS_EMPTY_MESSAGE", "Cannot send an empty message.");
  }

  switch (getSmsProvider()) {
    // TODO: add the contracted gateway here, for example:
    // case "twilio":
    //   return twilioClient.messages.create({
    //     body: message,
    //     from: process.env.SMS_SENDER_ID,
    //     to: recipient,
    //   });
    default:
      throw smsError(
        "SMS_NOT_CONFIGURED",
        `No SMS provider is configured for ${maskPhoneNumber(recipient)}.`,
      );
  }
};

const sendOtpSms = async (userName, phoneNumber, otp) => {
  const safeOtp = String(otp ?? "").replace(/\D/g, "").slice(0, 12);
  if (!safeOtp) {
    throw smsError("SMS_EMPTY_MESSAGE", "Cannot send an empty verification code.");
  }

  return sendSms(
    phoneNumber,
    `${safeOtp} is your ${OTP_SMS_SENDER} verification code. It expires in 5 minutes. Never share this code with anyone.`,
  );
};

module.exports = {
  OTP_SMS_SENDER,
  getSmsProvider,
  isSmsOtpEnabled,
  sendOtpSms,
  sendSms,
};
