const multer = require("multer");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp"); // Requires 'npm install sharp'

const createUploader = (subfolderName) => {
  // 1. Use Memory Storage (saves to RAM temporarily instead of directly to disk)
  const storage = multer.memoryStorage();

  // 2. Allow ALL image types (starts with "image/")
  const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  };

  // 3. Initialize Multer with a generous file size limit (e.g., 50MB)
  const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  // 4. Custom Processing Function using Sharp
  const processImage = async (req, file, subfolderName) => {
    let userId = "unassigned";

    // Because we use MemoryStorage, this runs AFTER the whole request is parsed.
    // req.body.userId is NOW GUARANTEED to be here, regardless of frontend field order!
    if (req.user && req.user._id) {
      userId = req.user._id.toString();
    } else if (req.body.userId) {
      userId = req.body.userId;
    } else if (req.body.adminStudioLocation) {
      userId = req.body.adminStudioLocation;
    }

    const uploadPath = path.join("uploads", subfolderName, userId);

    // Create folder if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    // Standardize filename and force .jpeg extension for consistency & compression
    const safeOriginalName = file.originalname
      .replace(/\.[^/.]+$/, "")
      .replace(/\s+/g, "-");
    const filename = `${Date.now()}-${safeOriginalName}.jpeg`;
    const filePath = path.join(uploadPath, filename);

    // Compress, resize, and convert the image
    await sharp(file.buffer)
      .resize({ width: 1920, withoutEnlargement: true }) // Max width 1920px (prevents 8K phone images from bloating the server)
      .jpeg({ quality: 80 }) // Compress to 80% quality JPEG
      .toFile(filePath);

    // Attach the new file details back to the req.file object
    // so your controllers can still use req.file.path seamlessly
    file.filename = filename;
    file.path = filePath;
    file.destination = uploadPath;
    file.mimetype = "image/jpeg";
    file.size = fs.statSync(filePath).size;
  };

  // 5. Return an object that mimics Multer's syntax but adds the compression step
  return {
    single: (fieldName) => {
      return [
        upload.single(fieldName),
        async (req, res, next) => {
          if (!req.file) return next();
          try {
            await processImage(req, req.file, subfolderName);
            next();
          } catch (err) {
            next(err);
          }
        },
      ];
    },
    array: (fieldName, maxCount) => {
      return [
        upload.array(fieldName, maxCount),
        async (req, res, next) => {
          if (!req.files || req.files.length === 0) return next();
          try {
            await Promise.all(
              req.files.map((f) => processImage(req, f, subfolderName)),
            );
            next();
          } catch (err) {
            next(err);
          }
        },
      ];
    },
  };
};

module.exports = {
  uploadProfile: createUploader("UserProfile"),
  uploadProof: createUploader("ProofOfPurchase"),
  uploadStudio: createUploader("Studio"),
};
