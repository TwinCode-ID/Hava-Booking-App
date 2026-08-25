const mongoose = require("mongoose");
const {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} = require("@simplewebauthn/server");
const { getPasskeyConfig } = require("../../config/passkeySecurity");
const { logAuthError } = require("../../helper/authSecurity");
const {
  getAuthVersion,
  issueAuthToken,
  issueReplacementAuthToken,
} = require("../../helper/authToken");
const {
  consumePasskeyCeremony,
  createPasskeyCeremony,
  getSessionBinding,
} = require("../../helper/passkeyCeremony");
const User = require("../../models/UserData/User");

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
const INVALID_CEREMONY_RESPONSE = {
  code: "PASSKEY_CEREMONY_INVALID",
  error: "This passkey request has expired or was already used.",
};
const AUTHENTICATION_FAILED_RESPONSE = {
  code: "PASSKEY_AUTHENTICATION_FAILED",
  error: "Passkey authentication failed.",
};

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
const getRegistrationSessionBinding = (req) =>
  getSessionBinding(getAuthenticatedUserId(req), req.auth?.jti);
const getExpectedUserHandle = (userId) =>
  Buffer.from(userId.toString(), "utf8").toString("base64url");
const isMatchingUserHandle = (response, userId) =>
  typeof response?.response?.userHandle === "string" &&
  response.response.userHandle === getExpectedUserHandle(userId);

const getAuthenticationChangeResponse = (user, accessClaims) => {
  const token = issueReplacementAuthToken(user, accessClaims);
  return token
    ? { reauthenticationRequired: false, token }
    : { reauthenticationRequired: true };
};

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
  } catch (error) {
    logAuthError("Passkey list failed", error);
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

    const user = await User.findOneAndUpdate(
      { _id: userId, "authenticators._id": authenticatorId },
      { $pull: { authenticators: { _id: authenticatorId } } },
      { new: true },
    ).select("+authenticators");
    if (!user) {
      return res.status(404).json({
        code: "PASSKEY_NOT_FOUND",
        message: "Passkey not found.",
      });
    }

    return res.status(200).json({
      success: true,
      code: "AUTHENTICATION_METHOD_CHANGED",
      message: "Passkey removed successfully.",
      passkeys: toSafePasskeyList(user.authenticators),
      ...getAuthenticationChangeResponse(user, req.auth),
    });
  } catch (error) {
    logAuthError("Passkey deletion failed", error);
    return res.status(500).json({ message: "Unable to remove passkey" });
  }
};

exports.registerStart = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const sessionBinding = getRegistrationSessionBinding(req);
    if (!userId || !sessionBinding) {
      return res.status(401).json({ error: "Not authorized" });
    }

    const user = await User.findById(userId).select("+authenticators");
    if (!user) return res.status(404).json({ error: "User not found" });

    const { rpID, rpName } = getPasskeyConfig();
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new TextEncoder().encode(user._id.toString()),
      userName: user.email,
      userDisplayName: user.fullName || user.email,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
      },
      excludeCredentials: (user.authenticators || []).map((authenticator) => ({
        id: authenticator.credentialID,
        type: "public-key",
        transports: normalizeTransports(authenticator.transports),
      })),
    });
    const ceremonyId = await createPasskeyCeremony({
      challenge: options.challenge,
      type: "registration",
      userId,
      sessionBinding,
    });

    return res.json({ ceremonyId, options });
  } catch (error) {
    logAuthError("Passkey registration start failed", error);
    return res
      .status(500)
      .json({ error: "Unable to start passkey registration." });
  }
};

exports.registerFinish = async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  const sessionBinding = getRegistrationSessionBinding(req);
  if (!userId || !sessionBinding) {
    return res.status(401).json({ error: "Not authorized" });
  }

  try {
    const ceremony = await consumePasskeyCeremony({
      ceremonyId: req.body?.ceremonyId,
      type: "registration",
      userId,
      sessionBinding,
    });
    if (!ceremony) {
      return res.status(400).json(INVALID_CEREMONY_RESPONSE);
    }

    const registrationResponse = req.body?.registrationResponse;
    if (!registrationResponse || typeof registrationResponse !== "object") {
      return res.status(400).json({ error: "Invalid registration response." });
    }

    const user = await User.findById(userId).select("+authenticators");
    if (!user) return res.status(400).json(INVALID_CEREMONY_RESPONSE);

    const { origins, rpID } = getPasskeyConfig();
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: registrationResponse,
        expectedChallenge: ceremony.challenge,
        expectedOrigin: origins,
        expectedRPID: rpID,
        expectedType: "webauthn.create",
        requireUserVerification: true,
      });
    } catch (error) {
      logAuthError("Passkey registration verification failed", error);
      return res.status(400).json({ error: "Passkey verification failed." });
    }
    if (!verification?.verified) {
      return res.status(400).json({ error: "Passkey verification failed." });
    }

    const info = verification.registrationInfo;
    const credentialID = info?.credentialID ?? info?.credential?.id;
    const credentialPublicKey =
      info?.credentialPublicKey ?? info?.credential?.publicKey;
    const counter = info?.counter ?? info?.credential?.counter ?? 0;
    const transports = info?.credential?.transports ?? [];
    if (!credentialID || !credentialPublicKey) {
      return res.status(400).json({ error: "Invalid passkey credential." });
    }

    const credentialIDString =
      typeof credentialID === "string"
        ? credentialID
        : Buffer.from(credentialID).toString("base64url");
    if (await User.exists({ "authenticators.credentialID": credentialIDString })) {
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
      counter,
      transports: normalizeTransports(transports),
      name: normalizePasskeyName(req.body.name ?? req.body.deviceName),
      createdAt: new Date(),
      lastUsedAt: null,
      deviceType,
      backedUp: Boolean(info?.credentialBackedUp),
    });
    user.authVersion = getAuthVersion(user) + 1;

    await user.save();
    const passkey = user.authenticators[user.authenticators.length - 1];
    return res.json({
      success: true,
      code: "AUTHENTICATION_METHOD_CHANGED",
      passkey: toSafePasskey(passkey),
      ...getAuthenticationChangeResponse(user, req.auth),
    });
  } catch (error) {
    logAuthError("Passkey registration finish failed", error);
    if (error?.code === 11000) {
      return res.status(409).json({
        code: "PASSKEY_ALREADY_REGISTERED",
        error: "This passkey is already registered.",
      });
    }
    return res.status(500).json({ error: "Unable to register passkey." });
  }
};

exports.loginStart = async (_req, res) => {
  try {
    const { rpID } = getPasskeyConfig();
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "required",
    });
    const ceremonyId = await createPasskeyCeremony({
      challenge: options.challenge,
      type: "authentication",
    });

    // This response never branches on account existence or enrollment state.
    return res.json({ ceremonyId, options });
  } catch (error) {
    logAuthError("Passkey login start failed", error);
    return res.status(500).json({ error: "Unable to start passkey sign-in." });
  }
};

exports.loginFinish = async (req, res) => {
  try {
    const ceremony = await consumePasskeyCeremony({
      ceremonyId: req.body?.ceremonyId,
      type: "authentication",
    });
    if (!ceremony) {
      return res.status(400).json(AUTHENTICATION_FAILED_RESPONSE);
    }

    const response = req.body?.response;
    if (!response || typeof response.id !== "string") {
      return res.status(400).json(AUTHENTICATION_FAILED_RESPONSE);
    }

    const user = await User.findOne({
      "authenticators.credentialID": response.id,
    }).select("+authenticators");
    if (!user || !isMatchingUserHandle(response, user._id)) {
      return res.status(400).json(AUTHENTICATION_FAILED_RESPONSE);
    }

    const authenticator = user.authenticators.find(
      (candidate) => candidate.credentialID === response.id,
    );
    if (!authenticator) {
      return res.status(400).json(AUTHENTICATION_FAILED_RESPONSE);
    }

    const credentialForLib = {
      id: authenticator.credentialID,
      publicKey: new Uint8Array(authenticator.credentialPublicKey),
      counter: authenticator.counter || 0,
      transports: authenticator.transports ?? [],
    };
    const { origins, rpID } = getPasskeyConfig();
    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: ceremony.challenge,
        expectedOrigin: origins,
        expectedRPID: rpID,
        expectedType: "webauthn.get",
        credential: credentialForLib,
        requireUserVerification: true,
      });
    } catch (error) {
      logAuthError("Passkey authentication verification failed", error);
      return res.status(400).json(AUTHENTICATION_FAILED_RESPONSE);
    }
    if (!verification?.verified) {
      return res.status(400).json(AUTHENTICATION_FAILED_RESPONSE);
    }

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
    user.markModified("authenticators");
    await user.save();

    const token = issueAuthToken(user._id, {
      authenticationMethod: "passkey",
      authVersion: getAuthVersion(user),
    });
    return res.json({ verified: true, token });
  } catch (error) {
    logAuthError("Passkey login finish failed", error);
    return res.status(500).json({ error: "Unable to complete passkey sign-in." });
  }
};

module.exports.AUTHENTICATION_FAILED_RESPONSE = AUTHENTICATION_FAILED_RESPONSE;
module.exports.INVALID_CEREMONY_RESPONSE = INVALID_CEREMONY_RESPONSE;
module.exports.getExpectedUserHandle = getExpectedUserHandle;
