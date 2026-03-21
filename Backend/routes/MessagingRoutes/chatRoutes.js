const express = require("express"); // Assuming you use express
const chatController = require("../../controllers/MessagingController/chatController");
const { protect } = require("../../middlewares/authMiddleware"); // Your JWT auth middleware

const router = express.Router();

// Get all inbox conversations
router.get("/conversations", protect, chatController.getConversations);

// Get messages for a specific chat
router.get("/:conversationId/messages", protect, chatController.getMessages);

router.put("/:conversationId/read", protect, chatController.markAsRead);
// Send a message
router.post("/send", protect, chatController.sendMessage);

// Start a new chat (or get existing one)
router.post("/initiate", protect, chatController.createOrGetConversation);

module.exports = router;
