// Phone numbers are an authentication identifier, so every comparison must run
// against one canonical representation. Profile numbers have historically been
// stored in free-form local notation ("0812-3456-7890"), while sign-in supplies
// an explicit country code, and both must resolve to the same E.164 value.

const PHONE_E164_PATTERN = /^\+[1-9]\d{7,14}$/;
const DIAL_CODE_PATTERN = /^\+[1-9]\d{0,3}$/;
const SEPARATOR_PATTERN = /[()\-./\s]/g;
const FALLBACK_DIAL_CODE = "+62";

// A national number keyed without a country code is only resolvable against an
// assumed country. Set PHONE_DEFAULT_COUNTRY_CODE to an empty string to refuse
// those numbers instead of assuming the studio's home country.
const getDefaultDialCode = () => {
  const configured = process.env.PHONE_DEFAULT_COUNTRY_CODE;
  if (typeof configured !== "string") return FALLBACK_DIAL_CODE;

  const trimmed = configured.trim();
  if (!trimmed) return null;
  return DIAL_CODE_PATTERN.test(trimmed) ? trimmed : null;
};

const normalizePhoneNumber = (value) => {
  if (typeof value !== "string") return null;

  const compact = value.trim().replace(SEPARATOR_PATTERN, "");
  if (!/^\+?\d{5,20}$/.test(compact)) return null;

  const dialCode = getDefaultDialCode();
  let candidate = null;

  if (compact.startsWith("+")) {
    candidate = compact;
  } else if (compact.startsWith("00")) {
    // International access prefix.
    candidate = `+${compact.slice(2)}`;
  } else if (compact.startsWith("0")) {
    // National trunk prefix; the leading zero is dropped by the country code.
    candidate = dialCode ? `${dialCode}${compact.slice(1)}` : null;
  } else if (dialCode && compact.startsWith(dialCode.slice(1))) {
    // Already carries the country code, just without the plus sign.
    candidate = `+${compact}`;
  } else if (dialCode) {
    candidate = `${dialCode}${compact}`;
  }

  return candidate && PHONE_E164_PATTERN.test(candidate) ? candidate : null;
};

const phoneNumbersMatch = (left, right) => {
  const normalizedLeft = normalizePhoneNumber(left);
  return Boolean(normalizedLeft) && normalizedLeft === normalizePhoneNumber(right);
};

// Only ever log or echo a partially redacted number.
const maskPhoneNumber = (value) => {
  const normalized = normalizePhoneNumber(value);
  if (!normalized) return "";
  return `${normalized.slice(0, 4)}${"•".repeat(
    Math.max(normalized.length - 7, 0),
  )}${normalized.slice(-3)}`;
};

module.exports = {
  FALLBACK_DIAL_CODE,
  PHONE_E164_PATTERN,
  getDefaultDialCode,
  maskPhoneNumber,
  normalizePhoneNumber,
  phoneNumbersMatch,
};
