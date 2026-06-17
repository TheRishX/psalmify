import React, { useState, useEffect, useRef } from 'react';
import { Song, FormattedSection } from '../types';
import { 
  Play, Pause, RotateCcw, Volume2, Sparkles, FileText, 
  Music, Youtube, Hash, HelpCircle, Check, Info, Maximize2, 
  Minimize2, ZoomIn, ZoomOut, Copy, Download, Radio
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);

  // Flattened lines list for tracking active line index during simulated playback
  const flattenedLines = React.useMemo(() => {
    const list: { sectionIdx: number; lineIdx: number; text: string; globalIdx: number }[] = [];
    let currentGlobalIdx = 0;
    song.formattedLyrics.forEach((sec, sIdx) => {
      sec.lines.forEach((line, lIdx) => {
        list.push({ sectionIdx: sIdx, lineIdx: lIdx, text: line, globalIdx: currentGlobalIdx });
        currentGlobalIdx++;
      });
    });
    return list;
  }, [song]);

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

  // Map simulated playback seconds to lyric lines
  useEffect(() => {
    if (!isPlaying) {
      if (currentTime === 0) {
        setActiveLineIndex(-1);
        setActiveSectionIndex(-1);
      }
      return;
    }

    // Distribute lyric lines evenly across the duration
    if (flattenedLines.length > 0) {
      const lineDuration = totalSeconds / flattenedLines.length;
      const currentLineIdx = Math.floor(currentTime / lineDuration);
      
      if (currentLineIdx < flattenedLines.length) {
        setActiveLineIndex(currentLineIdx);
        const mappedLine = flattenedLines[currentLineIdx];
        setActiveSectionIndex(mappedLine.sectionIdx);
      } else {
        setActiveLineIndex(-1);
        setActiveSectionIndex(-1);
      }
    }
  }, [currentTime, isPlaying, flattenedLines, totalSeconds]);

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

          {/* Timeline Bar Slider */}
          <div className="space-y-1">
            <input
              type="range"
              min="0"
              max={totalSeconds}
              value={currentTime}
              onChange={handleProgressChange}
              className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-slate-900 hover:bg-slate-200 transition-all"
            />
            <div className="flex justify-between text-[11px] font-mono text-slate-400">
              <span>{formatSeconds(currentTime)}</span>
              <span className="font-bold text-slate-500">Auto-Scroll {autoScrollActive ? 'ON' : 'OFF'}</span>
              <span>{formatSeconds(totalSeconds)}</span>
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
                  {song.rawLyrics}
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
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-serif font-light mb-1.5 text-slate-900">{song.title}</h2>
                  <p className="text-xs text-slate-400 tracking-[0.2em] font-sans uppercase">BY {song.artist}</p>
                </div>

                {song.formattedLyrics.map((section, sIdx) => {
                  const isChorus = section.type === 'chorus';
                  const isBridge = section.type === 'bridge';
                  const isHook = section.type === 'hook';
                  const isIntro = section.type === 'intro' || section.type === 'outro';
                  const isSectionActive = activeSectionIndex === sIdx;

                  // CSS classes for various sections
                  let containerClass = "relative rounded-xl border transition-all duration-300 p-5 ";
                  let headerClass = "text-[10px] font-bold tracking-wider font-mono mb-3 uppercase flex items-center justify-between ";
                  let lineClass = "leading-relaxed tracking-wide transition-all duration-200 ";

                  if (isChorus) {
                    containerClass += isSectionActive
                      ? "bg-rose-50/50 border-rose-300 shadow-sm " 
                      : "bg-rose-50/20 border-rose-100 hover:border-rose-200 ";
                    containerClass += "border-l-4 border-l-rose-500 pl-5";
                    headerClass += "text-rose-650";
                    lineClass += "italic font-serif font-semibold text-slate-900 ";
                  } else if (isBridge || isHook) {
                    containerClass += isSectionActive
                      ? "bg-amber-50/50 border-amber-300 shadow-sm "
                      : "bg-amber-50/10 border-amber-100 hover:border-amber-200 ";
                    containerClass += "border-l-4 border-l-amber-500 pl-5";
                    headerClass += "text-amber-700";
                    lineClass += "font-serif italic text-slate-900 ";
                  } else if (isIntro) {
                    containerClass += "bg-slate-50 border-slate-100 border-l-4 border-l-slate-300 pl-5 ";
                    headerClass += "text-slate-400";
                    lineClass += "text-slate-500 font-mono ";
                  } else {
                    // Standard Stanzas / Verses
                    containerClass += isSectionActive
                      ? "bg-slate-50/70 border-slate-300 "
                      : "bg-transparent border-transparent hover:border-slate-100/80 ";
                    containerClass += "border-l-4 border-l-slate-200 pl-5";
                    headerClass += "text-slate-400";
                    lineClass += "text-slate-800 font-sans ";
                  }

                  return (
                    <motion.div
                      key={sIdx}
                      id={`lyric-section-${sIdx}`}
                      className={containerClass}
                      layout
                    >
                      {/* Quote indicator */}
                      {isChorus && (
                        <div className="absolute top-4 right-4 text-rose-205/20 opacity-30 pointer-events-none">
                          <svg className="w-8 h-8 text-rose-200" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C20.1216 16 21.017 16.8954 21.017 18V21C21.017 22.1046 20.1216 23 19.017 23H16.017C14.9124 23 14.017 22.1046 14.017 21ZM5.017 21L5.017 18C5.017 16.8954 5.91243 16 7.017 16H10.017C11.1216 16 12.017 16.8954 12.017 18V21C12.017 22.1046 11.1216 23 10.017 23H7.017C5.91243 23 5.017 22.1046 5.017 21Z"></path></svg>
                        </div>
                      )}

                      <div className={headerClass}>
                        <div className="flex items-center gap-1.5 font-bold">
                          {isChorus && <Sparkles className="w-3.5 h-3.5 text-rose-500" />}
                          <span>{section.label}</span>
                        </div>
                        {isSectionActive && (
                          <span className="text-[8px] font-mono bg-slate-900 text-white font-bold px-1.5 py-0.5 rounded leading-none shadow-sm">
                            Sing Along Highlight
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        {section.lines.map((line, lIdx) => {
                          // Find out the exact global line index
                          let globalLineIdx = 0;
                          for (let i = 0; i < sIdx; i++) {
                            globalLineIdx += song.formattedLyrics[i].lines.length;
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
                                  ? 'text-amber-800 bg-amber-100/80 px-2 py-1 rounded-lg border-l-2 border-l-amber-500 scale-[1.01] font-bold shadow-sm' 
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
                })}
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
                {song.formattedLyrics.map((section, sIdx) => {
                  const isChorus = section.type === 'chorus';
                  const isBridge = section.type === 'bridge';
                  const isHook = section.type === 'hook';
                  const isSectionActive = activeSectionIndex === sIdx;

                  let containerStyles = "p-8 rounded-2xl border transition-all duration-300 ";
                  let headerStyles = "text-[10px] font-mono font-bold uppercase tracking-wider mb-4 block ";
                  let lineStyles = "leading-loose tracking-wider transition-all duration-200 ";

                  if (isChorus) {
                    containerStyles += isSectionActive 
                      ? "bg-rose-50 border-rose-300 ring-2 ring-rose-500/10 shadow-sm " 
                      : "bg-white border-rose-100/80 ";
                    containerStyles += "border-l-8 border-l-rose-500 pl-8";
                    headerStyles += "text-rose-600";
                    lineStyles += "font-serif italic font-bold text-slate-905 ";
                  } else if (isBridge || isHook) {
                    containerStyles += isSectionActive 
                      ? "bg-amber-50 border-amber-300 ring-2 ring-amber-500/10 shadow-sm " 
                      : "bg-white border-amber-100/80 ";
                    containerStyles += "border-l-8 border-l-amber-500 pl-8";
                    headerStyles += "text-amber-700";
                    lineStyles += "font-serif italic text-slate-905 ";
                  } else {
                    containerStyles += isSectionActive 
                      ? "bg-slate-100 border-slate-300 shadow-sm " 
                      : "bg-white border-slate-200 ";
                    containerStyles += "border-l-8 border-l-slate-300 pl-8";
                    headerStyles += "text-slate-400";
                    lineStyles += "font-sans text-slate-800 ";
                  }

                  return (
                    <div key={sIdx} className={containerStyles}>
                      <span className={headerStyles}>
                        {section.label} {isSectionActive && '• (Current sequence)'}
                      </span>

                      <div className="space-y-3">
                        {section.lines.map((line, lIdx) => {
                          let globalLineIdx = 0;
                          for (let i = 0; i < sIdx; i++) {
                            globalLineIdx += song.formattedLyrics[i].lines.length;
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
