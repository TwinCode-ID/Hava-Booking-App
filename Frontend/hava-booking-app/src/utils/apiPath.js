export const BASE_URL = import.meta.env.VITE_BASE_URL;

export const API_PATHS = {
  AUTH: {
    REGISTER: "/api/auth/register",
    LOGIN: "/api/auth/login",
    GET_PROFILE: "/api/auth/me",
    VERIFY_OTP: "/api/auth/otp/verify",
    REQUEST_OTP: "/api/auth/otp/request",
  },

  IMAGE: {
    UPLOAD_IMAGE: "/api/auth/upload-image",
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
    GET_ALL_ADMIN: (studioId) => `/api/purchases/studio/${studioId}`,
    REVIEW_PURCHASE: (purchaseId) => `/api/purchases/${purchaseId}/review`,
  },
};
