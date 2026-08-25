const crypto = require("crypto");
const { getPublicApiOrigin } = require("../config/security");

const PRIVATE_UPLOAD_PREFIX = "/uploads/ProofOfPurchase/";
const LEGACY_PROOF_FILENAME_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}\.(?:jpe?g|png|webp)$/i;
const SIGNED_URL_TTL_SECONDS = 5 * 60;
const MAX_SIGNED_URL_TTL_SECONDS = 10 * 60;

const getSigningSecret = () => {
  const secret = process.env.UPLOAD_URL_SIGNING_SECRET || process.env.JWT_SECRET;
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("Private upload signing is not configured securely.");
  }
  return secret;
};

const normalizePrivateUploadPath = (value) => {
  if (typeof value !== "string" || value.length === 0 || value.length > 4096) {
    return null;
  }

  let pathname;
  try {
    pathname = new URL(value, "https://uploads.invalid").pathname;
    pathname = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  if (
    !pathname.startsWith(PRIVATE_UPLOAD_PREFIX) ||
    pathname.includes("\\") ||
    pathname.includes("\0") ||
    pathname.split("/").some((part) => part === ".." || part === ".")
  ) {
    return null;
  }

  const segments = pathname.slice(PRIVATE_UPLOAD_PREFIX.length).split("/");
  if (
    segments.length !== 2 ||
    !/^[a-f\d]{24}$/i.test(segments[0]) ||
    !/^[A-Za-z0-9-]+\.jpeg$/.test(segments[1])
  ) {
    return null;
  }

  return `${PRIVATE_UPLOAD_PREFIX}${segments.join("/")}`;
};

// Legacy deployments stored proofs directly below ProofOfPurchase. They are
// never accepted for a new upload attachment, but authorized historical
// purchase responses may temporarily sign them until the migration script has
// moved every record into an owner-scoped directory.
const normalizeStoredPrivateUploadPath = (value) => {
  const ownerScopedPath = normalizePrivateUploadPath(value);
  if (ownerScopedPath) return ownerScopedPath;
  if (typeof value !== "string" || value.length === 0 || value.length > 4096) {
    return null;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(
      new URL(value, "https://uploads.invalid").pathname,
    );
  } catch {
    return null;
  }
  if (
    !pathname.startsWith(PRIVATE_UPLOAD_PREFIX) ||
    pathname.includes("\\") ||
    pathname.includes("\0")
  ) {
    return null;
  }

  const segments = pathname.slice(PRIVATE_UPLOAD_PREFIX.length).split("/");
  const isRootLegacyPath =
    segments.length === 1 && LEGACY_PROOF_FILENAME_PATTERN.test(segments[0]);
  const isOwnerScopedLegacyPath =
    segments.length === 2 &&
    /^[a-f\d]{24}$/i.test(segments[0]) &&
    LEGACY_PROOF_FILENAME_PATTERN.test(segments[1]);
  if (!isRootLegacyPath && !isOwnerScopedLegacyPath) {
    return null;
  }
  return `${PRIVATE_UPLOAD_PREFIX}${segments.join("/")}`;
};

const getSignature = (pathname, expires) =>
  crypto
    .createHmac("sha256", getSigningSecret())
    .update(`GET\n${pathname}\n${expires}`)
    .digest("base64url");

const signPrivateUploadUrl = (value, _req) => {
  const pathname = normalizeStoredPrivateUploadPath(value);
  if (!pathname) return null;

  const expires = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS;
  const signature = getSignature(pathname, expires);
  const origin = getPublicApiOrigin();
  const url = new URL(pathname, origin);
  url.searchParams.set("expires", String(expires));
  url.searchParams.set("signature", signature);
  return url.toString();
};

const verifyPrivateUploadSignature = (req, res, next) => {
  const pathname = normalizeStoredPrivateUploadPath(
    `${req.baseUrl}${req.path}`,
  );
  const expires = Number(req.query.expires);
  const signature = req.query.signature;
  const now = Math.floor(Date.now() / 1000);

  if (
    !pathname ||
    !Number.isSafeInteger(expires) ||
    expires <= now ||
    expires > now + MAX_SIGNED_URL_TTL_SECONDS ||
    typeof signature !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(signature)
  ) {
    return res.status(403).json({ message: "Private file link is invalid." });
  }

  const expected = getSignature(pathname, expires);
  const suppliedBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (
    suppliedBytes.length !== expectedBytes.length ||
    !crypto.timingSafeEqual(suppliedBytes, expectedBytes)
  ) {
    return res.status(403).json({ message: "Private file link is invalid." });
  }

  res.set({
    "Cache-Control": "private, no-store",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "X-Content-Type-Options": "nosniff",
  });
  return next();
};

const withSignedProofUrl = (purchase, req) => {
  const output = purchase?.toObject ? purchase.toObject() : { ...purchase };
  output.proofOfPayment = output.proofOfPayment
    ? signPrivateUploadUrl(output.proofOfPayment, req)
    : null;
  return output;
};

module.exports = {
  PRIVATE_UPLOAD_PREFIX,
  normalizePrivateUploadPath,
  normalizeStoredPrivateUploadPath,
  signPrivateUploadUrl,
  verifyPrivateUploadSignature,
  withSignedProofUrl,
};
