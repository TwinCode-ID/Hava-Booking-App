const Package = require("../../models/StudioData/Packages");

exports.createPackage = async (req, res) => {
  try {
    const {
      packageName,
      packageDescription,
      packagePrice,
      currency,
      validityDays,
      isCombo,
      credits,
      instructorType,
      classType,
      comboItems,
      packageCategory,
      isPromo,
      promoPrice,
      isOneTimePurchase,
      isAvailableToFreeze,
      enableExpiryReminder,
      reminderDaysBefore,
    } = req.body;

    if (!packageName) {
      return res.status(400).json({ message: "Package name is required" });
    }

    const studioLocation = req.user.adminStudioLocation;

    const newPackage = await Package.create({
      packageName,
      packageDescription,
      packagePrice,
      currency,
      validityDays,
      packageCategory: packageCategory || ["Regular"],
      isOneTimePurchase: isOneTimePurchase || false,
      isAvailableToFreeze: isAvailableToFreeze || false,
      isPromo: isPromo || false,
      promoPrice: isPromo ? promoPrice : undefined,
      isCombo: isCombo || false,
      credits,
      instructorType,
      classType,
      comboItems: isCombo ? comboItems : [],
      studioLocation,
      enableExpiryReminder: enableExpiryReminder || false,
      reminderDaysBefore: enableExpiryReminder ? reminderDaysBefore : 7,
    });

    res.status(201).json(newPackage);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getPackageById = async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id);
    if (!pkg) return res.status(404).json({ message: "Package not found" });
    res.json(pkg);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getPackageByStudio = async (req, res) => {
  try {
    const { studioLocation } = req.params;
    const packages = await Package.find({ studioLocation }).populate(
      "studioLocation",
      "studioName bankDetails",
    );

    if (!packages || packages.length === 0) {
      return res
        .status(404)
        .json({ message: "No packages found for this studio." });
    }
    res.status(200).json(packages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAllPackages = async (req, res) => {
  try {
    const packages = await Package.find().populate(
      "studioLocation",
      "studioName bankDetails",
    );
    res.json(packages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updatePackage = async (req, res) => {
  try {
    const {
      packageName,
      packageDescription,
      packagePrice,
      currency,
      validityDays,
      isActive,
      isCombo,
      credits,
      instructorType,
      classType,
      comboItems,
      packageCategory,
      isPromo,
      promoPrice,
      isOneTimePurchase,
      isAvailableToFreeze,
      enableExpiryReminder,
      reminderDaysBefore,
    } = req.body;

    const existingPackage = await Package.findById(req.params.id);
    if (!existingPackage)
      return res.status(404).json({ message: "Package not found" });

    existingPackage.packageName = packageName || existingPackage.packageName;
    existingPackage.packageDescription =
      packageDescription || existingPackage.packageDescription;
    existingPackage.packagePrice = packagePrice || existingPackage.packagePrice;
    existingPackage.currency = currency || existingPackage.currency;
    existingPackage.validityDays = validityDays || existingPackage.validityDays;
    existingPackage.isActive =
      isActive !== undefined ? isActive : existingPackage.isActive;

    existingPackage.packageCategory =
      packageCategory || existingPackage.packageCategory;
    existingPackage.isOneTimePurchase =
      isOneTimePurchase !== undefined
        ? isOneTimePurchase
        : existingPackage.isOneTimePurchase;
    existingPackage.isAvailableToFreeze =
      isAvailableToFreeze !== undefined
        ? isAvailableToFreeze
        : existingPackage.isAvailableToFreeze;

    existingPackage.isPromo =
      isPromo !== undefined ? isPromo : existingPackage.isPromo;
    existingPackage.promoPrice = isPromo ? promoPrice : undefined;

    existingPackage.isCombo =
      isCombo !== undefined ? isCombo : existingPackage.isCombo;
    existingPackage.credits =
      credits !== undefined ? credits : existingPackage.credits;
    existingPackage.instructorType =
      instructorType || existingPackage.instructorType;
    existingPackage.classType = classType || existingPackage.classType;

    existingPackage.comboItems = isCombo ? comboItems : [];
    existingPackage.enableExpiryReminder =
      enableExpiryReminder !== undefined
        ? enableExpiryReminder
        : existingPackage.enableExpiryReminder;

    existingPackage.reminderDaysBefore = enableExpiryReminder
      ? reminderDaysBefore
      : existingPackage.reminderDaysBefore;

    await existingPackage.save();
    res.status(200).json(existingPackage);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deletePackage = async (req, res) => {
  try {
    const pkg = await Package.findByIdAndDelete(req.params.id);
    if (!pkg) return res.status(404).json({ message: "Package not found" });
    res.json({ message: "Package deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.packageStatus = async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id);
    if (!pkg) return res.status(404).json({ message: "Package not found" });

    if (
      pkg.studioLocation.toString() !== req.user.adminStudioLocation.toString()
    ) {
      return res.status(403).json({ message: "Unauthorized user" });
    }

    pkg.isActive = !pkg.isActive;
    await pkg.save();
    res.json({
      message: pkg.isActive ? "Package active" : "Package inactive",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
