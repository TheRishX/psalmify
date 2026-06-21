import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";

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

function cleanMarkdownBlocks(text: string): string {
  if (!text) return "";
  return text
    .replace(/^[ \t]*```[a-zA-Z0-9-]*\n?/gm, "")
    .replace(/\n?```[ \t]*$/gm, "")
    .trim();
}

const app = express();
app.use(express.json({ limit: '10mb' })); // support higher payload sizes for images

// Support Vercel API routing: rewrite req.url if routed by vercel.json rewrite
app.use((req, res, next) => {
  if (req.url && req.url.includes("__vercel_api_path=")) {
    try {
      const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const apiPath = urlObj.searchParams.get("__vercel_api_path");
      if (apiPath) {
        req.url = apiPath;
      }
    } catch (e) {
      console.warn("Vercel route query rewrite error:", e);
    }
  }
  next();
});

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

    const outputText = response.text || "";
    const cleanedText = cleanMarkdownBlocks(outputText) || rawLyrics;

    res.json({
      success: true,
      formattedText: cleanedText,
      enrichment: "Formatted flawlessly by Gemini AI.",
      isSimulated: false
    });
  } catch (error: any) {
    console.error("Gemini Beautify Error:", error);
    // Return success: false but with status 200, so client json parser never fails
    res.json({
      success: false,
      error: "Gemini formatting failed: " + error.message,
      formattedText: rawLyrics
    });
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

    const outputText = response.text || "";
    const cleanedText = cleanMarkdownBlocks(outputText) || rawLyrics;

    res.json({
      success: true,
      formattedText: cleanedText,
      enrichment: "Proofread and spell-corrected by Gemini AI.",
      isSimulated: false
    });
  } catch (err: any) {
    console.error("Gemini proofread typo-correction error:", err);
    res.json({
      success: false,
      error: "AI lyrics proofreading failed: " + err.message,
      formattedText: rawLyrics
    });
  }
});

// AI Translation / Devanagari Converter Endpoint
app.post("/api/gemini/translate", async (req, res) => {
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
       enrichment: "Offline mode: Translate requires an active API key.",
       isSimulated: true
     });
     return;
  }

  try {
    const prompt = `You are an expert bilingual lyric translator and songwriter.
Translate the following song lyrics from English into poetic, beautiful, and sing-able Hindi (written in Devanagari script).
Rules:
- Format it with the exact same section block indicator tags like [INTRO], [VERSE 1], [CHORUS], [BRIDGE], [OUTRO] in brackets, written in uppercase.
- Do NOT include any English lyrics in the output block, write ONLY the beautiful Hindi translation.
- Preserve the exact layout of sections, paragraphs, and stanzas.

Song Title: ${songInfo?.title || "Untitled"}
Artist: ${songInfo?.artist || "Unknown"}

ENGLISH LYRICS:
${rawLyrics}

Return the Hindi lyrics text directly. Do not include any notes, preambles, or markdown formatting (no chat dialogue, no markdown codeblocks, just the plain text of lyrics).`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt
    });

    const outputText = response.text || "";
    const cleanedText = cleanMarkdownBlocks(outputText) || rawLyrics;

    res.json({
      success: true,
      formattedText: cleanedText,
      enrichment: "Successfully translated to Hindi using Gemini AI.",
      isSimulated: false
    });
  } catch (err: any) {
    console.error("Gemini translation error:", err);
    res.json({
      success: false,
      error: "AI translation failed: " + err.message,
      formattedText: rawLyrics
    });
  }
});

// AI PowerPoint Slide Beautifier Endpoint (with Sentiment-based Theme Tuning)
app.post("/api/gemini/beautify-ppt", async (req, res) => {
  const { title, artist, slides } = req.body;
  if (!slides || !Array.isArray(slides)) {
    res.status(400).json({ error: "Slides list is required." });
    return;
  }

  // Pre-bake an offline semantic analyzer in case Gemini client isn't available
  const generateSimulatedTheme = (songTitle: string, allLyrics: string) => {
    const textSample = (songTitle + " " + allLyrics).toLowerCase();
    
    if (
      textSample.includes("joy") || 
      textSample.includes("sing") || 
      textSample.includes("rejoice") || 
      textSample.includes("praise") || 
      textSample.includes("celebrate") || 
      textSample.includes("hallelu") || 
      textSample.includes("vibrant") ||
      textSample.includes("glad")
    ) {
      return {
        detectedSentiment: "Joyful / Celebratory",
        explanation: "Offline analysis detected uplifting and joyful keywords. Applied a warm ivory background with deep charcoal text and radiant yellow-amber accents, featuring friendly Poppins-like Georgia/Arial serif typography.",
        bgStr: "#FFFDF6",
        textColor: "#1A1A18",
        accentColor: "#D97706",
        fontFace: "Arial",
        pptBg: "FFFDF6",
        pptText: "1A1A18",
        pptAccent: "D97706"
      };
    } else if (
      textSample.includes("peace") || 
      textSample.includes("still") || 
      textSample.includes("rest") || 
      textSample.includes("quiet") || 
      textSample.includes("shepherd") || 
      textSample.includes("calm") || 
      textSample.includes("gentle")
    ) {
      return {
        detectedSentiment: "Meditative / Serene",
        explanation: "Offline analyzer matched calming themes of peace and rest. Prepared a serene deep evergreen atmosphere with pale mint elements and sophisticated Lucida Sans typography.",
        bgStr: "#062419",
        textColor: "#ECFDF5",
        accentColor: "#34D399",
        fontFace: "Lucida Sans Unicode",
        pptBg: "062419",
        pptText: "ECFDF5",
        pptAccent: "34D399"
      };
    } else if (
      textSample.includes("cross") || 
      textSample.includes("blood") || 
      textSample.includes("grave") || 
      textSample.includes("solemn") || 
      textSample.includes("holy") || 
      textSample.includes("broken") || 
      textSample.includes("sacrifice")
    ) {
      return {
        detectedSentiment: "Solemn / Reverent",
        explanation: "Offline matching resolved traditional, deep reverent terms. Configured a majestic deep charcoal base with royal gold accents and literary Georgia Serif fonts.",
        bgStr: "#111827",
        textColor: "#F9FAFB",
        accentColor: "#F59E0B",
        fontFace: "Georgia",
        pptBg: "111827",
        pptText: "F9FAFB",
        pptAccent: "F59E0B"
      };
    } else if (
      textSample.includes("hope") || 
      textSample.includes("promise") || 
      textSample.includes("morning") || 
      textSample.includes("light") || 
      textSample.includes("sunrise") || 
      textSample.includes("future")
    ) {
      return {
        detectedSentiment: "Hopeful / Uplifting",
        explanation: "Offline analysis identified brilliant keywords of light, hope, and morning. Applied a cool dawn blue palette with sparkling sky highlights and clean Arial typography.",
        bgStr: "#0F1E36",
        textColor: "#F1F5F9",
        accentColor: "#38BDF8",
        fontFace: "Trebuchet MS",
        pptBg: "0F1E36",
        pptText: "F1F5F9",
        pptAccent: "38BDF8"
      };
    } else {
      // Default: Cosmic Modern
      return {
        detectedSentiment: "Modern / Contemporary",
        explanation: "Applied a modern, high-contrast, deeply legible dark cosmic slate theme paired with crisp electric aqua features and sleek Arial styles.",
        bgStr: "#0B0F19",
        textColor: "#F3F4F6",
        accentColor: "#06B6D4",
        fontFace: "Arial",
        pptBg: "0B0F19",
        pptText: "F3F4F6",
        pptAccent: "06B6D4"
      };
    }
  };

  const getFullText = () => {
    return slides.map(s => (s.lines || []).join(" ")).join(" ");
  };

  const ai = getGeminiClient();
  if (!ai) {
    const offlineTheme = generateSimulatedTheme(title || "", getFullText());
    res.json({
      success: true,
      slides,
      theme: offlineTheme,
      isSimulated: true
    });
    return;
  }

  try {
    const prompt = `You are an elite PowerPoint presentation architect and thematic lyric artist.
Your objective is to:
1. Optimize the lyrics on each slide. Split overly long lines of lyrics into brief, poetic, highly readable phrases, ensuring no single line overflows standard horizontal layouts, keeping slides uncluttered and centered.
2. Analyze the following lyrics text for emotional sentiment (e.g., joyful/celebratory, solemn/reverent, hopeful/uplifting, energetic/vibrant, meditative/serene).
3. Automatically generate a beautiful custom slide theme (background color, text color, accent highlight color) matching that exact sentiment, alongside choosing the most appropriate font style (such as Georgia, Arial, Trebuchet MS, Lucida Sans Unicode, Courier New, Times New Roman, Garamond).

Below are background/accent recommendation maps across core sentiments:
- Joyful / Celebratory: Radiant light backgrounds (e.g., soft warm cream, peach canvas, amber haze), deep charcoal text, bright red-orange or yellow-gold accent highlights. Optimal fonts: Arial, Trebuchet MS.
- Solemn / Reverent: Majestic dark backgrounds (e.g., deep graphite, midnight steel, royal bronze), soft silver/white text, warm old gold or burgundy accents. Optimal fonts: Georgia, Times New Roman, Garamond.
- Hopeful / Serene: Cool sunrise backgrounds (e.g., soft sky blue, calm sage teal, lavender mist), clear high-contrast slate text, pure silver-gold or vivid teal highlights. Optimal fonts: Lucida Sans Unicode, Arial.
- Energetic / Vibrant: Dynamic night backgrounds (e.g., violet twilight, piano black, electric navy), glowing pure-white text, hot pink, vivid neon cyan or bright lime highlights. Optimal font: Courier New, Trebuchet MS.
- Meditative / Peaceful: Quiet nature backgrounds (e.g., deep emerald, charcoal-forest, warm oatmeal linen), pale text, soft sage or warm rose accents. Optimal font: Georgia, Lucida Sans.

Output MUST be a single raw JSON block matching this exact structural format (do NOT wrap inside markdown backticks or \`\`\`json tags, start with { and end with }):
{
  "slides": [
    { "title": "SLIDE TITLE", "category": "SLIDE SUBTITLE", "lines": ["Line 1", "Line 2", ...] }
  ],
  "theme": {
    "detectedSentiment": "Capitalized Sentiment Name (e.g. Solemn / Reverent)",
    "explanation": "A concise, beautiful sentence explaining how the visual palette choice echoes the emotional soul of the song.",
    "bgStr": "String HEX background starting with hash, e.g. #0B0F19",
    "textColor": "String HEX text starting with hash, e.g. #F3F4F6",
    "accentColor": "String HEX accent starting with hash, e.g. #38BDF8",
    "fontFace": "One matching font family string (e.g. Georgia, Arial, Trebuchet MS, Lucida Sans Unicode, Courier New)",
    "pptBg": "String HEX background WITHOUT hash, e.g. 0B0F19",
    "pptText": "String HEX text WITHOUT hash, e.g. F3F4F6",
    "pptAccent": "String HEX accent WITHOUT hash, e.g. 38BDF8"
  }
}

INPUT SLIDES DATA:
${JSON.stringify(slides, null, 2)}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt
    });

    try {
      const cleanedText = cleanMarkdownBlocks(response.text || "").trim();
      const resultObj = JSON.parse(cleanedText);
      
      if (resultObj && Array.isArray(resultObj.slides) && resultObj.theme) {
        res.json({
          success: true,
          slides: resultObj.slides,
          theme: resultObj.theme
        });
      } else {
        throw new Error("Missing essential slide or theme structures in Gemini response.");
      }
    } catch (parseErr) {
      console.warn("AI returned raw or invalid JSON formats. Falling back to offline analyzer:", response.text);
      const offlineTheme = generateSimulatedTheme(title || "", getFullText());
      res.json({
        success: true,
        slides,
        theme: offlineTheme,
        isSimulated: true
      });
    }
  } catch (err: any) {
    console.error("Gemini PPT beautify error:", err);
    res.status(500).json({ error: "AI PPT beautifier failed: " + err.message });
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

app.post("/api/gemini/fetch-lyrics", async (req, res) => {
  const { query } = req.body;
  if (!query || typeof query !== "string" || !query.trim()) {
    res.status(400).json({ success: false, error: "Search query is required." });
    return;
  }

  const ai = getGeminiClient();
  if (!ai) {
    res.json({
      success: false,
      error: "Gemini API Client is not configured. Please add your GEMINI_API_KEY in the Settings > Secrets section."
    });
    return;
  }

  try {
    const prompt = `You are a dynamic music cataloging agent with full access to Real-time Google Search.
Search the internet to discover information, lyrics, and YouTube links for the song: "${query}".

Requirements:
- Find the actual Official Title and Artist Name.
- Retrieve the structured English lyrics. Add bracket headings like [INTRO], [VERSE 1], [CHORUS], [BRIDGE], [OUTRO] exactly above each section.
- Retrieve the Hindi/Devanagari lyrics (if they exist) or translate the English sections into Hindi. Ensure the brackets and structural flow match the English lyrics EXACTLY so they fit on parallel tabs.
- Find a working YouTube video link of the song (like: https://www.youtube.com/watch?v=...).
- Recommend the primary music genre (e.g. Pop, Bollywood, Rock, Electronic, R&B, Devotional, Indie, etc.).

Search Google live using the search tool. Return a structured JSON matching the requested schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Official song title." },
            artist: { type: Type.STRING, description: "Official artist/singer name." },
            genre: { type: Type.STRING, description: "Primary single-word genre of the song." },
            lyricsEnglish: { type: Type.STRING, description: "Full formatted English lyrics with clean uppercase bracket sections." },
            lyricsHindi: { type: Type.STRING, description: "Matching Devanagari Hindi translation or native lyrics, with section bracket layout matching the English lyrics exactly." },
            youtubeUrl: { type: Type.STRING, description: "Correct URL of the official song or audio track from YouTube." },
            coverUrl: { type: Type.STRING, description: "Any high quality visual cover art link found, or leave blank." }
          },
          required: ["title", "artist", "genre", "lyricsEnglish", "lyricsHindi", "youtubeUrl"]
        }
      }
    });

    const text = response.text || "{}";
    const data = JSON.parse(text.trim());

    // Deduce YouTube Video ID and thumbnail from video itself
    let derivedCoverUrl = data.coverUrl || "";
    if (data.youtubeUrl) {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = data.youtubeUrl.match(regExp);
      const videoId = (match && match[2] && match[2].length === 11) ? match[2] : null;
      if (videoId) {
        // High quality thumbnail from the video itself
        derivedCoverUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      }
    }

    // Default cover art fallback if nothing is resolved
    if (!derivedCoverUrl) {
      derivedCoverUrl = "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600&auto=format&fit=crop";
    }

    res.json({
      success: true,
      title: data.title || query,
      artist: data.artist || "Unknown",
      genre: data.genre || "Pop",
      lyricsEnglish: data.lyricsEnglish || "",
      lyricsHindi: data.lyricsHindi || "",
      youtubeUrl: data.youtubeUrl || "",
      coverUrl: derivedCoverUrl
    });

  } catch (error: any) {
    console.error("AI Lyrics Fetcher Error:", error);
    res.json({
      success: false,
      error: "Failed to automatically fetch lyrics via Gemini Search Grounding: " + error.message
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

if (!process.env.VERCEL && !process.env.NOW_REGION) {
  startServer();
}

export { app };
export default app;
