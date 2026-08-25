import axios from "axios";
import { BASE_URL } from "./apiPath";
import {
  getAccessToken,
  notifyAuthTokenRotated,
  notifyInvalidAuthSession,
  storeAccessToken,
} from "./authToken";

const API_ORIGIN = new URL(BASE_URL).origin;

const targetsConfiguredApi = (config) => {
  try {
    const requestUrl = new URL(config.url || "", config.baseURL || BASE_URL);
    return requestUrl.origin === API_ORIGIN;
  } catch {
    return false;
  }
};

const getRequestAccessToken = (config) => {
  const headers = config?.headers;
  const authorization =
    (typeof headers?.get === "function" && headers.get("Authorization")) ||
    headers?.Authorization ||
    headers?.authorization;

  if (typeof authorization !== "string") return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
};

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 80000,
  headers: {
    Accept: "application/json",
  },
});

// Request Interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    const accessToken = getAccessToken();
    const hasAuthorization =
      config.headers?.has?.("Authorization") || config.headers?.Authorization;
    if (
      accessToken &&
      targetsConfiguredApi(config) &&
      !hasAuthorization
    ) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

axiosInstance.interceptors.response.use(
  (response) => {
    const data = response?.data;
    if (
      targetsConfiguredApi(response.config || {}) &&
      data?.code === "AUTHENTICATION_METHOD_CHANGED" &&
      data?.reauthenticationRequired === false &&
      typeof data?.token === "string"
    ) {
      const previousToken = getAccessToken();
      const nextToken = storeAccessToken(data.token);
      if (nextToken !== previousToken) notifyAuthTokenRotated();
    }
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const code = error.response?.data?.code;
    const message = error.response?.data?.message;
    const isSessionFailure =
      targetsConfiguredApi(error.config || {}) &&
      status === 401 &&
      (code === "AUTH_REQUIRED" ||
        code === "INVALID_TOKEN" ||
        code === "TOKEN_EXPIRED" ||
        code === "SESSION_REVOKED" ||
        (typeof message === "string" && message.startsWith("Not authorized")));

    const failedRequestToken = getRequestAccessToken(error.config);
    const currentToken = getAccessToken();
    const supersededRequest =
      failedRequestToken && currentToken && failedRequestToken !== currentToken;

    if (isSessionFailure && !supersededRequest) notifyInvalidAuthSession();
    return Promise.reject(error);
  },
);

export default axiosInstance;
