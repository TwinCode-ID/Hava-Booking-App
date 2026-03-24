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
    } = req.body;

    if (!packageName) {
      return res.status(400).json({ message: "Package name is required" });
    }

    const studioLocation = req.user.adminStudioLocation;

    const package = await Package.create({
      packageName,
      packageDescription,
      packagePrice,
      currency,
      validityDays,
      isCombo: isCombo || false,
      credits,
      instructorType,
      classType,
      comboItems: comboItems || [],
      studioLocation,
    });

    res.status(201).json(package);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getPackageById = async (req, res) => {
  try {
    const package = await Package.findById(req.params.id);
    if (!package) return res.status(404).json({ message: "Package not found" });
    res.json(package);
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
    const package = await Package.find().populate(
      "studioLocation",
      "studioName bankDetails",
    );
    res.json(package);
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
    } = req.body;

    const package = await Package.findById(req.params.id);
    if (!package) return res.status(404).json({ message: "Package not found" });

    package.packageName = packageName || package.packageName;
    package.packageDescription =
      packageDescription || package.packageDescription;
    package.packagePrice = packagePrice || package.packagePrice;
    package.currency = currency || package.currency;
    package.validityDays = validityDays || package.validityDays;
    package.isActive = isActive !== undefined ? isActive : package.isActive;

    package.isCombo = isCombo !== undefined ? isCombo : package.isCombo;
    package.credits = credits !== undefined ? credits : package.credits;
    package.instructorType = instructorType || package.instructorType;
    package.classType = classType || package.classType;
    package.comboItems = comboItems || package.comboItems;

    await package.save();
    res.status(200).json(package);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deletePackage = async (req, res) => {
  try {
    const package = await Package.findByIdAndDelete(req.params.id);
    if (!package) return res.status(404).json({ message: "Package not found" });
    res.json({ message: "Package deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.packageStatus = async (req, res) => {
  try {
    const package = await Package.findById(req.params.id);
    if (!package) return res.status(404).json({ message: "Package not found" });

    if (
      package.studioLocation.toString() !==
      req.user.adminStudioLocation.toString()
    ) {
      return res.status(403).json({ message: "Unauthorized user" });
    }

    package.isActive = !package.isActive;
    await package.save();
    res.json({
      message: package.isActive ? "Package active" : "Package inactive",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
