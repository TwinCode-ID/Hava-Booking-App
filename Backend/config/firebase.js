const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const getFirebaseCredential = () => {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
    );
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const credentialPath = path.resolve(
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    );
    const serviceAccount = JSON.parse(fs.readFileSync(credentialPath, "utf8"));
    return admin.credential.cert(serviceAccount);
  }

  return admin.credential.applicationDefault();
};

admin.initializeApp({
  credential: getFirebaseCredential(),
});

module.exports = admin;
