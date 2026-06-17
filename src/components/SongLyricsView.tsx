import React, { useState, useEffect, useRef } from 'react';
import { Song, FormattedSection } from '../types';
import { Play, Pause, RotateCcw, Volume2, Sparkles, FileText, Music, Youtube, Hash, HelpCircle, Check, Info } from 'lucide-react';
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
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Flattened lines list for tracking active line index during simulated playback
  const flattenedLines = React.useMemo(() => {
    const list: { sectionIdx: number; lineIdx: number; text: string }[] = [];
    song.formattedLyrics.forEach((sec, sIdx) => {
      sec.lines.forEach((line, lIdx) => {
        list.push({ sectionIdx: sIdx, lineIdx: lIdx, text: line });
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

  // Quick stats about these lyrics
  const wordCount = React.useMemo(() => {
    return song.rawLyrics.split(/\s+/).filter(Boolean).length;
  }, [song.rawLyrics]);

  const chorusCount = React.useMemo(() => {
    return song.formattedLyrics.filter(s => s.type === 'chorus').length;
  }, [song.formattedLyrics]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="lyrics-view-grid">
      {/* LEFT: Stunning Styled Lyric sheet and player */}
      <div className="lg:col-span-8 space-y-6">
        
        {/* Dynamic Vinyl Deck & Song Title Card */}
        <div className="bg-[#0f0f12] backdrop-blur-md rounded-3xl p-6 border border-white/10 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/5 rounded-full filter blur-3xl pointer-events-none" />
          
          {/* Vinyl Disc Rotating Asset */}
          <div className="relative flex-shrink-0 w-28 h-28 md:w-32 md:h-32">
            <motion.div 
              animate={isPlaying ? { rotate: 360 } : {}}
              transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
              className="w-full h-full rounded-full bg-[#070708] border-4 border-white/10 p-2 relative flex items-center justify-center shadow-2xl"
            >
              <img
                referrerPolicy="no-referrer"
                src={song.coverUrl || 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=600&auto=format&fit=crop'}
                alt={song.title}
                className="w-full h-full rounded-full object-cover opacity-80"
              />
              <div className="absolute w-8 h-8 rounded-full bg-[#0a0a0c] border border-white/10 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              </div>
            </motion.div>
            <div className="absolute -bottom-1 -right-1 bg-rose-600 text-white p-1.5 rounded-full text-xs font-bold leading-none shadow-md">
              <span className="sr-only">Genre</span>
              {song.genre.substring(0, 3).toUpperCase()}
            </div>
          </div>

          {/* Metadata info */}
          <div className="text-center md:text-left space-y-2 flex-grow">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <span className="text-[10px] font-mono bg-rose-500/15 text-rose-300 border border-rose-500/20 px-2 py-0.5 rounded-md uppercase font-bold">
                {song.genre}
              </span>
              {song.album && (
                <span className="text-[11px] font-mono text-white/50 bg-white/5 border border-white/10 px-2.5 py-0.5 rounded">
                  {song.album}
                </span>
              )}
            </div>
            
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight drop-shadow-md">
              {song.title}
            </h1>
            <p className="text-white/80 font-medium">
              By <span className="text-rose-400 hover:underline cursor-pointer">{song.artist}</span>
            </p>

            <div className="flex items-center justify-center md:justify-start gap-4 text-xs font-mono text-white/45 pt-1">
              <span>Duration: {song.duration}</span>
              <span>•</span>
              <span>Words: {wordCount}</span>
            </div>
          </div>
        </div>

        {/* Music Player Simulator Box */}
        <div className="bg-[#070708] border border-white/10 p-4 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-rose-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" />
              {isPlaying ? 'ACTIVE SYNCING ENGINES ON' : 'SYNC MONITOR STANDBY'}
            </span>
            <div className="flex items-center gap-2">
              {song.youtubeUrl && (
                <a 
                  href={song.youtubeUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-1 px-2.5 rounded-lg bg-red-950/40 border border-red-850/40 hover:bg-red-900/45 text-red-300 text-xs flex items-center gap-1 font-mono transition-colors"
                >
                  <Youtube className="w-3.5 h-3.5" />
                  YouTube
                </a>
              )}
              <button 
                onClick={() => setShowRaw(!showRaw)}
                className="p-1 px-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 text-xs flex items-center gap-1 font-mono transition-colors cursor-pointer"
              >
                <FileText className="w-3 h-3" />
                {showRaw ? 'Styled view' : 'Raw Input Code'}
              </button>
            </div>
          </div>

          {/* Timeline Bar slider */}
          <div className="space-y-1">
            <input
              type="range"
              min="0"
              max={totalSeconds}
              value={currentTime}
              onChange={handleProgressChange}
              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-rose-500 hover:bg-white/20 transition-all"
            />
            <div className="flex justify-between text-xs font-mono text-white/40">
              <span>{formatSeconds(currentTime)}</span>
              <span>{formatSeconds(totalSeconds)}</span>
            </div>
          </div>

          {/* Playback Controls button cluster */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`p-3 rounded-full transition-all duration-300 cursor-pointer ${
                  isPlaying 
                    ? 'bg-amber-500 text-slate-950 hover:bg-amber-400' 
                    : 'bg-rose-600 text-white hover:bg-rose-500 shadow-md shadow-rose-600/15'
                }`}
                title={isPlaying ? 'Pause Tracker' : 'Start Sing-Along'}
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
              </button>
              
              <button
                onClick={resetPlayback}
                disabled={currentTime === 0}
                className="p-2.5 bg-white/5 text-white/50 border border-white/10 rounded-full hover:bg-white/10 transition cursor-pointer"
                title="Reset track timeline"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 text-white/50 text-xs font-mono bg-white/[0.03] border border-white/10 px-3 py-1.5 rounded-xl">
              <Volume2 className="w-4 h-4 text-white/30" />
              <span>Simulated Audio Engine</span>
            </div>
          </div>
        </div>

        {/* Dynamic Lyrics display board */}
        <div id="lyrics-sheet-card" className="bg-[#0a0a0c] border border-white/10 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-inner">
          <AnimatePresence mode="wait">
            {showRaw ? (
              // RAW CODE TYPE WRITER STYLE
              <motion.div
                key="raw-lyrics-sheet"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="font-mono text-xs text-white/50 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-4">
                  <span className="text-white/40 font-bold">RAW UNFORMATTED SOURCE DATABASE VIEW</span>
                  <span className="text-[10px] text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded bg-amber-500/5 font-bold">MONOSPACE RAW TEXT</span>
                </div>
                <pre className="whitespace-pre-wrap leading-relaxed max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                  {song.rawLyrics}
                </pre>
              </motion.div>
            ) : (
              // POWERFUL AUTO-BEAUTIFIED STYLE PREVIEW
              <motion.div
                key="beautified-lyrics-sheet"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6 animate-fade-in"
              >
                <div className="text-center mb-12 relative z-10">
                  <h2 className="text-4xl font-serif font-light mb-2 text-white">{song.title}</h2>
                  <p className="text-sm text-white/40 tracking-[0.3em] font-sans uppercase">BY {song.artist}</p>
                </div>

                {song.formattedLyrics.map((section, sIdx) => {
                  const isChorus = section.type === 'chorus';
                  const isBridge = section.type === 'bridge';
                  const isHook = section.type === 'hook';
                  const isIntro = section.type === 'intro' || section.type === 'outro';
                  const isSectionActive = activeSectionIndex === sIdx;

                  // CSS classes for various sections
                  let containerClass = "relative rounded-2xl border transition-all duration-300 p-6 ";
                  let headerClass = "text-[10px] font-bold tracking-widest font-mono mb-4 uppercase flex items-center justify-between ";
                  let lineClass = "leading-relaxed text-base tracking-wide transition-all duration-200 ";

                  if (isChorus) {
                    // Chorus requirements: Highlighted Beautiful Rose card details
                    containerClass += isSectionActive
                      ? "bg-rose-500/10 border-rose-500 shadow-md shadow-rose-500/10 " 
                      : "bg-white/[0.03] border-white/10 hover:border-white/20 ";
                    containerClass += "border-l-4 border-l-rose-500 pl-6";
                    headerClass += "text-rose-400";
                    lineClass += "italic font-medium font-serif text-white text-lg "; // Serif and elegant sizing!
                  } else if (isBridge || isHook) {
                    containerClass += isSectionActive
                      ? "bg-amber-950/50 border-amber-500 shadow-inner "
                      : "bg-white/[0.01] border-white/5 hover:border-white/15 ";
                    containerClass += "border-l-4 border-l-amber-500 pl-6";
                    headerClass += "text-amber-400";
                    lineClass += "text-white font-serif italic text-lg ";
                  } else if (isIntro) {
                    containerClass += "bg-white/[0.01] border-white/5 border-l-4 border-l-white/20 pl-6 ";
                    headerClass += "text-white/40";
                    lineClass += "text-white/50 font-mono text-xs "; // Smaller and clean index font
                  } else {
                    // Standard Stanzas / Verses: Assign smaller, cleaner reading font size.
                    containerClass += isSectionActive
                      ? "bg-[#0f0f12] border-white/10 "
                      : "bg-transparent border-transparent hover:border-white/5 ";
                    containerClass += "border-l-4 border-l-white/5 pl-6";
                    headerClass += "text-white/30";
                    lineClass += "text-white/90 text-[14.5px] font-sans "; // Smaller cleaner font size
                  }

                  return (
                    <motion.div
                      key={sIdx}
                      id={`lyric-section-${sIdx}`}
                      className={containerClass}
                      layout
                    >
                      {/* Quote indicator like in the design panel for chorus */}
                      {isChorus && (
                        <div className="absolute top-4 right-6 text-white/10 pointer-events-none">
                          <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C20.1216 16 21.017 16.8954 21.017 18V21C21.017 22.1046 20.1216 23 19.017 23H16.017C14.9124 23 14.017 22.1046 14.017 21ZM5.017 21L5.017 18C5.017 16.8954 5.91243 16 7.017 16H10.017C11.1216 16 12.017 16.8954 12.017 18V21C12.017 22.1046 11.1216 23 10.017 23H7.017C5.91243 23 5.017 22.1046 5.017 21Z"></path></svg>
                        </div>
                      )}

                      <div className={headerClass}>
                        <div className="flex items-center gap-1.5 font-bold">
                          {isChorus && <Sparkles className="w-3.5 h-3.5 text-rose-450 animate-pulse" />}
                          <span>{section.label}</span>
                        </div>
                        {isSectionActive && (
                          <span className="text-[9px] font-mono bg-rose-500 text-slate-950 font-bold px-1.5 py-0.5 rounded leading-none">
                            ACTIVE VOCAL SEQUENCE
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        {section.lines.map((line, lIdx) => {
                          // Calculate global line index
                          let globalLineIdx = 0;
                          for (let i = 0; i < sIdx; i++) {
                            globalLineIdx += song.formattedLyrics[i].lines.length;
                          }
                          globalLineIdx += lIdx;

                          const isLineActive = activeLineIndex === globalLineIdx;

                          return (
                            <p
                              key={lIdx}
                              className={`${lineClass} ${
                                isLineActive 
                                  ? 'text-amber-300 scale-[1.01] translate-x-1.5 drop-shadow-[0_0_8px_rgba(245,158,11,0.35)] font-bold' 
                                  : 'opacity-85'
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

      {/* RIGHT: Stats, dynamic chords panel, or producer insights */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* Actions header banner for search */}
        {onBackToSearch && (
          <button 
            onClick={onBackToSearch}
            className="w-full py-3 px-4 bg-white/5 border border-white/10 text-[#f8f9fa] hover:bg-white/10 rounded-2xl flex items-center justify-center gap-2 font-mono text-xs font-bold transition-all cursor-pointer"
          >
            ← BROWSE ALL SONG PORTFILES
          </button>
        )}

        {/* Dynamic Vibe / Producer insights block */}
        <div className="bg-[#0f0f12] border border-white/10 rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-2 right-2 p-1 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          
          <h3 className="text-xs font-mono font-bold tracking-wider text-white/55 uppercase mb-3 flex items-center gap-1.5">
            Producer Insights & Dynamics
          </h3>

          <div className="space-y-4">
            <div className="bg-[#0a0a0c] p-3.5 rounded-xl border border-white/10 text-xs space-y-2 leading-relaxed">
              <span className="text-rose-400 font-bold flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-rose-400" /> Vocal Guidance:
              </span>
              <p className="text-white/70 font-mono">
                Observe the formatted chorus sections. Syllable load increases during high-pitch arpeggios. Accent words highlighted in simulated track-timer.
              </p>
            </div>

            {/* Simulated Live-Sync WordPress status for verification */}
            <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 text-xs space-y-1.5">
              <span className="text-rose-400 font-bold flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-rose-400" /> WordPress Database Mapping:
              </span>
              <div className="flex justify-between items-center text-white/50 font-mono text-[10px] pt-1">
                <span>Post Template:</span>
                <span className="text-white/40 italic">Singles-Lyric-Post</span>
              </div>
              <div className="flex justify-between items-center text-white/50 font-mono text-[10px]">
                <span>Status in DB:</span>
                <span className="text-emerald-400 font-bold font-mono">201 COMPLIANT</span>
              </div>
              <div className="flex justify-between items-center text-white/50 font-mono text-[10px]">
                <span>Rendering Engine:</span>
                <span className="text-white/40">Tailwind Glassmorphic</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Analytics & Structure Summary */}
        <div className="bg-[#070708] border border-white/10 rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-mono font-bold tracking-wider text-white/55 uppercase flex items-center gap-2">
            <Music className="w-4 h-4 text-rose-400" />
            Vocal Sheet Architecture
          </h3>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-white/5 p-3 rounded-xl border border-white/10">
              <div className="text-2xl font-bold text-white font-mono">{song.formattedLyrics.length}</div>
              <div className="text-[10px] text-white/40 font-mono uppercase mt-0.5">Total Sections</div>
            </div>
            <div className="bg-white/5 p-3 rounded-xl border border-white/10">
              <div className="text-2xl font-bold text-rose-400 font-mono">{chorusCount}</div>
              <div className="text-[10px] text-white/40 font-mono uppercase mt-0.5">Choruses</div>
            </div>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="py-2 border-b border-white/5 flex justify-between items-center">
              <span className="text-white/40">Format Standard:</span>
              <span className="text-white/70">AURA-L3-Beautified</span>
            </div>
            <div className="py-2 border-b border-white/5 flex justify-between items-center">
              <span className="text-white/40">Structure Density:</span>
              <span className="text-white/70">{Math.round(wordCount / (song.formattedLyrics.length || 1))} wp-sect</span>
            </div>
            <div className="py-2 flex justify-between items-center">
              <span className="text-white/40">Sync Status:</span>
              <span className="text-emerald-450 flex items-center gap-0.5 font-bold">
                <Check className="w-3.5 h-3.5 text-emerald-400" /> PUBLISHED
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
