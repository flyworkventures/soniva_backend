const admin = require("firebase-admin");
const path = require("path");
const config = require("./config");

let initialized = false;

function initFirebase() {
  if (initialized) return admin;
  try {
    const serviceAccountPath = path.resolve(
      process.cwd(),
      config.firebaseServiceAccount
    );
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    initialized = true;
  } catch (err) {
    console.error("Firebase Admin init error:", err.message);
    throw err;
  }
  return admin;
}

async function verifyIdToken(token) {
  if (!initialized) initFirebase();
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded;
  } catch (err) {
    console.error("[Firebase] verifyIdToken failed:", err.message || err);
    return null;
  }
}

module.exports = { initFirebase, verifyIdToken };
