const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, require: true },
    email: { type: String, require: true, unique: true },
    appleUserId: {
      type: String,
      unique: true,
      sparse: true, // Important: Allows multiple users to have "null" appleUserId
    },

    authenticators: [
      {
        credentialID: { type: String, required: true },
        credentialPublicKey: { type: Buffer, required: true }, // Binary data
        counter: { type: Number, default: 0 },
        transports: [String], // ['internal', 'hybrid'] etc.
      },
    ],

    currentChallenge: { type: String },

    // 1. REMOVE "unique: true" from password.
    // Multiple users will have empty passwords, so it cannot be unique.
    password: { type: String },

    phoneNumber: { type: String },
    preferredStudioId: { type: mongoose.Schema.Types.ObjectId, ref: "Studios" },
    role: {
      type: String,
      enum: ["client", "studioAdmin", "devTeam"],
      default: "client", // Recommended: Set a default role
      // required: true, // You can remove 'required' if you have a default
    },
    adminStudioLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Studios",
    },
    avatar: String,
  },
  { timestamps: true },
);

// 2. UPDATE PRE-SAVE HOOK
// Do not hash if the password is an empty string
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return;

  // If password is explicitly empty (Studio Created User), skip hashing
  if (this.password === "") return;

  this.password = await bcrypt.hash(this.password, 10);
});

// 3. UPDATE MATCH PASSWORD
// Handle cases where password is empty (Studio Created User)
userSchema.methods.matchPassword = function (enteredPassword) {
  // If the DB user has no password set, they cannot login via password
  if (!this.password || this.password === "") {
    return false;
  }
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
