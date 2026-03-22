const User = require("../../models/UserData/User");
const jwt = require("jsonwebtoken");

const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require("@simplewebauthn/server");

const RP_ID = "bookingservice.my.id";
const ORIGIN = `https://${RP_ID}`;

const base64urlToBuffer = (base64url) => {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4 ? "=".repeat(4 - (base64.length % 4)) : "";
  return Buffer.from(base64 + pad, "base64");
};

exports.registerStart = async (req, res) => {
  try {
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const options = await generateRegistrationOptions({
      rpName: "MyPilates",
      rpID: RP_ID,
      userID: new TextEncoder().encode(user._id.toString()),
      userName: user.email,
      userDisplayName: user.fullName || user.email,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "preferred",
      },
    });

    user.currentChallenge = options.challenge;
    await user.save();

    res.json(options);
  } catch (err) {
    console.error("registerStart error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.registerFinish = async (req, res) => {
  try {
    const { userId, registrationResponse } = req.body;

    const user = await User.findById(userId);
    if (!user || !user.currentChallenge) {
      return res.status(400).json({ error: "Invalid session" });
    }

    const verification = await verifyRegistrationResponse({
      response: registrationResponse,
      expectedChallenge: user.currentChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });

    if (!verification?.verified) {
      return res.status(400).json({ error: "Verification failed" });
    }

    const info = verification.registrationInfo;

    const credentialID = info?.credentialID ?? info?.credential?.id;

    const credentialPublicKey =
      info?.credentialPublicKey ?? info?.credential?.publicKey;

    const counter = info?.counter ?? info?.credential?.counter ?? 0;

    const transports = info?.credential?.transports ?? [];

    if (!credentialID || !credentialPublicKey) {
      return res.status(400).json({ error: "Invalid credential" });
    }

    const credentialIDString =
      typeof credentialID === "string"
        ? credentialID
        : Buffer.from(credentialID).toString("base64url");

    user.authenticators.push({
      credentialID: credentialIDString,
      credentialPublicKey: Buffer.from(credentialPublicKey),
      counter: counter,
      transports,
    });

    user.currentChallenge = undefined;
    await user.save();

    res.json({ success: true });
  } catch (err) {
    console.error("registerFinish error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.loginStart = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) return res.status(400).json({ error: "Email required" });

    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.authenticators?.length)
      return res.status(400).json({
        error: "No passkey registered",
      });

    console.log(
      "Using credentialIDs:",
      user.authenticators.map((a) => a.credentialID),
    );

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: user.authenticators.map((auth) => ({
        id: auth.credentialID,
        type: "public-key",
        transports: auth.transports ?? ["internal"],
      })),

      userVerification: "preferred",
    });

    user.currentChallenge = options.challenge;
    await user.save();

    res.json(options);
  } catch (err) {
    console.error("🔥 loginStart crash:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.loginFinish = async (req, res) => {
  try {
    const { email, response } = req.body;

    const user = await User.findOne({ email });
    if (!user || !user.currentChallenge) {
      return res.status(400).json({ error: "Session expired" });
    }

    // 1. Find the authenticator
    const authenticator = user.authenticators.find(
      (a) => a.credentialID === response.id,
    );

    if (!authenticator) {
      return res
        .status(400)
        .json({ error: "Credential not registered to this user" });
    }

    const credentialForLib = {
      id: authenticator.credentialID, // keep as base64url STRING
      publicKey: new Uint8Array(authenticator.credentialPublicKey), // bytes
      counter: authenticator.counter || 0,
      transports: authenticator.transports ?? [],
    };

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: user.currentChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: credentialForLib,
    });

    if (!verification.verified) {
      return res.status(400).json({ error: "Authentication failed" });
    }

    // 3. Update counter and clear challenge
    authenticator.counter = verification.authenticationInfo.newCounter;

    // Mark the subdocument as modified (sometimes needed for updates inside arrays)
    user.markModified("authenticators");

    user.currentChallenge = undefined;
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "60d",
    });

    res.json({ verified: true, token });
  } catch (err) {
    console.error("🔥 loginFinish crash:", err);
    res.status(500).json({ error: "Internal server error during login" });
  }
};
