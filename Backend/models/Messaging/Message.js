const mongoose = require("mongoose");
const {
  MAX_CHAT_MESSAGE_BYTES,
  isChatMessageWithinLimit,
} = require("../../helper/chatSecurity");

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Both clients and admins are Users
      required: true,
    },
    text: {
      type: String,
      required: true,
      maxlength: MAX_CHAT_MESSAGE_BYTES,
      validate: {
        validator: isChatMessageWithinLimit,
        message: `Message text must be at most ${MAX_CHAT_MESSAGE_BYTES} bytes.`,
      },
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Message", messageSchema);
