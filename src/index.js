const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const config = require("./config");
const { initFirebase } = require("./firebase");
const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users");
const tracksRoutes = require("./routes/tracks");
const sunoRoutes = require("./routes/suno");

if (!fs.existsSync(path.join(__dirname, "../uploads"))) {
  fs.mkdirSync(path.join(__dirname, "../uploads"), { recursive: true });
}

const app = express();

app.use(cors());
app.use(express.json());

initFirebase();

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/tracks", tracksRoutes);
app.use("/api/suno", sunoRoutes);

const uploadsPath = path.join(__dirname, "../uploads");
const mimeTypes = { ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png" };
app.use("/uploads", express.static(uploadsPath, {
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (mimeTypes[ext]) res.setHeader("Content-Type", mimeTypes[ext]);
    res.setHeader("Accept-Ranges", "bytes");
  },
}));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(config.port, () => {
  console.log(`Soniva Backend API running on port ${config.port}`);
});
