const { PKPass } = require("passkit-generator");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const User = require("../../models/UserData/User");

function formatUserIdDisplay(id) {
  // Keep QR = full id, but display shorter so it doesn’t break the layout
  // Example: 698e0dd3…de08c
  if (!id) return "";
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}…${id.slice(-5)}`;
}

exports.generatePass = async (req, res) => {
  try {
    const backendRoot = path.resolve(__dirname, "../../");
    const modelPath = path.join(backendRoot, "pass-models", "mypilates.pass");

    // TODO: replace with DB lookup
    const userId = req.params.id; // QR content

    if (userId) {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
    }

    const fullName = user.fullName;
    const memberSince = user.createdAt.getFullYear().toString();
    const phone = user.phoneNumber;

    const certificates = {
      wwdr: fs.readFileSync(path.join(backendRoot, "keys", "wwdr.pem")),
      signerCert: fs.readFileSync(
        path.join(backendRoot, "keys", "signerCert.pem"),
      ),
      signerKey: fs.readFileSync(
        path.join(backendRoot, "keys", "signerKey.pem"),
      ),
      signerKeyPassphrase: process.env.PASSWORD,
    };

    const pass = await PKPass.from(
      { model: modelPath, certificates },
      { serialNumber: userId }, // unique per user
    );

    pass.type = "generic";

    pass.primaryFields.push({ key: "name", label: "Name", value: fullName });

    pass.secondaryFields.push({
      key: "secondary0",
      label: "MEMBER SINCE",
      value: memberSince,
    });

    pass.auxiliaryFields.push(
      { key: "auxilary0", label: "MEMBER ID", value: String(userId).slice(-6) },
      { key: "auxilary1", label: "PHONE", value: phone },
      { key: "auxilary2", label: "", value: "" },
    );

    // QR = full userId
    pass.setBarcodes({
      message: userId,
      format: "PKBarcodeFormatQR",
    });

    const buffer = pass.getAsBuffer();
    res.setHeader("Content-Type", "application/vnd.apple.pkpass");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="mypilates-${userId}.pkpass"`,
    );
    return res.status(200).send(buffer);
  } catch (err) {
    console.error("❌ ERROR:", err);
    return res.status(500).send(`Error: ${err.message}`);
  }
};
