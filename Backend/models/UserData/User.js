const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    fcmTokens: [{ type: String }],
    fullName: { type: String, require: true },
    email: { type: String, require: true, unique: true },
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
    password: { type: String, select: false },
    phoneNumber: { type: String },
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
  delete returnedObject.password;
  delete returnedObject.authenticators;
  delete returnedObject.currentChallenge;
  return returnedObject;
};

userSchema.set("toJSON", { transform: removeSensitiveAuthenticationFields });
userSchema.set("toObject", {
  transform: removeSensitiveAuthenticationFields,
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return;
  if (this.password === "") return;

  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.matchPassword = function (enteredPassword) {
  if (!this.password || this.password === "") {
    return false;
  }
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
