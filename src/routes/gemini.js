const express = require("express");
const config = require("../config");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

const PRIMARY_MODEL = "gemini-3.1-flash-image-preview";
const FALLBACK_MODEL = "gemini-2.5-flash-image";

const SCENES = [
  "dark professional recording studio, deep purple and violet neon lighting",
  "futuristic concert stage with colorful laser beams and fog",
  "luxury penthouse music studio with floor-to-ceiling city views at night",
  "cyberpunk underground music club with neon strips and smoke",
  "cinematic outdoor rooftop stage at night with city skyline behind",
];

async function tryModel(model, prompt) {
  if (!config.geminiApiKey) {
    return null;
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.geminiApiKey}`;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: "1:1" },
    },
  });
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (resp.status !== 200) {
      console.error(`[Gemini ${model}] Error ${resp.status}:`, await resp.text());
      return null;
    }
    const json = await resp.json();
    const candidates = json.candidates || [];
    for (const candidate of candidates) {
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        if (part.thought) continue;
        const data = part.inlineData?.data;
        if (data) {
          return data;
        }
      }
    }
    return null;
  } catch (err) {
    console.error(`[Gemini ${model}] Exception:`, err.message);
    return null;
  }
}

router.use(authMiddleware);

router.post("/generate-artist-image", async (req, res) => {
  if (!config.geminiApiKey) {
    return res.status(503).json({ code: 503, msg: "Gemini API not configured" });
  }
  const { name, gender, physicalDescription, sceneIndex = 0 } = req.body;
  if (!name || !gender || !physicalDescription) {
    return res.status(400).json({
      code: 400,
      msg: "Missing required fields: name, gender, physicalDescription",
    });
  }
  const scene = SCENES[sceneIndex % SCENES.length];
  const genderDesc = gender === "female" ? "woman" : "man";
  const prompt =
    `Professional music artist portrait photo, square 1:1 format. ` +
    `Subject: a ${genderDesc} named ${name}. ${physicalDescription}. ` +
    `Background: ${scene}. ` +
    `There is a glowing neon sign on the wall that reads exactly "FW AI Music" in bright purple/pink neon light. ` +
    `High quality cinematic photography, dramatic professional lighting, ` +
    `ultra-realistic, detailed, artistic.`;

  let base64 = await tryModel(PRIMARY_MODEL, prompt);
  if (!base64) {
    base64 = await tryModel(FALLBACK_MODEL, prompt);
  }
  if (!base64) {
    return res.status(502).json({ code: 502, msg: "Image generation failed" });
  }
  res.json({ image: base64 });
});

module.exports = router;
