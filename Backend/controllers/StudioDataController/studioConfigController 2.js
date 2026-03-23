const StudioConfig = require("../../models/StudioData/StudioConfig");

// 1. Get Configuration (Auto-create if missing)
exports.getStudioConfig = async (req, res) => {
  try {
    const { studioId } = req.params;
    let config = await StudioConfig.findOne({ studioId });

    if (!config) {
      // Create default config if this is the first time
      config = await StudioConfig.create({ studioId });
    }

    res.status(200).json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 2. Add a New Type
exports.addConfigType = async (req, res) => {
  try {
    const { studioId } = req.params;
    const { type, category } = req.body; // category must be 'classTypes' or 'instructorTypes'

    if (!["classTypes", "instructorTypes"].includes(category)) {
      return res.status(400).json({ error: "Invalid category" });
    }

    if (!type || type.trim() === "") {
      return res.status(400).json({ error: "Type name cannot be empty" });
    }

    let config = await StudioConfig.findOne({ studioId });
    if (!config) config = await StudioConfig.create({ studioId });

    // Check for duplicates (case-insensitive)
    const exists = config[category].some(
      (t) => t.toLowerCase() === type.toLowerCase(),
    );
    if (exists) {
      return res.status(400).json({ error: "This type already exists" });
    }

    config[category].push(type);
    await config.save();

    res.status(200).json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 3. Remove a Type
exports.removeConfigType = async (req, res) => {
  try {
    const { studioId } = req.params;
    const { type, category } = req.body;

    const config = await StudioConfig.findOne({ studioId });
    if (!config) return res.status(404).json({ error: "Config not found" });

    config[category] = config[category].filter((t) => t !== type);
    await config.save();

    res.status(200).json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
