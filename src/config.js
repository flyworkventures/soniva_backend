require("dotenv").config();

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
    database: process.env.MYSQL_DATABASE || "db_aimusic", 
    port: process.env.MYSQL_PORT || 3306,
  },
  firebaseServiceAccount: process.env.GOOGLE_APPLICATION_CREDENTIALS || "./serviceAccountKey.json",
  sunoApiKey: process.env.SUNO_API_KEY || "",
  sunoBaseUrl: process.env.SUNO_BASE_URL || "https://api.sunoapi.org",
};
