const express = require("express");
const {
  createPackage,
  getPackageById,
  getAllPackages,
  updatePackage,
  deletePackage,
  packageStatus,
  getPackageByStudio,
  getPackagePaymentInstructions,
} = require("../../controllers/StudioDataController/packagesController");
const {
  protect,
  requireStepUp,
  studioAdmin,
} = require("../../middlewares/authMiddleware");
const { FINANCIAL_READ_SCOPE } = require("../../helper/authToken");

const router = express.Router();
const requireFinancialManagement = requireStepUp(
  FINANCIAL_READ_SCOPE,
  "Verify your identity before changing package value.",
);
const requireFinancialReadForStaff = (req, res, next) =>
  req.user?.role === "studioAdmin" || req.user?.role === "devTeam"
    ? requireFinancialManagement(req, res, next)
    : next();

router.post("/", protect, studioAdmin, createPackage);
router.get("/", getAllPackages);
router.get(
  "/:id/payment-instructions",
  protect,
  requireFinancialReadForStaff,
  getPackagePaymentInstructions,
);
router.get("/:id", getPackageById);
router.get("/studio/:studioLocation", protect, getPackageByStudio);
router.put("/:id", protect, studioAdmin, updatePackage);
router.delete("/:id", protect, studioAdmin, deletePackage);
router.put(
  "/:id/set-package-status",
  protect,
  studioAdmin,
  packageStatus,
);

module.exports = router;
