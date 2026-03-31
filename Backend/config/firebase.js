const admin = require("firebase-admin");
const serviceAccount = require("../mypilates-c7465-firebase-adminsdk-fbsvc-332adb77b7.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
