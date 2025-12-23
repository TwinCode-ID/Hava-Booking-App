const multer = require("multer");
const fs = require("fs");
const path = require("path");

const createUploader = (subfolderName) => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      // 1. Try to get userId from Auth Token (req.user) OR Request Body
      // Note: req.user is safest. If using req.body, the 'userId' field must be sent BEFORE the file in the frontend.
      let userId = "unknown";

      if (req.user && req.user._id) {
        userId = req.user._id.toString();
      } else if (req.body.userId) {
        userId = req.body.userId;
      }

      // 2. Define the dynamic path: uploads/UserProfile/{userId}/
      const uploadPath = path.join("uploads", subfolderName, userId);

      // 3. Create directory if it doesn't exist (recursively)
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }

      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      // Clean filename to prevent duplicate conflicts
      cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`);
    },
  });

  const fileFilter = (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPG, JPEG, or PNG allowed!"), false);
  };

  return multer({ storage, fileFilter });
};

module.exports = {
  uploadProfile: createUploader("UserProfile"),
  uploadProof: createUploader("ProofOfPurchase"),
};
