const mongoose = require("mongoose");
const bcyrpt = require("bcryptjs");

const userSchema = new mongoose.Schema({
    fullName: {type: String, require: true},
    email: {type: String, require: true, unique: true},
    password: {type: String, require: true, unique: true},
    phoneNumber: {type: String, require: true, unique: true},
    preferredStudioId: {type: mongoose.Schema.Types.ObjectId, ref:"Studios"},
    role: {type: String, enum: ["client","studioAdmin","devTeam"], require: true},
    adminStudioLocation :  {type: mongoose.Schema.Types.ObjectId, ref:"Studios"},
    avatar: String,
},{timestamps: true});

userSchema.pre("save", async function () {
    if(!this.isModified("password")) return;
    this.password = await bcyrpt.hash(this.password, 10);
});

userSchema.methods.matchPassword = function (enteredPassword) {
    return bcyrpt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);