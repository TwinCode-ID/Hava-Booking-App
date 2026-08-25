import axiosInstance from "./axiosInstance";
import { API_PATHS } from "./apiPath";

const RECENT_AUTH_REQUIRED = "RECENT_AUTH_REQUIRED";
const STEP_UP_TOKEN_HEADER = "X-Step-Up-Token";

export const PASSKEY_STEP_UP_CANCELLED = "PasskeyStepUpCancelledError";

export const getSuggestedPasskeyName = () => {
  if (typeof navigator === "undefined") return "Passkey";

  const userAgent = navigator.userAgent || "";
  let browser = "Browser";
  let device = navigator.userAgentData?.platform || navigator.platform || "Device";

  if (/Edg\//.test(userAgent)) browser = "Edge";
  else if (/CriOS|Chrome\//.test(userAgent)) browser = "Chrome";
  else if (/FxiOS|Firefox\//.test(userAgent)) browser = "Firefox";
  else if (/Safari\//.test(userAgent)) browser = "Safari";

  if (/iPhone/.test(userAgent)) device = "iPhone";
  else if (/iPad/.test(userAgent)) device = "iPad";
  else if (/Android/.test(userAgent)) device = "Android device";
  else if (/Mac/.test(device)) device = "Mac";
  else if (/Win/.test(device)) device = "Windows device";
  else if (/Linux/.test(device)) device = "Linux device";

  return `${browser} on ${device}`;
};

const createStepUpCancelledError = () => {
  const error = new Error("Identity verification was cancelled.");
  error.name = PASSKEY_STEP_UP_CANCELLED;
  return error;
};

const requestPasswordStepUpToken = async () => {
  const password = window.prompt(
    "For your security, enter your current password to continue:",
  );
  if (password === null) throw createStepUpCancelledError();
  if (password.length === 0) {
    throw new Error("Your current password is required.");
  }

  const { data } = await axiosInstance.post(API_PATHS.AUTH.VERIFY_PASSWORD, {
    password,
  });
  if (typeof data?.stepUpToken !== "string" || !data.stepUpToken) {
    throw new Error("Identity verification did not complete.");
  }

  return data.stepUpToken;
};

// The scoped token exists only on this call stack and is never persisted in
// component state, browser storage, or Axios defaults.
export const withPasswordStepUp = async (request) => {
  try {
    return await request({});
  } catch (error) {
    if (
      error.response?.status !== 403 ||
      error.response?.data?.code !== RECENT_AUTH_REQUIRED
    ) {
      throw error;
    }

    const stepUpToken = await requestPasswordStepUpToken();
    return request({
      headers: { [STEP_UP_TOKEN_HEADER]: stepUpToken },
    });
  }
};
