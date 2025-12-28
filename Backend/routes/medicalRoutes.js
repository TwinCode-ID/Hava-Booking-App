const express = require("express");
const router = express.Router();
const {
  upsertMedicalRecord,
  getMedicalRecord,
} = require("../controllers/medicalRecordController");
const { protect } = require("../middlewares/authMiddleware");

// POST /api/medical/:userId - Create or Update record
router.post("/:userId", protect, upsertMedicalRecord);

// GET /api/medical/:userId - View record
router.get("/:userId", protect, getMedicalRecord);

module.exports = router;
