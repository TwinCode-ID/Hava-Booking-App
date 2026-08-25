const MAX_CHAT_MESSAGE_BYTES = 4 * 1024;

const isChatMessageWithinLimit = (value) =>
  typeof value === "string" &&
  Buffer.byteLength(value, "utf8") <= MAX_CHAT_MESSAGE_BYTES;

module.exports = { MAX_CHAT_MESSAGE_BYTES, isChatMessageWithinLimit };
