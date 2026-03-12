const express = require("express");
const path = require("path");
const multer = require("multer");
const config = require("../config");
const { query } = require("../db");
const { authMiddleware } = require("../middleware/auth");
const { downloadToUploads } = require("../utils/download");
const { verifyUserSubscription } = require("../services/subscriptionVerifier");

const router = express.Router();
const upload = multer({
  dest: path.join(__dirname, "../../uploads"),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.use(authMiddleware);

router.get("/:userId/credits", async (req, res) => {
  if (req.user.uid !== req.params.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const rows = await query(
      "SELECT credits FROM users WHERE id = ?",
      [req.params.userId]
    );
    res.json({ credits: rows[0]?.credits ?? 0 });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

router.patch("/:userId/credits", async (req, res) => {
  if (req.user.uid !== req.params.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const { credits } = req.body;
  try {
    await query("UPDATE users SET credits = ?, updated_at = NOW() WHERE id = ?", [
      credits,
      req.params.userId,
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

router.post("/:userId/credits/add", async (req, res) => {
  if (req.user.uid !== req.params.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const { delta } = req.body;
  const deltaNum = parseInt(delta, 10);
  if (isNaN(deltaNum)) {
    return res.status(400).json({ error: "Invalid delta" });
  }
  try {
    // Negatif delta (kredi düşümü): yeterli bakiye kontrolü
    if (deltaNum < 0) {
      const [rows] = await query(
        "SELECT credits FROM users WHERE id = ?",
        [req.params.userId]
      );
      const current = rows[0]?.credits ?? 0;
      if (current + deltaNum < 0) {
        return res.status(402).json({
          error: "Insufficient credits",
          credits: current,
          required: Math.abs(deltaNum),
        });
      }
    }
    await query(
      "UPDATE users SET credits = credits + ?, updated_at = NOW() WHERE id = ?",
      [deltaNum, req.params.userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

router.get("/:userId/subscription/verify", async (req, res) => {
  if (req.user.uid !== req.params.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const userId = req.params.userId;
  try {
    const result = await verifyUserSubscription(userId);
    if (result === null) {
      return res.status(503).json({
        error: "Subscription verification unavailable",
        active: false,
      });
    }
    if (result.active) {
      const subRows = await query(
        "SELECT id, expires_at FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
        [userId]
      );
      const sub = subRows[0];
      const storedExpiry = sub?.expires_at
        ? new Date(sub.expires_at).getTime()
        : 0;
      const newExpiry = result.expiryTimeMillis || 0;
      const isRenewal = newExpiry > storedExpiry;
      if (isRenewal || storedExpiry === 0) {
        await query(
          "UPDATE users SET credits = ?, updated_at = NOW() WHERE id = ?",
          [result.credits, userId]
        );
        if (newExpiry > 0 && sub?.id) {
          await query(
            "UPDATE subscriptions SET expires_at = FROM_UNIXTIME(?) WHERE id = ?",
            [Math.floor(newExpiry / 1000), sub.id]
          );
        }
      }
      const creditsRows = await query(
        "SELECT credits FROM users WHERE id = ?",
        [userId]
      );
      const credits = creditsRows?.[0]?.credits ?? result.credits;
      return res.json({ active: true, credits });
    }
    await query(
      "UPDATE users SET credits = 0, updated_at = NOW() WHERE id = ?",
      [userId]
    );
    await query("DELETE FROM subscriptions WHERE user_id = ?", [userId]);
    return res.json({ active: false, credits: 0 });
  } catch (err) {
    console.error("Subscription verify error:", err);
    return res.status(500).json({ error: "Database error", active: false });
  }
});

router.post("/:userId/subscription/clear", async (req, res) => {
  if (req.user.uid !== req.params.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const userId = req.params.userId;
  try {
    await query("UPDATE users SET credits = 0, updated_at = NOW() WHERE id = ?", [
      userId,
    ]);
    await query("DELETE FROM subscriptions WHERE user_id = ?", [userId]);
    res.json({ success: true });
  } catch (err) {
    console.error("Subscription clear error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

router.post("/:userId/subscriptions", async (req, res) => {
  if (req.user.uid !== req.params.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const data = req.body;
  const userId = req.params.userId;
  try {
    await query(
      `INSERT INTO users (id, name, email, photo_url, credits, created_at, updated_at)
       VALUES (?, ?, ?, ?, 2, NOW(), NOW())
       ON DUPLICATE KEY UPDATE updated_at = NOW()`,
      [userId, "User", req.user.email || "", ""]
    );

    const productId = data.productId || data.product_id || "";
    const platform = data.platform || "ios";
    const transactionId = data.transactionId || data.transaction_id || null;
    const purchaseToken = data.purchaseToken || data.purchase_token || null;
    const price = data.price ?? null;
    const currency = data.currency || null;
    const purchaseDate = data.purchaseDate || data.purchase_date || null;
    const expiresAt = data.expiresAt || data.expires_at || null;
    const productTitle = data.productTitle || data.product_title || null;
    const rawData = data.rawData ? JSON.stringify(data.rawData) : null;

    await query(
      `INSERT INTO subscriptions (user_id, user_email, user_name, product_id, product_title, platform,
       transaction_id, purchase_token, price, currency, status, purchase_date, expires_at, raw_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
      [
        userId,
        req.user.email || null,
        data.userName || data.user_name || null,
        productId,
        productTitle,
        platform,
        transactionId,
        purchaseToken,
        price,
        currency,
        purchaseDate,
        expiresAt,
        rawData,
      ]
    );

    const creditMap = {
      "com.fw.aimusic.weekly": 50,
      "com.fw.aimusic.monthly": 300,
      "com.fw.aimusic.yearly": 999,
    };
    const creditsToAdd = creditMap[productId] ?? 50;
    await query(
      "UPDATE users SET credits = credits + ?, updated_at = NOW() WHERE id = ?",
      [creditsToAdd, userId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Subscription save error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

router.get("/:userId/tracks", async (req, res) => {
  if (req.user.uid !== req.params.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const rows = await query(
      "SELECT * FROM tracks WHERE user_id = ? ORDER BY created_at DESC",
      [req.params.userId]
    );
    res.json(rows.map((r) => ({ ...r, id: r.id.toString() })));
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

router.post("/:userId/tracks", async (req, res) => {
  if (req.user.uid !== req.params.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const data = req.body;
  const userId = req.params.userId;
  try {
    await query(
      `INSERT INTO users (id, name, email, photo_url, credits, created_at, updated_at)
       VALUES (?, ?, ?, ?, 2, NOW(), NOW())
       ON DUPLICATE KEY UPDATE updated_at = NOW()`,
      [userId, "User", req.user.email || "", ""]
    );

    let audioUrl = data.audioUrl || null;
    let imageUrl = data.imageUrl || null;
    try {
      const base = (config.uploadsBaseUrl || "").replace(/\/$/, "") || "https://soniva.fly-work.com";
      if (data.audioUrl) {
        const audioFile = await Promise.race([
          downloadToUploads(data.audioUrl, "audio", "mp3"),
          new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 20000)),
        ]).catch((e) => {
          console.warn("[Track] Audio download failed:", e?.message || e);
          return null;
        });
        if (audioFile) audioUrl = `${base}/uploads/${audioFile}`;
      }
      if (data.imageUrl) {
        const imageFile = await Promise.race([
          downloadToUploads(data.imageUrl, "cover", "jpg"),
          new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 15000)),
        ]).catch((e) => {
          console.warn("[Track] Image download failed:", e?.message || e);
          return null;
        });
        if (imageFile) imageUrl = `${base}/uploads/${imageFile}`;
      }
    } catch (dlErr) {
      console.warn("[Track] Download skipped:", dlErr?.message || dlErr);
    }

    const result = await query(
      `INSERT INTO tracks (user_id, task_id, remote_id, title, audio_url, image_url, prompt, style, tags, instrumental, duration, play_count, user_name, artist_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        userId,
        data.taskId || "",
        data.remoteId || null,
        data.title || null,
        audioUrl,
        imageUrl,
        data.prompt || "",
        data.style || null,
        data.tags || null,
        data.instrumental ? 1 : 0,
        data.duration || null,
        data.playCount || 0,
        data.userName || null,
        data.artistId || null,
      ]
    );
    const insertId = result.insertId ?? (Array.isArray(result) ? result[0]?.insertId : null);
    res.json({ id: String(insertId ?? "") });
  } catch (err) {
    console.error("Track save error:", err.message || err, err.stack);
    res.status(500).json({ error: "Database error" });
  }
});

router.delete("/:userId/tracks/:trackId", async (req, res) => {
  if (req.user.uid !== req.params.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    await query("DELETE FROM tracks WHERE id = ? AND user_id = ?", [
      req.params.trackId,
      req.params.userId,
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

router.get("/:userId/artists", async (req, res) => {
  if (req.user.uid !== req.params.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const rows = await query(
      "SELECT * FROM artists WHERE user_id = ? ORDER BY created_at DESC",
      [req.params.userId]
    );
    res.json(rows.map((r) => ({ ...r, id: r.id.toString() })));
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

router.post("/:userId/artists/:artistId/image", upload.single("image"), async (req, res) => {
  if (req.user.uid !== req.params.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (!req.file) {
    return res.status(400).json({ error: "No image file" });
  }
  const imageUrl = `${config.baseUrl}/uploads/${req.file.filename}`;
  await query(
    "UPDATE artists SET image_url = ?, updated_at = NOW() WHERE id = ? AND user_id = ?",
    [imageUrl, req.params.artistId, req.params.userId]
  );
  res.json({ imageUrl });
});

router.get("/:userId/artists/:artistId", async (req, res) => {
  if (req.user.uid !== req.params.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const rows = await query(
      "SELECT * FROM artists WHERE id = ? AND user_id = ?",
      [req.params.artistId, req.params.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json({ ...rows[0], id: rows[0].id.toString() });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

router.post("/:userId/artists", async (req, res) => {
  if (req.user.uid !== req.params.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const data = req.body;
  const userId = req.params.userId;
  try {
    await query(
      `INSERT INTO users (id, name, email, photo_url, credits, created_at, updated_at)
       VALUES (?, ?, ?, ?, 2, NOW(), NOW())
       ON DUPLICATE KEY UPDATE updated_at = NOW()`,
      [userId, "User", req.user.email || "", ""]
    );

    const result = await query(
      `INSERT INTO artists (user_id, name, gender, description, image_url, persona_id, persona_task_id, persona_audio_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        userId,
        data.name || "",
        data.gender || "male",
        data.description || "",
        data.imageUrl || null,
        data.personaId || null,
        data.personaTaskId || null,
        data.personaAudioId || null,
      ]
    );
    const insertId = result.insertId ?? (Array.isArray(result) ? result[0]?.insertId : null);
    res.json({ id: String(insertId ?? "") });
  } catch (err) {
    console.error("Artist save error:", err.message || err);
    res.status(500).json({ error: "Database error" });
  }
});

router.patch("/:userId/artists/:artistId", async (req, res) => {
  if (req.user.uid !== req.params.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const data = req.body;
  const allowed = ["name", "gender", "description", "imageUrl", "personaId", "personaTaskId", "personaAudioId"];
  const updates = [];
  const values = [];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      const col = key.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
      updates.push(`${col} = ?`);
      values.push(data[key]);
    }
  }
  if (updates.length === 0) return res.json({ success: true });
  values.push(req.params.artistId, req.params.userId);
  try {
    await query(
      `UPDATE artists SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ? AND user_id = ?`,
      values
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

router.delete("/:userId/artists/:artistId", async (req, res) => {
  if (req.user.uid !== req.params.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    await query("DELETE FROM artists WHERE id = ? AND user_id = ?", [
      req.params.artistId,
      req.params.userId,
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

module.exports = router;
