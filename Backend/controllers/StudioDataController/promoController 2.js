const Promo = require("../../models/StudioData/Promo");

// CREATE PROMO
exports.createPromo = async (req, res) => {
  try {
    const {
      code,
      title,
      description,
      discountType,
      discountValue,
      buyX,
      getY,
      minItemsRequired,
      validUntil,
    } = req.body;
    const studioLocation = req.user.adminStudioLocation;

    if (!code || !title || !discountType) {
      return res
        .status(400)
        .json({ message: "Code, Title, and Discount Type are required." });
    }

    const existingPromo = await Promo.findOne({
      code: code.toUpperCase(),
      studioLocation,
    });
    if (existingPromo) {
      return res
        .status(400)
        .json({ message: "Promo code already exists for this studio." });
    }

    const promo = await Promo.create({
      code,
      title,
      description,
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
    res.status(500).json({ message: error.message });
  }
};

// GET PROMOS BY STUDIO
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

// UPDATE PROMO
exports.updatePromo = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (updateData.code) updateData.code = updateData.code.toUpperCase();

    const promo = await Promo.findByIdAndUpdate(id, updateData, { new: true });
    if (!promo) return res.status(404).json({ message: "Promo not found." });

    res.status(200).json(promo);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE PROMO
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

// TOGGLE STATUS
exports.togglePromoStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const promo = await Promo.findById(id);
    if (!promo) return res.status(404).json({ message: "Promo not found." });

    promo.isActive = !promo.isActive;
    await promo.save();

    res.status(200).json({
      message: `Promo is now ${promo.isActive ? "Active" : "Inactive"}`,
      isActive: promo.isActive,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
