const express = require("express");
const { query } = require("../db");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

router.get("/trending", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  try {
    let rows = await query(
      `SELECT t.id, t.user_id, t.task_id, t.remote_id, t.title, t.audio_url,
              t.image_url, t.prompt, t.style, t.tags, t.instrumental, t.duration,
              t.play_count, COALESCE(u.name, t.user_name) as user_name, t.artist_id, t.created_at
       FROM tracks t
       LEFT JOIN users u ON t.user_id = u.id
       ORDER BY t.play_count DESC, t.created_at DESC
       LIMIT ?`,
      [limit]
    );
    if (!Array.isArray(rows)) rows = [];
    res.json(rows.map((r) => ({ ...r, id: String(r.id) })));
  } catch (err) {
    console.error("Tracks trending error:", err.message || err);
    try {
      const fallback = await query(
        "SELECT * FROM tracks ORDER BY play_count DESC, created_at DESC LIMIT ?",
        [limit]
      );
      const rows = Array.isArray(fallback) ? fallback : [];
      res.json(rows.map((r) => ({ ...r, id: String(r.id) })));
    } catch (e2) {
      console.error("Tracks trending fallback error:", e2.message || e2);
      res.status(500).json({ error: "Database error" });
    }
  }
});

router.get("/by-tag/:tag", async (req, res) => {
  const tag = decodeURIComponent(req.params.tag);
  const limit = Math.min(parseInt(req.query.limit) || 30, 100);
  try {
    const rows = await query(
      `SELECT t.*, u.name as user_name FROM tracks t
       LEFT JOIN users u ON t.user_id = u.id
       WHERE t.tags LIKE ? OR t.style LIKE ?
       ORDER BY t.play_count DESC
       LIMIT ?`,
      [`%${tag}%`, `%${tag}%`, limit]
    );
    res.json(rows.map((r) => ({ ...r, id: r.id.toString() })));
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

router.post("/:trackId/play", authMiddleware, async (req, res) => {
  try {
    await query(
      "UPDATE tracks SET play_count = play_count + 1 WHERE id = ?",
      [req.params.trackId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

module.exports = router;
