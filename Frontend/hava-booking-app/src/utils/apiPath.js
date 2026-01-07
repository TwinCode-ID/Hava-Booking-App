export const BASE_URL = import.meta.env.VITE_BASE_URL;

export const API_PATHS = {
  AUTH: {
    REGISTER: "/api/auth/register",
    LOGIN: "/api/auth/login",
    GET_PROFILE: "/api/auth/me",
    GET_PROFILE_BY_ID: (id) => `/api/user/${id}`,
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

  IMAGE: {
    UPLOAD_IMAGE: "/api/auth/upload-image",
    UPLOAD_PROOF: "/api/auth/upload-proof",
    UPLOAD_STUDIO: "/api/auth/upload-studio",
  },

  STUDIOS: {
    GET_ALL: "/api/studio",
    GET_STUDIO_BY_ID: (id) => `/api/studio/${id}`,
  },

  PACKAGES: {
    GET_ALL: "/api/package",
    GET_PACKAGE_BY_ID: (id) => `/api/package/${id}`,
    GET_PACKAGE_BY_STUDIO: (studioId) => `/api/package/studio/${studioId}`,
    CREATE_PACKAGE: "/api/package",
    UPDATE_PACKAGE: (id) => `/api/package/${id}`,
    DELETE_PACKAGE: (id) => `/api/package/${id}`,
    SET_PACKAGE_STATUS: (id) => `/api/package/${id}/set-package-status`,
  },

  PURCHASES: {
    CREATE: "/api/purchases",
    GET_ALL_ADMIN: (studioId) => `/api/purchases/studio/${studioId}`,
    REVIEW_PURCHASE: (purchaseId) => `/api/purchases/${purchaseId}/review`,
  },

  PASSES: {
    GET_ALL_ACTIVE_PASS: (userId) => `/api/passes/user/active/${userId}`,
    GET_ALL_INACTIVE_PASS: (userId) => `/api/passes/user/inactive/${userId}`,
    GET_ALL_ADMIN: (studioId) => `/api/passes/history/${studioId}`,
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
  },
};
