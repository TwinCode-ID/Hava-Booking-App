const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const sharp = require("sharp");

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_INPUT_PIXELS = 40 * 1000 * 1000;
const MAX_OUTPUT_DIMENSION = 2400;
const DEFAULT_OWNER_STORAGE_BYTES = 250 * 1024 * 1024;
const configuredOwnerStorageBytes = Number.parseInt(
  process.env.UPLOAD_OWNER_QUOTA_BYTES || "",
  10,
);
const MAX_OWNER_STORAGE_BYTES =
  Number.isSafeInteger(configuredOwnerStorageBytes) &&
  configuredOwnerStorageBytes >= MAX_UPLOAD_BYTES
    ? configuredOwnerStorageBytes
    : DEFAULT_OWNER_STORAGE_BYTES;
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const getDirectoryUsageBytes = (directory) => {
  if (!fs.existsSync(directory)) return 0;

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .reduce((total, entry) => {
      try {
        return total + fs.statSync(path.join(directory, entry.name)).size;
      } catch {
        return total;
      }
    }, 0);
};

const getUploadOwnerId = (req, subfolderName) => {
  if (!req.user?._id) throw new Error("Authenticated upload required.");

  if (subfolderName !== "Studio") return req.user._id.toString();

  const studioId =
    req.user.role === "devTeam"
      ? req.body.adminStudioLocation
      : req.user.adminStudioLocation;
  if (typeof studioId?.toString !== "function") {
    throw new Error("A valid studio is required for this upload.");
  }

  const normalizedStudioId = studioId.toString();
  if (!OBJECT_ID_PATTERN.test(normalizedStudioId)) {
    throw new Error("A valid studio is required for this upload.");
  }
  return normalizedStudioId;
};

const createUploader = (subfolderName) => {
  const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (_req, file, callback) => {
      if (ALLOWED_IMAGE_TYPES.has(file.mimetype)) return callback(null, true);
      const error = new Error("Only JPEG, PNG, WebP, HEIC, or HEIF images are allowed.");
      error.code = "INVALID_IMAGE_TYPE";
      return callback(error, false);
    },
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 8 },
  });

  const processImage = async (req, file) => {
    const ownerId = getUploadOwnerId(req, subfolderName);
    const uploadPath = path.resolve(
      __dirname,
      "../uploads",
      subfolderName,
      ownerId,
    );
    const filename = `${crypto.randomUUID()}.jpeg`;
    const filePath = path.join(uploadPath, filename);

    fs.mkdirSync(uploadPath, { recursive: true, mode: 0o750 });
    try {
      await sharp(file.buffer, {
        failOn: "warning",
        limitInputPixels: MAX_INPUT_PIXELS,
        sequentialRead: true,
      })
        .rotate()
        .resize({
          width: MAX_OUTPUT_DIMENSION,
          height: MAX_OUTPUT_DIMENSION,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80, mozjpeg: true })
        .toFile(filePath);

      if (getDirectoryUsageBytes(uploadPath) > MAX_OWNER_STORAGE_BYTES) {
        const quotaError = new Error("Upload storage quota exceeded.");
        quotaError.code = "UPLOAD_QUOTA_EXCEEDED";
        throw quotaError;
      }
    } catch (error) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      error.code ||= "INVALID_IMAGE_DATA";
      throw error;
    }

    file.filename = filename;
    file.path = filePath;
    file.destination = uploadPath;
    file.mimetype = "image/jpeg";
    file.size = fs.statSync(filePath).size;
  };

  const processFiles = async (req, files, next) => {
    const completedPaths = [];
    try {
      // Sequential processing bounds Sharp memory use and makes the per-owner
      // disk quota deterministic within a request.
      for (const file of files) {
        await processImage(req, file);
        completedPaths.push(file.path);
      }
      return next();
    } catch (error) {
      for (const completedPath of completedPaths) {
        try {
          if (fs.existsSync(completedPath)) fs.unlinkSync(completedPath);
        } catch {
          // The scheduled orphan cleanup is a final fallback if local cleanup
          // is interrupted or the filesystem becomes temporarily unavailable.
        }
      }
      return next(error);
    }
  };

  return {
    single: (fieldName) => [
      upload.single(fieldName),
      (req, _res, next) =>
        req.file ? processFiles(req, [req.file], next) : next(),
    ],
    array: (fieldName, maxCount) => [
      upload.array(fieldName, Math.min(maxCount, 8)),
      (req, _res, next) =>
        req.files?.length ? processFiles(req, req.files, next) : next(),
    ],
  };
};

module.exports = {
  DEFAULT_OWNER_STORAGE_BYTES,
  MAX_INPUT_PIXELS,
  MAX_OWNER_STORAGE_BYTES,
  MAX_UPLOAD_BYTES,
  getDirectoryUsageBytes,
  uploadProfile: createUploader("UserProfile"),
  uploadProof: createUploader("ProofOfPurchase"),
  uploadStudio: createUploader("Studio"),
};
