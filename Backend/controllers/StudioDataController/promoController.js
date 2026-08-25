const Promo = require("../../models/StudioData/Promo");
const crypto = require("crypto");
const {
  canManageStudio,
  isDevTeam,
} = require("../../helper/authorization");

const PROMO_UPDATE_FIELDS = [
  "title",
  "description",
  "promoType",
  "prefix",
  "staticCode",
  "maxUsageLimit",
  "discountType",
  "discountValue",
  "buyX",
  "getY",
  "minItemsRequired",
  "validUntil",
];
const MAX_CODES_PER_REQUEST = 500;

const isBoundedInteger = (value, minimum, maximum) =>
  Number.isSafeInteger(Number(value)) &&
  Number(value) >= minimum &&
  Number(value) <= maximum;

const validatePromoValues = (promo, quantity = 1) => {
  if (
    typeof promo.title !== "string" ||
    !promo.title.trim() ||
    promo.title.trim().length > 120
  ) {
    return "A valid promo title is required.";
  }
  if (!["bulk", "static", "admin"].includes(promo.promoType)) {
    return "Promo type is invalid.";
  }
  if (
    promo.promoType === "bulk" &&
    !isBoundedInteger(quantity, 1, MAX_CODES_PER_REQUEST)
  ) {
    return `Generate between 1 and ${MAX_CODES_PER_REQUEST} codes at a time.`;
  }
  if (
    (promo.promoType === "static" || promo.promoType === "admin") &&
    (typeof promo.staticCode !== "string" ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(promo.staticCode))
  ) {
    return "Static promo code is invalid.";
  }
  if (
    promo.promoType !== "admin" &&
    !isBoundedInteger(promo.maxUsageLimit, 1, 1_000_000)
  ) {
    return "Promo usage limit is invalid.";
  }
  if (promo.discountType === "percentage") {
    const value = Number(promo.discountValue);
    if (!Number.isFinite(value) || value <= 0 || value > 100) {
      return "Percentage discounts must be greater than 0 and at most 100.";
    }
  } else if (promo.discountType === "fixed") {
    const value = Number(promo.discountValue);
    if (!Number.isFinite(value) || value <= 0 || value > 1_000_000_000_000) {
      return "Fixed discounts are invalid.";
    }
  } else if (promo.discountType === "buy_x_get_y") {
    if (
      !isBoundedInteger(promo.buyX, 1, 1000) ||
      !isBoundedInteger(promo.getY, 1, 1000)
    ) {
      return "Buy/get quantities are invalid.";
    }
  } else {
    return "Discount type is invalid.";
  }
  if (!isBoundedInteger(promo.minItemsRequired ?? 1, 1, 1000)) {
    return "Minimum item count is invalid.";
  }
  if (promo.validUntil) {
    const expiry = new Date(promo.validUntil);
    if (Number.isNaN(expiry.getTime()) || expiry <= new Date()) {
      return "Promo expiry must be a valid future date.";
    }
  }
  return null;
};

const generateRandomCodes = (prefix, quantity) => {
  const codes = [];
  const generated = new Set();
  for (let i = 0; i < quantity; i++) {
    let suffix;
    do {
      // 80 bits keeps bulk vouchers impractical to guess even when many are
      // issued for the same campaign.
      suffix = crypto.randomBytes(10).toString("hex").toUpperCase();
    } while (generated.has(suffix));
    generated.add(suffix);
    codes.push({ code: `${prefix ? prefix + "-" : ""}${suffix}` });
  }
  return codes;
};

exports.createPromo = async (req, res) => {
  try {
    const {
      title,
      description,
      promoType,
      prefix,
      quantity,
      staticCode,
      maxUsageLimit,
      discountType,
      discountValue,
      buyX,
      getY,
      minItemsRequired,
      validUntil,
      studioLocation: requestedStudio,
    } = req.body;

    const studioLocation = isDevTeam(req.user)
      ? requestedStudio
      : req.user.adminStudioLocation;
    if (!studioLocation || !canManageStudio(req.user, studioLocation)) {
      return res.status(403).json({ message: "Unauthorized." });
    }

    if (!title || !discountType) {
      return res
        .status(400)
        .json({ message: "Title and Discount Type are required." });
    }

    const promoValidationError = validatePromoValues(
      {
        title,
        promoType: promoType || "bulk",
        staticCode,
        maxUsageLimit: maxUsageLimit ?? 100,
        discountType,
        discountValue,
        buyX,
        getY,
        minItemsRequired,
        validUntil,
      },
      quantity ?? 1,
    );
    if (promoValidationError) {
      return res.status(400).json({ message: promoValidationError });
    }

    let generatedCodes = [];

    if (promoType === "static" || promoType === "admin") {
      if (!staticCode)
        return res
          .status(400)
          .json({ message: "Static Code is required for this Promo Type." });

      const existingStatic = await Promo.findOne({
        staticCode: staticCode.toUpperCase(),
        studioLocation,
      });
      if (existingStatic) {
        return res.status(400).json({
          message:
            "This static promo code is already in use by another campaign.",
        });
      }
    } else {
      generatedCodes = generateRandomCodes(
        prefix || "",
        Number(quantity ?? 1),
      );
    }

    const promo = await Promo.create({
      title,
      description,
      promoType: promoType || "bulk",
      prefix,
      codes: generatedCodes,
      staticCode: staticCode ? staticCode.toUpperCase() : null,
      maxUsageLimit: promoType === "admin" ? null : (maxUsageLimit ?? 100),
      discountType,
      discountValue,
      buyX,
      getY,
      minItemsRequired,
      validUntil,
      studioLocation,
    });

    res.status(201).json(promo);
  } catch (error) {
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        message: `A promo campaign with this ${duplicateField} already exists.`,
      });
    }
    if (error?.name === "ValidationError") {
      return res.status(400).json({ message: "Promo data is invalid." });
    }
    res.status(500).json({ message: "Unable to create promo." });
  }
};

exports.getPromosByStudio = async (req, res) => {
  try {
    const { studioId } = req.params;
    if (!canManageStudio(req.user, studioId)) {
      return res.status(403).json({ message: "Unauthorized." });
    }
    const promos = await Promo.find({ studioLocation: studioId }).sort({
      createdAt: -1,
    });
    res.status(200).json(promos);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updatePromo = async (req, res) => {
  try {
    const { id } = req.params;
    const { generateMoreQuantity } = req.body;

    const promo = await Promo.findById(id);
    if (!promo) return res.status(404).json({ message: "Promo not found." });
    if (!canManageStudio(req.user, promo.studioLocation)) {
      return res.status(403).json({ message: "Unauthorized." });
    }

    for (const field of PROMO_UPDATE_FIELDS) {
      if (req.body[field] !== undefined) promo[field] = req.body[field];
    }

    const promoValidationError = validatePromoValues(promo, 1);
    if (promoValidationError) {
      return res.status(400).json({ message: promoValidationError });
    }

    if (
      promo.promoType === "bulk" &&
      generateMoreQuantity !== undefined &&
      Number(generateMoreQuantity) !== 0
    ) {
      if (!isBoundedInteger(generateMoreQuantity, 1, MAX_CODES_PER_REQUEST)) {
        return res.status(400).json({
          message: `Generate between 1 and ${MAX_CODES_PER_REQUEST} codes at a time.`,
        });
      }
      const newCodes = generateRandomCodes(
        promo.prefix || "",
        Number(generateMoreQuantity),
      );
      promo.codes.push(...newCodes);
    }

    await promo.save();
    res.status(200).json(promo);
  } catch (error) {
    if (error?.name === "ValidationError") {
      return res.status(400).json({ message: "Promo data is invalid." });
    }
    res.status(500).json({ message: "Unable to update promo." });
  }
};

exports.deletePromo = async (req, res) => {
  try {
    const { id } = req.params;
    const promo = await Promo.findById(id);
    if (!promo) return res.status(404).json({ message: "Promo not found." });
    if (!canManageStudio(req.user, promo.studioLocation)) {
      return res.status(403).json({ message: "Unauthorized." });
    }
    await promo.deleteOne();
    res.status(200).json({ message: "Promo deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.togglePromoStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const promo = await Promo.findById(id);
    if (!promo) return res.status(404).json({ message: "Promo not found." });
    if (!canManageStudio(req.user, promo.studioLocation)) {
      return res.status(403).json({ message: "Unauthorized." });
    }

    promo.isActive = !promo.isActive;
    await promo.save();

    res.status(200).json({
      message: `Promo is now ${promo.isActive ? "Active" : "Inactive"}`,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.validatePromo = async (req, res) => {
  try {
    const { code, studioId } = req.body;
    if (!code || !studioId)
      return res.status(400).json({ message: "Code and Studio ID required." });

    const upperCode = code.toUpperCase().trim();

    const promo = await Promo.findOne({
      studioLocation: studioId,
      $or: [{ staticCode: upperCode }, { "codes.code": upperCode }],
    });

    if (!promo || !promo.isActive) {
      return res
        .status(404)
        .json({ message: "Promo code not found or is inactive." });
    }

    if (promo.promoType === "admin" && !canManageStudio(req.user, studioId)) {
      return res.status(403).json({ message: "This promo is staff-only." });
    }

    if (promo.validUntil && new Date(promo.validUntil) < new Date()) {
      return res.status(400).json({ message: "This promo code has expired." });
    }

    if (promo.promoType === "bulk") {
      const voucher = promo.codes.find((c) => c.code === upperCode);
      if (!voucher || voucher.isUsed) {
        return res
          .status(400)
          .json({ message: "This voucher code has already been used." });
      }
    } else if (promo.promoType === "static") {
      if (
        promo.maxUsageLimit &&
        promo.currentUsageCount >= promo.maxUsageLimit
      ) {
        return res.status(400).json({
          message: "This promo code has reached its maximum usage limit.",
        });
      }
    }

    res.status(200).json({
      _id: promo._id,
      title: promo.title,
      description: promo.description,
      promoType: promo.promoType,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      buyX: promo.buyX,
      getY: promo.getY,
      minItemsRequired: promo.minItemsRequired,
      validUntil: promo.validUntil,
      studioLocation: promo.studioLocation,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
