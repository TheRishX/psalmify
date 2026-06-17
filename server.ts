import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { DEFAULT_SONGS, DEFAULT_PLAYLISTS } from "./src/data/defaultData";
import { parseRawLyrics } from "./src/utils/lyricParser";
import { GoogleGenAI } from "@google/genai";

// Initialize environment variables
dotenv.config();

// Initialize internal storage with preloaded data + local disk persistence
const PERSISTED_SONGS_PATH = path.join(process.cwd(), "persisted_songs.json");
const PERSISTED_PLAYLISTS_PATH = path.join(process.cwd(), "persisted_playlists.json");

let songs = [];
let playlists = [];

try {
  if (fs.existsSync(PERSISTED_SONGS_PATH)) {
    songs = JSON.parse(fs.readFileSync(PERSISTED_SONGS_PATH, "utf-8"));
  } else {
    songs = DEFAULT_SONGS.map(s => ({
      ...s,
      formattedLyrics: parseRawLyrics(s.rawLyrics)
    }));
  }
} catch (e) {
  console.warn("Failed to read persisted songs:", e);
  songs = DEFAULT_SONGS.map(s => ({
    ...s,
    formattedLyrics: parseRawLyrics(s.rawLyrics)
  }));
}

try {
  if (fs.existsSync(PERSISTED_PLAYLISTS_PATH)) {
    playlists = JSON.parse(fs.readFileSync(PERSISTED_PLAYLISTS_PATH, "utf-8"));
  } else {
    playlists = [...DEFAULT_PLAYLISTS];
  }
} catch (e) {
  console.warn("Failed to read persisted playlists:", e);
  playlists = [...DEFAULT_PLAYLISTS];
}

function saveSongsToDisk() {
  try {
    fs.writeFileSync(PERSISTED_SONGS_PATH, JSON.stringify(songs, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to write persisted songs:", e);
  }
}

function savePlaylistsToDisk() {
  try {
    fs.writeFileSync(PERSISTED_PLAYLISTS_PATH, JSON.stringify(playlists, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to write persisted playlists:", e);
  }
}

// Helper to reverse format HTML sent to WordPress back to structured raw lyrics
function convertHtmlToRawLyrics(html: string): string {
  if (!html) return "";
  
  const sectionRegex = /<section[^>]*class="[^"]*lyric-section[^"]*"[^>]*>([\s\S]*?)<\/section>/gi;
  let match;
  const parts: string[] = [];
  
  while ((match = sectionRegex.exec(html)) !== null) {
    const sectionContent = match[1];
    
    // Extract label
    const labelMatch = /<div[^>]*style="[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(sectionContent) || /<div[^>]*class="[^"]*lyric-label[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(sectionContent);
    const label = labelMatch ? labelMatch[1].replace(/<[^>]+>/g, "").trim() : "";
    
    // Extract lines
    const linesContentMatch = /<div[^>]*class="[^"]*lyric-lines[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(sectionContent) || /<div[^>]*style="[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(sectionContent);
    const linesContent = linesContentMatch ? linesContentMatch[1] : sectionContent;
    
    const lineRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let lineMatch;
    const lines: string[] = [];
    while ((lineMatch = lineRegex.exec(linesContent)) !== null) {
      const lineText = lineMatch[1]
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#8217;/g, "'")
        .replace(/&#8211;/g, "-")
        .trim();
      if (lineText) lines.push(lineText);
    }
    
    if (lines.length > 0) {
      let sectionText = "";
      if (label) {
        sectionText += `[${label}]\n`;
      }
      sectionText += lines.join("\n");
      parts.push(sectionText);
    }
  }
  
  if (parts.length > 0) {
    return parts.join("\n\n");
  }
  
  // Fallback: strip standard format
  let clean = html
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, "-")
    .trim();
    
  clean = clean.replace(/\n\s*\n\s*\n+/g, "\n\n");
  return clean;
}

// Dynamically fetch WordPress.com blog posts
async function fetchWordPressPosts(siteUrl: string = "psalmify.wordpress.com"): Promise<any[]> {
  try {
    const url = `https://public-api.wordpress.com/rest/v1.1/sites/${siteUrl}/posts?number=40`;
    console.log(`Dynamic fetching 40 latest lyrics posts from live blog: ${url}`);
    
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 4000); // 4-second timeout to keep the app responsive
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    
    if (!response.ok) {
      console.warn(`WordPress Public API returned non-OK status: ${response.status}`);
      return [];
    }
    const data = await response.json();
    return data.posts || [];
  } catch (e) {
    console.warn("Could not dynamically connect to WordPress Public API posts:", e);
    return [];
  }
}

// Simulated WordPress JWT store: token -> expiry timestamp
const activeWordPressTokens = new Map<string, number>();

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
app.use(express.json());

// ==========================================
// 1. PUBLIC & ADMIN LYRIC APP DATABASE APIs
// ==========================================

// Get all playlists
app.get("/api/playlists", (req, res) => {
  res.json(playlists);
});

// Create or Update a playlist
app.post("/api/playlists", (req, res) => {
    const { id, name, description, coverUrl, genre, songIds } = req.body;
    if (!name || !genre) {
       res.status(400).json({ error: "Name and genre are required." });
       return;
    }

    if (id) {
      // Update
      const index = playlists.findIndex(p => p.id === id);
      if (index !== -1) {
        playlists[index] = { id, name, description, coverUrl, genre, songIds: songIds || [] };
        savePlaylistsToDisk();
        res.json(playlists[index]);
        return;
      }
    }

    // Create
    const newPlaylist = {
      id: "p_" + Date.now(),
      name,
      description: description || "",
      coverUrl: coverUrl || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600&auto=format&fit=crop",
      genre,
      songIds: songIds || []
    };
    playlists.push(newPlaylist);
    savePlaylistsToDisk();
    res.status(201).json(newPlaylist);
  });

  // Get all songs
  app.get("/api/songs", async (req, res) => {
    // Fetch live posts from the WordPress blog
    const siteUrl = (req.query.site as string) || "psalmify.wordpress.com";
    const wpPosts = await fetchWordPressPosts(siteUrl);
    
    // Map WordPress posts to Song format
    const wpSongs = wpPosts.map(post => {
      let title = post.title || "";
      // Strip any tags, decode standard entities
      title = title.replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#8211;/g, "-")
        .replace(/&ndash;/g, "-")
        .replace(/&mdash;/g, "-")
        .replace(/&#8217;/g, "'")
        .trim();
      
      let artist = "Various Artists";
      if (title.toLowerCase().startsWith("lyrics:")) {
        const cleanTitle = title.replace(/^lyrics:\s*/i, "");
        const parts = cleanTitle.split(/\s+-\s+/);
        if (parts.length >= 2) {
          title = parts[0].trim();
          artist = parts.slice(1).join(" - ").trim();
        } else {
          title = cleanTitle.trim();
        }
      }

      const content = post.content || "";
      const rawLyrics = convertHtmlToRawLyrics(content);
      const formattedLyrics = parseRawLyrics(rawLyrics);

      return {
        id: `wp_${post.ID}`,
        title,
        artist,
        album: "WordPress Live",
        genre: "Acoustic", // Fallback genre
        rawLyrics,
        formattedLyrics,
        coverUrl: post.featured_image || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600&auto=format&fit=crop",
        duration: "3:40",
        isFeatured: false,
        link: post.URL
      };
    }).filter(s => s.rawLyrics && s.rawLyrics.trim().length > 0);

    // Merge WordPress live posts into our local array, prioritizing the local array for edits
    const mergedSongs = [...songs];
    wpSongs.forEach(wpS => {
      const exists = mergedSongs.some(
        s => s.title.toLowerCase().trim() === wpS.title.toLowerCase().trim() && 
             s.artist.toLowerCase().trim() === wpS.artist.toLowerCase().trim()
      );
      if (!exists) {
        mergedSongs.push(wpS);
      }
    });

    res.json(mergedSongs);
  });

  // Save / Upload Song (Admin Panel creation and update)
  app.post("/api/songs", (req, res) => {
    const { id, title, artist, album, genre, rawLyrics, youtubeUrl, coverUrl, duration, isFeatured, playlistIds } = req.body;

    if (!title || !artist || !rawLyrics) {
       res.status(400).json({ error: "Title, Artist, and Raw Lyrics are required." });
       return;
    }

    const formattedLyrics = parseRawLyrics(rawLyrics);

    let targetSong;

    if (id) {
      // Update
      const index = songs.findIndex(s => s.id === id);
      if (index !== -1) {
        songs[index] = {
          id,
          title,
          artist,
          album,
          genre,
          rawLyrics,
          formattedLyrics,
          youtubeUrl,
          coverUrl: coverUrl || songs[index].coverUrl,
          duration: duration || songs[index].duration || "3:30",
          isFeatured: !!isFeatured
        };
        targetSong = songs[index];
      }
    }

    if (!targetSong) {
      // Create
      const newSong = {
        id: "s_" + Date.now(),
        title,
        artist,
        album: album || "Single",
        genre: genre || "Acoustic",
        rawLyrics,
        formattedLyrics,
        youtubeUrl: youtubeUrl || "",
        coverUrl: coverUrl || "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600&auto=format&fit=crop",
        duration: duration || "3:30",
        isFeatured: !!isFeatured
      };
      songs.push(newSong);
      targetSong = newSong;
    }

    // Sync playlist mappings
    if (playlistIds && Array.isArray(playlistIds)) {
      playlists.forEach(pl => {
        // If this playlist was selected, add the song's ID to it if not present
        if (playlistIds.includes(pl.id)) {
          if (!pl.songIds.includes(targetSong.id)) {
            pl.songIds.push(targetSong.id);
          }
        } else {
          // If unselected, remove the song's ID from this playlist
          pl.songIds = pl.songIds.filter(sid => sid !== targetSong.id);
        }
      });
    }

    saveSongsToDisk();
    savePlaylistsToDisk();

    res.status(200).json(targetSong);
  });

  // Delete Song
  app.delete("/api/songs/:id", (req, res) => {
    const { id } = req.params;
    songs = songs.filter(s => s.id !== id);
    // Remove from playlists as well
    playlists.forEach(p => {
      p.songIds = p.songIds.filter(sid => sid !== id);
    });
    saveSongsToDisk();
    savePlaylistsToDisk();
    res.json({ success: true, message: "Song successfully deleted." });
  });

  // ==========================================
  // 2. REAL-TIME AI GEMINI BEAUTIFIER ENDPOINT
  // ==========================================
  app.post("/api/gemini/beautify", async (req, res) => {
    const { rawLyrics, songInfo } = req.body;
    if (!rawLyrics || !rawLyrics.trim()) {
       res.status(400).json({ error: "Raw lyrics content is required." });
       return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      // If we don't have Gemini API key, we return a smart mock simulated result
      // styled perfectly, to ensure pristine functionality of the front-end!
      console.log("Gemini API Key not present. Falling back to offline advanced simulator.");
      
      // Let's parse offline with our heavy parsing engine, but add high-vibe suggestions!
      const offlineParsed = parseRawLyrics(rawLyrics);
      const suggestions = [
        "Identified standard Verse-Chorus song progression structures.",
        "Auto-balanced line breaks to enhance readability.",
        "Highlighted raw sections with high-vibe contrast borders."
      ];
      
      setTimeout(() => {
        res.json({
          success: true,
          formatted: offlineParsed,
          enrichment: "Simulated AI Smart Formatting: Analyzed stanza patterns and successfully structured chorus components. Line visual weight adjusted for optimum delivery.",
          suggestions,
          isSimulated: true
        });
      }, 800);
      return;
    }

    try {
      // Prompt Gemini to structure and format these lyrics beautifully
      const prompt = `You are a professional songwriting and music typography expert. 
Format the following lyrics into clean structural blocks such as INTRO, VERSE, CHORUS, BRIDGE, OUTRO.
Do not lose any lines of the lyrics, but structure them cleanly with empty lines separating paragraphs, and add bracketed header indicators like [VERSE 1] or [CHORUS] above each block.
Clean up rough typing, double spaces, or irregular line spacing.

Song Name: ${songInfo?.title || "Untitled"}
Artist: ${songInfo?.artist || "Unknown"}

RAW LYRICS TO FORMAT:
${rawLyrics}

Return the formatted lyrics text directly. Do not include any other markdown chat intro or outro text. Your output will be parsed by regex.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt
      });

      const formattedText = response.text || rawLyrics;
      const parsedSections = parseRawLyrics(formattedText);

      // Offer dynamic AI creative suggestion
      const advicePrompt = `Review the song lyrics for "${songInfo?.title || "Untitled"}" by "${songInfo?.artist || "Unknown"}":
${rawLyrics.slice(0, 500)}

Give exactly two brief bullet points (no more than 20 words each) suggesting vocal pacing or musical dynamics relative to the Chorus and Verses. Speak as a professional producer.`;
      
      let enrichmentText = "Empowered by Gemini AI. Sections extracted, syllables balanced.";
      try {
        const adviceRes = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: advicePrompt
        });
        if (adviceRes.text) {
          enrichmentText = adviceRes.text.trim();
        }
      } catch (e) {
        console.warn("Minor advice generation issue:", e);
      }

      res.json({
        success: true,
        formattedText,
        formatted: parsedSections,
        enrichment: enrichmentText,
        isSimulated: false
      });

    } catch (error: any) {
      console.error("Gemini API Call Error:", error);
      res.status(500).json({ error: "Gemini formatting failed: " + error.message });
    }
  });

  // ==========================================
  // 3. SECURE WORDPRESS DATABASE STREAM SIMULATOR
  // ==========================================

  // A. Authenticate and issue a JWT token
  app.post("/api/wordpress/token", (req, res) => {
    const { username, password } = req.body;
    
    // Simulate simple WordPress Admin Login
    if (username === "admin" && password === "admin123") {
      const simulatedToken = "wp_jwt_" + Math.random().toString(36).substring(2, 11).toUpperCase();
      // Set to expire in 120 seconds to allow showcasing "JWT Expired Fallback" state!
      const expiry = Date.now() + 120000; 
      
      activeWordPressTokens.set(simulatedToken, expiry);
      
      res.json({
        token: simulatedToken,
        user_email: "wp-administrator@local-music-site.org",
        user_nickname: "WP Admin",
        user_display_name: "Wordpress Admin",
        expiresAt: expiry
      });
    } else {
      res.status(403).json({
        code: "invalid_credentials",
        message: "<strong>Error:</strong> The password or username you entered is incorrect.",
        data: { status: 403 }
      });
    }
  });

  // B. WordPress Sync Post Endpoint
  // Authenticates simulated JWT token bearer and saves the parsed lyric HTML payload permanently
  app.post("/wp-json/wp/v2/posts", (req, res) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
       res.status(401).json({
        code: "rest_cannot_create",
        message: "Sorry, you are not allowed to create posts as this user.",
        data: { status: 401 }
      });
       return;
    }

    const token = authHeader.split(" ")[1];

    // Simulating explicit expired state for demonstration
    if (token === "EXPIRED_TEST_TOKEN") {
       res.status(403).json({
        code: "jwt_auth_expired",
        message: "Authentication failed. Signature has expired.",
        data: { status: 403 }
      });
       return;
    }

    const tokenExpiry = activeWordPressTokens.get(token);

    if (!tokenExpiry) {
       res.status(403).json({
        code: "jwt_auth_invalid_token",
        message: "Authentication failed. Invalid Token signature.",
        data: { status: 403 }
      });
       return;
    }

    if (Date.now() > tokenExpiry) {
       // Token expired! Removes the stale token as well
       activeWordPressTokens.delete(token);
       res.status(403).json({
        code: "jwt_auth_expired",
        message: "Your WordPress JWT Session Token has expired. Please log in again.",
        data: { status: 430 } 
       });
       return;
    }

    const { title, content, status } = req.body;
    if (!title || !content) {
       res.status(400).json({ error: "WordPress sync payload must contain post title and content." });
       return;
    }

    // Successfully syncing! Let's return a WP mock payload returning 201 Created status!
    res.status(201).json({
      id: Math.floor(1000 + Math.random() * 9000),
      date: new Date().toISOString(),
      date_gmt: new Date().toISOString(),
      guid: {
        rendered: `https://mock-wordpress.local/?p=${Math.floor(Math.random() * 500)}`
      },
      modified: new Date().toISOString(),
      status: status || "publish",
      type: "post",
      link: `https://music-portal.org/lyrics/${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      title: {
        rendered: title
      },
      content: {
        rendered: content,
        protected: false
      },
      comment_status: "open",
      author: 1,
      sticky: false,
      template: "",
      categories: [ 4 ], // Category mapping for Lyrics
      tags: [],
      acf: {},
      _links: {
        self: [{ href: "https://mock-wordpress.local/wp-json/wp/v2/posts/991" }],
        collection: [{ href: "https://mock-wordpress.local/wp-json/wp/v2/posts" }]
      }
    });
  });

  // REAL WORDPRESS.COM REST API POST PROXY ENDPOINT
  app.post("/api/wordpress/post", async (req, res) => {
    const { title, content, token, blog_url } = req.body;
    if (!token) {
      res.status(401).json({ error: "No active WordPress access token provided. Please connect first." });
      return;
    }

    try {
      const siteId = blog_url || "psalmify.wordpress.com";
      const wpResponse = await fetch(`https://public-api.wordpress.com/rest/v1.1/sites/${encodeURIComponent(siteId)}/posts/new`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          content,
          status: "publish"
        })
      });

      const wpData = await wpResponse.json();

      if (!wpResponse.ok) {
        res.status(wpResponse.status).json({ message: wpData.message || "Failed to create post on WordPress.com." });
        return;
      }

      res.status(201).json({
        link: wpData.URL || wpData.link,
        message: "Successfully synchronized and published to WordPress.com!"
      });
    } catch (err: any) {
      console.error("Proxy publishing error:", err);
      res.status(500).json({ message: `Exception publishing to WordPress.com: ${err.message}` });
    }
  });

  // Verify Single-Admin static credentials or token
  app.post("/api/admin/verify", (req, res) => {
    const { password } = req.body;
    if (password === "admin123") {
      res.json({ success: true, token: "admin_dashboard_token_vibe" });
    } else {
      res.status(401).json({ success: false, message: "Invalid administrator password." });
    }
  });

  // ==========================================
  // REAL WORDPRESS OAUTH 2.0 ROUTING HANDLERS
  // ==========================================
  app.get("/api/wordpress/oauth/url", (req, res) => {
    const clientId = process.env.WORDPRESS_CLIENT_ID;
    if (!clientId) {
      res.status(400).json({ error: "WordPress Client ID is not configured in environment variables." });
      return;
    }

    // Accept redirect_uri from request query param or fall back to APP_URL
    const clientRedirectUri = req.query.redirect_uri as string;
    const appUrl = process.env.APP_URL || "https://ais-dev-7tkhecepw4twy6vpgjwurc-741505619319.asia-southeast1.run.app";
    const redirectUri = clientRedirectUri || `${appUrl}/auth/callback`;

    // Secure state contains the exact redirectUri to pass it forward
    const stateObj = { redirect_uri: redirectUri };
    const stateVal = Buffer.from(JSON.stringify(stateObj)).toString("base64");

    // Construct WordPress OAuth authorization URL
    const authUrl = `https://public-api.wordpress.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=posts&state=${stateVal}`;
    res.json({ url: authUrl });
  });

  app.get(["/auth/callback", "/auth/callback/"], async (req, res) => {
    const { code, state, error, error_description } = req.query;

    if (error) {
      res.send(`
        <html>
          <body style="font-family: sans-serif; background-color: #0a0a0c; color: #f8f9fa; padding: 40px; text-align: center;">
            <h2 style="color: #ef4444;">WordPress Connection Failed</h2>
            <p>${error_description || error}</p>
            <button onclick="window.close()" style="background: #e11d48; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; margin-top: 15px;">Close Window</button>
          </body>
        </html>
      `);
      return;
    }

    if (!code) {
      res.status(400).send("No authorization code provided.");
      return;
    }

    const clientId = process.env.WORDPRESS_CLIENT_ID;
    const clientSecret = process.env.WORDPRESS_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      res.status(500).send("WordPress OAuth client credentials are not configured on the server.");
      return;
    }

    try {
      // Decode redirect_uri from state
      let redirectUri = `${process.env.APP_URL || "https://ais-dev-7tkhecepw4twy6vpgjwurc-741505619319.asia-southeast1.run.app"}/auth/callback`;
      if (state) {
        try {
          const decodedState = JSON.parse(Buffer.from(state as string, "base64").toString("utf-8"));
          if (decodedState.redirect_uri) {
            redirectUri = decodedState.redirect_uri;
          }
        } catch (e) {
          console.error("Failed to decode OAuth state:", e);
        }
      }

      // Exchange code for Access Token
      const tokenResponse = await fetch("https://public-api.wordpress.com/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          code: code as string,
          grant_type: "authorization_code"
        })
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        throw new Error(tokenData.error_description || tokenData.error || "Failed to exchange token");
      }

      const { access_token, blog_id, blog_url } = tokenData;

      // Render callback success HTML which posts a message to Aura Lyrics main App
      res.send(`
        <html>
          <body style="font-family: sans-serif; background-color: #0a0a0c; color: #f8f9fa; padding: 40px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 80vh;">
            <div style="background: #1e1b4b; border: 1px solid #dc2626; padding: 30px; border-radius: 20px; max-width: 400px; box-shadow: 0 10px 30px rgba(225, 29, 72, 0.1);">
              <div style="width: 50px; height: 50px; background: rgba(225, 29, 72, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-weight: bold; color: #ef4444; font-size: 24px;">✓</div>
              <h2 style="margin: 0 0 10px 0; font-size: 20px;">Connected Successfully!</h2>
              <p style="font-size: 13px; color: rgba(255,255,255,0.7); line-height: 1.6; margin: 0 0 20px 0;">
                Your site <strong>psalmify.wordpress.com</strong> is now securely bridged to Aura Lyrics.
              </p>
              <p style="font-size: 11px; font-family: monospace; color: rgba(255,255,255,0.4);">
                Syncing secure credentials with workspace...
              </p>
            </div>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'WP_OAUTH_SUCCESS', 
                  token: '${access_token}', 
                  blog_id: '${blog_id || ""}', 
                  blog_url: '${blog_url || ""}' 
                }, '*');
                setTimeout(() => window.close(), 1500);
              } else {
                window.location.href = '/';
              }
            </script>
          </body>
        </html>
      `);

    } catch (err: any) {
      console.error("WordPress OAuth Error Exception:", err);
      res.status(500).send(`Exception exchanging code: ${err.message}`);
    }
  });

  // ==========================================
  // 4. VITE DEV AND PRODUCTION STATIC SERVING
  // ==========================================
  async function startServer() {
    const PORT = 3000;
    if (process.env.NODE_ENV !== "production") {
      console.log("Hooking Vite middleware for dev runtime.");
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      console.log(`Serving industrial assets from production path: ${distPath}`);
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    if (!process.env.VERCEL) {
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Smart Lyrics Server running on http://0.0.0.0:${PORT}`);
      });
    }
  }

  if (!process.env.VERCEL) {
    startServer();
  }

  export { app };
  export default app;
