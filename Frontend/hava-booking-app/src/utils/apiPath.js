const configuredBaseUrl = import.meta.env.VITE_BASE_URL?.trim();

if (!configuredBaseUrl) {
  throw new Error("VITE_BASE_URL is required.");
}

const parsedBaseUrl = new URL(configuredBaseUrl);
if (parsedBaseUrl.username || parsedBaseUrl.password) {
  throw new Error("VITE_BASE_URL must not contain credentials.");
}
if (import.meta.env.PROD && parsedBaseUrl.protocol !== "https:") {
  throw new Error("VITE_BASE_URL must use HTTPS in production.");
}

export const BASE_URL = configuredBaseUrl.replace(/\/+$/, "");

export const API_PATHS = {
  AUTH: {
    REGISTER: "/api/auth/register",
    // Phone-only registrations wait here until staff activate them, because no
    // SMS gateway exists to verify the number.
    PENDING_SIGNUPS: "/api/auth/pending-signups",
    APPROVE_PENDING_SIGNUP: (id) => `/api/auth/pending-signups/${id}/approve`,
    REJECT_PENDING_SIGNUP: (id) => `/api/auth/pending-signups/${id}/reject`,
    LOGIN: "/api/auth/login",
    PHONE_LOGIN: "/api/auth/phone/login",
    PHONE_SET_PASSWORD: "/api/auth/phone/set-password",
    GET_PROFILE: "/api/auth/me",
    GET_PROFILE_BY_ID: (id) => `/api/user/${id}`,
    DELETE_USER: (id) => `/api/user/${id}`,
    UPDATE_PROFILE_ADMIN: (id) => `/api/user/profile/${id}`,
    GET_ALL_USERS: "/api/user/all",
    VERIFY_OTP: "/api/auth/otp/verify",
    REQUEST_OTP: "/api/auth/otp/request",
    MEDICAL_INFO: (id) => `/api/medical/${id}`,
    VERIFY_PASSWORD: "/api/auth/verify-password",
    CHECK_STATUS: "api/auth/check-status",
    SET_NEW_PASSWORD: "api/user/set-password",
    UPDATE_PROFILE: "api/user/profile",
    UPDATE_PASSWORD: "api/user/update-password",
  },

  DEV: {
    GET_METRICS: "/api/user/metrics",
  },

  IMAGE: {
    UPLOAD_PROFILE: "/api/auth/upload-profile",
    UPLOAD_PROOF: "/api/auth/upload-proof",
    UPLOAD_STUDIO: "/api/auth/upload-studio",
  },

  STUDIOS: {
    GET_ALL: "/api/studio",
    CREATE: "/api/studio",
    UPDATE: (id) => `/api/studio/${id}`,
    DELETE: (id) => `/api/studio/${id}`,
  },

  PACKAGES: {
    GET_ALL: "/api/package",
    GET_PACKAGE_BY_ID: (id) => `/api/package/${id}`,
    GET_PAYMENT_INSTRUCTIONS: (id) =>
      `/api/package/${id}/payment-instructions`,
    GET_PACKAGE_BY_STUDIO: (studioId) => `/api/package/studio/${studioId}`,
    CREATE_PACKAGE: "/api/package",
    UPDATE_PACKAGE: (id) => `/api/package/${id}`,
    DELETE_PACKAGE: (id) => `/api/package/${id}`,
    SET_PACKAGE_STATUS: (id) => `/api/package/${id}/set-package-status`,
  },

  PURCHASES: {
    CREATE: "/api/purchases",
    GET_ALL_ADMIN: (studioId) => `/api/purchases/studio/${studioId}`,
    GET_ALL_USER: (userId) => `/api/purchases/user/${userId}`,
    REVIEW_PURCHASE: (purchaseId) => `/api/purchases/${purchaseId}/review`,
    UPLOAD_PROOF: (purchaseId) => `/api/purchases/${purchaseId}/proof`,
  },

  PASSES: {
    GET_ALL_ACTIVE_PASS: (userId) => `/api/passes/user/active/${userId}`,
    GET_ALL_INACTIVE_PASS: (userId) => `/api/passes/user/inactive/${userId}`,
    GET_ALL_ADMIN: (studioId) => `/api/passes/history/${studioId}`,
    UPDATE_PASS: (passId) => `/api/passes/update/${passId}`,
  },

  INSTRUCTOR: {
    GET_ALL: "/api/instructor/",
    CREATE_INSTRUCTOR: "/api/instructor/create-instructor",
    DELETE_INSTRUCTOR: (instructorId) => `/api/instructor/${instructorId}`,
    UPDATE_INSTRUCTOR: (instructorId) =>
      `/api/instructor/${instructorId}/update-profile`,
    TOGGLE_INSTRUCTOR: (instructorId) => `/api/instructor/${instructorId}`,
  },

  STUDIO: {
    GET_ALL: "/api/studio",
    GET_STUDIO_BY_ID: (studioId) => `/api/studio/${studioId}`,
    GET_PAYMENT_INSTRUCTIONS: (studioId) =>
      `/api/studio/${studioId}/payment-instructions`,
    UPDATE_STUDIO_BY_ID: (studioId) => `/api/studio/${studioId}`,
  },

  SCHEDULE: {
    GET_ALL: "/api/schedule",
    GET_BY_STUDIO_ID: (studioId) => `/api/schedule/${studioId}`,
    CREATE_SCHEDULE: "/api/schedule",
    DELETE_SCHEDULE: (classId) => `/api/schedule/${classId}`,
    UPDATE_SCHEDULE: (classId) => `/api/schedule/${classId}`,
    TOGGLE_ISACTIVE_SCHEDULE: (classId) => `/api/schedule/toggle/${classId}`,
  },

  BOOKING: {
    GET_ALL: "/api/bookings",
    GET_STUDIO_BOOKING: "/api/bookings/studio",
    CREATE_BOOKING: "/api/bookings",
    CANCEL_BOOKING: "/api/bookings/cancel",
    STUDENT_CHECK_IN: (bookingId) => `/api/bookings/${bookingId}`,
    GET_CLASS_BOOKINGS: (classId) => `/api/bookings/class/${classId}`,
  },

  CONFIG: {
    GET: (studioId) => `/api/config/${studioId}`,
    ADD: (studioId) => `/api/config/add/${studioId}`,
    REMOVE: (studioId) => `/api/config/remove/${studioId}`,
  },

  CHAT: {
    GET_CONVERSATIONS: "/api/chat/conversations",
    GET_MESSAGES: (conversationId) => `/api/chat/${conversationId}/messages`,
    SEND_MESSAGE: "/api/chat/send",
    INITIATE: "/api/chat/initiate",
    MARK_READ: (conversationId) => `/api/chat/${conversationId}/read`,
  },

  PASSKEY: {
    REGISTER_START: "/api/user/passkey/register-start",
    REGISTER_FINISH: "/api/user/passkey/register-finish",
    LOGIN_START: "/api/user/passkey/login-start",
    LOGIN_FINISH: "/api/user/passkey/login-finish",
    LIST: "/api/user/passkey",
    DELETE: (authenticatorId) =>
      `/api/user/passkey/${encodeURIComponent(authenticatorId)}`,
  },

  APPLE: {
    LOGIN: "/api/auth/apple-web",
  },

  GOOGLE: {
    LOGIN: "/api/auth/google",
  },
};
