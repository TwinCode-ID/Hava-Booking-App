const Promo = require("../../models/StudioData/Promo");
const crypto = require("crypto");

const generateRandomCodes = (prefix, quantity) => {
  const codes = [];
  for (let i = 0; i < quantity; i++) {
    const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
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
    } = req.body;

    const studioLocation = req.user.adminStudioLocation;

    if (!title || !discountType) {
      return res
        .status(400)
        .json({ message: "Title and Discount Type are required." });
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
      generatedCodes = generateRandomCodes(prefix || "", quantity || 1);
    }

    const promo = await Promo.create({
      title,
      description,
      promoType: promoType || "bulk",
      prefix,
      codes: generatedCodes,
      staticCode: staticCode ? staticCode.toUpperCase() : null,
      maxUsageLimit: promoType === "admin" ? null : maxUsageLimit,
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
    res.status(500).json({ message: error.message });
  }
};

exports.getPromosByStudio = async (req, res) => {
  try {
    const { studioId } = req.params;
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
    const { generateMoreQuantity, ...updateData } = req.body;

    const promo = await Promo.findById(id);
    if (!promo) return res.status(404).json({ message: "Promo not found." });

    Object.assign(promo, updateData);

    if (
      promo.promoType === "bulk" &&
      generateMoreQuantity &&
      generateMoreQuantity > 0
    ) {
      const newCodes = generateRandomCodes(
        promo.prefix || "",
        generateMoreQuantity,
      );
      promo.codes.push(...newCodes);
    }

    await promo.save();
    res.status(200).json(promo);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deletePromo = async (req, res) => {
  try {
    const { id } = req.params;
    const promo = await Promo.findByIdAndDelete(id);
    if (!promo) return res.status(404).json({ message: "Promo not found." });
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

    res.status(200).json(promo);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
