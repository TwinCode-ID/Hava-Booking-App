const { PKPass } = require("passkit-generator");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const User = require("../../models/UserData/User");
const { idsEqual } = require("../../helper/authorization");
const { logAuthError } = require("../../helper/authSecurity");

function formatUserIdDisplay(id) {
  if (!id) return "";
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}…${id.slice(-5)}`;
}

exports.generatePass = async (req, res) => {
  try {
    const backendRoot = path.resolve(__dirname, "../../");
    const modelPath = path.join(backendRoot, "pass-models", "mypilates.pass");

    const userId = req.params.id; // QR content

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }
    if (!idsEqual(req.user?._id, userId)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const fullName = user.fullName || "Member";
    const memberSince = user.createdAt
      ? user.createdAt.getFullYear().toString()
      : new Date().getFullYear().toString();
    const phone = user.phoneNumber || "";

    const certificates = {
      wwdr: fs.readFileSync(
        process.env.APPLE_PASS_WWDR_PATH ||
          path.join(backendRoot, "keys", "wwdr.pem"),
      ),
      signerCert: fs.readFileSync(
        process.env.APPLE_PASS_SIGNER_CERT_PATH ||
          path.join(backendRoot, "keys", "signerCert.pem"),
      ),
      signerKey: fs.readFileSync(
        process.env.APPLE_PASS_SIGNER_KEY_PATH ||
          path.join(backendRoot, "keys", "signerKey.pem"),
      ),
      signerKeyPassphrase: process.env.APPLE_PASS_SIGNER_KEY_PASSPHRASE,
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
    logAuthError("Apple Wallet pass generation failed", err);
    return res.status(500).json({ message: "Unable to generate wallet pass." });
  }
};
