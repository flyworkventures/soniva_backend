const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const uploadsBaseUrl = process.env.UPLOADS_BASE_URL || baseUrl.replace(/\/api\/?$/, "");

module.exports = {
  port: process.env.PORT || 3000,
  baseUrl,
  uploadsBaseUrl,
  mysql: {
    host: process.env.MYSQL_HOST || "localhost",
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "sportsanalyzer_aimusic",
    port: process.env.MYSQL_PORT || 3306,
  },
  // Firebase Admin SDK - serviceAccountKey.json dosyasını proje köküne ekleyin
  firebaseServiceAccount: process.env.GOOGLE_APPLICATION_CREDENTIALS || "./serviceAccountKey.json",
  // Suno API - anahtar sadece sunucuda tutulur, istemciye gönderilmez
  sunoApiKey: process.env.SUNO_API_KEY || "4cb407806036dbe12084b1f9b958b8b5",
  sunoBaseUrl: process.env.SUNO_BASE_URL || "https://api.sunoapi.org",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  // Play Store abonelik doğrulama (service account JSON yolu - Play Console API erişimi gerekli)
  googlePlayPackageName: process.env.GOOGLE_PLAY_PACKAGE_NAME || "com.flywork.aimusicapp",
  googlePlayCredentialsPath:
    process.env.GOOGLE_PLAY_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS,
  // App Store abonelik doğrulama (App Store Connect > App > App Information > App-Specific Shared Secret)
  appleSharedSecret: process.env.APPLE_SHARED_SECRET || "",
};
