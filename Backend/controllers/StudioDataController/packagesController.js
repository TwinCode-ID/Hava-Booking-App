const Package = require("../../models/StudioData/Packages");

exports.createPackage = async (req, res) => {
  try {
    const {
      packageName,
      packageDescription,
      packagePrice,
      currency,
      validityDays,
      credits,
      instructorType,
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
      instructorType,
      credits,
      studioLocation,
    });

    res.status(201).json({
      _id: package._id,
      packageName: package.packageName,
      packageDescription: package.packageDescription,
      packagePrice: package.packagePrice,
      currency: package.currency,
      validityDays: package.validityDays,
      isActive: package.isActive,
      credits: package.credits,
      instructorType: package.instructorType,
      studioLocation: package.studioLocation,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getPackageById = async (req, res) => {
  try {
    const package = await Package.findById(req.params.id);
    if (!package) {
      return res.status(404).json({ message: "Package not found" });
    }
    res.json({
      _id: package._id,
      packageName: package.packageName,
      packageDescription: package.packageDescription,
      packagePrice: package.packagePrice,
      currency: package.currency,
      validityDays: package.validityDays,
      isActive: package.isActive,
      credits: package.credits,
      instructorType: package.instructorType,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAllPackages = async (req, res) => {
  try {
    const package = await Package.find();
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
      credits,
      instructorType,
    } = req.body;
    const package = await Package.findById(req.params.id);
    if (!package) {
      return res.status(404).json({ message: "Package not found" });
    }

    package.packageName = packageName || package.packageName;
    package.packageDescription =
      packageDescription || package.packageDescription;
    package.packagePrice = packagePrice || package.packagePrice;
    package.currency = currency || package.currency;
    package.validityDays = validityDays || package.validityDays;
    package.isActive = isActive || package.isActive;
    package.credits = credits || package.credits;
    package.instructorType = instructorType || package.instructorType;
    await package.save();

    res.status(201).json({
      _id: package._id,
      packageName: package.packageName,
      packageDescription: package.packageDescription,
      packagePrice: package.packagePrice,
      currency: package.currency,
      validityDays: package.validityDays,
      isActive: package.isActive,
      credits: package.credits,
      instructorType: package.instructorType,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deletePackage = async (req, res) => {
  try {
    const package = await Package.findByIdAndDelete(req.params.id);
    if (!package) {
      return res.status(404).json({ message: "Package not found" });
    }
    res.json({ message: "Package deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.packageStatus = async (req, res) => {
  try {
    const package = await Package.findById(req.params.id);
    if (!package) {
      return res.status(404).json({ message: "Package not found" });
    }

    if (
      package.studioLocation.toString() !==
      req.user.adminStudioLocation.toString()
    ) {
      return res.status(403).json({ message: "Unauthorized user" });
    }

    if (package.isActive) {
      package.isActive = false;
      await package.save();

      res.json({ message: "Package inactive" });
    } else {
      package.isActive = true;
      await package.save();

      res.json({ message: "Package active" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
