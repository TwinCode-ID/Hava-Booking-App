const Conversation = require("../../models/Messaging/Conversation");
const Message = require("../../models/Messaging/Message");
const Studio = require("../../models/StudioData/Studios");
const {
  MAX_CHAT_MESSAGE_BYTES,
  isChatMessageWithinLimit,
} = require("../../helper/chatSecurity");
const {
  idsEqual,
  isDevTeam,
  isStudioAdmin,
} = require("../../helper/authorization");

const canAccessConversation = (user, conversation) =>
  isDevTeam(user) ||
  idsEqual(conversation.client, user?._id) ||
  (isStudioAdmin(user) &&
    idsEqual(conversation.studio, user.adminStudioLocation));

const findAuthorizedConversation = async (req, res, conversationId) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    res.status(404).json({ message: "Conversation not found" });
    return null;
  }
  if (!canAccessConversation(req.user, conversation)) {
    res.status(403).json({ message: "Not authorized for this conversation" });
    return null;
  }
  return conversation;
};

// 1. Get all conversations for the logged-in user (Admin or Client)
exports.getConversations = async (req, res) => {
  try {
    const { role, _id, adminStudioLocation } = req.user;
    let query = {};

    // If it's a Studio Admin, fetch chats for their specific studio
    if (role === "studioAdmin") {
      query.studio = adminStudioLocation;
    } else {
      // If it's a Client, fetch their personal chats
      query.client = _id;
    }

    const conversations = await Conversation.find(query)
      .populate("client", "fullName avatar email")
      .populate("studio", "studioName studioPictures")
      .sort({ lastMessageAt: -1 }); // Sort by newest first

    res.status(200).json(conversations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch conversations" });
  }
};

// 2. Get messages for a specific conversation
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const conversation = await findAuthorizedConversation(
      req,
      res,
      conversationId,
    );
    if (!conversation) return;

    const messages = await Message.find({ conversationId })
      .populate("sender", "fullName avatar role")
      .sort({ createdAt: 1 }); // Oldest to newest (standard chat flow)

    res.status(200).json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch messages" });
  }
};

// 3. Send a new message
exports.sendMessage = async (req, res) => {
  try {
    const { conversationId, text } = req.body;
    const senderId = req.user._id;
    const senderRole = req.user.role;

    if (typeof text !== "string") {
      return res.status(400).json({ message: "Message text is required" });
    }
    const normalizedText = text.trim();
    if (!normalizedText) {
      return res.status(400).json({ message: "Message text is required" });
    }
    if (!isChatMessageWithinLimit(normalizedText)) {
      return res.status(400).json({
        code: "MESSAGE_TOO_LONG",
        message: `Message text must be at most ${MAX_CHAT_MESSAGE_BYTES} bytes.`,
      });
    }

    const conversation = await findAuthorizedConversation(
      req,
      res,
      conversationId,
    );
    if (!conversation) return;

    // Save the new message
    const newMessage = await Message.create({
      conversationId,
      sender: senderId,
      text: normalizedText,
    });

    // Determine who needs their unread counter increased
    const updateField =
      senderRole === "studioAdmin"
        ? { $inc: { unreadCountClient: 1 } }
        : { $inc: { unreadCountStudio: 1 } };

    // Update the conversation's last message and timestamp
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: normalizedText,
      lastMessageAt: Date.now(),
      ...updateField,
    });

    // Populate sender info before sending back to frontend
    const populatedMessage = await Message.findById(newMessage._id).populate(
      "sender",
      "fullName avatar role",
    );

    const io = req.app.get("io");
    if (io) io.to(conversationId).emit("receive_message", populatedMessage);

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to send message" });
  }
};

// 4. Create or Find a Conversation (Used when a client clicks "Chat with Studio" for the first time)
exports.createOrGetConversation = async (req, res) => {
  try {
    const { studioId } = req.body;
    const clientId = req.user._id;

    if (req.user.role !== "client") {
      return res
        .status(403)
        .json({ message: "Only clients can initiate studio conversations" });
    }

    const studioExists = await Studio.exists({ _id: studioId });
    if (!studioExists) {
      return res.status(404).json({ message: "Studio not found" });
    }

    let conversation = await Conversation.findOne({
      client: clientId,
      studio: studioId,
    }).populate("studio", "studioName studioPictures");

    if (!conversation) {
      conversation = await Conversation.create({
        client: clientId,
        studio: studioId,
      });
      // Populate it before sending
      conversation = await Conversation.findById(conversation._id).populate(
        "studio",
        "studioName studioPictures",
      );
    }

    res.status(200).json(conversation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to initiate chat" });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userRole = req.user.role;

    const conversation = await findAuthorizedConversation(
      req,
      res,
      conversationId,
    );
    if (!conversation) return;

    // Determine which counter to reset based on who is looking at the chat
    const updateField =
      userRole === "studioAdmin"
        ? { unreadCountStudio: 0 }
        : { unreadCountClient: 0 };

    await Conversation.findByIdAndUpdate(conversationId, updateField);

    res.status(200).json({ message: "Chat marked as read" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to mark as read" });
  }
};
