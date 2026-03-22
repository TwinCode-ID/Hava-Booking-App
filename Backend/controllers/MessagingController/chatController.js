const Conversation = require("../../models/Messaging/Conversation");
const Message = require("../../models/Messaging/Message");

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
    const { conversationId, text, receiverId } = req.body;
    const senderId = req.user._id;
    const senderRole = req.user.role;

    // Save the new message
    const newMessage = await Message.create({
      conversationId,
      sender: senderId,
      text,
    });

    // Determine who needs their unread counter increased
    const updateField =
      senderRole === "studioAdmin"
        ? { $inc: { unreadCountClient: 1 } }
        : { $inc: { unreadCountStudio: 1 } };

    // Update the conversation's last message and timestamp
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: text,
      lastMessageAt: Date.now(),
      ...updateField,
    });

    // Populate sender info before sending back to frontend
    const populatedMessage = await Message.findById(newMessage._id).populate(
      "sender",
      "fullName avatar role",
    );

    const io = req.app.get("io");
    io.to(conversationId).emit("receive_message", populatedMessage);

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
