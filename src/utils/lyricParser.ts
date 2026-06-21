import { FormattedSection } from '../types';

/**
 * Parses raw lyric text into structured blocks with section identification.
 * Triggers on typing / formatting to display elegant stanzas, strophes, and bridges.
 */
export function parseRawLyrics(raw: string): FormattedSection[] {
  if (!raw || !raw.trim()) return [];

  // Normalize line endings and split by double line breaks (representing paragraphs)
  const blocks = raw.split(/\n\s*\n/);
  const sections: FormattedSection[] = [];

  let verseCounter = 1;

  for (let block of blocks) {
    block = block.trim();
    if (!block) continue;

    const lines = block.split(/\n/).map(line => line.trim());
    if (lines.length === 0) continue;

    let type: FormattedSection['type'] = 'stanza';
    let label = '';
    let lyricLines = [...lines];

    // Check first line of block for section indicators
    const firstLine = lines[0];
    const headerRegex = /^\s*[\[\(\{\s]*(Chorus|Verse\s*\d*|Bridge|Hook|Intro|Outro|Stanza|Refrain|Pre-Chorus|PreChorus|Pre\s+Chorus|Tension)[\]\)\}\s]*\s*$/i;
    const headerMatch = firstLine.match(headerRegex);

    // Check if the header is inline like "[Verse 1] I sat on the chair"
    const inlineHeaderRegex = /^\s*[\[\(](Chorus|Verse\s*\d*|Bridge|Hook|Intro|Outro|Stanza|Refrain|Pre-Chorus|PreChorus|Pre\s+Chorus|Tension)[\]\)]\s*(.*)$/i;
    const inlineMatch = firstLine.match(inlineHeaderRegex);

    if (headerMatch) {
      // The first line is entirely a header (e.g. "[Chorus]" or "Bridge")
      const title = headerMatch[1].trim();
      label = title.toUpperCase(); // High-contrast capitalized label
      type = determineSectionType(title);
      lyricLines.shift(); // Remove the header line from body text
    } else if (inlineMatch) {
      // First line starts with a bracketed header, followed directly by lyrics
      const title = inlineMatch[1].trim();
      label = title.toUpperCase();
      type = determineSectionType(title);
      lyricLines[0] = inlineMatch[2].trim();
      if (!lyricLines[0]) lyricLines.shift();
    } else {
      // No explicit bracketed header. Check common prefixes
      const lowerFirst = firstLine.toLowerCase();
      if (lowerFirst.startsWith('chorus:') || lowerFirst.startsWith('chorus')) {
        type = 'chorus';
        label = 'CHORUS';
        lyricLines[0] = firstLine.replace(/^chorus:?/i, '').trim();
        if (!lyricLines[0]) lyricLines.shift();
      } else if (lowerFirst.startsWith('pre-chorus:') || lowerFirst.startsWith('pre-chorus') || lowerFirst.startsWith('prechorus:') || lowerFirst.startsWith('prechorus') || lowerFirst.startsWith('pre chorus:') || lowerFirst.startsWith('pre chorus') || lowerFirst.startsWith('refrain:') || lowerFirst.startsWith('refrain') || lowerFirst.startsWith('tension:') || lowerFirst.startsWith('tension')) {
        type = 'tension';
        label = 'PRE-CHORUS';
        lyricLines[0] = firstLine.replace(/^(pre-chorus|prechorus|pre\s+chorus|refrain|tension):?/i, '').trim();
        if (!lyricLines[0]) lyricLines.shift();
      } else if (lowerFirst.startsWith('bridge:') || lowerFirst.startsWith('bridge')) {
        type = 'bridge';
        label = 'BRIDGE';
        lyricLines[0] = firstLine.replace(/^bridge:?/i, '').trim();
        if (!lyricLines[0]) lyricLines.shift();
      } else if (lowerFirst.startsWith('hook:') || lowerFirst.startsWith('hook')) {
        type = 'hook';
        label = 'HOOK';
        lyricLines[0] = firstLine.replace(/^hook:?/i, '').trim();
        if (!lyricLines[0]) lyricLines.shift();
      } else if (lowerFirst.startsWith('intro:') || lowerFirst.startsWith('intro')) {
        type = 'intro';
        label = 'INTRO';
        lyricLines[0] = firstLine.replace(/^intro:?/i, '').trim();
        if (!lyricLines[0]) lyricLines.shift();
      } else if (lowerFirst.startsWith('outro:') || lowerFirst.startsWith('outro')) {
        type = 'outro';
        label = 'OUTRO';
        lyricLines[0] = firstLine.replace(/^outro:?/i, '').trim();
        if (!lyricLines[0]) lyricLines.shift();
      } else if (lowerFirst.startsWith('verse:') || lowerFirst.startsWith('verse')) {
        type = 'verse';
        const numMatch = firstLine.match(/verse\s*:?\s*(\d+)/i);
        const idx = numMatch ? numMatch[1] : verseCounter++;
        label = `VERSE ${idx}`;
        lyricLines[0] = firstLine.replace(/^verse\s*\d*:?/i, '').trim();
        if (!lyricLines[0]) lyricLines.shift();
      } else {
        // Fallback: assign progressive Verse numbering
        type = 'verse';
        label = `VERSE ${verseCounter++}`;
      }
    }

    // Clean up lines and remove any remaining trailing braces
    const cleanLines = lyricLines
      .map(line => {
        let l = line.trim();
        // Remove redundant labels if nested
        l = l.replace(/^[\[\(]?(Chorus|Verse\s*\d*|Bridge|Hook|Intro|Outro|Stanza)[\]\)]?\s*:?/gi, '').trim();
        return l;
      })
      .filter(line => line.length > 0);

    if (cleanLines.length > 0) {
      sections.push({
        type,
        label,
        lines: cleanLines
      });
    }
  }

  return sections;
}

function determineSectionType(title: string): FormattedSection['type'] {
  const t = title.toLowerCase();
  if (t.includes('pre-chorus') || t.includes('prechorus') || t.includes('pre chorus') || t.includes('refrain') || t.includes('tension')) {
    return 'tension';
  }
  if (t.includes('chorus')) {
    return 'chorus';
  }
  if (t.includes('bridge')) return 'bridge';
  if (t.includes('hook')) return 'hook';
  if (t.includes('intro')) return 'intro';
  if (t.includes('outro')) return 'outro';
  if (t.includes('verse')) return 'verse';
  return 'stanza';
}

/**
 * Transforms structured lyric sections into pristine styled HTML
 * with Tailwind classes or inline styles intact, ready for WordPress REST API publishing.
 */
export function buildHTMLFromSections(sections: FormattedSection[], title: string, artist: string): string {
  let html = `<div class="lyric-container" style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0f172a; color: #f1f5f9; border-radius: 12px; border: 1px solid #334155;">`;
  html += `<header style="margin-bottom: 24px; border-bottom: 1px solid #334155; padding-bottom: 16px;">`;
  html += `<h1 class="lyric-title" style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.025em;">${title}</h1>`;
  html += `<p class="lyric-artist" style="margin: 4px 0 0; font-size: 16px; color: #38bdf8; font-weight: 500;">${artist}</p>`;
  html += `</header>`;

  sections.forEach((sec, idx) => {
    const isChorus = sec.type === 'chorus' || sec.type === 'hook';
    const isTension = sec.type === 'tension';
    const isSpecial = sec.type === 'bridge' || sec.type === 'intro' || sec.type === 'outro';

    let blockStyle = `margin-bottom: 24px; padding: 12px; border-radius: 8px;`;
    let labelStyle = `font-family: sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; margin-bottom: 8px; opacity: 0.6;`;
    let linesStyle = `font-size: 14px; line-height: 1.6; margin: 0;`;

    if (isChorus) {
      blockStyle += `background: rgba(56, 189, 248, 0.08); border-left: 4px solid #38bdf8; padding-left: 16px;`;
      labelStyle += `color: #38bdf8; opacity: 1;`;
      linesStyle += `font-weight: 600; font-style: italic; color: #f8fafc; font-size: 15px;`;
    } else if (isTension) {
      blockStyle += `background: rgba(245, 158, 11, 0.08); border-left: 4px solid #f59e0b; padding-left: 16px;`;
      labelStyle += `color: #f59e0b; opacity: 1;`;
      linesStyle += `font-weight: 600; color: #fef3c7; font-size: 14px;`;
    } else if (isSpecial) {
      blockStyle += `background: rgba(168, 85, 247, 0.08); border-left: 4px solid #a855f7; padding-left: 16px;`;
      labelStyle += `color: #a855f7; opacity: 1;`;
      linesStyle += `color: #e2e8f0;`;
    } else {
      blockStyle += `background: transparent; border-left: 4px solid #475569; padding-left: 16px;`;
      labelStyle += `color: #94a3b8;`;
      linesStyle += `color: #cbd5e1;`;
    }

    html += `<section class="lyric-section lyric-${sec.type}" style="${blockStyle}">`;
    html += `<div class="lyric-label" style="${labelStyle}">${sec.label}</div>`;
    html += `<div class="lyric-lines" style="${linesStyle}">`;
    
    sec.lines.forEach(line => {
      html += `<p style="margin: 0 0 6px 0;">${line}</p>`;
    });

    html += `</div>`;
    html += `</section>`;
  });

  html += `<footer style="margin-top: 32px; border-top: 1px solid #334155; padding-top: 16px; font-size: 12px; text-align: center; color: #64748b;">`;
  html += `Published via Smart Lyric Uploader Dashboard • Sync Timestamp: ${new Date().toLocaleString()}`;
  html += `</footer>`;
  html += `</div>`;

  return html;
}
