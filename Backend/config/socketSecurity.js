const mongoose = require("mongoose");
const Conversation = require("../models/Messaging/Conversation");
const User = require("../models/UserData/User");
const { logAuthError } = require("../helper/authSecurity");
const { getAuthVersion, verifyAuthToken } = require("../helper/authToken");
const { idsEqual, isDevTeam, isStudioAdmin } = require("../helper/authorization");

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const SOCKET_TOKEN_MAX_LENGTH = 4096;
const DEFAULT_SOCKET_AUTH_REVALIDATE_MS = 60 * 1000;
const MIN_SOCKET_AUTH_REVALIDATE_MS = 10 * 1000;
const MAX_SOCKET_AUTH_REVALIDATE_MS = 5 * 60 * 1000;
const MAX_TIMEOUT_DELAY_MS = 2_147_000_000;

const getSocketToken = (socket) => {
  const authToken = socket.handshake?.auth?.token;
  if (
    typeof authToken === "string" &&
    authToken.length > 0 &&
    authToken.length <= SOCKET_TOKEN_MAX_LENGTH
  ) {
    return authToken;
  }

  const authorization = socket.handshake?.headers?.authorization;
  if (
    typeof authorization !== "string" ||
    authorization.length > SOCKET_TOKEN_MAX_LENGTH
  ) {
    return null;
  }

  const [scheme, token, extra] = authorization.trim().split(/\s+/);
  return !extra && /^Bearer$/i.test(scheme) && token ? token : null;
};

const rejectRoomJoin = (socket, acknowledge) => {
  const response = { ok: false, code: "ROOM_ACCESS_DENIED" };
  if (typeof acknowledge === "function") acknowledge(response);
  else socket.emit("room_error", response);
};

const acceptRoomJoin = (acknowledge) => {
  if (typeof acknowledge === "function") acknowledge({ ok: true });
};

const getSocketAuthRevalidateMs = () => {
  const configured = Number.parseInt(
    process.env.SOCKET_AUTH_REVALIDATE_MS || "",
    10,
  );
  if (!Number.isSafeInteger(configured)) {
    return DEFAULT_SOCKET_AUTH_REVALIDATE_MS;
  }
  return Math.min(
    MAX_SOCKET_AUTH_REVALIDATE_MS,
    Math.max(MIN_SOCKET_AUTH_REVALIDATE_MS, configured),
  );
};

const getSocketExpiryDelay = (decoded, now = Date.now()) => {
  if (!Number.isSafeInteger(decoded?.exp)) return 0;
  return Math.max(0, decoded.exp * 1000 - now);
};

const normalizeOptionalId = (value) => value?.toString() || null;

const toSocketSecuritySnapshot = (user) => ({
  authVersion: getAuthVersion(user),
  role: user?.role || null,
  adminStudioLocation: normalizeOptionalId(user?.adminStudioLocation),
});

const isSocketSecurityStateCurrent = (decoded, snapshot, user) =>
  Boolean(
    user &&
      decoded?.id === user._id?.toString() &&
      decoded.ver === getAuthVersion(user) &&
      snapshot?.authVersion === getAuthVersion(user) &&
      snapshot?.role === (user.role || null) &&
      snapshot?.adminStudioLocation ===
        normalizeOptionalId(user.adminStudioLocation),
  );

const findSocketUser = (userId) =>
  User.findById(userId)
    .select("_id role adminStudioLocation authVersion")
    .lean();

const revalidateSocketAuthentication = async (socket, now = Date.now()) => {
  const decoded = socket.data?.auth;
  if (!decoded || getSocketExpiryDelay(decoded, now) === 0) {
    return { code: "TOKEN_EXPIRED", valid: false };
  }

  const user = await findSocketUser(decoded.id);
  if (
    !isSocketSecurityStateCurrent(
      decoded,
      socket.data.securitySnapshot,
      user,
    )
  ) {
    return { code: "SESSION_REVOKED", valid: false };
  }

  socket.data.user = user;
  return { user, valid: true };
};

const disconnectUnauthorizedSocket = (socket, code) => {
  socket.emit("authentication_error", { code });
  socket.disconnect(true);
};

const requireCurrentSocketAuthentication = async (socket, acknowledge) => {
  try {
    const result = await revalidateSocketAuthentication(socket);
    if (result.valid) return result.user;

    rejectRoomJoin(socket, acknowledge);
    disconnectUnauthorizedSocket(socket, result.code);
    return null;
  } catch (error) {
    logAuthError("Socket authorization refresh failed", error);
    rejectRoomJoin(socket, acknowledge);
    disconnectUnauthorizedSocket(socket, "SESSION_REVOKED");
    return null;
  }
};

const canAccessConversation = (user, conversation) =>
  isDevTeam(user) ||
  idsEqual(user?._id, conversation?.client) ||
  (isStudioAdmin(user) &&
    idsEqual(user.adminStudioLocation, conversation?.studio));

const configureAuthenticatedSockets = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = getSocketToken(socket);
      if (!token) return next(new Error("Not authorized"));

      const decoded = verifyAuthToken(token);
      const user = await User.findById(decoded.id)
        .select("_id role adminStudioLocation authVersion")
        .lean();
      if (!user || decoded.ver !== getAuthVersion(user)) {
        return next(new Error("Not authorized"));
      }

      socket.data.auth = decoded;
      socket.data.securitySnapshot = toSocketSecuritySnapshot(user);
      socket.data.user = user;
      return next();
    } catch (error) {
      logAuthError("Socket authentication failed", error);
      return next(new Error("Not authorized"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;
    const userId = user._id.toString();

    // Notification rooms are derived from the verified identity. Legacy join
    // events remain supported, but cannot be used to join another user's room.
    socket.join(userId);
    if (isStudioAdmin(user) && user.adminStudioLocation) {
      socket.join(user.adminStudioLocation.toString());
    }

    let revalidationInProgress = false;
    let expiryTimer;
    const scheduleExpiryDisconnect = () => {
      const remaining = getSocketExpiryDelay(socket.data.auth);
      if (remaining === 0) {
        expiryTimer = setTimeout(
          () => disconnectUnauthorizedSocket(socket, "TOKEN_EXPIRED"),
          0,
        );
        expiryTimer.unref?.();
        return;
      }

      expiryTimer = setTimeout(
        remaining > MAX_TIMEOUT_DELAY_MS
          ? scheduleExpiryDisconnect
          : () => disconnectUnauthorizedSocket(socket, "TOKEN_EXPIRED"),
        Math.min(remaining, MAX_TIMEOUT_DELAY_MS),
      );
      expiryTimer.unref?.();
    };
    scheduleExpiryDisconnect();

    const revalidationTimer = setInterval(async () => {
      if (revalidationInProgress) return;
      revalidationInProgress = true;
      try {
        const result = await revalidateSocketAuthentication(socket);
        if (!result.valid) {
          disconnectUnauthorizedSocket(socket, result.code);
        }
      } catch (error) {
        logAuthError("Socket authorization refresh failed", error);
        disconnectUnauthorizedSocket(socket, "SESSION_REVOKED");
      } finally {
        revalidationInProgress = false;
      }
    }, getSocketAuthRevalidateMs());
    revalidationTimer.unref?.();

    socket.on("disconnect", () => {
      if (expiryTimer) clearTimeout(expiryTimer);
      clearInterval(revalidationTimer);
    });

    socket.on("join_user_room", async (requestedUserId, acknowledge) => {
      const currentUser = await requireCurrentSocketAuthentication(
        socket,
        acknowledge,
      );
      if (!currentUser) return;
      if (!idsEqual(requestedUserId, currentUser._id)) {
        return rejectRoomJoin(socket, acknowledge);
      }
      socket.join(userId);
      return acceptRoomJoin(acknowledge);
    });

    socket.on("join_studio_admin_room", async (
      requestedStudioId,
      acknowledge,
    ) => {
      const currentUser = await requireCurrentSocketAuthentication(
        socket,
        acknowledge,
      );
      if (!currentUser) return;
      if (
        !isStudioAdmin(currentUser) ||
        !idsEqual(requestedStudioId, currentUser.adminStudioLocation)
      ) {
        return rejectRoomJoin(socket, acknowledge);
      }
      socket.join(currentUser.adminStudioLocation.toString());
      return acceptRoomJoin(acknowledge);
    });

    socket.on("join_chat", async (conversationId, acknowledge) => {
      const currentUser = await requireCurrentSocketAuthentication(
        socket,
        acknowledge,
      );
      if (!currentUser) return;
      if (
        typeof conversationId !== "string" ||
        !OBJECT_ID_PATTERN.test(conversationId) ||
        !mongoose.isValidObjectId(conversationId)
      ) {
        return rejectRoomJoin(socket, acknowledge);
      }

      try {
        const conversation = await Conversation.findById(conversationId)
          .select("client studio")
          .lean();
        if (
          !conversation ||
          !canAccessConversation(currentUser, conversation)
        ) {
          return rejectRoomJoin(socket, acknowledge);
        }

        socket.join(conversation._id.toString());
        return acceptRoomJoin(acknowledge);
      } catch (error) {
        logAuthError("Socket room authorization failed", error);
        return rejectRoomJoin(socket, acknowledge);
      }
    });
  });
};

module.exports = {
  canAccessConversation,
  configureAuthenticatedSockets,
  getSocketAuthRevalidateMs,
  getSocketExpiryDelay,
  getSocketToken,
  isSocketSecurityStateCurrent,
  revalidateSocketAuthentication,
  toSocketSecuritySnapshot,
};
