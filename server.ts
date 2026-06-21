import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";

// Initialize environment variables
dotenv.config();

// Setup lazy Gemini AI client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== "MY_GEMINI_API_KEY") {
      aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
  }
  return aiClient;
}

const app = express();
app.use(express.json({ limit: '10mb' })); // support higher payload sizes for images

// ==========================================
// AESTHETIC COVER ART LISTS (FALLBACK ENGINE)
// ==========================================
const DUMMY_COVERS: { [key: string]: string[] } = {
  acoustic: [
    "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=600&q=80",
    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=80",
    "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&q=80"
  ],
  contemporary: [
    "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&q=80",
    "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600&q=80",
    "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&q=80"
  ],
  gospel: [
    "https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=600&q=80",
    "https://images.unsplash.com/photo-1516280440614-37939bbacd6a?w=600&q=80",
    "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&q=80"
  ],
  traditional: [
    "https://images.unsplash.com/photo-1442504028989-ab58b5f29a4a?w=600&q=80",
    "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=600&q=80"
  ],
  rock: [
    "https://images.unsplash.com/photo-1484755560693-a4074577af3a?w=600&q=80",
    "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=600&q=80"
  ],
  default: [
    "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=600&q=80",
    "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=600&q=80",
    "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=600&q=80",
    "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&q=80"
  ]
};

// ==========================================
// 1. DYNAMIC API ROUTES
// ==========================================

// Health Check API
app.get("/api/health", (req, res) => {
  res.json({ status: "alive", engine: "Vite + Express Fullstack", timestamp: new Date().toISOString() });
});

// Real-time AI Beautifier
app.post("/api/gemini/beautify", async (req, res) => {
  const { rawLyrics, songInfo } = req.body;
  if (!rawLyrics || !rawLyrics.trim()) {
     res.status(400).json({ error: "Raw lyrics content is required." });
     return;
  }

  const ai = getGeminiClient();
  if (!ai) {
    console.warn("Gemini API key is not present. Falling back to structured parser offline.");
    res.json({
      success: true,
      formattedText: rawLyrics,
      enrichment: "Offline simulated mode. Double line breaks are marked as stanzas.",
      isSimulated: true
    });
    return;
  }

  try {
    const prompt = `You are a professional songwriting, lyrics proofreading, and typesetting expert.
Format the following song lyrics into clear structural blocks such as INTRO, VERSE, CHORUS, BRIDGE, OUTRO.
Rules:
- Do NOT alter any original content context, meanings, or lyric lines, but group them with empty lines separating paragraphs.
- Add UPPERCASE brackets indicators like [INTRO], [VERSE 1], [CHORUS], [BRIDGE], [OUTRO] exactly above each section block.
- Clean up messy indentations, irregular line breaks and format nicely.

Song Title: ${songInfo?.title || "Untitled"}
Artist: ${songInfo?.artist || "Unknown"}

RAW LYRICS DATA:
${rawLyrics}

Return the formatted lyrics text directly. Do not include any HTML, markdown, or chat text. Output only the beautified lyric text.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt
    });

    res.json({
      success: true,
      formattedText: response.text || rawLyrics,
      enrichment: "Formatted flawlessly by Gemini AI.",
      isSimulated: false
    });
  } catch (error: any) {
    console.error("Gemini Beautify Error:", error);
    res.status(500).json({ error: "Gemini formatting failed: " + error.message });
  }
});

// Spell Correct / Typos Fixer Endpoint
app.post("/api/gemini/correct", async (req, res) => {
  const { rawLyrics, songInfo } = req.body;
  if (!rawLyrics || !rawLyrics.trim()) {
    res.status(400).json({ error: "Lyrics content is required." });
    return;
  }

  const ai = getGeminiClient();
  if (!ai) {
     res.json({
       success: true,
       formattedText: rawLyrics,
       enrichment: "Offline mode: Typo checking requires an active API key.",
       isSimulated: true
     });
     return;
  }

  try {
    const prompt = `You are an expert record label music proofreader.
Analyze and correct any misspelled words, typing typos, and grammar mistakes in these song lyrics.
Rules:
- Strictly PRESERVE the song's context, phonetic spellings (like 'cause, 'til, runnin'), slang, or repetition.
- Do NOT rewrite lines, only patch actual typos and spelling mistakes (e.g. correct 'beutiful' to 'beautiful', 'recievd' to 'received').
- Keep the paragraph splits and any brackets brackets identical.

Song Title: ${songInfo?.title || "Untitled"}
Artist: ${songInfo?.artist || "Unknown"}

LYRICS INPUT:
${rawLyrics}

Return the corrected lyrics text directly. Do not include any chat summaries, explanations, or metadata. Output only the corrected lyric text.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt
    });

    res.json({
      success: true,
      formattedText: response.text || rawLyrics,
      enrichment: "Proofread and spell-corrected by Gemini AI.",
      isSimulated: false
    });
  } catch (err: any) {
    console.error("Gemini proofread typo-correction error:", err);
    res.status(500).json({ error: "AI lyrics proofreading failed: " + err.message });
  }
});

// AI 1:1 Album/Cover graphic generator or aesthetic Search fallback
app.post("/api/gemini/generate-cover", async (req, res) => {
  const { title, artist, genre } = req.body;
  if (!title) {
    res.status(400).json({ error: "Song title is required." });
    return;
  }

  const cleanGenre = String(genre || "default").toLowerCase();
  const fallbackList = DUMMY_COVERS[cleanGenre] || DUMMY_COVERS.default;
  const randomIndex = Math.floor(Math.random() * fallbackList.length);
  const fallbackUrl = fallbackList[randomIndex];

  const ai = getGeminiClient();
  if (!ai) {
    // Return stunning high-vibe curated Unsplash fallback
    console.log("No Gemini SDK client. Returning Unsplash curated musical fallback.");
    res.json({
      success: true,
      source: 'unsplash-curated',
      url: fallbackUrl
    });
    return;
  }

  try {
    const promptText = `A premium quality, stunningly artistic abstract music cover art for a song named "${title}" by "${artist || "Unknown"}". Genre is ${genre || "Worship"}. Visual style: modern, clean, dreamy gradient overlay, high-contrast, beautiful aesthetic vector or oil painting, no words or text on the cover.`;
    
    // Call Imagen 3 model natively for image generation
    const response = await ai.models.generateImages({
      model: "imagen-3.0-generate-002",
      prompt: promptText,
      config: {
        numberOfImages: 1,
        outputMimeType: "image/jpeg",
        aspectRatio: "1:1",
      }
    });

    if (response?.generatedImages?.[0]?.image?.imageBytes) {
      const base64Data = `data:image/jpeg;base64,${response.generatedImages[0].image.imageBytes}`;
      res.json({
        success: true,
        source: 'imagen',
        url: base64Data
      });
      return;
    }

    res.json({
      success: true,
      source: 'unsplash-fallback',
      url: fallbackUrl
    });
  } catch (error: any) {
    console.warn("Imagen generation failed or not provisioned under key. Serving Unsplash musical cover art.", error);
    res.json({
      success: true,
      source: 'unsplash-fallback',
      url: fallbackUrl
    });
  }
});

// ==========================================
// 2. VITE DEV AND PRODUCTION STATIC SERVING
// ==========================================
async function startServer() {
  const PORT = 3000;
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEV mode. Mounting Vite middleware...");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    console.log(`Starting server in PRODUCTION mode. Serving static assets from: ${distPath}`);
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Bind to 0.0.0.0 and port 3000
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

export { app };
export default app;
