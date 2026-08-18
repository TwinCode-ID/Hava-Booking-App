const User = require("../../models/UserData/User");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require("@simplewebauthn/server");

const RP_ID = "bookingservice.my.id";
const ORIGIN = `https://${RP_ID}`;
const PASSKEY_NAME_MAX_LENGTH = 80;
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const DEVICE_TYPES = new Set(["singleDevice", "multiDevice"]);
const PASSKEY_TRANSPORTS = new Set([
  "ble",
  "cable",
  "hybrid",
  "internal",
  "nfc",
  "smart-card",
  "usb",
]);

const normalizePasskeyName = (name) => {
  if (typeof name !== "string") return "Passkey";

  const normalized = name
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, PASSKEY_NAME_MAX_LENGTH);

  return normalized || "Passkey";
};

const normalizeTransports = (transports) => {
  if (!Array.isArray(transports)) return [];

  return [
    ...new Set(
      transports.filter(
        (transport) =>
          typeof transport === "string" &&
          PASSKEY_TRANSPORTS.has(transport),
      ),
    ),
  ];
};

const getPasskeyCreatedAt = (authenticator) => {
  if (authenticator.createdAt) return authenticator.createdAt;

  if (typeof authenticator._id?.getTimestamp === "function") {
    return authenticator._id.getTimestamp();
  }

  return null;
};

const toSafePasskey = (authenticator) => ({
  id: authenticator._id.toString(),
  name: normalizePasskeyName(authenticator.name),
  createdAt: getPasskeyCreatedAt(authenticator),
  lastUsedAt: authenticator.lastUsedAt || null,
  deviceType: DEVICE_TYPES.has(authenticator.deviceType)
    ? authenticator.deviceType
    : "unknown",
  backedUp: Boolean(authenticator.backedUp),
  transports: normalizeTransports(authenticator.transports),
});

const toSafePasskeyList = (authenticators = []) =>
  authenticators
    .filter((authenticator) => authenticator?._id)
    .map(toSafePasskey)
    .sort((left, right) => {
      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right.createdAt
        ? new Date(right.createdAt).getTime()
        : 0;
      return rightTime - leftTime;
    });

const getAuthenticatedUserId = (req) => req.user?._id;

exports.listPasskeys = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const user = await User.findById(userId).select("+authenticators");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      passkeys: toSafePasskeyList(user.authenticators),
    });
  } catch (err) {
    console.error("listPasskeys error:", err);
    return res.status(500).json({ message: "Unable to list passkeys" });
  }
};

exports.deletePasskey = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const authenticatorId = req.params.authenticatorId?.trim();
    if (!authenticatorId || !OBJECT_ID_PATTERN.test(authenticatorId)) {
      return res.status(400).json({
        code: "INVALID_PASSKEY_ID",
        message: "Invalid passkey ID.",
      });
    }

    const user = await User.findById(userId).select("+authenticators");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const authenticators = user.authenticators || [];
    const authenticatorIndex = authenticators.findIndex(
      (authenticator) =>
        authenticator._id?.toString().toLowerCase() ===
        authenticatorId.toLowerCase(),
    );

    if (authenticatorIndex === -1) {
      return res.status(404).json({
        code: "PASSKEY_NOT_FOUND",
        message: "Passkey not found.",
      });
    }

    authenticators.splice(authenticatorIndex, 1);
    user.markModified("authenticators");
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Passkey removed successfully.",
      passkeys: toSafePasskeyList(user.authenticators),
    });
  } catch (err) {
    console.error("deletePasskey error:", err);
    return res.status(500).json({ message: "Unable to remove passkey" });
  }
};

exports.registerStart = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authorized" });
    }

    const user = await User.findById(userId).select(
      "+authenticators +currentChallenge",
    );
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
      excludeCredentials: (user.authenticators || []).map((authenticator) => ({
        id: authenticator.credentialID,
        type: "public-key",
        transports: normalizeTransports(authenticator.transports),
      })),
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
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authorized" });
    }

    const { registrationResponse } = req.body;
    const requestedName = req.body.name ?? req.body.deviceName;

    const user = await User.findById(userId).select(
      "+authenticators +currentChallenge",
    );
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

    const duplicateCredential = (user.authenticators || []).some(
      (authenticator) => authenticator.credentialID === credentialIDString,
    );
    if (duplicateCredential) {
      user.currentChallenge = undefined;
      await user.save();
      return res.status(409).json({
        code: "PASSKEY_ALREADY_REGISTERED",
        error: "This passkey is already registered.",
      });
    }

    const deviceType = DEVICE_TYPES.has(info?.credentialDeviceType)
      ? info.credentialDeviceType
      : "unknown";

    user.authenticators.push({
      _id: new mongoose.Types.ObjectId(),
      credentialID: credentialIDString,
      credentialPublicKey: Buffer.from(credentialPublicKey),
      counter: counter,
      transports: normalizeTransports(transports),
      name: normalizePasskeyName(requestedName),
      createdAt: new Date(),
      lastUsedAt: null,
      deviceType,
      backedUp: Boolean(info?.credentialBackedUp),
    });

    user.currentChallenge = undefined;
    await user.save();

    const passkey = user.authenticators[user.authenticators.length - 1];
    res.json({ success: true, passkey: toSafePasskey(passkey) });
  } catch (err) {
    console.error("registerFinish error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.loginStart = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) return res.status(400).json({ error: "Email required" });

    const user = await User.findOne({ email }).select(
      "+authenticators +currentChallenge",
    );

    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.authenticators?.length)
      return res.status(400).json({
        error: "No passkey registered",
      });

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

    const user = await User.findOne({ email }).select(
      "+authenticators +currentChallenge",
    );
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
    authenticator.lastUsedAt = new Date();

    if (
      DEVICE_TYPES.has(
        verification.authenticationInfo.credentialDeviceType,
      )
    ) {
      authenticator.deviceType =
        verification.authenticationInfo.credentialDeviceType;
    }
    authenticator.backedUp = Boolean(
      verification.authenticationInfo.credentialBackedUp,
    );

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
