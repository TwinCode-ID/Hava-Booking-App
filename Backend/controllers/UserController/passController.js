const { PKPass } = require("passkit-generator");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

exports.generatePass = async (req, res) => {
  try {
    const backendRoot = path.resolve(__dirname, "../../");
    const modelPath = path.join(backendRoot, "pass-models", "mypilates.pass");

    const certificates = {
      wwdr: fs.readFileSync(path.join(backendRoot, "keys", "wwdr.pem")),
      signerCert: fs.readFileSync(
        path.join(backendRoot, "keys", "signerCert.pem"),
      ),
      signerKey: fs.readFileSync(
        path.join(backendRoot, "keys", "signerKey.pem"),
      ),
      signerKeyPassphrase:
        process.env.SIGNER_KEY_PASSPHRASE || "W1ll14m70n4th417.",
    };

    // ✅ Load pass.json + images from the model folder correctly
    const pass = await PKPass.from(
      { model: modelPath, certificates },
      { serialNumber: req.params.id || "123456" },
    );

    // If your pass.json already defines eventTicket, you can omit this.
    pass.type = "generic";

    pass.primaryFields.push({
      key: "event",
      label: "CLASS",
      value: "Junior Private",
    });

    pass.secondaryFields.push({
      key: "date",
      label: "TIME",
      value: new Date(),
      dateStyle: "PKDateStyleMedium",
      timeStyle: "PKDateStyleShort",
    });

    pass.auxiliaryFields.push({
      key: "location",
      label: "STUDIO",
      value: "BASI Pilates West Java",
    });

    pass.setBarcodes({
      message: req.params.id,
      format: "PKBarcodeFormatQR",
      altText: req.params.id,
    });

    const buffer = pass.getAsBuffer();

    res.setHeader("Content-Type", "application/vnd.apple.pkpass");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="mypilates-${pass.serialNumber}.pkpass"`,
    );

    return res.status(200).send(buffer);
  } catch (err) {
    console.error("❌ ERROR:", err);
    return res.status(500).send(`Error: ${err.message}`);
  }
};
