const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { normalizePhoneNumber } = require("../../helper/phoneNumber");

const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

const userSchema = new mongoose.Schema(
  {
    fcmTokens: [{ type: String, maxlength: 4096 }],
    fullName: { type: String, require: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    appleUserId: {
      type: String,
      unique: true,
      sparse: true,
    },
    googleUserId: {
      type: String,
      unique: true,
      sparse: true,
    },
    authenticators: {
      type: [
        {
          credentialID: { type: String, required: true },
          credentialPublicKey: { type: Buffer, required: true },
          counter: { type: Number, default: 0 },
          transports: [String],
          name: { type: String, maxlength: 80, default: "Passkey" },
          createdAt: { type: Date },
          lastUsedAt: { type: Date },
          deviceType: {
            type: String,
            enum: ["singleDevice", "multiDevice", "unknown"],
            default: "unknown",
          },
          backedUp: { type: Boolean, default: false },
        },
      ],
      default: [],
      select: false,
    },
    currentChallenge: { type: String, select: false },
    currentChallengeExpiresAt: { type: Date, select: false },
    currentChallengeType: {
      type: String,
      enum: ["authentication", "registration"],
      select: false,
    },
    password: { type: String, select: false },
    authVersion: { type: Number, default: 0, min: 0 },
    passwordChangedAt: { type: Date, select: false },
    phoneNumber: { type: String },
    // Canonical E.164 form of phoneNumber, derived on every write. Sign-in
    // resolves an account through this field so the number a member keeps in
    // their profile is the number they can sign in with.
    phoneNumberE164: { type: String, index: true, sparse: true },
    isStudent: { type: Boolean, default: false },
    preferredStudioId: { type: mongoose.Schema.Types.ObjectId, ref: "Studios" },
    role: {
      type: String,
      enum: ["client", "studioAdmin", "devTeam"],
      default: "client",
    },
    adminStudioLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Studios",
    },
    avatar: String,
  },
  { timestamps: true },
);

// Never serialize authentication secrets, even when a controller explicitly
// selected them for an authentication operation.
const removeSensitiveAuthenticationFields = (_document, returnedObject) => {
  delete returnedObject.phoneNumberE164;
  delete returnedObject.password;
  delete returnedObject.authenticators;
  delete returnedObject.currentChallenge;
  delete returnedObject.currentChallengeExpiresAt;
  delete returnedObject.currentChallengeType;
  delete returnedObject.authVersion;
  delete returnedObject.passwordChangedAt;
  return returnedObject;
};

userSchema.set("toJSON", { transform: removeSensitiveAuthenticationFields });
userSchema.set("toObject", {
  transform: removeSensitiveAuthenticationFields,
});

// A credential must never be attachable to two accounts. The controller also
// checks within a user document so the multikey index is complemented by an
// application-level duplicate check.
userSchema.index(
  { "authenticators.credentialID": 1 },
  { unique: true, sparse: true },
);

userSchema.pre("save", async function () {
  if (this.isModified("phoneNumber")) {
    this.phoneNumberE164 = normalizePhoneNumber(this.phoneNumber) || undefined;
  }

  const passwordChanged = this.isModified("password");
  const authenticationChanged =
    !this.isNew &&
    (passwordChanged ||
      this.isModified("appleUserId") ||
      this.isModified("email") ||
      this.isModified("googleUserId") ||
      this.isModified("role") ||
      this.isModified("adminStudioLocation"));

  if (passwordChanged) {
    this.passwordChangedAt = new Date();
    if (this.password !== "") {
      if (this.$locals?.passwordAlreadyHashed === true) {
        if (!BCRYPT_HASH_PATTERN.test(this.password)) {
          throw new Error("Refusing to store an invalid password digest.");
        }
      } else {
        this.password = await bcrypt.hash(this.password, 10);
      }
    }
  }

  if (authenticationChanged) {
    const currentVersion = Number.isSafeInteger(this.authVersion)
      ? this.authVersion
      : 0;
    this.authVersion = currentVersion + 1;
  }
});

// Pending registrations contain a one-way digest so the plaintext password is
// never retained while email ownership is unverified. This internal-only
// constructor avoids hashing that digest a second time during activation.
userSchema.statics.createWithPasswordHash = async function (attributes) {
  if (!BCRYPT_HASH_PATTERN.test(attributes?.password || "")) {
    throw new Error("Cannot activate a user without a valid password digest.");
  }
  const user = new this(attributes);
  user.$locals.passwordAlreadyHashed = true;
  return user.save();
};

// Keep query-based authentication and privilege mutations coupled to session
// revocation even when they do not use save().
userSchema.pre(["findOneAndUpdate", "updateOne", "updateMany"], function () {
  const update = this.getUpdate();
  if (!update || Array.isArray(update)) return;

  // The derived sign-in identifier must never drift from the stored number,
  // including when a profile is edited without loading the document.
  const phoneNumberUpdate = Object.hasOwn(update, "phoneNumber")
    ? update
    : update.$set && Object.hasOwn(update.$set, "phoneNumber")
      ? update.$set
      : null;
  if (phoneNumberUpdate) {
    const normalized = normalizePhoneNumber(phoneNumberUpdate.phoneNumber);
    if (normalized) {
      phoneNumberUpdate.phoneNumberE164 = normalized;
    } else {
      delete phoneNumberUpdate.phoneNumberE164;
      update.$unset = { ...update.$unset, phoneNumberE164: "" };
    }
    this.setUpdate(update);
  }

  const authenticationFields = new Set([
    "adminStudioLocation",
    "appleUserId",
    "authenticators",
    "email",
    "googleUserId",
    "password",
    "role",
  ]);
  const touchesAuthenticationField = (changes) =>
    changes &&
    Object.keys(changes).some((path) =>
      authenticationFields.has(path.split(".")[0]),
    );
  const authenticationChanged = Boolean(
    touchesAuthenticationField(update) ||
      touchesAuthenticationField(update.$set) ||
      touchesAuthenticationField(update.$unset) ||
      touchesAuthenticationField(update.$pull) ||
      touchesAuthenticationField(update.$push) ||
      touchesAuthenticationField(update.$addToSet),
  );
  if (!authenticationChanged) return;

  update.$inc = update.$inc || {};
  if (
    !Number.isSafeInteger(update.$inc.authVersion) ||
    update.$inc.authVersion < 1
  ) {
    update.$inc.authVersion = 1;
  }
  this.setUpdate(update);
});

userSchema.methods.matchPassword = function (enteredPassword) {
  if (!this.password || this.password === "") {
    return false;
  }
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
