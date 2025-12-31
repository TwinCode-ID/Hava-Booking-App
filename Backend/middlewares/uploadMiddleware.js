const multer = require("multer");
const fs = require("fs");
const path = require("path");

const createUploader = (subfolderName) => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      let userId = "unassigned"; // Default folder if no ID is found

      // 1. Check req.user (if protected)
      if (req.user && req.user._id) {
        userId = req.user._id.toString();
      }
      // 2. Check req.body (if public/registration)
      // CRITICAL: Frontend must send 'userId' BEFORE 'image'
      else if (req.body.userId) {
        userId = req.body.userId;
      } else if (req.body.adminStudioLocation) {
        userId = req.body.adminStudioLocation;
      }

      const uploadPath = path.join("uploads", subfolderName, userId);

      // Create folder if it doesn't exist
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }

      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
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
  uploadStudio: createUploader("Studio"),
};
