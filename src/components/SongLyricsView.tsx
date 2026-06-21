import React, { useState, useEffect, useRef } from 'react';
import { Song, FormattedSection } from '../types';
import { 
  Play, Pause, RotateCcw, Volume2, Sparkles, FileText, 
  Music, Youtube, Hash, HelpCircle, Check, Info, Maximize2, 
  Minimize2, ZoomIn, ZoomOut, Copy, Download, Radio, Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../utils/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { parseRawLyrics } from '../utils/lyricParser';
import { jsPDF } from 'jspdf';

interface SongLyricsViewProps {
  song: Song;
  onBackToSearch?: () => void;
}

export default function SongLyricsView({ song, onBackToSearch }: SongLyricsViewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeLineIndex, setActiveLineIndex] = useState<number>(-1);
  const [activeSectionIndex, setActiveSectionIndex] = useState<number>(-1);
  const [showRaw, setShowRaw] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  
  // Custom interactive lyrics controls states
  const [lyricFontSize, setLyricFontSize] = useState<number>(20); // default 20px
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [autoScrollActive, setAutoScrollActive] = useState<boolean>(true);
  const [readerTheme, setReaderTheme] = useState<'light' | 'dark' | 'sepia'>(() => {
    const saved = localStorage.getItem('readerTheme') as 'light' | 'dark' | 'sepia' | null;
    return saved === 'light' || saved === 'dark' || saved === 'sepia' ? saved : 'light';
  });

  useEffect(() => {
    localStorage.setItem('readerTheme', readerTheme);
  }, [readerTheme]);
  const [hindiFont, setHindiFont] = useState<'poppins' | 'rajdhani' | 'yatra' | 'rozha' | 'arima' | 'martel'>('poppins');

  // Bilingual translation & tabs management
  const [lyricsLanguageTab, setLyricsLanguageTab] = useState<'english' | 'hindi'>('english');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [activeRawLyricsHindi, setActiveRawLyricsHindi] = useState(song.rawLyricsHindi || '');
  const [activeFormattedLyricsHindi, setActiveFormattedLyricsHindi] = useState<FormattedSection[]>(song.formattedLyricsHindi || []);

  useEffect(() => {
    setActiveRawLyricsHindi(song.rawLyricsHindi || '');
    setActiveFormattedLyricsHindi(song.formattedLyricsHindi || []);
    setLyricsLanguageTab('english'); // Default back to English for any newly selected track
  }, [song]);

  const handleAITranslate = async () => {
    setIsTranslating(true);
    try {
      const res = await fetch("/api/gemini/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawLyrics: song.rawLyrics,
          songInfo: { title: song.title, artist: song.artist }
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.formattedText) {
          const rawH = data.formattedText;
          const parsedH = parseRawLyrics(rawH);
          setActiveRawLyricsHindi(rawH);
          setActiveFormattedLyricsHindi(parsedH);
          setLyricsLanguageTab('hindi');
          
          // Persist the results inside Cloud Firestore automatically
          try {
            await updateDoc(doc(db, "songs", song.id), {
              rawLyricsHindi: rawH,
              formattedLyricsHindi: parsedH
            });
            console.log("Cached translation permanently inside Cloud Firestore!");
          } catch (dbErr) {
            console.warn("Could not write translation back to database:", dbErr);
          }
        } else {
          alert(data.error || "Failed to generate Devanagari translation from Gemini.");
        }
      }
    } catch (err) {
      console.error(err);
      alert("Network exception connecting to AI translator.");
    } finally {
      setIsTranslating(false);
    }
  };

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);

  // Convert duration string "3:45" into total seconds
  const totalSeconds = React.useMemo(() => {
    if (!song.duration) return 210; // Default 3:30
    const [m, s] = song.duration.split(':').map(Number);
    return (m * 60) + (s || 0);
  }, [song.duration]);

  // Control playback simulation
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentTime(prev => {
          if (prev >= totalSeconds) {
            setIsPlaying(false);
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, totalSeconds]);

  // Timetag regex parser & line-alignment mapping
  const parsedLines = React.useMemo(() => {
    const list: { sectionIdx: number; lineIdx: number; text: string; time: number; globalIdx: number }[] = [];
    let currentGlobalIdx = 0;
    
    // Pattern looking for [mm:ss] or [mm:ss.xx]
    const timeReg = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/;
    const activeLyricsList = lyricsLanguageTab === 'english' ? song.formattedLyrics : activeFormattedLyricsHindi;

    activeLyricsList.forEach((sec, sIdx) => {
      sec.lines.forEach((line, lIdx) => {
        const match = line.match(timeReg);
        let timeVal = -1;
        let cleanText = line;

        if (match) {
          const m = parseInt(match[1], 10);
          const s = parseInt(match[2], 10);
          const ms = match[3] ? parseInt(match[3], 10) / 105 : 0;
          timeVal = (m * 60) + s + ms;
          cleanText = line.replace(timeReg, "").trim();
        }

        list.push({
          sectionIdx: sIdx,
          lineIdx: lIdx,
          text: cleanText,
          time: timeVal,
          globalIdx: currentGlobalIdx
        });
        currentGlobalIdx++;
      });
    });

    const hasTimestamps = list.some(item => item.time !== -1);
    if (hasTimestamps) {
      // Sort in timeline sequence
      list.sort((a, b) => a.time - b.time);
    } else {
      // Proportional distribution over duration fallback
      const lineDuration = totalSeconds / Math.max(1, list.length);
      list.forEach((item, idx) => {
        item.time = idx * lineDuration;
      });
    }

    return list;
  }, [song, totalSeconds, lyricsLanguageTab, activeFormattedLyricsHindi]);

  // Map simulated playback seconds to lyric lines
  useEffect(() => {
    if (parsedLines.length > 0) {
      let activeIdx = -1;
      for (let i = 0; i < parsedLines.length; i++) {
        if (currentTime >= parsedLines[i].time) {
          activeIdx = i;
        } else {
          break;
        }
      }

      if (activeIdx !== -1) {
        setActiveLineIndex(activeIdx);
        const mappedLine = parsedLines[activeIdx];
        setActiveSectionIndex(mappedLine.sectionIdx);
      } else {
        if (currentTime === 0) {
          setActiveLineIndex(-1);
          setActiveSectionIndex(-1);
        }
      }
    }
  }, [currentTime, parsedLines]);

  // Handle smooth scroll assist when lyrics sequence moves forward
  useEffect(() => {
    if (autoScrollActive && activeLineIndex !== -1) {
      const targetId = isFullScreen 
        ? `fullscreen-lyric-line-global-${activeLineIndex}` 
        : `lyric-line-global-${activeLineIndex}`;
      
      const scrollTimer = setTimeout(() => {
        const activeLineElem = document.getElementById(targetId);
        if (activeLineElem) {
          activeLineElem.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      }, 100);

      return () => clearTimeout(scrollTimer);
    }
  }, [activeLineIndex, autoScrollActive, isFullScreen]);

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentTime(Number(e.target.value));
  };

  const resetPlayback = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    setActiveLineIndex(-1);
    setActiveSectionIndex(-1);
  };

  const formatSeconds = (secNum: number) => {
    const mins = Math.floor(secNum / 60);
    const secs = Math.floor(secNum % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  // Quick info insights
  const wordCount = React.useMemo(() => {
    return song.rawLyrics.split(/\s+/).filter(Boolean).length;
  }, [song.rawLyrics]);

  const chorusCount = React.useMemo(() => {
    return song.formattedLyrics.filter(s => s.type === 'chorus').length;
  }, [song.formattedLyrics]);

  // Sizing adjusters
  const increaseFontSize = () => {
    setLyricFontSize(prev => Math.min(prev + 2, 36));
  };

  const decreaseFontSize = () => {
    setLyricFontSize(prev => Math.max(prev - 2, 12));
  };

  // Copy lyrics function
  const copyLyricsToClipboard = () => {
    navigator.clipboard.writeText(song.rawLyrics);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Download raw lyrics script
  const downloadLyricsAsFile = () => {
    const element = document.createElement("a");
    const file = new Blob([`${song.title} - ${song.artist}\n\n${song.rawLyrics}`], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${song.title.replace(/\s+/g, '_')}_Lyrics.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Download beautifully formatted printable PDF lyrics sheet
  const downloadLyricsAsPdf = () => {
    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const activeLyricsList = lyricsLanguageTab === 'english' ? song.formattedLyrics : activeFormattedLyricsHindi;

      // Canvas dimensions for sharp A4 rendering (150 DPI)
      const canvasWidth = 1240;
      const canvasHeight = 1754;

      // Extract colors that map to currently active reader mode themes
      const isDark = readerTheme === 'dark';
      const isSepia = readerTheme === 'sepia';

      let pageBg = '#f8fafc'; // Default modern background
      let textPrimary = '#0f172a';
      let textSecondary = '#475569';
      let dividerColor = '#cbd5e1';

      let stdBg = '#ffffff';
      let stdBorder = '#e2e8f0';
      let stdLabel = '#64748b';
      let stdText = '#1e293b';

      let chorusBg = '#fff1f2';
      let chorusBorder = '#fbcfe8';
      let chorusLabel = '#be123c';
      let chorusText = '#4c0519';

      let introBg = '#f0fdfa';
      let introBorder = '#ccfbf1';
      let introLabel = '#0f766e';
      let introText = '#115e59';

      if (isDark) {
        pageBg = '#0f172a';
        textPrimary = '#f8fafc';
        textSecondary = '#94a3b8';
        dividerColor = '#334155';

        stdBg = '#1e293b';
        stdBorder = '#334145';
        stdLabel = '#cbd5e1';
        stdText = '#f8fafc';

        chorusBg = '#4c0519';
        chorusBorder = '#9f1239';
        chorusLabel = '#f472b6';
        chorusText = '#fce7f3';

        introBg = '#042f2e';
        introBorder = '#115e59';
        introLabel = '#2dd4bf';
        introText = '#99f6e4';
      } else if (isSepia) {
        pageBg = '#f4ecd8';
        textPrimary = '#433422';
        textSecondary = '#7c6a59';
        dividerColor = '#dcd0b4';

        stdBg = '#ece0c4';
        stdBorder = '#dcd0b4';
        stdLabel = '#5a462e';
        stdText = '#433422';

        chorusBg = '#ffd9cc';
        chorusBorder = '#eed5cc';
        chorusLabel = '#803c26';
        chorusText = '#4b1d0e';

        introBg = '#e2ecc2';
        introBorder = '#cbd8ae';
        introLabel = '#14532d';
        introText = '#3d442b';
      }

      let pageNum = 1;
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvasWidth;
      tempCanvas.height = canvasHeight;
      const ctx = tempCanvas.getContext('2d');
      if (!ctx) {
        setIsGeneratingPdf(false);
        return;
      }

      // Safe cross-browser rounded corners generator for classic look in exports
      const drawRoundRectCorners = (x: number, y: number, w: number, h: number, tl: number, tr: number, br: number, bl: number) => {
        ctx.beginPath();
        ctx.moveTo(x + tl, y);
        ctx.lineTo(x + w - tr, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
        ctx.lineTo(x + w, y + h - br);
        ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
        ctx.lineTo(x + bl, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
        ctx.lineTo(x, y + tl);
        ctx.quadraticCurveTo(x, y, x + tl, y);
        ctx.closePath();
      };

      // Helper to initialize and frame each page correctly
      const initPage = (pNum: number) => {
        ctx.fillStyle = pageBg;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Frame boundary decoration
        ctx.strokeStyle = dividerColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(40, 40, canvasWidth - 80, canvasHeight - 80);

        if (pNum === 1) {
          // Main banner title section
          ctx.fillStyle = textPrimary;
          ctx.font = 'bold 38px "Space Grotesk", "Inter", sans-serif';
          ctx.fillText(song.title, 80, 110, canvasWidth - 160);

          // Subtitle artist line
          ctx.fillStyle = textSecondary;
          ctx.font = 'italic 18px "Inter", sans-serif';
          ctx.fillText(`by ${song.artist}`, 80, 145, canvasWidth - 160);

          // Meta statistics list
          ctx.fillStyle = textSecondary;
          ctx.font = '12px "JetBrains Mono", monospace';
          const metaColumns = [];
          if (song.album) metaColumns.push(`Album: ${song.album}`);
          if (song.genre) metaColumns.push(`Genre: ${song.genre}`);
          if (song.duration) metaColumns.push(`Length: ${song.duration}`);
          metaColumns.push(`Language: ${lyricsLanguageTab === 'english' ? 'English' : 'Hindi'}`);
          ctx.fillText(metaColumns.join('  •  '), 80, 180, canvasWidth - 160);

          // Border divider
          ctx.strokeStyle = dividerColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(80, 205);
          ctx.lineTo(canvasWidth - 80, 205);
          ctx.stroke();

          return 245; // Start coordinates Y on first page
        } else {
          // Running page header
          ctx.fillStyle = textSecondary;
          ctx.font = '12px "JetBrains Mono", monospace';
          ctx.fillText(`${song.title}  |  Lyrics Document`, 80, 70);
          ctx.textAlign = 'right';
          ctx.fillText(`Page ${pNum}`, canvasWidth - 80, 70);
          ctx.textAlign = 'left';

          // Line runner divider
          ctx.strokeStyle = dividerColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(80, 85);
          ctx.lineTo(canvasWidth - 80, 85);
          ctx.stroke();

          return 125; // Start coordinates Y on other pages
        }
      };

      let currentY = initPage(pageNum);

      // Map font family dynamically depending on Roman script vs Hindi Devanagari Font selectors
      const getFontFamily = () => {
        if (lyricsLanguageTab === 'hindi') {
          if (hindiFont === 'poppins') return 'Poppins, sans-serif';
          if (hindiFont === 'rajdhani') return 'Rajdhani, sans-serif';
          if (hindiFont === 'yatra') return '"Yatra One", serif';
          if (hindiFont === 'rozha') return '"Rozha One", serif';
          if (hindiFont === 'arima') return 'Arima, serif';
          if (hindiFont === 'martel') return 'Martel, serif';
          return 'Poppins, sans-serif';
        }
        return '"Inter", "Helvetica", Arial, sans-serif';
      };

      const lyricFontFamily = getFontFamily();

      // Loop and draw formatted stanzas section by section
      for (let i = 0; i < activeLyricsList.length; i++) {
        const section = activeLyricsList[i];
        const isChorus = section.type === 'chorus';
        const isIntro = section.type === 'intro' || section.type === 'outro';

        let bgStyle = stdBg;
        let borderStyle = stdBorder;
        let colorLabel = stdLabel;
        let colorLine = stdText;

        if (isChorus) {
          bgStyle = chorusBg;
          borderStyle = chorusBorder;
          colorLabel = chorusLabel;
          colorLine = chorusText;
        } else if (isIntro) {
          bgStyle = introBg;
          borderStyle = introBorder;
          colorLabel = introLabel;
          colorLine = introText;
        }

        // Determine spacing metrics
        const paddingVertical = 25;
        const paddingHorizontal = 35;
        const sLabelHeight = 18;
        const sGapAfterLabel = 12;
        const sLineHeight = 32;
        const trailingGap = 20;

        const totalCardHeight = paddingVertical + sLabelHeight + sGapAfterLabel + (section.lines.length * sLineHeight) + trailingGap;

        // Auto-handle standard multi-page break split
        if (currentY + totalCardHeight > 1620) {
          // Capture current frame and add it to doc prior to page generation
          const frameImg = tempCanvas.toDataURL('image/jpeg', 0.95);
          if (pageNum > 1) {
            doc.addPage();
          }
          doc.addImage(frameImg, 'JPEG', 0, 0, 210, 297);

          pageNum++;
          currentY = initPage(pageNum);
        }

        const boxX = 80;
        const boxWidth = canvasWidth - 160;

        // Draw main container backing
        ctx.fillStyle = bgStyle;
        ctx.strokeStyle = borderStyle;
        ctx.lineWidth = 1;
        drawRoundRectCorners(boxX, currentY, boxWidth, totalCardHeight, 12, 12, 12, 12);
        ctx.fill();
        ctx.stroke();

        // Thick side bar accent specifically for Chorus structures (pink/rose) or Intro (teal) or Sepia matching counterparts
        if (isChorus) {
          ctx.fillStyle = '#f43f5e';
          drawRoundRectCorners(boxX, currentY, 6, totalCardHeight, 12, 0, 0, 12);
          ctx.fill();
        } else if (isIntro) {
          ctx.fillStyle = '#0f766e';
          drawRoundRectCorners(boxX, currentY, 6, totalCardHeight, 12, 0, 0, 12);
          ctx.fill();
        }

        // Stamp headers
        ctx.fillStyle = colorLabel;
        ctx.font = 'bold 12px "JetBrains Mono", monospace';
        const displayLabel = section.label ? section.label.toUpperCase() : (isChorus ? 'CHORUS' : 'STANZA');
        ctx.fillText(displayLabel, boxX + paddingHorizontal, currentY + paddingVertical + 4);

        if (isChorus) {
          ctx.fillText('✦', boxX + boxWidth - paddingHorizontal - 8, currentY + paddingVertical + 4);
        }

        let lineY = currentY + paddingVertical + sLabelHeight + sGapAfterLabel;

        // Write individual lyrics
        ctx.fillStyle = colorLine;
        const isBold = isChorus ? 'bold' : 'normal';
        const isItalic = isChorus ? 'italic' : 'normal';
        ctx.font = `${isItalic} ${isBold} 17px ${lyricFontFamily}`;

        for (const line of section.lines) {
          ctx.fillText(line, boxX + paddingHorizontal, lineY, boxWidth - 2 * paddingHorizontal);
          lineY += sLineHeight;
        }

        // Setup top margin for the next element box
        currentY += totalCardHeight + 25;
      }

      // Add final page frame to document
      const lastFrame = tempCanvas.toDataURL('image/jpeg', 0.95);
      if (pageNum > 1) {
        doc.addPage();
      }
      doc.addImage(lastFrame, 'JPEG', 0, 0, 210, 297);

      // Save output
      doc.save(`${song.title.replace(/\s+/g, '_')}_Lyrics_Sheet.pdf`);
    } catch (err) {
      console.error("PDF generator encountered an error:", err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="lyrics-view-grid">
      
      {/* LEFT ASPECT: Lyric Sheet containing playback controls */}
      <div className="lg:col-span-8 space-y-6">
        
        {/* Dynamic Cover & Song Header */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm flex flex-col sm:flex-row items-center gap-6 relative overflow-hidden">
          {/* Cover Art Miniature */}
          <div className="relative flex-shrink-0 w-24 h-24 sm:w-28 sm:h-28">
            <motion.div 
              animate={isPlaying ? { rotate: 360 } : {}}
              transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
              className="w-full h-full rounded-full bg-slate-50 border-2 border-slate-200 p-1 flex items-center justify-center shadow-md"
            >
              <img
                referrerPolicy="no-referrer"
                src={song.coverUrl || 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=600&auto=format&fit=crop'}
                alt={song.title}
                className="w-full h-full rounded-full object-cover"
              />
              <div className="absolute w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />
              </div>
            </motion.div>
          </div>

          {/* Core metadata text */}
          <div className="text-center sm:text-left space-y-1.5 flex-grow">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
              <span className="text-[10px] font-mono bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-0.5 rounded-md uppercase font-bold">
                {song.genre}
              </span>
              {song.album && (
                <span className="text-[10px] font-mono text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded">
                  {song.album}
                </span>
              )}
            </div>
            
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {song.title}
            </h1>
            <p className="text-slate-600 text-sm">
              Provided by <span className="text-slate-900 font-bold">{song.artist}</span>
            </p>

            <div className="flex items-center justify-center sm:justify-start gap-4 text-xs font-mono text-slate-400 pt-0.5">
              <span>Duration: {song.duration}</span>
              <span>•</span>
              <span>Syllables: {wordCount} words</span>
            </div>
          </div>
        </div>

        {/* Dynamic Interactive Control Bar */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 uppercase">
                <Radio className={`w-2.5 h-2.5 text-slate-500 ${isPlaying ? 'animate-pulse' : ''}`} />
                {isPlaying ? 'Live Lyrics Active' : 'Lyrics Play Tracker'}
              </span>
            </div>

            {/* Quick action buttons */}
            <div className="flex items-center gap-1.5">
              
              {/* Increase / Decrease Font Size of Lyrics */}
              <div className="flex items-center gap-1 bg-slate-100 border border-slate-250/50 p-1 rounded-lg">
                <button
                  onClick={decreaseFontSize}
                  className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition cursor-pointer"
                  title="Smaller Lyrics Font"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-mono font-bold px-1.5 text-slate-700">
                  {lyricFontSize}px
                </span>
                <button
                  onClick={increaseFontSize}
                  className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition cursor-pointer"
                  title="Larger Lyrics Font"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Reading Theme Selector */}
              <div className="flex items-center gap-1 bg-slate-100 border border-slate-250/50 p-1 rounded-lg">
                <button
                  onClick={() => setReaderTheme('light')}
                  className={`px-2 py-1 text-[10px] font-mono font-bold rounded transition-all cursor-pointer ${
                    readerTheme === 'light' 
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200/50' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                  title="Light Mode"
                >
                  Light
                </button>
                <button
                  onClick={() => setReaderTheme('sepia')}
                  className={`px-2 py-1 text-[10px] font-mono font-bold rounded transition-all cursor-pointer ${
                    readerTheme === 'sepia' 
                      ? 'bg-[#fadcb8]/50 text-[#543b18] shadow-xs border border-[#cfbca1]' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                  title="Sepia Mode"
                >
                  Sepia
                </button>
                <button
                  onClick={() => setReaderTheme('dark')}
                  className={`px-2 py-1 text-[10px] font-mono font-bold rounded transition-all cursor-pointer ${
                    readerTheme === 'dark' 
                      ? 'bg-slate-950 text-white shadow-xs border border-slate-850' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                  title="Dark Mode"
                >
                  Dark
                </button>
              </div>

              {/* YouTube fallback */}
              {song.youtubeUrl && (
                <a 
                  href={song.youtubeUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100/70 text-xs flex items-center gap-1 font-mono transition-all"
                  title="View YouTube Video"
                >
                  <Youtube className="w-3.5 h-3.5" />
                </a>
              )}

              {/* Copy lyrics */}
              <button
                onClick={copyLyricsToClipboard}
                className={`p-1.5 rounded-lg border text-xs gap-1 flex font-mono items-center transition cursor-pointer ${
                  isCopied 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
                title="Copy complete raw content"
              >
                {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{isCopied ? 'Copied' : 'Copy'}</span>
              </button>

              {/* Download raw lyrics text */}
              <button
                onClick={downloadLyricsAsFile}
                className="p-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-slate-600 hover:bg-slate-100 text-xs flex items-center gap-1 font-mono transition-colors cursor-pointer"
                title="Save as TXT file"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download</span>
              </button>

              {/* Download beautifully formatted printable PDF lyrics sheet */}
              <button
                onClick={downloadLyricsAsPdf}
                disabled={isGeneratingPdf}
                className="p-1.5 rounded-lg bg-rose-50 border border-rose-200/80 text-rose-600 hover:bg-rose-100 text-xs flex items-center gap-1 font-mono transition-colors cursor-pointer disabled:opacity-50"
                title="Save as beautiful printable PDF document"
              >
                {isGeneratingPdf ? (
                  <span className="w-3.5 h-3.5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <Printer className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">Download PDF</span>
              </button>

              {/* Toggle Styled vs Raw */}
              <button 
                onClick={() => setShowRaw(!showRaw)}
                className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs flex items-center gap-1 font-mono transition-all cursor-pointer"
                title="View formatted styled sections vs raw input code block"
              >
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">{showRaw ? 'Beautified' : 'Raw'}</span>
              </button>

              {/* One Click Full Screen Button */}
              <button
                onClick={() => setIsFullScreen(true)}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-950 text-white hover:bg-slate-800 text-xs flex items-center gap-1 font-mono transition-colors cursor-pointer"
                title="Full-Screen Sing Along Mode"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Fullscreen</span>
              </button>
            </div>
          </div>

          {/* Timeline Bar Info Details (Progress music slider was removed for clarity as requested) */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[11px] font-mono text-slate-400 bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-100">
              <span className="font-semibold text-slate-600">Playback Elapsed: {formatSeconds(currentTime)}</span>
              <span className="font-bold text-rose-600 flex items-center gap-1.5 animate-pulse bg-rose-50/50 border border-rose-100 px-2.5 py-0.5 rounded-full text-[9px] uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                {autoScrollActive ? 'Auto-Scrolling Active' : 'Scrolling Standby'}
              </span>
              <span className="font-semibold text-slate-600">Total Length: {formatSeconds(totalSeconds)}</span>
            </div>
          </div>

          {/* Sync control tools */}
          <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`px-4 py-2 rounded-xl transition-all font-mono font-bold text-xs flex items-center gap-1.5 cursor-pointer ${
                  isPlaying 
                    ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-250/50' 
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                <span>{isPlaying ? 'Pause Tracker' : 'Play Lyrics Sync'}</span>
              </button>
              
              <button
                onClick={resetPlayback}
                disabled={currentTime === 0}
                className="p-2 bg-slate-100 text-slate-500 hover:text-slate-900 disabled:opacity-40 border border-slate-200 rounded-xl hover:bg-slate-200 transition cursor-pointer"
                title="Reset tracks timeline"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={() => setAutoScrollActive(!autoScrollActive)}
                className={`px-2 py-2 rounded-xl text-[10px] font-mono font-bold border transition cursor-pointer ${
                  autoScrollActive 
                    ? 'bg-rose-50 border-rose-250/60 text-rose-600' 
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
                title="Enable / Disable Auto Scrolling"
              >
                Focus tracking
              </button>
            </div>

            <div className="text-slate-400 text-[10px] font-mono flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-slate-355" />
              <span>Synthesizer Standby</span>
            </div>
          </div>
        </div>

        {/* Dynamic Lyrics sheet board */}
        <div id="lyrics-sheet-card" className={`border rounded-2xl p-6 md:p-8 relative overflow-hidden shadow-sm transition-all duration-300 ${
          readerTheme === 'dark'
            ? 'bg-slate-950 border-slate-800 text-slate-100'
            : readerTheme === 'sepia'
              ? 'bg-[#faf4e8] border-[#e5d9c0] text-[#3e2c14]'
              : 'bg-white border-slate-200/90 text-slate-800'
        }`}>
          <AnimatePresence mode="wait">
            {showRaw ? (
              // RAW CODE TYPE WRITER STYLE
              <motion.div
                key="raw-lyrics-sheet"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="font-mono text-xs text-slate-500 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
                  <span className="text-slate-500 font-bold block">RAW SONG SOURCE ENTRY</span>
                  <span className="text-[9px] text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded bg-slate-50 font-bold">MONOSPACE</span>
                </div>
                <pre className={`whitespace-pre-wrap leading-relaxed max-h-[450px] overflow-y-auto pr-2 custom-scrollbar ${
                  readerTheme === 'dark' ? 'text-slate-300' : readerTheme === 'sepia' ? 'text-[#5a462e]' : 'text-slate-500'
                }`}>
                  {lyricsLanguageTab === 'english' ? song.rawLyrics : activeRawLyricsHindi || "No Hindi translations available."}
                </pre>
              </motion.div>
            ) : (
              // AUTO-BEAUTIFIED LYRICS PREVIEW WITH FONT SIZE CONTROLS
              <motion.div
                key="beautified-lyrics-sheet"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="text-center mb-4">
                  <h2 className={`text-2xl md:text-3xl font-serif font-black mb-1 tracking-tight ${
                    readerTheme === 'dark' 
                      ? 'text-white' 
                      : readerTheme === 'sepia'
                        ? 'text-[#3e2c14]' 
                        : 'text-slate-900'
                  }`}>{song.title}</h2>
                  <p className={`text-xs tracking-[0.2em] font-sans uppercase ${
                    readerTheme === 'sepia' ? 'text-[#87745d]' : 'text-slate-400'
                  }`}>BY {song.artist}</p>
                </div>

                {/* Elegant Dual-Language Tab Selectors with micro-interactions */}
                <div className="flex flex-col gap-4 pb-4 border-b border-slate-100">
                  <div className="flex justify-center gap-2.5">
                    <button
                      onClick={() => setLyricsLanguageTab('english')}
                      className={`px-5 py-2 rounded-xl text-xs font-bold tracking-wide transition-all uppercase flex items-center gap-2 cursor-pointer ${
                        lyricsLanguageTab === 'english'
                          ? readerTheme === 'dark'
                            ? 'bg-white text-slate-950 shadow-lg scale-105'
                            : 'bg-slate-900 text-white shadow-lg shadow-slate-900/10 scale-105'
                          : readerTheme === 'dark'
                            ? 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                            : readerTheme === 'sepia'
                              ? 'bg-[#ebdca5]/30 hover:bg-[#ebdca5]/60 text-[#54432a] border border-[#cfc19f]'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200/50'
                      }`}
                    >
                      🇬🇧 English Default
                    </button>

                    <button
                      onClick={() => setLyricsLanguageTab('hindi')}
                      className={`px-5 py-2 rounded-xl text-xs font-bold tracking-wide transition-all uppercase flex items-center gap-2 cursor-pointer ${
                        lyricsLanguageTab === 'hindi'
                          ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/10 scale-105'
                          : readerTheme === 'dark'
                            ? 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                            : readerTheme === 'sepia'
                              ? 'bg-[#ebdca5]/30 hover:bg-[#ebdca5]/60 text-[#54432a] border border-[#cfc19f]'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200/50'
                      }`}
                    >
                      🇮🇳 Hindi Version (हिंदी)
                    </button>
                  </div>

                  {/* Phone Optimized Hindi Font options */}
                  {lyricsLanguageTab === 'hindi' && activeFormattedLyricsHindi.length > 0 && (
                    <div id="hindi-font-selector" className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2 border-t border-dashed border-slate-100 animate-fadeIn">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                        🇮🇳 Select Hindi Font Style:
                      </span>
                      <div className="flex flex-wrap justify-center gap-1 p-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                        {[
                          { id: 'poppins', label: 'Poppins (Sans)' },
                          { id: 'rajdhani', label: 'Rajdhani (Tech)' },
                          { id: 'yatra', label: 'Yatra (Calligraphy)' },
                          { id: 'rozha', label: 'Rozha (Bold Editorial)' },
                          { id: 'arima', label: 'Arima (Soft/Warm)' },
                          { id: 'martel', label: 'Martel (Traditional Serif)' }
                        ].map((fontItem) => (
                          <button
                            key={fontItem.id}
                            onClick={() => setHindiFont(fontItem.id as any)}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-all duration-150 cursor-pointer select-none ${
                              hindiFont === fontItem.id
                                ? 'bg-rose-600 text-white font-bold shadow-xs'
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 font-sans'
                            }`}
                          >
                            {fontItem.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {lyricsLanguageTab === 'hindi' && activeFormattedLyricsHindi.length === 0 ? (
                  <div className={`border rounded-3xl p-8 text-center max-w-md mx-auto space-y-4 shadow-sm my-8 ${
                    readerTheme === 'dark'
                      ? 'from-rose-950/20 to-amber-950/20 border-rose-900 bg-slate-900'
                      : readerTheme === 'sepia'
                        ? 'from-[#ebdca5]/30 to-[#eadebe]/30 border-[#cfc19f] bg-[#ece0c4]/40'
                        : 'bg-gradient-to-br from-rose-50/50 to-amber-50/30 border-rose-100'
                  }`}>
                    <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600 mx-auto shadow-sm">
                      <Sparkles className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h4 className={`font-bold leading-tight ${
                        readerTheme === 'dark'
                          ? 'text-white'
                          : readerTheme === 'sepia'
                            ? 'text-[#3e2c14]'
                            : 'text-slate-900'
                      }`}>Hindi lyrics have not been synced yet</h4>
                      <p className={`text-xs mt-1.5 leading-relaxed ${
                        readerTheme === 'dark'
                          ? 'text-slate-450'
                          : readerTheme === 'sepia'
                            ? 'text-[#7d684e]'
                            : 'text-slate-500'
                      }`}>
                        No translation is configured for this song. Tap to invoke the Gemini API to analyze and translate the lyrics to Devanagari Hindi instantly!
                      </p>
                    </div>
                    <button
                      onClick={handleAITranslate}
                      disabled={isTranslating}
                      className="w-full py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-55 text-white text-xs font-bold font-sans tracking-wide rounded-2xl transition shadow-lg shadow-rose-600/10 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isTranslating ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>AI generating translation...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-white" />
                          <span>Generate Devanagari Translation with AI</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  (lyricsLanguageTab === 'english' ? song.formattedLyrics : activeFormattedLyricsHindi).map((section, sIdx) => {
                    const isChorus = section.type === 'chorus';
                    const isTension = section.type === 'tension';
                    const isBridge = section.type === 'bridge';
                    const isHook = section.type === 'hook';
                    const isIntro = section.type === 'intro' || section.type === 'outro';
                    const isSectionActive = activeSectionIndex === sIdx;

                    const themeStyles = {
                      light: {
                        chorus: {
                          bg: isSectionActive ? "bg-rose-50/95 border-pink-400 ring-2 ring-pink-500/20 shadow-md scale-[1.01]" : "bg-gradient-to-br from-rose-50/70 to-pink-50/40 border-pink-200/80 shadow-sm hover:bg-rose-50/50",
                          header: "text-pink-700 font-extrabold tracking-wide",
                          line: "text-pink-950 font-bold italic tracking-wide",
                          borderLeft: "border-l-pink-500 border-l-[6px]"
                        },
                        tension: {
                          bg: isSectionActive ? "bg-orange-100 hover:bg-orange-100 border-orange-300 shadow-md ring-1 ring-orange-500/10" : "bg-orange-50/15 border-orange-100 hover:border-orange-200 hover:bg-orange-50/30",
                          header: "text-orange-700 font-extrabold",
                          line: "text-slate-900 font-medium",
                          borderLeft: "border-l-orange-500"
                        },
                        bridge: {
                          bg: isSectionActive ? "bg-amber-50/60 border-amber-300 shadow-md ring-1 ring-amber-500/10" : "bg-amber-50/10 border-amber-100 hover:border-amber-250/50 hover:bg-amber-50/20",
                          header: "text-amber-850",
                          line: "text-slate-900 font-serif italic",
                          borderLeft: "border-l-amber-500"
                        },
                        intro: {
                          bg: "bg-teal-50 border-teal-150",
                          header: "text-teal-700 font-medium",
                          line: "text-teal-800 font-mono italic",
                          borderLeft: "border-l-teal-400"
                        },
                        standard: {
                          bg: isSectionActive ? "bg-slate-100 border-slate-350 shadow-md ring-1 ring-slate-500/10" : "bg-slate-50/60 border-slate-250/40 hover:border-slate-300 hover:bg-slate-50/80",
                          header: "text-slate-600 font-semibold",
                          line: "text-slate-800 font-sans",
                          borderLeft: "border-l-slate-400"
                        }
                      },
                      dark: {
                        chorus: {
                          bg: isSectionActive ? "bg-gradient-to-r from-rose-950/50 to-indigo-950/50 border-pink-500 ring-2 ring-pink-500/30 shadow-md scale-[1.01]" : "bg-gradient-to-br from-rose-950/20 to-indigo-950/20 border-pink-900/50 hover:bg-rose-950/30 hover:border-rose-800",
                          header: "text-pink-400 font-extrabold tracking-wide",
                          line: "text-rose-100 font-bold italic tracking-wide",
                          borderLeft: "border-l-pink-500 border-l-[6px]"
                        },
                        tension: {
                          bg: isSectionActive ? "bg-orange-950/50 border-orange-700 shadow-md ring-1 ring-orange-500/25" : "bg-orange-950/15 border-orange-900/40 hover:bg-orange-950/30 hover:border-orange-800",
                          header: "text-orange-400 font-extrabold",
                          line: "text-orange-100 font-medium",
                          borderLeft: "border-l-orange-550"
                        },
                        bridge: {
                          bg: isSectionActive ? "bg-amber-955/40 border-amber-700 shadow-md ring-1 ring-amber-500/20" : "bg-amber-950/10 border-amber-900/60 hover:bg-amber-950/20 hover:border-amber-805",
                          header: "text-amber-400",
                          line: "text-amber-100 font-serif italic",
                          borderLeft: "border-l-amber-600"
                        },
                        intro: {
                          bg: "bg-teal-950/20 border-teal-900",
                          header: "text-teal-450",
                          line: "text-teal-300 font-mono",
                          borderLeft: "border-l-teal-600"
                        },
                        standard: {
                          bg: isSectionActive ? "bg-slate-900 border-slate-700 shadow-md ring-1 ring-slate-500/10" : "bg-slate-900/40 border-slate-800/80 hover:bg-slate-900/60 hover:border-slate-700",
                          header: "text-slate-450 font-semibold",
                          line: "text-slate-300 font-sans",
                          borderLeft: "border-l-slate-600"
                        }
                      },
                      sepia: {
                        chorus: {
                          bg: isSectionActive ? "bg-[#ffd9cc]/60 border-[#c46a4f] ring-2 ring-orange-500/20 scale-[1.01]" : "bg-[#fbe7df]/40 border-[#eed5cc]/85 hover:bg-[#ffd9cc]/15 hover:border-[#dfc3b5]",
                          header: "text-[#803c26] font-extrabold tracking-wide",
                          line: "text-[#4b1d0e] font-bold italic tracking-wide",
                          borderLeft: "border-l-[#b04f32] border-l-[6px]"
                        },
                        tension: {
                          bg: isSectionActive ? "bg-[#f5e3d3] border-[#d8b08d] shadow-md ring-1 ring-[#c08d5c]/15" : "bg-[#f5e3d3]/25 border-[#eed5be] hover:bg-[#f5e3d3]/50 hover:border-[#d9af88]",
                          header: "text-orange-900 font-extrabold",
                          line: "text-[#3e2305] font-medium",
                          borderLeft: "border-l-orange-500"
                        },
                        bridge: {
                          bg: isSectionActive ? "bg-[#ebdca5] border-[#c8b788] shadow-md ring-1 ring-[#a89564]/10" : "bg-[#ece0c4]/30 border-[#e5d9bd] hover:bg-[#ece0c4]/50 hover:border-[#cfc19e]",
                          header: "text-amber-955",
                          line: "text-[#332210] font-serif italic",
                          borderLeft: "border-l-amber-700"
                        },
                        intro: {
                          bg: "bg-[#e2ecc2]/40 border-[#cbd8ae]",
                          header: "text-emerald-900 font-semibold",
                          line: "text-[#3d442b] font-mono",
                          borderLeft: "border-l-emerald-600"
                        },
                        standard: {
                          bg: isSectionActive ? "bg-[#ece0c4] border-[#cfc19e] shadow-md ring-1 ring-[#af9e7a]/15" : "bg-[#ece0c4]/30 border-[#e5d9bd] hover:bg-[#ece0c4]/50 hover:border-[#cfc19e]",
                          header: "text-[#5a462e] font-semibold",
                          line: "text-[#403019] font-sans",
                          borderLeft: "border-l-[#a08b68]"
                        }
                      }
                    };

                    const activeTheme = themeStyles[readerTheme];
                    let currentSectionStyles;
                    if (isChorus) {
                      currentSectionStyles = activeTheme.chorus;
                    } else if (isTension) {
                      currentSectionStyles = activeTheme.tension;
                    } else if (isBridge || isHook) {
                      currentSectionStyles = activeTheme.bridge;
                    } else if (isIntro) {
                      currentSectionStyles = activeTheme.intro;
                    } else {
                      currentSectionStyles = activeTheme.standard;
                    }

                    // BEAUTIFUL HIGH-CONTRAST HIGHLIGHTS FOR DIFFERENT BLOCK TYPES
                    let containerClass = `relative rounded-xl border transition-all duration-300 p-5 ${currentSectionStyles.bg} border-l-4 ${currentSectionStyles.borderLeft} pl-5 `;
                    let headerClass = `text-[10px] font-bold tracking-wider font-mono mb-3 uppercase flex items-center justify-between ${currentSectionStyles.header} `;
                    let lineClass = `leading-relaxed tracking-wide transition-all duration-200 ${currentSectionStyles.line} `;

                    // Dynamic font selection for Devanagari vs Default
                    const isHindiActive = lyricsLanguageTab === 'hindi';
                    let fontClass = 'font-sans';
                    if (isHindiActive) {
                      if (hindiFont === 'poppins') fontClass = 'font-hindi-poppins';
                      else if (hindiFont === 'rajdhani') fontClass = 'font-hindi-rajdhani';
                      else if (hindiFont === 'yatra') fontClass = 'font-hindi-yatra';
                      else if (hindiFont === 'rozha') fontClass = 'font-hindi-rozha';
                      else if (hindiFont === 'arima') fontClass = 'font-hindi-arima';
                      else if (hindiFont === 'martel') fontClass = 'font-hindi-martel';
                    }

                    return (
                      <motion.div
                        key={sIdx}
                        id={`lyric-section-${sIdx}`}
                        className={containerClass}
                        layout
                      >
                        {/* Quote decoration */}
                        {isChorus && (
                          <div className="absolute top-4 right-4 text-emerald-200 opacity-20 pointer-events-none">
                            <svg className="w-8 h-8 text-emerald-500" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C20.1216 16 21.017 16.8954 21.017 18V21C21.017 22.1046 20.1216 23 19.017 23H16.017C14.9124 23 14.017 22.1046 14.017 21ZM5.017 21L5.017 18C5.017 16.8954 5.91243 16 7.017 16H10.017C11.1216 16 12.017 16.8954 12.017 18V21C12.017 22.1046 11.1216 23 10.017 23H7.017C5.91243 23 5.017 22.1046 5.017 21Z"></path></svg>
                          </div>
                        )}

                        <div className={headerClass}>
                          <div className="flex items-center gap-1.5 font-bold">
                            {isChorus && <Sparkles className="w-3.5 h-3.5 text-emerald-500" />}
                            {isTension && <Sparkles className="w-3.5 h-3.5 text-orange-500" />}
                            {!isChorus && !isTension && <Music className="w-3.5 h-3.5 text-violet-400" />}
                            <span>{section.label}</span>
                          </div>
                          {isSectionActive && (
                            <span className="text-[8px] font-mono bg-slate-900 text-white font-bold px-1.5 py-0.5 rounded leading-none shadow-sm flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                              TRACKER HIGHLIGHT
                            </span>
                          )}
                        </div>

                        <div className="space-y-2">
                          {section.lines.map((line, lIdx) => {
                            const activeLyricsList = lyricsLanguageTab === 'english' ? song.formattedLyrics : activeFormattedLyricsHindi;
                            let globalLineIdx = 0;
                            for (let i = 0; i < sIdx; i++) {
                              globalLineIdx += activeLyricsList[i].lines.length;
                            }
                            globalLineIdx += lIdx;

                            const isLineActive = activeLineIndex === globalLineIdx;

                            const getHighlightClass = () => {
                              if (!isLineActive) return 'opacity-90';
                              switch (readerTheme) {
                                case 'dark':
                                  return 'text-amber-200 bg-amber-950/70 px-2.5 py-1.5 rounded-xl border-l-2 border-l-amber-500 scale-[1.01] font-bold shadow-md';
                                case 'sepia':
                                  return 'text-[#543b18] bg-[#ebdca5] px-2.5 py-1.5 rounded-xl border-l-2 border-l-amber-700 scale-[1.01] font-bold shadow-md';
                                case 'light':
                                  default:
                                  return 'text-amber-900 bg-amber-50 px-2.5 py-1.5 rounded-xl border-l-2 border-l-amber-500 scale-[1.01] font-bold shadow-sm';
                              }
                            };

                            return (
                              <p
                                key={lIdx}
                                id={`lyric-line-global-${globalLineIdx}`}
                                style={{ fontSize: `${lyricFontSize}px` }}
                                className={`${lineClass} ${fontClass} ${getHighlightClass()}`}
                              >
                                {line}
                              </p>
                            );
                          })}
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* RIGHT ASPECT: Structural architecture, statistics, meta insights */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* Back Link Button */}
        {onBackToSearch && (
          <button 
            onClick={onBackToSearch}
            className="w-full py-3 px-4 bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 rounded-xl flex items-center justify-center gap-2 font-mono text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            ← Back to Songs Directory
          </button>
        )}

        {/* Dynamic Connected YouTube player */}
        {song.youtubeUrl && getYouTubeId(song.youtubeUrl) && (
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3 relative overflow-hidden">
            <h3 className="text-xs font-mono font-bold tracking-wider text-slate-500 uppercase flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              YouTube Live Sync Video
            </h3>
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-100 shadow-sm">
              <iframe
                id="yt-sync-iframe"
                src={`https://www.youtube.com/embed/${getYouTubeId(song.youtubeUrl)}?enablejsapi=1&autoplay=0&rel=0`}
                title="YouTube music video player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full border-0"
              />
            </div>
            <p className="text-[10px] text-slate-400 font-mono leading-relaxed">
              💡 Play the music of YouTube. Moving the lyrics slider above syncs lyrics based on timestamps!
            </p>
          </div>
        )}

        {/* Minimal Information Insight panel */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 relative overflow-hidden shadow-sm">
          <div className="absolute top-3 right-3 p-1 rounded bg-rose-50 border border-rose-100 text-rose-600">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          
          <h3 className="text-xs font-mono font-bold tracking-wider text-slate-500 uppercase mb-3 flex items-center gap-1.5">
            Producer Dynamics
          </h3>

          <div className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 text-xs space-y-2 leading-relaxed">
              <span className="text-slate-800 font-bold flex items-center gap-1 font-mono">
                <Info className="w-3.5 h-3.5 text-slate-500" /> Verse Guidance:
              </span>
              <p className="text-slate-600 font-sans">
                Choruses and special bridges are designed with spacious indented margins. Use the font scaling tools (`${lyricFontSize}px` active) at the dashboard control bar to find your optimal screen reading comfort.
              </p>
            </div>

            {/* Simple Dynamic Metrics mapping */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 text-xs space-y-2">
              <span className="text-slate-800 font-bold flex items-center gap-1 font-mono">
                <Music className="w-3.5 h-3.5 text-slate-500" /> Structure:
              </span>
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-500">
                <div className="p-1.5 bg-white border border-slate-250/50 rounded">
                  <span className="block text-slate-400">SECTIONS</span>
                  <span className="font-bold text-slate-800 text-xs">{song.formattedLyrics.length}</span>
                </div>
                <div className="p-1.5 bg-white border border-slate-250/50 rounded">
                  <span className="block text-slate-400">CHORUSES</span>
                  <span className="font-bold text-slate-800 text-xs">{chorusCount}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FULLSCREEN OVERLAY PORTAL (Simulated beautiful themed theater display) */}
      <AnimatePresence>
        {isFullScreen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-50 overflow-y-auto px-6 py-12 md:p-16 custom-scrollbar transition-all duration-300 ${
              readerTheme === 'dark'
                ? 'bg-slate-950 text-slate-100'
                : readerTheme === 'sepia'
                  ? 'bg-[#faf4e8] text-[#3e2c14]'
                  : 'bg-[#fafafa] text-slate-800'
            }`}
            id="fullscreen-lyrics-overlay"
          >
            {/* Top-Right Exit Icon Only */}
            <button
              onClick={() => setIsFullScreen(false)}
              className={`fixed top-6 right-6 z-50 p-2.5 border rounded-xl shadow-sm cursor-pointer transition ${
                readerTheme === 'dark'
                  ? 'bg-slate-800 border-slate-700 text-rose-400 hover:text-rose-350 hover:bg-slate-755'
                  : readerTheme === 'sepia'
                    ? 'bg-[#ebdca5]/85 border-[#cfc19f] text-[#8e2e2e] hover:bg-[#e2d5bd]'
                    : 'bg-white border-slate-200 text-rose-500 hover:text-rose-600 hover:bg-slate-50'
              }`}
              title="Remove Fullscreen"
              id="exit-fullscreen-btn"
            >
              <Minimize2 className="w-5 h-5" />
            </button>

            <div className="max-w-3xl mx-auto space-y-12 pb-32 pt-8">
              {/* Immersive Title */}
              <div className="text-center space-y-2 border-b border-slate-100/30 pb-8">
                <h1 className={`text-3xl font-serif font-black tracking-tight ${
                  readerTheme === 'dark' 
                    ? 'text-white' 
                    : readerTheme === 'sepia'
                      ? 'text-[#3e2c14]' 
                      : 'text-slate-900'
                }`}>{song.title}</h1>
                <p className={`text-xs uppercase font-mono tracking-wider ${
                  readerTheme === 'sepia' ? 'text-[#87745d]' : 'text-slate-400'
                }`}>By {song.artist}</p>
              </div>

              {/* Readable Lyrics Blocks */}
              <div className="space-y-8 pt-4">
                {(lyricsLanguageTab === 'english' ? song.formattedLyrics : activeFormattedLyricsHindi).map((section, sIdx) => {
                  const isChorus = section.type === 'chorus';
                  const isTension = section.type === 'tension';
                  const isBridge = section.type === 'bridge';
                  const isHook = section.type === 'hook';
                  const isIntro = section.type === 'intro' || section.type === 'outro';
                  const isSectionActive = activeSectionIndex === sIdx;

                  const themeStyles = {
                    light: {
                      chorus: {
                        bg: isSectionActive ? "bg-rose-50/95 border-pink-400 ring-2 ring-pink-500/20 shadow-md scale-[1.01]" : "bg-gradient-to-br from-rose-50/70 to-pink-50/40 border-pink-200/80 shadow-sm",
                        header: "text-pink-700 font-extrabold tracking-wide",
                        line: "text-pink-950 font-bold italic tracking-wide",
                        borderLeft: "border-l-pink-500 border-l-[6px]"
                      },
                      tension: {
                        bg: isSectionActive ? "bg-orange-100 border-orange-300 ring-1 ring-orange-500/10 shadow-sm" : "bg-white border-orange-100",
                        header: "text-orange-600 font-extrabold",
                        line: "font-medium text-slate-905",
                        borderLeft: "border-l-orange-500"
                      },
                      bridge: {
                        bg: isSectionActive ? "bg-amber-50 border-amber-300 ring-1 ring-amber-500/10 shadow-sm" : "bg-white border-amber-100",
                        header: "text-amber-700",
                        line: "font-serif italic text-slate-905",
                        borderLeft: "border-l-amber-550"
                      },
                      intro: {
                        bg: "bg-slate-50 border-slate-100",
                        header: "text-slate-400",
                        line: "text-slate-500 font-mono",
                        borderLeft: "border-l-slate-300"
                      },
                      standard: {
                        bg: isSectionActive ? "bg-violet-50 border-violet-300 shadow-sm" : "bg-white border-violet-150/50",
                        header: "text-violet-500",
                        line: "font-sans text-slate-800",
                        borderLeft: "border-l-violet-400"
                      }
                    },
                    dark: {
                      chorus: {
                        bg: isSectionActive ? "bg-gradient-to-r from-rose-950/50 to-indigo-950/50 border-pink-500 ring-2 ring-pink-500/30 shadow-md scale-[1.01]" : "bg-gradient-to-br from-rose-955/20 to-indigo-955/20 border-pink-900/50 hover:bg-rose-955/30 hover:border-rose-800",
                        header: "text-pink-400 font-extrabold tracking-wide",
                        line: "text-rose-100 font-bold italic tracking-wide",
                        borderLeft: "border-l-pink-500 border-l-[6px]"
                      },
                      tension: {
                        bg: isSectionActive ? "bg-orange-950/50 border-orange-700 ring-1 ring-orange-500/25 shadow-sm" : "bg-slate-900 border-orange-950",
                        header: "text-orange-400 font-extrabold",
                        line: "font-medium text-orange-100",
                        borderLeft: "border-l-orange-550"
                      },
                      bridge: {
                        bg: isSectionActive ? "bg-amber-950/40 border-amber-700 ring-1 ring-amber-500/20 shadow-sm" : "bg-slate-900 border-amber-955",
                        header: "text-amber-450",
                        line: "font-serif italic text-amber-100",
                        borderLeft: "border-l-amber-600"
                      },
                      intro: {
                        bg: "bg-slate-900 border-slate-800",
                        header: "text-slate-500",
                        line: "text-slate-400 font-mono",
                        borderLeft: "border-l-slate-600"
                      },
                      standard: {
                        bg: isSectionActive ? "bg-violet-950/40 border-violet-700 shadow-sm" : "bg-slate-900 border-violet-955",
                        header: "text-violet-400",
                        line: "font-sans text-slate-300",
                        borderLeft: "border-l-violet-500"
                      }
                    },
                    sepia: {
                      chorus: {
                        bg: isSectionActive ? "bg-[#ffd9cc]/60 border-[#c46a4f] ring-2 ring-orange-500/20 scale-[1.01]" : "bg-[#fbe7df]/40 border-[#eed5cc]/85 hover:bg-[#ffd9cc]/15 hover:border-[#dfc3b5]",
                        header: "text-[#803c26] font-extrabold tracking-wide",
                        line: "text-[#4b1d0e] font-bold italic tracking-wide",
                        borderLeft: "border-l-[#b04f32] border-l-[6px]"
                      },
                      tension: {
                        bg: isSectionActive ? "bg-[#f5e3d3] border-[#d8b08d] ring-1 ring-[#c08d5c]/15 shadow-sm" : "bg-[#ece0c4]/40 border-[#dfd2be]",
                        header: "text-orange-900 font-extrabold",
                        line: "font-medium text-[#3e2305]",
                        borderLeft: "border-l-orange-500"
                      },
                      bridge: {
                        bg: isSectionActive ? "bg-[#ebdca5] border-[#c8b788] ring-1 ring-[#a89564]/10 shadow-sm" : "bg-[#ece0c4]/40 border-[#dfd2be]",
                        header: "text-amber-950",
                        line: "font-serif italic text-[#332210]",
                        borderLeft: "border-l-amber-700"
                      },
                      intro: {
                        bg: "bg-[#eadebe]/45 border-[#d0c19b]",
                        header: "text-[#857053]",
                        line: "text-[#6d5b43] font-mono",
                        borderLeft: "border-l-[#a09070]"
                      },
                      standard: {
                        bg: isSectionActive ? "bg-[#ece0c4] border-[#cfc19e] shadow-sm" : "bg-[#ece0c4]/40 border-[#dfd2be]",
                        header: "text-violet-900",
                        line: "font-sans text-[#403019]",
                        borderLeft: "border-l-violet-700"
                      }
                    }
                  };

                  const activeTheme = themeStyles[readerTheme];
                  let currentStyles;
                  if (isChorus) {
                    currentStyles = activeTheme.chorus;
                  } else if (isTension) {
                    currentStyles = activeTheme.tension;
                  } else if (isBridge || isHook) {
                    currentStyles = activeTheme.bridge;
                  } else if (isIntro) {
                    currentStyles = activeTheme.intro;
                  } else {
                    currentStyles = activeTheme.standard;
                  }

                  let containerStyles = `p-8 rounded-2xl border transition-all duration-300 ${currentStyles.bg} border-l-8 ${currentStyles.borderLeft} pl-8 `;
                  let headerStyles = `text-[10px] font-mono font-bold uppercase tracking-wider mb-4 block ${currentStyles.header} `;
                  let lineStyles = `leading-loose tracking-wider transition-all duration-200 ${currentStyles.line} `;

                  // Dynamic font selection for Devanagari vs Default
                  const isHindiActive = lyricsLanguageTab === 'hindi';
                  let fontClass = 'font-sans';
                  if (isHindiActive) {
                    if (hindiFont === 'poppins') fontClass = 'font-hindi-poppins';
                    else if (hindiFont === 'rajdhani') fontClass = 'font-hindi-rajdhani';
                    else if (hindiFont === 'yatra') fontClass = 'font-hindi-yatra';
                    else if (hindiFont === 'rozha') fontClass = 'font-hindi-rozha';
                    else if (hindiFont === 'arima') fontClass = 'font-hindi-arima';
                    else if (hindiFont === 'martel') fontClass = 'font-hindi-martel';
                  }

                  return (
                    <div key={sIdx} className={containerStyles}>
                      <span className={headerStyles}>
                        {section.label} {isSectionActive && '• (Current sequence)'}
                      </span>

                      <div className="space-y-3">
                        {section.lines.map((line, lIdx) => {
                          const activeLyricsList = lyricsLanguageTab === 'english' ? song.formattedLyrics : activeFormattedLyricsHindi;
                          let globalLineIdx = 0;
                          for (let i = 0; i < sIdx; i++) {
                            globalLineIdx += activeLyricsList[i].lines.length;
                          }
                          globalLineIdx += lIdx;

                          const isLineActive = activeLineIndex === globalLineIdx;

                          const getFullscreenHighlightClass = () => {
                            if (!isLineActive) return 'opacity-90';
                            switch (readerTheme) {
                              case 'dark':
                                return 'text-amber-200 bg-amber-950/80 px-3 py-1.5 rounded-xl border-l-4 border-l-amber-500 scale-[1.01] font-bold shadow-md';
                              case 'sepia':
                                return 'text-[#543b18] bg-[#ebdca5] px-3 py-1.5 rounded-xl border-l-4 border-l-amber-700 scale-[1.01] font-bold shadow-md';
                              case 'light':
                              default:
                                return 'text-amber-950 bg-amber-100 px-3 py-1.5 rounded-xl border-l-4 border-l-amber-600 scale-[1.01] font-bold shadow-sm';
                            }
                          };

                          return (
                            <p 
                              key={lIdx}
                              id={`fullscreen-lyric-line-global-${globalLineIdx}`}
                              style={{ fontSize: `${lyricFontSize + 4}px` }} 
                              className={`${lineStyles} ${fontClass} ${getFullscreenHighlightClass()}`}
                            >
                              {line}
                            </p>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

function getYouTubeId(url?: string) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

