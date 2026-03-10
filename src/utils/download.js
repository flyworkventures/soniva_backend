const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const UPLOADS_DIR = path.join(__dirname, "../../uploads");

/**
 * Downloads a file from URL and saves to uploads folder.
 * @param {string} fileUrl - Full URL (https or http)
 * @param {string} prefix - Filename prefix (e.g. "audio", "cover")
 * @param {string} defaultExt - Default extension if not in URL (e.g. "mp3", "jpg")
 * @returns {Promise<string|null>} Local filename (e.g. "audio_1234567890_abc123.mp3") or null on failure
 */
async function downloadToUploads(fileUrl, prefix = "file", defaultExt = "bin") {
  if (!fileUrl || typeof fileUrl !== "string" || !fileUrl.startsWith("http")) {
    return null;
  }
  try {
    const ext = getExtensionFromUrl(fileUrl) || defaultExt;
    const filename = `${prefix}_${Date.now()}_${randomId()}.${ext}`;
    const filepath = path.join(UPLOADS_DIR, filename);

    const data = await fetchUrl(fileUrl);
    if (!data || data.length === 0) return null;

    fs.writeFileSync(filepath, data);
    return filename;
  } catch (err) {
    console.error(`[download] Failed to download ${fileUrl}:`, err.message);
    return null;
  }
}

function getExtensionFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    return match ? match[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const opts = {
      headers: { "User-Agent": "Soniva-Backend/1.0" },
    };
    const req = protocol.get(url, opts, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error("Timeout"));
    });
  });
}

module.exports = { downloadToUploads };
