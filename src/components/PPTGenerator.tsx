import React, { useState, useEffect } from 'react';
import { Song, FormattedSection } from '../types';
import { 
  X, Presentation, Download, Play, ChevronLeft, ChevronRight, 
  Settings, Layout, Type, Palette, MonitorCheck, Maximize2, Minimize2,
  Sparkles, Loader2, RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import pptxgen from 'pptxgenjs';

interface PPTGeneratorProps {
  song: Song;
  onClose: () => void;
}

type PPTThemeId = 'cosmic-dark' | 'midnight-onyx' | 'vintage-serif' | 'emerald-worship' | 'neon-aurora' | 'ai-custom';

interface PPTThemeConfig {
  id: PPTThemeId;
  name: string;
  bgStr: string; // CSS color string
  textColor: string; // CSS colors
  accentColor: string; // CSS color
  fontFace: string;
  pptBg: string; // Hex color for pptxgenjs (no #)
  pptText: string; // Hex for pptxgenjs
  pptAccent: string; // Hex for pptxgenjs
}

const THEMES: PPTThemeConfig[] = [
  {
    id: 'cosmic-dark',
    name: 'Cosmic Dark (Default)',
    bgStr: '#0f172a', // Slate 900
    textColor: '#f1f5f9', // Slate 100
    accentColor: '#38bdf8', // Sky 400
    fontFace: 'Arial',
    pptBg: '0F172A',
    pptText: 'F1F5F9',
    pptAccent: '38BDF8'
  },
  {
    id: 'midnight-onyx',
    name: 'Midnight Onyx (Piano Black)',
    bgStr: '#050505',
    textColor: '#ffffff',
    accentColor: '#888888',
    fontFace: 'Trebuchet MS',
    pptBg: '050505',
    pptText: 'FFFFFF',
    pptAccent: '888888'
  },
  {
    id: 'vintage-serif',
    name: 'Vintage Paper (Warm Serif)',
    bgStr: '#FAF6EE',
    textColor: '#2c2c2a',
    accentColor: '#a21caf',
    fontFace: 'Georgia',
    pptBg: 'FAF6EE',
    pptText: '2C2C2A',
    pptAccent: 'A21CAF'
  },
  {
    id: 'emerald-worship',
    name: 'Emerald Green (Worship Mood)',
    bgStr: '#042f1a', // emerald 950
    textColor: '#f0fdf4', // emerald 50
    accentColor: '#4ade80', // emerald 400
    fontFace: 'Lucida Sans Unicode',
    pptBg: '042F1A',
    pptText: 'F0FDF4',
    pptAccent: '4ADE80'
  },
  {
    id: 'neon-aurora',
    name: 'Neon Aurora (Vibrant Concert)',
    bgStr: '#1e0b36', // deep violet
    textColor: '#ffffff',
    accentColor: '#f43f5e', // deep neon rose
    fontFace: 'Courier New',
    pptBg: '1E0B36',
    pptText: 'FFFFFF',
    pptAccent: 'F43F5E'
  }
];

export default function PPTGenerator({ song, onClose }: PPTGeneratorProps) {
  const [selectedThemeId, setSelectedThemeId] = useState<PPTThemeId>('cosmic-dark');
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [isCompiling, setIsCompiling] = useState<boolean>(false);

  // States for the AI sentiment beautifier
  const [customAITheme, setCustomAITheme] = useState<PPTThemeConfig | null>(null);
  const [isBeautifying, setIsBeautifying] = useState<boolean>(false);
  const [beautifiedSlides, setBeautifiedSlides] = useState<any[] | null>(null);
  const [aiExplanation, setAiExplanation] = useState<string>('');

  const allAvailableThemes = customAITheme ? [...THEMES, customAITheme] : THEMES;
  const activeTheme = allAvailableThemes.find(t => t.id === selectedThemeId) || THEMES[0];

  // Logic to build slides from stanzas
  const slides = React.useMemo(() => {
    if (beautifiedSlides && beautifiedSlides.length > 0) {
      return beautifiedSlides;
    }

    const list: { title: string; category: string; lines: string[] }[] = [];
    
    // Slide 0: Title Slide
    list.push({
      title: song.title.toUpperCase(),
      category: `WORDS BY ${song.artist.toUpperCase()}`,
      lines: song.album ? [`ALBUM: ${song.album.toUpperCase()}`, `CATEGORY: ${song.genre.toUpperCase()}`] : [`CATEGORY: ${song.genre.toUpperCase()}`]
    });

    // Slides for each stanza block
    const langLyrics = song.formattedLyrics && song.formattedLyrics.length > 0
      ? song.formattedLyrics
      : (song.formattedLyricsHindi || []);

    langLyrics.forEach((section) => {
      list.push({
        title: section.label.toUpperCase(),
        category: `WORDS BY ${song.artist.toUpperCase()}`,
        lines: section.lines
      });
    });

    // End Slide
    list.push({
      title: "THANK YOU",
      category: "SMART LYRICS PRESENTATIONS ENGINE",
      lines: ["Praise & Worship Directory", "Powered by Google Cloud & Firestore"]
    });

    return list;
  }, [song, beautifiedSlides]);

  const handleAIBeautify = async () => {
    setIsBeautifying(true);
    try {
      // Form initial draft presentation structures for input
      const defaultSlides = [
        {
          title: song.title.toUpperCase(),
          category: `WORDS BY ${song.artist.toUpperCase()}`,
          lines: song.album ? [`ALBUM: ${song.album.toUpperCase()}`, `CATEGORY: ${song.genre.toUpperCase()}`] : [`CATEGORY: ${song.genre.toUpperCase()}`]
        },
        ...(song.formattedLyrics && song.formattedLyrics.length > 0 ? song.formattedLyrics : song.formattedLyricsHindi || []).map(section => ({
          title: section.label.toUpperCase(),
          category: `WORDS BY ${song.artist.toUpperCase()}`,
          lines: section.lines
        })),
        {
          title: "THANK YOU",
          category: "SMART LYRICS PRESENTATIONS ENGINE",
          lines: ["Praise & Worship Directory", "Powered by Google Cloud & Firestore"]
        }
      ];

      const res = await fetch("/api/gemini/beautify-ppt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: song.title,
          artist: song.artist,
          slides: defaultSlides
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.theme && data.slides) {
          const aiTheme: PPTThemeConfig = {
            id: 'ai-custom',
            name: `AI: ${data.theme.detectedSentiment}`,
            bgStr: data.theme.bgStr || '#1e293b',
            textColor: data.theme.textColor || '#f8fafc',
            accentColor: data.theme.accentColor || '#38bdf8',
            fontFace: data.theme.fontFace || 'Arial',
            pptBg: data.theme.pptBg || '1E293B',
            pptText: data.theme.pptText || 'F8FAFC',
            pptAccent: data.theme.pptAccent || '38BDF8'
          };
          setCustomAITheme(aiTheme);
          setBeautifiedSlides(data.slides);
          setAiExplanation(data.theme.explanation || '');
          setSelectedThemeId('ai-custom');
          setActiveSlideIndex(0);
        } else {
          alert("Could not process presentation theme recommendation. Try again.");
        }
      } else {
        alert("The AI PowerPoint beautification service returned an error status.");
      }
    } catch (err) {
      console.error("Failed AI presentation beautification:", err);
      alert("Network or service exception occurred during PowerPoint beautification.");
    } finally {
      setIsBeautifying(false);
    }
  };

  const handleResetAITheme = () => {
    setCustomAITheme(null);
    setBeautifiedSlides(null);
    setAiExplanation('');
    setSelectedThemeId('cosmic-dark');
    setActiveSlideIndex(0);
  };

  // Handle key listeners for slide switching of presentation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Space') {
        setActiveSlideIndex(prev => Math.min(prev + 1, slides.length - 1));
      } else if (e.key === 'ArrowLeft') {
        setActiveSlideIndex(prev => Math.max(prev - 0, prev - 1));
      } else if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [slides.length, isFullScreen]);

  // Export to actual .pptx using pptxgenjs library
  const handleExportPPT = async () => {
    setIsCompiling(true);
    try {
      const pptx = new pptxgen();
      
      // Set presentation properties
      pptx.layout = 'LAYOUT_16x9';

      slides.forEach((slideData, idx) => {
        const pptSlide = pptx.addSlide();
        
        // Background color fill
        pptSlide.background = { fill: activeTheme.pptBg };

        // Subtitle/Artist Tag at top
        pptSlide.addText(slideData.category, {
          x: 0.5,
          y: 0.4,
          w: 9.0,
          h: 0.4,
          fontSize: 11,
          bold: true,
          color: activeTheme.pptAccent,
          fontFace: activeTheme.fontFace,
        });

        // Stanza Head label / Section Label
        pptSlide.addText(slideData.title, {
          x: 0.5,
          y: 0.8,
          w: 9.0,
          h: 0.5,
          fontSize: 16,
          bold: true,
          color: activeTheme.pptAccent,
          fontFace: activeTheme.fontFace,
        });

        // Content Lyrics body
        const contentLines = slideData.lines.join('\n');
        
        // Compute font sizing dynamically depending on amount of text lines
        let fontSlideSize = 22;
        if (slideData.lines.length > 8) {
          fontSlideSize = 16;
        } else if (slideData.lines.length > 5) {
          fontSlideSize = 19;
        }

        pptSlide.addText(contentLines, {
          x: 0.5,
          y: 1.5,
          w: 9.0,
          h: 3.5,
          fontSize: fontSlideSize,
          color: activeTheme.pptText,
          fontFace: activeTheme.fontFace,
          align: 'left',
          valign: 'middle',
          lineSpacing: fontSlideSize * 1.4, // nice and legible paragraph spacing
        });

        // Branding credit label at footer
        pptSlide.addText("Lyrics presentation crafted via Smart Playlists Dashboard", {
          x: 0.5,
          y: 5.2,
          w: 9.0,
          h: 0.3,
          fontSize: 8,
          italic: true,
          color: activeTheme.pptAccent,
          align: 'left',
          fontFace: activeTheme.fontFace,
        });
      });

      // Save file cleanly
      const safeName = song.title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      await pptx.writeFile({ fileName: `${safeName}_lyrics_presentation.pptx` });
    } catch (e) {
      console.error("Error creating PowerPoint slides:", e);
      alert("Failed to export. Your file compile timed out.");
    } finally {
      setIsCompiling(false);
    }
  };

  const activeSlide = slides[activeSlideIndex] || slides[0];

  return (
    <div id="ppt-slideshow-overlay" className={`fixed inset-0 z-50 flex flex-col bg-slate-950 text-white ${isFullScreen ? 'p-0' : 'p-4 md:p-8'}`}>
      
      {/* Top action header info */}
      {!isFullScreen && (
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 flex-shrink-0 mb-6">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <Presentation className="w-5 h-5 animate-pulse" />
            </span>
            <div>
              <h3 className="text-base md:text-lg font-bold tracking-tight">Active Presentation Companion</h3>
              <p className="text-xs text-slate-400 font-mono">Theme designer and slide slideshow builder</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPPT}
              disabled={isCompiling}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-55 rounded-xl text-xs font-semibold shadow-lg shadow-indigo-500/10 transition cursor-pointer"
            >
              <Download className={`w-4 h-4 ${isCompiling ? 'animate-spin' : ''}`} />
              {isCompiling ? 'Creating Slides...' : 'Export PPTX file'}
            </button>

            <button
              onClick={onClose}
              className="p-2 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Main core splitter workspace */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 overflow-y-auto">
        
        {/* Left Side: slide preview with player controls */}
        <div className="flex-1 flex flex-col justify-between space-y-4">
          
          {/* Active Canvas Stage card */}
          <div 
            style={{ backgroundColor: activeTheme.bgStr, fontFamily: activeTheme.fontFace }}
            className={`relative flex-1 flex flex-col justify-between border shadow-2xl rounded-3xl overflow-hidden transition-all duration-300 ${
              isFullScreen ? 'border-0 rounded-none' : 'border-slate-800/80 p-8 md:p-12 min-h-[350px]'
            }`}
          >
            {/* Screen triggers for clicking to switch slides */}
            <div className="absolute inset-0 flex">
              <div className="w-1/3 h-full cursor-west-resize" onClick={() => setActiveSlideIndex(prev => Math.max(0, prev - 1))} />
              <div className="w-2/3 h-full cursor-east-resize" onClick={() => setActiveSlideIndex(prev => Math.min(slides.length - 1, prev + 1))} />
            </div>

            {/* Slide heading metadata */}
            <div className="space-y-1 relative z-10 pointer-events-none select-none">
              <p style={{ color: activeTheme.accentColor }} className="text-xs font-mono tracking-widest uppercase font-semibold">
                {activeSlide.category}
              </p>
              <h1 style={{ color: activeTheme.accentColor }} className="text-sm md:text-lg font-bold tracking-wide">
                {activeSlide.title}
              </h1>
            </div>

            {/* Slide main lyrics space */}
            <div className="flex-1 flex items-center justify-start py-8 relative z-10 pointer-events-none select-none">
              <div className="space-y-3 max-w-full">
                {activeSlide.lines.map((line, lIdx) => (
                  <p 
                    key={lIdx} 
                    style={{ color: activeTheme.textColor }}
                    className="text-lg md:text-2xl lg:text-3xl font-semibold leading-relaxed tracking-wide text-left filter drop-shadow-sm truncate"
                  >
                    {line}
                  </p>
                ))}
              </div>
            </div>

            {/* Slide footer logo credits */}
            <div className="flex items-center justify-between border-t border-slate-50/10 pt-4 relative z-10 pointer-events-none select-none text-[10px]">
              <span style={{ color: activeTheme.accentColor }} className="font-mono tracking-widest uppercase opacity-70">
                {song.title} lyrics slideshow
              </span>
              <span className="text-slate-400 opacity-55">
                Slide {activeSlideIndex + 1} of {slides.length}
              </span>
            </div>

            {/* Fullscreen close toggle button if full-screen active */}
            {isFullScreen && (
              <button
                onClick={() => setIsFullScreen(false)}
                className="absolute right-6 top-6 p-2 bg-slate-900/60 backdrop-blur-md rounded-full text-white hover:bg-slate-900 transition-all cursor-pointer border border-white/5"
                title="Collapse fullscreen presentation"
              >
                <Minimize2 className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Silder Control keys row */}
          {!isFullScreen && (
            <div className="flex items-center justify-between bg-slate-900/40 p-4 border border-slate-800/60 rounded-2xl flex-shrink-0">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveSlideIndex(prev => Math.max(0, prev - 1))}
                  disabled={activeSlideIndex === 0}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 transition cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-xs font-mono font-bold text-slate-400 min-w-[50px] text-center">
                  {activeSlideIndex + 1} / {slides.length}
                </span>
                <button
                  onClick={() => setActiveSlideIndex(prev => Math.min(slides.length - 1, prev + 1))}
                  disabled={activeSlideIndex === slides.length - 1}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 transition cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Status helper text */}
              <p className="hidden md:block text-[11px] text-slate-500 font-mono">
                💡 Press <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">Space</kbd> or <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">→</kbd> to cycle slides.
              </p>

              {/* Enter Fullscreen Slide trigger */}
              <button
                onClick={() => setIsFullScreen(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700/60 hover:bg-slate-700 text-xs font-semibold rounded-xl text-indigo-400 hover:text-indigo-300 transition-all cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                Fullscreen Present
              </button>
            </div>
          )}

        </div>

        {/* Right Side: properties / designer (Hidden in Fullscreen) */}
        {!isFullScreen && (
          <div className="w-full lg:w-80 space-y-6 flex-shrink-0">
            
            {/* AI PPT Beautifier Tool */}
            <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-rose-400">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">AI PPT Beautifier</h4>
                </div>
                {customAITheme && (
                  <span className="text-[9px] bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-full font-mono font-bold animate-pulse">
                    Active
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <p className="text-[11px] text-slate-400 leading-relaxed font-mono">
                  Let Gemini analyze the track lyrics for emotional sentiment, automatically generate matching background layouts, select custom typography, and optimize bullet split points.
                </p>

                {aiExplanation && (
                  <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3 space-y-1">
                    <p className="text-[10px] font-bold text-rose-400 flex items-center gap-1.5">
                      <span>Sentiment:</span>
                      <span className="bg-rose-500/10 text-rose-300 px-1.5 py-0.5 rounded uppercase font-mono tracking-wide text-[9px]">
                        {customAITheme?.name.replace("AI: ", "")}
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-300 leading-relaxed italic">
                      "{aiExplanation}"
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleAIBeautify}
                  disabled={isBeautifying}
                  className="w-full py-2.5 bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-400 hover:to-indigo-505 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-rose-500/10"
                >
                  {isBeautifying ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Analyzing Theme & Tone...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{customAITheme ? 'Run AI Analysis Again' : 'Beautify Slides with AI'}</span>
                    </>
                  )}
                </button>

                {customAITheme && (
                  <button
                    type="button"
                    onClick={handleResetAITheme}
                    className="w-full py-2 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-xl text-[10px] font-mono transition inline-flex items-center justify-center gap-1.5 cursor-pointer bg-slate-950/20"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset to Classic Styles
                  </button>
                )}
              </div>
            </div>

            {/* Theme designer panel */}
            <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-indigo-400 border-b border-slate-800 pb-3">
                <Palette className="w-4 h-4" />
                <h4 className="text-xs font-bold uppercase tracking-wider">Slide Palette Designer</h4>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] text-slate-400 font-mono">Choose a typography and visual background style:</p>
                
                <div className="space-y-1.5">
                  {allAvailableThemes.map((theme) => {
                    const isSel = theme.id === selectedThemeId;
                    return (
                      <button
                        key={theme.id}
                        onClick={() => setSelectedThemeId(theme.id)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                          isSel 
                            ? 'border-indigo-500 bg-indigo-500/10 text-white' 
                            : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span 
                            style={{ backgroundColor: theme.bgStr }} 
                            className="w-3.5 h-3.5 rounded-full border border-white/20 inline-block flex-shrink-0" 
                          />
                          <span className="font-semibold">{theme.name}</span>
                        </div>
                        {isSel && <MonitorCheck className="w-4 h-4 text-indigo-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Quick overview of all presentation card pages */}
            <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 space-y-3 flex-1 overflow-y-auto max-h-[300px]">
              <div className="flex items-center gap-2 text-indigo-400 border-b border-slate-800 pb-3 flex-shrink-0">
                <Layout className="w-4 h-4" />
                <h4 className="text-xs font-bold uppercase tracking-wider">Present Deck ({slides.length})</h4>
              </div>

              <div className="space-y-1.5 overflow-y-auto">
                {slides.map((sl, index) => {
                  const isActive = index === activeSlideIndex;
                  return (
                    <button
                      key={index}
                      onClick={() => setActiveSlideIndex(index)}
                      className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left text-[11px] transition cursor-pointer ${
                        isActive 
                          ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30' 
                          : 'bg-slate-950/20 text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      <span className="font-mono bg-slate-950 px-1.5 py-0.5 rounded text-[9px] text-slate-500 font-bold">
                        S{index + 1}
                      </span>
                      <div className="truncate flex-1 space-y-0.5">
                        <p className="font-semibold text-white/90 truncate">{sl.title}</p>
                        <p className="text-[9px] text-slate-500 truncate">{sl.lines[0] || 'Blank slide content'}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
