const test = require("node:test");
const assert = require("node:assert/strict");

const Conversation = require("../models/Messaging/Conversation");
const Message = require("../models/Messaging/Message");
const RateLimitCounter = require("../models/Security/RateLimitCounter");
const { sendMessage } = require("../controllers/MessagingController/chatController");
const chatRouter = require("../routes/MessagingRoutes/chatRoutes");
const {
  CHAT_MESSAGE_LIMIT,
  CHAT_MESSAGE_WINDOW_MS,
  chatMessageLimiter,
} = require("../middlewares/rateLimitMiddleware");
const {
  MAX_CHAT_MESSAGE_BYTES,
} = require("../helper/chatSecurity");

const IDS = {
  conversation: "507f1f77bcf86cd799439010",
  message: "507f1f77bcf86cd799439011",
  studio: "507f1f77bcf86cd799439012",
  user: "507f1f77bcf86cd799439013",
};

const createResponse = () => ({
  body: undefined,
  headers: new Map(),
  statusCode: 200,
  getHeader(name) {
    return this.headers.get(name.toLowerCase());
  },
  json(body) {
    this.body = body;
    return this;
  },
  setHeader(name, value) {
    this.headers.set(name.toLowerCase(), value);
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
});

const createChatRequest = (text) => ({
  app: { get: () => null },
  body: { conversationId: IDS.conversation, text },
  user: { _id: IDS.user, role: "client" },
});

test("chat controller rejects messages larger than 4KB before database work", async () => {
  const originalConversationFindById = Conversation.findById;
  let conversationLookupCount = 0;
  Conversation.findById = async () => {
    conversationLookupCount += 1;
    return null;
  };

  try {
    for (const text of [
      "a".repeat(MAX_CHAT_MESSAGE_BYTES + 1),
      "é".repeat(MAX_CHAT_MESSAGE_BYTES / 2 + 1),
    ]) {
      const response = createResponse();
      await sendMessage(createChatRequest(text), response);
      assert.equal(response.statusCode, 400);
      assert.equal(response.body.code, "MESSAGE_TOO_LONG");
    }
    assert.equal(conversationLookupCount, 0);
  } finally {
    Conversation.findById = originalConversationFindById;
  }
});

test("chat controller trims once and stores the same bounded text in both records", async () => {
  const originalConversationFindById = Conversation.findById;
  const originalConversationUpdate = Conversation.findByIdAndUpdate;
  const originalMessageCreate = Message.create;
  const originalMessageFindById = Message.findById;
  let createdMessage;
  let conversationUpdate;

  Conversation.findById = async () => ({
    _id: IDS.conversation,
    client: IDS.user,
    studio: IDS.studio,
  });
  Conversation.findByIdAndUpdate = async (_id, update) => {
    conversationUpdate = update;
  };
  Message.create = async (attributes) => {
    createdMessage = attributes;
    return { _id: IDS.message };
  };
  Message.findById = () => ({
    populate: async () => ({ _id: IDS.message, ...createdMessage }),
  });

  try {
    const boundedText = "a".repeat(MAX_CHAT_MESSAGE_BYTES);
    const response = createResponse();
    await sendMessage(createChatRequest(`  ${boundedText}  `), response);

    assert.equal(response.statusCode, 201);
    assert.equal(createdMessage.text, boundedText);
    assert.equal(conversationUpdate.lastMessage, boundedText);
    assert.equal(
      Buffer.byteLength(createdMessage.text, "utf8"),
      MAX_CHAT_MESSAGE_BYTES,
    );
  } finally {
    Conversation.findById = originalConversationFindById;
    Conversation.findByIdAndUpdate = originalConversationUpdate;
    Message.create = originalMessageCreate;
    Message.findById = originalMessageFindById;
  }
});

test("message and conversation schemas enforce the 4KB cap", () => {
  assert.equal(Message.schema.path("text").options.maxlength, 4096);
  assert.equal(Conversation.schema.path("lastMessage").options.maxlength, 4096);

  const oversizedUtf8 = "é".repeat(MAX_CHAT_MESSAGE_BYTES / 2 + 1);
  const message = new Message({
    conversationId: IDS.conversation,
    sender: IDS.user,
    text: oversizedUtf8,
  });
  const conversation = new Conversation({
    client: IDS.user,
    studio: IDS.studio,
    lastMessage: oversizedUtf8,
  });

  assert.ok(message.validateSync()?.errors.text);
  assert.ok(conversation.validateSync()?.errors.lastMessage);
});

test("only the chat send route uses the dedicated limiter", () => {
  const routeLayers = chatRouter.stack.filter((layer) => layer.route);
  const sendRoute = routeLayers.find(
    (layer) => layer.route.path === "/send" && layer.route.methods.post,
  );
  assert.ok(sendRoute);
  assert.equal(sendRoute.route.stack[1].handle, chatMessageLimiter);

  for (const layer of routeLayers.filter((candidate) => candidate !== sendRoute)) {
    assert.equal(
      layer.route.stack.some((handler) => handler.handle === chatMessageLimiter),
      false,
    );
  }
});

test("chat limiter is a one-minute per-user Mongo-backed limit", async () => {
  assert.equal(CHAT_MESSAGE_LIMIT, 30);
  assert.equal(CHAT_MESSAGE_WINDOW_MS, 60_000);

  const originalFindOneAndUpdate = RateLimitCounter.findOneAndUpdate;
  const counterIds = [];
  RateLimitCounter.findOneAndUpdate = (filter) => {
    counterIds.push(filter._id);
    return {
      lean: async () => ({
        resetAt: new Date(Date.now() + CHAT_MESSAGE_WINDOW_MS),
        totalHits: 1,
      }),
    };
  };

  const runLimiter = async (userId, ip) => {
    const request = {
      app: {
        get: (setting) => (setting === "trust proxy" ? false : undefined),
      },
      headers: {},
      ip,
      method: "POST",
      path: "/send",
      socket: { remoteAddress: ip },
      user: { _id: userId },
    };
    const response = createResponse();
    let nextError;
    await chatMessageLimiter(request, response, (error) => {
      nextError = error;
    });
    assert.equal(nextError, undefined);
  };

  try {
    await runLimiter(IDS.user, "198.51.100.10");
    await runLimiter(IDS.user, "198.51.100.11");
    await runLimiter("507f1f77bcf86cd799439014", "198.51.100.10");

    assert.equal(counterIds.length, 3);
    assert.match(counterIds[0], /^chat-message:/);
    assert.equal(counterIds[0], counterIds[1]);
    assert.notEqual(counterIds[0], counterIds[2]);
  } finally {
    RateLimitCounter.findOneAndUpdate = originalFindOneAndUpdate;
  }
});
