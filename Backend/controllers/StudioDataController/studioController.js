const Studio = require("../../models/StudioData/Studios");
const { canManageStudio } = require("../../helper/authorization");
const {
  toPaymentInstructionsDto,
} = require("../../helper/paymentInstructions");

const toPublicStudioDto = (studio) => ({
  _id: studio._id,
  studioName: studio.studioName,
  studioPictures: studio.studioPictures,
  address: studio.address,
  facilities: studio.facilities,
  contactNumber: studio.contactNumber,
});

const normalizeBankDetails = (value) => {
  if (!Array.isArray(value) || value.length > 10) return null;

  const normalized = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const bankName = typeof entry.bankName === "string" ? entry.bankName.trim() : "";
    const accountNumber =
      typeof entry.accountNumber === "string" ? entry.accountNumber.trim() : "";
    const accountHolderName =
      typeof entry.accountHolderName === "string"
        ? entry.accountHolderName.trim()
        : "";

    if (
      !/^[\p{L}\p{N} .&'()-]{1,80}$/u.test(bankName) ||
      !/^[A-Za-z0-9 -]{4,34}$/.test(accountNumber) ||
      !/^[\p{L}\p{N} .,'&()/-]{2,100}$/u.test(accountHolderName)
    ) {
      return null;
    }
    normalized.push({ bankName, accountNumber, accountHolderName });
  }
  return normalized;
};

exports.createStudio = async (req, res) => {
  try {
    const {
      studioName,
      studioPictures,
      address,
      facilities,
      contactNumber,
      bankDetails,
    } = req.body;
    if (!studioName) {
      return res.status(400).json({ message: "Studio name is required" });
    }
    const normalizedBankDetails =
      bankDetails === undefined ? [] : normalizeBankDetails(bankDetails);
    if (!normalizedBankDetails) {
      return res.status(400).json({
        message: "Bank details contain invalid account information.",
      });
    }
    const studioNameExists = await Studio.findOne({ studioName });
    if (studioNameExists) {
      return res.status(400).json({ message: "Studio already exists" });
    }

    const studio = await Studio.create({
      studioName,
      studioPictures,
      address,
      facilities,
      contactNumber,
      bankDetails: normalizedBankDetails,
    });

    res.status(201).json({
      _id: studio._id,
      studioName: studio.studioName,
      studioPictures: studio.studioPictures,
      address: studio.address,
      facilities: studio.facilities,
      contactNumber: studio.contactNumber,
      bankDetails: studio.bankDetails,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getStudioById = async (req, res) => {
  try {
    const studio = await Studio.findById(req.params.id);
    if (!studio) {
      return res.status(404).json({ message: "Studio not found" });
    }
    res.json(toPublicStudioDto(studio));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAllStudios = async (req, res) => {
  try {
    const studios = await Studio.find();
    res.json(studios.map(toPublicStudioDto));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getStudioPaymentInstructions = async (req, res) => {
  try {
    const studio = await Studio.findById(req.params.id).select(
      "_id studioName bankDetails",
    );
    if (!studio) {
      return res.status(404).json({ message: "Studio not found" });
    }
    if (!canManageStudio(req.user, studio._id)) {
      return res.status(403).json({ message: "Unauthorized user" });
    }

    res.set("Cache-Control", "private, no-store");
    return res.status(200).json(toPaymentInstructionsDto(studio));
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Unable to load payment instructions." });
  }
};

exports.updateStudio = async (req, res) => {
  try {
    const {
      studioName,
      studioPictures,
      address,
      facilities,
      contactNumber,
      bankDetails,
    } = req.body;
    const studio = await Studio.findById(req.params.id);
    if (!studio) {
      return res.status(404).json({ message: "Studio not found" });
    }
    if (!canManageStudio(req.user, studio._id)) {
      return res.status(403).json({ message: "Unauthorized user" });
    }

    let normalizedBankDetails;
    if (Object.prototype.hasOwnProperty.call(req.body, "bankDetails")) {
      normalizedBankDetails = normalizeBankDetails(bankDetails);
      if (!normalizedBankDetails) {
        return res.status(400).json({
          message: "Bank details contain invalid account information.",
        });
      }
    }

    studio.studioName = studioName || studio.studioName;
    studio.studioPictures = studioPictures || studio.studioPictures;
    studio.address = address || studio.address;
    studio.facilities = facilities || studio.facilities;
    studio.contactNumber = contactNumber || studio.contactNumber;
    if (normalizedBankDetails) studio.bankDetails = normalizedBankDetails;

    await studio.save();

    const response = {
      _id: studio._id,
      studioName: studio.studioName,
      studioPictures: studio.studioPictures,
      address: studio.address,
      facilities: studio.facilities,
      contactNumber: studio.contactNumber,
    };
    if (normalizedBankDetails) response.bankDetails = studio.bankDetails;
    res.status(201).json(response);
  } catch (err) {
    console.error("Studio update failed", err);
    res.status(500).json({ message: "Unable to update studio." });
  }
};

exports.deleteStudio = async (req, res) => {
  try {
    const studio = await Studio.findByIdAndDelete(req.params.id);
    if (!studio) {
      return res.status(404).json({ message: "Studio not found" });
    }
    res.json({ message: "Studio deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
