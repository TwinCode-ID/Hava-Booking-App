// Dial codes offered by the phone sign-in field. The studio's home country
// leads the list; the rest are alphabetical.
export const COUNTRY_CODES = [
  { iso: "ID", name: "Indonesia", dialCode: "+62", flag: "🇮🇩" },
  { iso: "AU", name: "Australia", dialCode: "+61", flag: "🇦🇺" },
  { iso: "AT", name: "Austria", dialCode: "+43", flag: "🇦🇹" },
  { iso: "BE", name: "Belgium", dialCode: "+32", flag: "🇧🇪" },
  { iso: "BN", name: "Brunei", dialCode: "+673", flag: "🇧🇳" },
  { iso: "KH", name: "Cambodia", dialCode: "+855", flag: "🇰🇭" },
  { iso: "CA", name: "Canada", dialCode: "+1", flag: "🇨🇦" },
  { iso: "CN", name: "China", dialCode: "+86", flag: "🇨🇳" },
  { iso: "DK", name: "Denmark", dialCode: "+45", flag: "🇩🇰" },
  { iso: "EG", name: "Egypt", dialCode: "+20", flag: "🇪🇬" },
  { iso: "FI", name: "Finland", dialCode: "+358", flag: "🇫🇮" },
  { iso: "FR", name: "France", dialCode: "+33", flag: "🇫🇷" },
  { iso: "DE", name: "Germany", dialCode: "+49", flag: "🇩🇪" },
  { iso: "GR", name: "Greece", dialCode: "+30", flag: "🇬🇷" },
  { iso: "HK", name: "Hong Kong", dialCode: "+852", flag: "🇭🇰" },
  { iso: "IN", name: "India", dialCode: "+91", flag: "🇮🇳" },
  { iso: "IE", name: "Ireland", dialCode: "+353", flag: "🇮🇪" },
  { iso: "IL", name: "Israel", dialCode: "+972", flag: "🇮🇱" },
  { iso: "IT", name: "Italy", dialCode: "+39", flag: "🇮🇹" },
  { iso: "JP", name: "Japan", dialCode: "+81", flag: "🇯🇵" },
  { iso: "LA", name: "Laos", dialCode: "+856", flag: "🇱🇦" },
  { iso: "MY", name: "Malaysia", dialCode: "+60", flag: "🇲🇾" },
  { iso: "MX", name: "Mexico", dialCode: "+52", flag: "🇲🇽" },
  { iso: "MM", name: "Myanmar", dialCode: "+95", flag: "🇲🇲" },
  { iso: "NL", name: "Netherlands", dialCode: "+31", flag: "🇳🇱" },
  { iso: "NZ", name: "New Zealand", dialCode: "+64", flag: "🇳🇿" },
  { iso: "NO", name: "Norway", dialCode: "+47", flag: "🇳🇴" },
  { iso: "PK", name: "Pakistan", dialCode: "+92", flag: "🇵🇰" },
  { iso: "PH", name: "Philippines", dialCode: "+63", flag: "🇵🇭" },
  { iso: "PL", name: "Poland", dialCode: "+48", flag: "🇵🇱" },
  { iso: "PT", name: "Portugal", dialCode: "+351", flag: "🇵🇹" },
  { iso: "QA", name: "Qatar", dialCode: "+974", flag: "🇶🇦" },
  { iso: "RU", name: "Russia", dialCode: "+7", flag: "🇷🇺" },
  { iso: "SA", name: "Saudi Arabia", dialCode: "+966", flag: "🇸🇦" },
  { iso: "SG", name: "Singapore", dialCode: "+65", flag: "🇸🇬" },
  { iso: "ZA", name: "South Africa", dialCode: "+27", flag: "🇿🇦" },
  { iso: "KR", name: "South Korea", dialCode: "+82", flag: "🇰🇷" },
  { iso: "ES", name: "Spain", dialCode: "+34", flag: "🇪🇸" },
  { iso: "SE", name: "Sweden", dialCode: "+46", flag: "🇸🇪" },
  { iso: "CH", name: "Switzerland", dialCode: "+41", flag: "🇨🇭" },
  { iso: "TW", name: "Taiwan", dialCode: "+886", flag: "🇹🇼" },
  { iso: "TH", name: "Thailand", dialCode: "+66", flag: "🇹🇭" },
  { iso: "TR", name: "Turkey", dialCode: "+90", flag: "🇹🇷" },
  { iso: "AE", name: "United Arab Emirates", dialCode: "+971", flag: "🇦🇪" },
  { iso: "GB", name: "United Kingdom", dialCode: "+44", flag: "🇬🇧" },
  { iso: "US", name: "United States", dialCode: "+1", flag: "🇺🇸" },
  { iso: "VN", name: "Vietnam", dialCode: "+84", flag: "🇻🇳" },
];

export const DEFAULT_COUNTRY =
  COUNTRY_CODES.find((country) => country.iso === "ID") || COUNTRY_CODES[0];

// Longest dial code first so "+62" never shadows "+6" style prefixes.
const COUNTRIES_BY_DIAL_LENGTH = [...COUNTRY_CODES].sort(
  (a, b) => b.dialCode.length - a.dialCode.length,
);

export const findCountryByDialCode = (value) => {
  if (typeof value !== "string" || !value.startsWith("+")) return null;
  return (
    COUNTRIES_BY_DIAL_LENGTH.find((country) =>
      value.startsWith(country.dialCode),
    ) || null
  );
};

// The national part is digits only; the country code carries the plus sign and
// the trunk "0" is dropped because the country code replaces it.
export const toNationalDigits = (value) =>
  String(value ?? "")
    .replace(/\D/g, "")
    .replace(/^0+/, "")
    .slice(0, 15);

export const toE164 = (dialCode, nationalNumber) => {
  const digits = toNationalDigits(nationalNumber);
  if (!digits) return "";
  return `${dialCode}${digits}`;
};

// Splits a stored number back into the two halves the picker edits. Profiles
// captured before sign-in used phone numbers hold free-form local notation
// ("0812-3456-7890") with no country code at all, so anything unrecognisable
// falls back to the studio's home country rather than being dropped.
export const splitPhoneNumber = (value) => {
  const compact = String(value ?? "")
    .trim()
    .replace(/[()\-./\s]/g, "");
  if (!compact) return { country: DEFAULT_COUNTRY, nationalNumber: "" };

  // "00" is the international access prefix and means the same as a plus.
  const international = compact.startsWith("00")
    ? `+${compact.slice(2)}`
    : compact;

  if (international.startsWith("+")) {
    const country = findCountryByDialCode(international);
    if (country) {
      return {
        country,
        nationalNumber: toNationalDigits(
          international.slice(country.dialCode.length),
        ),
      };
    }
  }

  // Some stored numbers carry the home country's code with no plus sign at
  // all ("6281234567890"). Only the home code is tested, because a bare
  // national number would otherwise collide with another country's code — an
  // Indonesian "81234567890" starts with Japan's 81. The API normalizes this
  // notation by the same rule.
  const homeDigits = DEFAULT_COUNTRY.dialCode.slice(1);
  if (compact.startsWith(homeDigits) && compact.length > homeDigits.length) {
    return {
      country: DEFAULT_COUNTRY,
      nationalNumber: toNationalDigits(compact.slice(homeDigits.length)),
    };
  }

  return {
    country: DEFAULT_COUNTRY,
    nationalNumber: toNationalDigits(compact),
  };
};

// One canonical string for comparing a number the member is editing against
// the one already saved, whichever notation each of them is in.
export const toComparablePhoneNumber = (value) => {
  const { country, nationalNumber } = splitPhoneNumber(value);
  return nationalNumber ? toE164(country.dialCode, nationalNumber) : "";
};

export const formatPhoneNumber = (dialCode, nationalNumber) => {
  const digits = toNationalDigits(nationalNumber);
  if (!digits) return dialCode;
  return `${dialCode} ${digits.replace(/(\d{3,4})(?=\d)/g, "$1 ").trim()}`;
};
