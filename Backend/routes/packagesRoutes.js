const express = require("express");
const {
    createPackage, 
    getPackageById, 
    getAllPackages, 
    updatePackage, 
    deletePackage, 
    packageStatus,
} = require("../controllers/packagesController");
const {protect, studioAdmin} = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/", protect, studioAdmin, createPackage);
router.get("/", getAllPackages);
router.get("/:id", getPackageById);
router.put("/:id", protect, studioAdmin, updatePackage);
router.delete("/:id", protect, studioAdmin, deletePackage);
router.put("/:id/set-package-status", protect, studioAdmin, packageStatus);

module.exports = router;