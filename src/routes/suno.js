const express = require("express");
const config = require("../config");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();
const sunoBase = (config.sunoBaseUrl || "https://api.sunoapi.org").replace(/\/$/, "");

if (!config.sunoApiKey) {
  console.warn("[Suno] SUNO_API_KEY not set - Suno proxy will return 503");
}

async function proxyToSuno(req, res, method, path, body = null) {
  if (!config.sunoApiKey) {
    return res.status(503).json({ code: 503, msg: "Suno API not configured" });
  }
  const url = `${sunoBase}${path}`;
  const headers = {
    Authorization: `Bearer ${config.sunoApiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  try {
    const opts = { method, headers };
    if (body && (method === "POST" || method === "PUT")) {
      opts.body = typeof body === "string" ? body : JSON.stringify(body);
    }
    const resp = await fetch(url, opts);
    const text = await resp.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      return res.status(resp.status).send(text);
    }
    res.status(resp.status).json(json);
  } catch (err) {
    console.error("[Suno] Proxy error:", err.message);
    res.status(502).json({ code: 502, msg: "Suno API request failed" });
  }
}

router.use(authMiddleware);

router.post("/generate", (req, res) => {
  proxyToSuno(req, res, "POST", "/api/v1/generate", req.body);
});

router.get("/generate/record-info", (req, res) => {
  const qs = new URLSearchParams(req.query).toString();
  proxyToSuno(req, res, "GET", `/api/v1/generate/record-info?${qs}`);
});

router.post("/lyrics", (req, res) => {
  proxyToSuno(req, res, "POST", "/api/v1/lyrics", req.body);
});

router.get("/lyrics/record-info", (req, res) => {
  const qs = new URLSearchParams(req.query).toString();
  proxyToSuno(req, res, "GET", `/api/v1/lyrics/record-info?${qs}`);
});

router.get("/credits", (req, res) => {
  proxyToSuno(req, res, "GET", "/api/v1/credits");
});

router.post("/generate-persona", (req, res) => {
  proxyToSuno(req, res, "POST", "/api/v1/generate/generate-persona", req.body);
});

module.exports = router;
