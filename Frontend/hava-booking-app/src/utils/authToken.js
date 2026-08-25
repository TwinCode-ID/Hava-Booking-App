const ACCESS_TOKEN_KEY = "token";
const LEGACY_AUTH_KEYS = ["refreshToken", "user"];

export const AUTH_SESSION_INVALID_EVENT = "hava:auth-session-invalid";
export const AUTH_TOKEN_ROTATED_EVENT = "hava:auth-token-rotated";

const getStorage = () => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const normalizeJwt = (token) => {
  if (typeof token !== "string") return null;

  const normalized = token.trim();
  if (normalized.length === 0 || normalized.length > 4096) return null;

  const segments = normalized.split(".");
  const isJwt =
    segments.length === 3 &&
    segments.every(
      (segment) => segment.length > 0 && /^[A-Za-z0-9_-]+$/.test(segment),
    );

  return isJwt ? normalized : null;
};

export const normalizeAccessToken = (token) => normalizeJwt(token);

export const getAccessToken = () => {
  const storage = getStorage();
  if (!storage) return null;

  let storedToken;
  try {
    storedToken = storage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
  const token = normalizeJwt(storedToken);

  if (storedToken && !token) {
    try {
      storage.removeItem(ACCESS_TOKEN_KEY);
    } catch {
      // Treat inaccessible storage the same as a signed-out session.
    }
  }
  return token;
};

export const storeAccessToken = (token) => {
  const normalized = normalizeJwt(token);
  if (!normalized) throw new Error("The server returned an invalid access token.");

  const storage = getStorage();
  if (!storage) throw new Error("Browser storage is unavailable.");

  try {
    storage.setItem(ACCESS_TOKEN_KEY, normalized);
    LEGACY_AUTH_KEYS.forEach((key) => storage.removeItem(key));
  } catch {
    throw new Error("Browser storage is unavailable.");
  }
  return normalized;
};

export const clearStoredAuth = () => {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.removeItem(ACCESS_TOKEN_KEY);
    LEGACY_AUTH_KEYS.forEach((key) => storage.removeItem(key));
  } catch {
    // There is no recoverable client-side action when storage is blocked.
  }
};

export const notifyInvalidAuthSession = () => {
  clearStoredAuth();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_SESSION_INVALID_EVENT));
  }
};

export const notifyAuthTokenRotated = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_TOKEN_ROTATED_EVENT));
  }
};
