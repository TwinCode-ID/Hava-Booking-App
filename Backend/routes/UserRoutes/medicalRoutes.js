const express = require("express");
const router = express.Router();
const {
  upsertMedicalRecord,
  getMedicalRecord,
} = require("../../controllers/UserController/medicalRecordController");
const {
  protect,
  requireStepUp,
} = require("../../middlewares/authMiddleware");
const { FINANCIAL_READ_SCOPE } = require("../../helper/authToken");

const requireSensitiveDataAccess = requireStepUp(
  FINANCIAL_READ_SCOPE,
  "Verify your identity before accessing client medical records.",
);
const protectStaffMedicalAccess = (req, res, next) =>
  req.user?.role === "studioAdmin" || req.user?.role === "devTeam"
    ? requireSensitiveDataAccess(req, res, next)
    : next();

// POST /api/medical/:userId - Create or Update record
router.post(
  "/:userId",
  protect,
  protectStaffMedicalAccess,
  upsertMedicalRecord,
);

// GET /api/medical/:userId - View record
router.get(
  "/:userId",
  protect,
  protectStaffMedicalAccess,
  getMedicalRecord,
);

module.exports = router;
