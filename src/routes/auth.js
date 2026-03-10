const express = require("express");
const { query } = require("../db");
const { verifyIdToken } = require("../firebase");

const router = express.Router();

router.post("/sync", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.substring(7);
  const decoded = await verifyIdToken(token);
  if (!decoded) {
    return res.status(401).json({ error: "Invalid token" });
  }

  const { userId, name, email, photoUrl } = req.body;
  const uid = userId || decoded.uid;

  try {
    await query(
      `INSERT INTO users (id, name, email, photo_url, credits, created_at, updated_at)
       VALUES (?, ?, ?, ?, 2, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         email = VALUES(email),
         photo_url = VALUES(photo_url),
         updated_at = NOW()`,
      [uid, name || decoded.name || "User", email || decoded.email || "", photoUrl || ""]
    );
    res.json({ success: true, userId: uid });
  } catch (err) {
    console.error("Auth sync error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

module.exports = router;
