const mongoose = require("mongoose");
const bcyrpt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, require: true },
    email: { type: String, require: true, unique: true },

    // 1. REMOVE "unique: true" from password.
    // Multiple users will have empty passwords, so it cannot be unique.
    password: { type: String },

    phoneNumber: { type: String },
    preferredStudioId: { type: mongoose.Schema.Types.ObjectId, ref: "Studios" },
    role: {
      type: String,
      enum: ["client", "studioAdmin", "devTeam"],
      require: true,
    },
    adminStudioLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Studios",
    },
    avatar: String,
  },
  { timestamps: true }
);

// 2. UPDATE PRE-SAVE HOOK
// Do not hash if the password is an empty string
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return;

  // If password is explicitly empty (Studio Created User), skip hashing
  if (this.password === "") return;

  this.password = await bcyrpt.hash(this.password, 10);
});

// 3. UPDATE MATCH PASSWORD
// Handle cases where password is empty (Studio Created User)
userSchema.methods.matchPassword = function (enteredPassword) {
  // If the DB user has no password set, they cannot login via password
  if (!this.password || this.password === "") {
    return false;
  }
  return bcyrpt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
