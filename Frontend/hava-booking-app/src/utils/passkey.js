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
