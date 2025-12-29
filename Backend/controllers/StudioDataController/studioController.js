const Studio = require("../../models/StudioData/Studios");

exports.createStudio = async (req, res) => {
  try {
    const { studioName, studioPictures, address, facilities, contactNumber } =
      req.body;
    if (!studioName) {
      return res.status(400).json({ message: "Studio name is required" });
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
    });

    res.status(201).json({
      _id: studio._id,
      studioName: studio.studioName,
      studioPictures: studio.studioPictures,
      address: studio.address,
      facilities: studio.facilities,
      contactNumber: studio.contactNumber,
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
    res.json({
      _id: studio._id,
      studioName: studio.studioName,
      studioPictures: studio.studioPictures,
      address: studio.address,
      facilities: studio.facilities,
      contactNumber: studio.contactNumber,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAllStudios = async (req, res) => {
  try {
    const studio = await Studio.find();
    res.json(studio);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateStudio = async (req, res) => {
  try {
    const { studioName, studioPictures, address, facilities, contactNumber } =
      req.body;
    const studio = await Studio.findById(req.params.id);
    if (!studio) {
      return res.status(404).json({ message: "Studio not found" });
    }

    studio.studioName = studioName || studio.studioName;
    studio.studioPictures = studioPictures || studio.studioPictures;
    studio.address = address || studio.address;
    studio.facilities = facilities || studio.facilities;
    studio.contactNumber = contactNumber || studio.contactNumber;

    await studio.save();

    res.status(201).json({
      _id: studio._id,
      studioName: studio.studioName,
      studioPictures: studio.studioPictures,
      address: studio.address,
      facilities: studio.facilities,
      contactNumber: studio.contactNumber,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
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
