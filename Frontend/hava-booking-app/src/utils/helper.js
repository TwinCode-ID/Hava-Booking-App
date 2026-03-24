export const fetchImage = (url) => {
  if (!url) {
    return null;
  }
  const separator = url.includes("?") ? "&" : "?";
  const finalUrl = `${url}${separator}x-api-key=${import.meta.env.VITE_INTERNAL_API_KEY}`;
  return finalUrl;
};

//Validate Email
export const validateEmail = (email) => {
  if (!email.trim()) return "Email is required";
  const emailRegex = /^[^\s@]+@[^\s@]+\.+[^\s@]+$/;
  if (!emailRegex.test(email)) return "Please enter a valid email address";
  return "";
};

//Validate Password
export const validatePassword = (password) => {
  if (!password) return "password is required";
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/(?=.*[a-z])/.test(password))
    return "Password must be at least one lowercase letter";
  if (!/(?=.*[A-Z])/.test(password))
    return "Password must be at least one uppercase letter";
  if (!/(?=.*\d)/.test(password))
    return "Password must contain at least one number";
  return "";
};

// Validate Phone Number
export const validatePhoneNumber = (phone) => {
  if (!phone) return "Phone number is required";

  // Check for valid characters (numbers, spaces, dashes, plus sign, parentheses)
  if (!/^[0-9+\-\s()]*$/.test(phone)) {
    return "Phone number contains invalid characters";
  }

  // Count actual digits to check length
  const digits = phone.replace(/\D/g, ""); // Remove everything except numbers

  if (digits.length < 10) {
    return "Phone number must be at least 10 digits";
  }

  if (digits.length > 15) {
    return "Phone number is too long";
  }

  return "";
};

export const validateAvatar = (file) => {
  if (!file) return ""; // Optional

  // 1. Allow ANY image type (including image/heic, image/webp, etc.)
  if (!file.type.startsWith("image/")) {
    // Some phones don't pass the mime type correctly for HEIC,
    // so we can also check the extension as a fallback
    const extension = file.name.split(".").pop().toLowerCase();
    const validExtensions = ["jpg", "jpeg", "png", "heic", "heif", "webp"];

    if (!validExtensions.includes(extension)) {
      return "File must be a valid image format.";
    }
  }

  // 2. Increase limit to 50MB (Backend will compress it anyway)
  const maxSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSize) {
    return "Image is too large. Must be less than 50MB.";
  }

  return "";
};

export const pad = (number) => {
  return number < 10 ? "0" + number : number.toString();
};

export const toCRC16 = (input) => {
  function charCodeAt(input, i) {
    return input.charCodeAt(i);
  }

  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= charCodeAt(input, i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }

  let hex = (crc & 0xffff).toString(16).toUpperCase();
  return hex.length === 3 ? "0" + hex : hex;
};

export const getBetween = (str, start, end) => {
  let startIdx = str.indexOf(start);
  if (startIdx === -1) return "";
  startIdx += start.length;
  let endIdx = str.indexOf(end, startIdx);
  return str.slice(startIdx, endIdx);
};

export const dataQris = (qris) => {
  const nmid = "ID" + getBetween(qris, "15ID", "0303");
  const id = qris.includes("A01") ? "A01" : "01";
  const merchantName = getBetween(qris, "ID59", "60")
    .substring(2)
    .trim()
    .toUpperCase();

  const printData = qris.match(/(?<=ID|COM).+?(?=0118)/g);
  const printCount = printData.length;
  const printerName = printData[printCount - 1].split(".");
  const printer = printerName.length === 3 ? printerName[1] : printerName[2];

  const nnsData = qris.match(/(?<=0118).+?(?=ID)/g);
  const nns = nnsData[nnsData.length - 1].substring(0, 8);

  const crcInput = qris.slice(0, -4);
  const crcFromQris = qris.slice(-3);
  const crcComputed = toCRC16(crcInput);

  return {
    nmid: nmid,
    id: id,
    merchantName: merchantName,
    printer: printer,
    nns: nns,
    crcIsValid: crcFromQris === crcComputed,
  };
};

export const INDONESIAN_BANKS = [
  "BCA",
  "Bank Mandiri",
  "BNI",
  "BRI",
  "BSI (Bank Syariah Indonesia)",
  "BTN",
  "CIMB Niaga",
  "PermataBank",
  "Danamon",
  "Bank Mega",
  "OCBC NISP",
  "PaninBank",
  "Bank Jago",
  "SeaBank",
  "Blu",
  "Jenius",
  "Allo Bank",
  "GoPay",
  "OVO",
  "DANA",
  "ShopeePay",
  "LinkAja",
  "OTHER",
];
