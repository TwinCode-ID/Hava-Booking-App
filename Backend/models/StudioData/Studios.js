const mongoose = require("mongoose");

const studiosSchema = new mongoose.Schema(
  {
    studioName: { type: String, require: true },
    studioPictures: [
      {
        type: [String],
      },
    ],
    address: {
      street: { type: String, require: true },
      city: { type: String, require: true },
      zip: { type: String, require: true },
      coordinates: {
        type: [Number],
        require: true,
      },
    },
    facilities: [
      {
        type: [String],
        require: true,
      },
    ],
    contactNumber: {
      type: String,
      default: null,
    },
    bankDetails: [
      {
        accountHolderName: { type: String, default: null },
        bankName: { type: String, default: null },
        accountNumber: { type: String, default: null },
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Studios", studiosSchema);
