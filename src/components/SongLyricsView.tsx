import React, { useState, useEffect, useRef } from 'react';
import { Song, FormattedSection } from '../types';
import { 
  Play, Pause, RotateCcw, Volume2, Sparkles, FileText, 
  Music, Youtube, Hash, HelpCircle, Check, Info, Maximize2, 
  Minimize2, ZoomIn, ZoomOut, Copy, Download, Radio
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../utils/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { parseRawLyrics } from '../utils/lyricParser';

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

  // Bilingual translation & tabs management
  const [lyricsLanguageTab, setLyricsLanguageTab] = useState<'english' | 'hindi'>('english');
  const [isTranslating, setIsTranslating] = useState(false);
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
      const activeLineElem = document.getElementById(`lyric-line-global-${activeLineIndex}`);
      if (activeLineElem) {
        activeLineElem.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  }, [activeLineIndex, autoScrollActive]);

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
        <div id="lyrics-sheet-card" className="bg-white border border-slate-200/90 rounded-2xl p-6 md:p-8 relative overflow-hidden shadow-sm">
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
                <pre className="whitespace-pre-wrap leading-relaxed max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
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
                  <h2 className="text-2xl md:text-3xl font-serif font-black mb-1 text-slate-900 tracking-tight">{song.title}</h2>
                  <p className="text-xs text-slate-400 tracking-[0.2em] font-sans uppercase">BY {song.artist}</p>
                </div>

                {/* Elegant Dual-Language Tab Selectors with micro-interactions */}
                <div className="flex justify-center gap-2.5 pb-4 border-b border-slate-100">
                  <button
                    onClick={() => setLyricsLanguageTab('english')}
                    className={`px-5 py-2 rounded-xl text-xs font-bold tracking-wide transition-all uppercase flex items-center gap-2 cursor-pointer ${
                      lyricsLanguageTab === 'english'
                        ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10 scale-105'
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
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200/50'
                    }`}
                  >
                    🇮🇳 Hindi Version (हिंदी)
                  </button>
                </div>

                {lyricsLanguageTab === 'hindi' && activeFormattedLyricsHindi.length === 0 ? (
                  <div className="bg-gradient-to-br from-rose-50/50 to-amber-50/30 border border-rose-100 rounded-3xl p-8 text-center max-w-md mx-auto space-y-4 shadow-sm my-8">
                    <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600 mx-auto shadow-sm">
                      <Sparkles className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 leading-tight">Hindi lyrics have not been synced yet</h4>
                      <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
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
                    const isBridge = section.type === 'bridge';
                    const isHook = section.type === 'hook';
                    const isIntro = section.type === 'intro' || section.type === 'outro';
                    const isSectionActive = activeSectionIndex === sIdx;

                    // BEAUTIFUL HIGH-CONTRAST HIGHLIGHTS FOR DIFFERENT BLOCK TYPES
                    let containerClass = "relative rounded-xl border transition-all duration-300 p-5 ";
                    let headerClass = "text-[10px] font-bold tracking-wider font-mono mb-3 uppercase flex items-center justify-between ";
                    let lineClass = "leading-relaxed tracking-wide transition-all duration-200 ";

                    if (isChorus) {
                      containerClass += isSectionActive
                        ? "bg-emerald-50 border-emerald-300 shadow-md ring-2 ring-emerald-500/10 " 
                        : "bg-emerald-50/10 border-emerald-100 hover:border-emerald-200 hover:bg-emerald-50/20 ";
                      containerClass += "border-l-4 border-l-emerald-500 pl-5";
                      headerClass += "text-emerald-700";
                      lineClass += "italic font-semibold text-slate-900 ";
                    } else if (isBridge || isHook) {
                      containerClass += isSectionActive
                        ? "bg-amber-50/60 border-amber-300 shadow-md ring-2 ring-amber-500/10 "
                        : "bg-amber-50/10 border-amber-100 hover:border-amber-250/50 hover:bg-amber-50/20 ";
                      containerClass += "border-l-4 border-l-amber-500 pl-5";
                      headerClass += "text-amber-850";
                      lineClass += "font-serif italic text-slate-900 ";
                    } else if (isIntro) {
                      containerClass += "bg-slate-50 border-slate-100 border-l-4 border-l-slate-300 pl-5 ";
                      headerClass += "text-slate-400";
                      lineClass += "text-slate-500 font-mono ";
                    } else {
                      // Standard Stanzas / Verses (Soft Elegant Violet Palette)
                      containerClass += isSectionActive
                        ? "bg-violet-50/80 border-violet-300 shadow-md ring-2 ring-violet-500/10 "
                        : "bg-violet-50/10 border-violet-100/70 hover:border-violet-200 hover:bg-violet-50/20 ";
                      containerClass += "border-l-4 border-l-violet-400 pl-5";
                      headerClass += "text-violet-700";
                      lineClass += "text-slate-800 font-sans ";
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
                            {!isChorus && <Music className="w-3.5 h-3.5 text-violet-400" />}
                            <span>{section.label}</span>
                          </div>
                          {isSectionActive && (
                            <span className="text-[8px] font-mono bg-slate-900 text-white font-bold px-1.5 py-0.5 rounded leading-none shadow-sm flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-ping" />
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

                            return (
                              <p
                                key={lIdx}
                                id={`lyric-line-global-${globalLineIdx}`}
                                style={{ fontSize: `${lyricFontSize}px` }}
                                className={`${lineClass} ${
                                  isLineActive 
                                    ? 'text-amber-900 bg-amber-50 px-2.5 py-1.5 rounded-xl border-l-2 border-l-amber-500 scale-[1.01] font-bold shadow-sm' 
                                    : 'opacity-90'
                                }`}
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

      {/* FULLSCREEN OVERLAY PORTAL (Simulated beautiful light-themed theater display) */}
      <AnimatePresence>
        {isFullScreen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#fafafa] overflow-y-auto px-6 py-12 md:p-16 custom-scrollbar text-slate-800"
            id="fullscreen-lyrics-overlay"
          >
            {/* Top-Right Exit Icon Only */}
            <button
              onClick={() => setIsFullScreen(false)}
              className="fixed top-6 right-6 z-50 p-2.5 bg-white border border-slate-200 text-rose-500 hover:text-rose-600 transition hover:bg-slate-50 rounded-xl shadow-sm cursor-pointer"
              title="Remove Fullscreen"
              id="exit-fullscreen-btn"
            >
              <Minimize2 className="w-5 h-5" />
            </button>

            <div className="max-w-3xl mx-auto space-y-12 pb-32 pt-8">
              {/* Immersive Title */}
              <div className="text-center space-y-2 border-b border-slate-100 pb-8">
                <h1 className="text-3xl font-serif font-black tracking-tight text-slate-900">{song.title}</h1>
                <p className="text-xs uppercase font-mono tracking-wider text-slate-400">By {song.artist}</p>
              </div>

              {/* Readable Lyrics Blocks */}
              <div className="space-y-8 pt-4">
                {(lyricsLanguageTab === 'english' ? song.formattedLyrics : activeFormattedLyricsHindi).map((section, sIdx) => {
                  const isChorus = section.type === 'chorus';
                  const isBridge = section.type === 'bridge';
                  const isHook = section.type === 'hook';
                  const isSectionActive = activeSectionIndex === sIdx;

                  let containerStyles = "p-8 rounded-2xl border transition-all duration-300 ";
                  let headerStyles = "text-[10px] font-mono font-bold uppercase tracking-wider mb-4 block ";
                  let lineStyles = "leading-loose tracking-wider transition-all duration-200 ";

                  if (isChorus) {
                    containerStyles += isSectionActive 
                      ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/10 shadow-sm " 
                      : "bg-white border-emerald-100/80 ";
                    containerStyles += "border-l-8 border-l-emerald-500 pl-8";
                    headerStyles += "text-emerald-600";
                    lineStyles += "italic font-bold text-slate-905 ";
                  } else if (isBridge || isHook) {
                    containerStyles += isSectionActive 
                      ? "bg-amber-50 border-amber-300 ring-2 ring-amber-500/10 shadow-sm " 
                      : "bg-white border-amber-100/80 ";
                    containerStyles += "border-l-8 border-l-amber-500 pl-8";
                    headerStyles += "text-amber-700";
                    lineStyles += "font-serif italic text-slate-905 ";
                  } else {
                    containerStyles += isSectionActive 
                      ? "bg-violet-50 border-violet-300 shadow-sm pr-8 " 
                      : "bg-white border-violet-150/50 ";
                    containerStyles += "border-l-8 border-l-violet-400 pl-8";
                    headerStyles += "text-violet-500";
                    lineStyles += "font-sans text-slate-800 ";
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

                          return (
                            <p 
                              key={lIdx}
                              style={{ fontSize: `${lyricFontSize + 4}px` }} 
                              className={`${lineStyles} ${
                                isLineActive 
                                  ? 'text-amber-900 bg-amber-100 px-3 py-1.5 rounded-xl border-l-4 border-l-amber-600 scale-[1.01] font-bold shadow-sm' 
                                  : 'opacity-90'
                              }`}
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

