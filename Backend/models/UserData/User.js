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
    authenticators: [
      {
        credentialID: { type: String, required: true },
        credentialPublicKey: { type: Buffer, required: true },
        counter: { type: Number, default: 0 },
        transports: [String],
      },
    ],
    currentChallenge: { type: String },
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

// Never expose a password hash when a user document is serialized to JSON,
// even if a controller explicitly selected it for authentication.
userSchema.set("toJSON", {
  transform: (_document, returnedObject) => {
    delete returnedObject.password;
    return returnedObject;
  },
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
