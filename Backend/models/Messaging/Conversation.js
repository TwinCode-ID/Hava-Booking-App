const mongoose = require("mongoose");
const {
  MAX_CHAT_MESSAGE_BYTES,
  isChatMessageWithinLimit,
} = require("../../helper/chatSecurity");

const conversationSchema = new mongoose.Schema(
  {
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    studio: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Studios", // References your Studios model
      required: true,
    },
    lastMessage: {
      type: String,
      default: "",
      maxlength: MAX_CHAT_MESSAGE_BYTES,
      validate: {
        validator: isChatMessageWithinLimit,
        message: `Last message must be at most ${MAX_CHAT_MESSAGE_BYTES} bytes.`,
      },
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    unreadCountClient: { type: Number, default: 0 },
    unreadCountStudio: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Conversation", conversationSchema);
