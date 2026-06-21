import React, { useState, useEffect, useMemo } from 'react';
import { Song, FormattedSection } from '../types';
import { db } from '../utils/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { 
  Presentation, Download, Sparkles, MonitorIcon, ChevronLeft, ChevronRight,
  Plus, Trash2, ArrowUp, ArrowDown, Type, Palette, LayoutGrid, Check, 
  RotateCcw, Loader2, ListMusic, Music, Search, Edit2, ShieldAlert,
  Church, Save, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import pptxgen from 'pptxgenjs';

interface PPTEditorTabProps {
  songs: Song[];
  user: any;
}

interface SlideData {
  id: string;
  title: string;
  category: string;
  lines: string[];
}

type PPTThemeId = 'cosmic-dark' | 'midnight-onyx' | 'vintage-serif' | 'emerald-worship' | 'neon-aurora' | 'ai-custom';

interface PPTThemeConfig {
  id: PPTThemeId;
  name: string;
  bgStr: string; // CSS color string
  textColor: string; 
  accentColor: string; 
  fontFace: string;
  pptBg: string; // Hex color for pptxgenjs (no #)
  pptText: string; 
  pptAccent: string; 
}

const THEMES: PPTThemeConfig[] = [
  {
    id: 'cosmic-dark',
    name: 'Cosmic Dark',
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
    name: 'Midnight Onyx',
    bgStr: '#050505',
    textColor: '#ffffff',
    accentColor: '#e2e8f0',
    fontFace: 'Georgia',
    pptBg: '050505',
    pptText: 'FFFFFF',
    pptAccent: 'E2E8F0'
  },
  {
    id: 'vintage-serif',
    name: 'Vintage Cream',
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
    name: 'Emerald Sanctuary',
    bgStr: '#042f1a', // emerald 950
    textColor: '#f0fdf4', // emerald 50
    accentColor: '#4ade80', // emerald 400
    fontFace: 'Arial',
    pptBg: '042F1A',
    pptText: 'F0FDF4',
    pptAccent: '4ADE80'
  },
  {
    id: 'neon-aurora',
    name: 'Neon Praise',
    bgStr: '#1e0b36',
    textColor: '#ffffff',
    accentColor: '#f43f5e',
    fontFace: 'Arial',
    pptBg: '1E0B36',
    pptText: 'FFFFFF',
    pptAccent: 'F43F5E'
  }
];

export default function PPTEditorTab({ songs, user }: PPTEditorTabProps) {
  // Active states
  const [selectedSongId, setSelectedSongId] = useState<string>('');
  const [churchName, setChurchName] = useState<string>('My Church');
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);
  
  // Custom design parameters
  const [selectedThemeId, setSelectedThemeId] = useState<PPTThemeId>('cosmic-dark');
  const [pptFontOverride, setPptFontOverride] = useState<string | null>(null);
  const [customAITheme, setCustomAITheme] = useState<PPTThemeConfig | null>(null);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [isBeautifying, setIsBeautifying] = useState<boolean>(false);
  const [aiExplanation, setAiExplanation] = useState<string>('');

  // Active editors for the currently highlighted slide
  const [editTitle, setEditTitle] = useState<string>('');
  const [editLinesRaw, setEditLinesRaw] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('');

  // Search filtering for choosing track list
  const [dropdownSearch, setDropdownSearch] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  const filteredSongsList = useMemo(() => {
    return songs.filter(s => 
      s.title.toLowerCase().includes(dropdownSearch.toLowerCase()) ||
      s.artist.toLowerCase().includes(dropdownSearch.toLowerCase())
    );
  }, [songs, dropdownSearch]);

  const allAvailableThemes = customAITheme ? [...THEMES, customAITheme] : THEMES;
  const activeTheme = allAvailableThemes.find(t => t.id === selectedThemeId) || THEMES[0];
  const currentFontFace = pptFontOverride || activeTheme.fontFace;

  // Listen for user profile to prefill Church Name
  useEffect(() => {
    if (!user) return;
    const loadProfileChurch = async () => {
      try {
        const docRef = doc(db, 'user_profiles', user.uid);
        const snap = await getDoc(docRef);
        if (snap.exists() && snap.data().churchName) {
          setChurchName(snap.data().churchName);
        }
      } catch (err) {
        console.warn("Could not prefill church name from user profile:", err);
      }
    };
    loadProfileChurch();
  }, [user]);

  // Handle selected track lyric generation trigger
  const handleSelectSong = (song: Song) => {
    setSelectedSongId(song.id);
    setIsDropdownOpen(false);
    setDropdownSearch('');
    setCustomAITheme(null);
    setAiExplanation('');
    setSelectedThemeId('cosmic-dark');

    const tempSlides: SlideData[] = [];

    // Slide 0: Front Page Title Slide. Rules: "I only want the Song Name And Church Name In the Front page"
    tempSlides.push({
      id: `slide-title-${Date.now()}`,
      title: song.title.toUpperCase(),
      category: 'front-page-slide', // special tag for strict rendering rules
      lines: [churchName] // ONLY church name in lines
    });

    // Content Slides (synced sections)
    const activeLyrics = song.formattedLyrics && song.formattedLyrics.length > 0
      ? song.formattedLyrics
      : (song.formattedLyricsHindi || []);

    activeLyrics.forEach((section, index) => {
      tempSlides.push({
        id: `slide-content-${index}-${Date.now()}`,
        title: section.label.toUpperCase(),
        category: `WORDS BY ${song.artist.toUpperCase()}`,
        lines: [...section.lines]
      });
    });

    // Slide End
    tempSlides.push({
      id: `slide-end-${Date.now()}`,
      title: "THANK YOU",
      category: "SMART LYRICS PRESENTATIONS ENGINE",
      lines: ["Praise & Worship Directory", "Powered by Google Cloud & Firestore"]
    });

    setSlides(tempSlides);
    setActiveSlideIndex(0);
  };

  // Synchronize input fields values on active index slide changes
  useEffect(() => {
    if (slides.length > 0 && slides[activeSlideIndex]) {
      const activeSl = slides[activeSlideIndex];
      setEditTitle(activeSl.title);
      setEditLinesRaw(activeSl.lines.join('\n'));
      setEditCategory(activeSl.category);
    } else {
      setEditTitle('');
      setEditLinesRaw('');
      setEditCategory('');
    }
  }, [activeSlideIndex, slides]);

  // Synchronize church name updates to Title Slide in real-time
  const handleChurchNameChange = (val: string) => {
    setChurchName(val);
    setSlides(prev => prev.map((sl) => {
      if (sl.category === 'front-page-slide') {
        return {
          ...sl,
          lines: [val]
        };
      }
      return sl;
    }));
  };

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle slideshow key bindings
      if (slides.length === 0) return;
      if (e.key === 'ArrowRight' || e.key === 'Space') {
        if (isFullScreen) {
          e.preventDefault();
          setActiveSlideIndex(prev => Math.min(prev + 1, slides.length - 1));
        }
      } else if (e.key === 'ArrowLeft') {
        if (isFullScreen) {
          e.preventDefault();
          setActiveSlideIndex(prev => Math.max(0, prev - 1));
        }
      } else if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [slides.length, isFullScreen]);

  // Individual Slide operations
  const handleSaveActiveSlideEdits = () => {
    if (slides.length === 0) return;
    const splitLines = editLinesRaw.split('\n').map(l => l.trim()).filter(Boolean);
    
    setSlides(prev => prev.map((sl, index) => {
      if (index === activeSlideIndex) {
        return {
          ...sl,
          title: editTitle.trim().toUpperCase(),
          category: editCategory.trim(),
          lines: splitLines
        };
      }
      return sl;
    }));

    // If it is the front page slide, update local churchName tracker as well
    if (slides[activeSlideIndex]?.category === 'front-page-slide') {
      if (splitLines[0]) {
        setChurchName(splitLines[0]);
      }
    }
  };

  const handleAddNewSlide = () => {
    const newSl: SlideData = {
      id: `slide-custom-${Date.now()}`,
      title: "NEW SLIDE SECTION",
      category: "CONGREGATION CHANT",
      lines: ["Type your customized worship lyrics lines here", "Separate lines with a simple return key"]
    };

    // Insert directly after currently selected slide index
    const updated = [...slides];
    updated.splice(activeSlideIndex + 1, 0, newSl);
    setSlides(updated);
    setActiveSlideIndex(activeSlideIndex + 1);
  };

  const handleDeleteActiveSlide = () => {
    if (slides.length <= 1) {
      alert("At least one slide sheet is required to maintain presentation integrity.");
      return;
    }
    const filtered = slides.filter((_, idx) => idx !== activeSlideIndex);
    setSlides(filtered);
    setActiveSlideIndex(prev => Math.max(0, prev - 1));
  };

  const handleMoveSlideUp = () => {
    if (activeSlideIndex === 0) return;
    const reordered = [...slides];
    const temp = reordered[activeSlideIndex];
    reordered[activeSlideIndex] = reordered[activeSlideIndex - 1];
    reordered[activeSlideIndex - 1] = temp;
    setSlides(reordered);
    setActiveSlideIndex(activeSlideIndex - 1);
  };

  const handleMoveSlideDown = () => {
    if (activeSlideIndex === slides.length - 1) return;
    const reordered = [...slides];
    const temp = reordered[activeSlideIndex];
    reordered[activeSlideIndex] = reordered[activeSlideIndex + 1];
    reordered[activeSlideIndex + 1] = temp;
    setSlides(reordered);
    setActiveSlideIndex(activeSlideIndex + 1);
  };

  // AI Beautifier Hook
  const handleAIBeautify = async () => {
    if (slides.length === 0) return;
    setIsBeautifying(true);
    setAiExplanation('');

    try {
      // Find the song details for the parser
      const selectedSong = songs.find(s => s.id === selectedSongId);
      const title = selectedSong?.title || "Worship Song";
      const artist = selectedSong?.artist || "Congregation";

      const res = await fetch("/api/gemini/beautify-ppt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          artist,
          slides: slides.map((sl) => ({
            title: sl.title,
            category: sl.category,
            lines: sl.lines
          }))
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
          setSelectedThemeId('ai-custom');
          setAiExplanation(data.theme.explanation || 'Analyzed sentiment of worship and customized colors.');
          
          // Re-initialize slides mapping
          const mappedSlides: SlideData[] = data.slides.map((sl: any, idx: number) => ({
            id: `slide-ai-${idx}-${Date.now()}`,
            title: sl.title.toUpperCase(),
            category: sl.category || `SECTION ${idx + 1}`,
            lines: sl.lines || []
          }));
          
          setSlides(mappedSlides);
          setActiveSlideIndex(0);
        } else {
          alert("Gemini failed to beautify. Try applying normal templates.");
        }
      } else {
        alert("The Beautifier service returned an error. Apply custom templates instead.");
      }
    } catch (err) {
      console.error(err);
      alert("Network or authentication issue occurred during PowerPoint AI beautifier.");
    } finally {
      setIsBeautifying(false);
    }
  };

  const handleResetAITheme = () => {
    setCustomAITheme(null);
    setAiExplanation('');
    setSelectedThemeId('cosmic-dark');
    if (selectedSongId) {
      const activeSong = songs.find(s => s.id === selectedSongId);
      if (activeSong) handleSelectSong(activeSong);
    }
  };

  // Compile Slides & Export .pptx File
  const handleExportPPTX = async () => {
    if (slides.length === 0) return;
    setIsCompiling(true);

    try {
      const pptx = new pptxgen();
      pptx.layout = 'LAYOUT_16x9';

      slides.forEach((sl) => {
        const pptSlide = pptx.addSlide();
        pptSlide.background = { fill: activeTheme.pptBg };

        // For Slide 0: Front Page. Strictly Song Name and Church Name in center!
        const isFrontPage = sl.category === 'front-page-slide';

        if (isFrontPage) {
          // Centered Song Title on Title Page
          pptSlide.addText(sl.title, {
            x: 0.5,
            y: 2.0,
            w: 9.0,
            h: 1.0,
            fontSize: 28,
            bold: true,
            color: activeTheme.pptText,
            fontFace: currentFontFace,
            align: 'center',
            valign: 'middle'
          });

          // Centered Church name below title
          const churchLabel = sl.lines[0] || churchName;
          pptSlide.addText(churchLabel, {
            x: 0.5,
            y: 3.2,
            w: 9.0,
            h: 0.5,
            fontSize: 16,
            italic: true,
            color: activeTheme.pptAccent,
            fontFace: currentFontFace,
            align: 'center',
            valign: 'middle'
          });

        } else {
          // Standard content Slide: Section Category Title
          pptSlide.addText(sl.category, {
            x: 0.5,
            y: 0.4,
            w: 9.0,
            h: 0.4,
            fontSize: 11,
            bold: true,
            color: activeTheme.pptAccent,
            fontFace: currentFontFace
          });

          // Stanza title label (Verse 1, Chorus)
          pptSlide.addText(sl.title, {
            x: 0.5,
            y: 0.8,
            w: 9.0,
            h: 0.5,
            fontSize: 16,
            bold: true,
            color: activeTheme.pptAccent,
            fontFace: currentFontFace
          });

          // Lyrics lines
          const lyricsBody = sl.lines.join('\n');
          let fontSlideSize = 22;
          if (sl.lines.length > 8) {
            fontSlideSize = 16;
          } else if (sl.lines.length > 5) {
            fontSlideSize = 19;
          }

          pptSlide.addText(lyricsBody, {
            x: 0.5,
            y: 1.5,
            w: 9.0,
            h: 3.5,
            fontSize: fontSlideSize,
            color: activeTheme.pptText,
            fontFace: currentFontFace,
            align: 'left',
            valign: 'middle',
            lineSpacing: fontSlideSize * 1.4
          });
        }

        // Standard footer brand representation on non-front pages
        if (!isFrontPage) {
          pptSlide.addText("Psamify Lyrics — Dynamic PowerPoint Companion", {
            x: 0.5,
            y: 5.2,
            w: 9.0,
            h: 0.3,
            fontSize: 8,
            italic: true,
            color: activeTheme.pptAccent,
            align: 'left',
            fontFace: currentFontFace
          });
        }
      });

      const selectedSong = songs.find(s => s.id === selectedSongId);
      const outputFileName = selectedSong 
        ? `${selectedSong.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_presentation.pptx`
        : `worship_presentation.pptx`;

      await pptx.writeFile({ fileName: outputFileName });
    } catch (err) {
      console.error(err);
      alert("Failed compiling PowerPoint. Re-verify the library configurations.");
    } finally {
      setIsCompiling(false);
    }
  };

  const activeSlide = slides[activeSlideIndex];

  return (
    <div id="ppt-editor-workspace" className="space-y-6">
      
      {/* HEADER BANNER */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-xs">
            <Presentation className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Presentation Companion Deck</h2>
            <p className="text-xs text-slate-500 font-mono">Bespoke slide editor, theme designer, and PowerPoint assembler</p>
          </div>
        </div>

        {slides.length > 0 && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleExportPPTX}
              disabled={isCompiling}
              className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm shadow-indigo-600/10"
            >
              <Download className={`w-4 h-4 ${isCompiling ? 'animate-spin' : ''}`} />
              <span>{isCompiling ? 'Generating...' : 'Export PPTX File'}</span>
            </button>
          </div>
        )}
      </div>

      {/* SEARCH AND SONG SELECTION MENU */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Dropdown Song Picker */}
        <div className="md:col-span-2 relative">
          <label className="text-[10px] font-mono font-bold text-slate-550 uppercase tracking-wider mb-1.5 block">
            Select Track from Lyrics Catalog to Initialize Presentation Slides
          </label>
          
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white border border-slate-200 text-left rounded-2xl text-xs text-slate-700 transition shadow-xs cursor-pointer focus:border-slate-400"
            >
              <span className="flex items-center gap-2 truncate">
                <Music className="w-4 h-4 text-slate-400" />
                {selectedSongId 
                  ? <strong>{songs.find(s => s.id === selectedSongId)?.title} — {songs.find(s => s.id === selectedSongId)?.artist}</strong>
                  : <span className="text-slate-400">Choose a lyric sheet...</span>
                }
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            {isDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200/90 rounded-2xl shadow-xl z-50 p-2 space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search song title or composer..."
                    value={dropdownSearch}
                    onChange={(e) => setDropdownSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-20s focus:border-indigo-400 rounded-lg outline-none font-mono"
                  />
                </div>

                <div className="max-h-56 overflow-y-auto divide-y divide-slate-50">
                  {filteredSongsList.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectSong(s)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 text-slate-700 font-sans block truncate rounded-lg transition"
                    >
                      <span className="font-bold text-slate-900 inline-block mr-1">{s.title}</span>
                      <span className="text-slate-400 font-mono">({s.artist})</span>
                    </button>
                  ))}
                  {filteredSongsList.length === 0 && (
                    <div className="p-3 text-center text-xs text-slate-400 font-mono">No matching songs inside directory.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Global default parameters */}
        <div className="bg-white border border-slate-200/90 p-4 rounded-3xl space-y-1.5 shadow-xs">
          <label className="text-[10px] font-mono font-bold text-slate-550 uppercase tracking-wider block">
            Default Church Name (First Presentation Slide)
          </label>
          <div className="relative">
            <Church className="absolute left-3 top-3 w-4 h-4 text-indigo-500" />
            <input
              type="text"
              placeholder="e.g. Calvary Chapel"
              value={churchName}
              onChange={(e) => handleChurchNameChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl outline-none font-mono font-semibold"
            />
          </div>
        </div>
      </div>

      {slides.length === 0 ? (
        <div className="bg-slate-50 border border-dashed border-slate-250 rounded-3xl p-16 text-center text-slate-400 font-mono space-y-4" id="ppt-empty-state">
          <Presentation className="w-12 h-12 text-slate-300 mx-auto animate-pulse" />
          <div className="space-y-1">
            <p className="font-bold text-slate-600 text-sm">No Active PowerPoint Selected</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
              Kindly choose a praise lyric sheet from the searchable dropdown list to auto-populate presentation templates, custom slides and alignments.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[500px]">
          
          {/* LEFT COLUMN: Deck slide indexes list (Lg: col-span-3) */}
          <div className="lg:col-span-3 space-y-4 bg-white border border-slate-200 p-4 rounded-3xl h-[600px] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 flex-shrink-0">
              <span className="text-[10px] font-mono font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <LayoutGrid className="w-3.5 h-3.5" /> Present Deck ({slides.length})
              </span>
              <button 
                onClick={handleAddNewSlide}
                className="p-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200"
                title="Insert customizable slide sheet"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2 flex-1 overflow-y-auto max-h-[460px] pr-0.5">
              {slides.map((sl, index) => {
                const isActive = index === activeSlideIndex;
                const isFront = sl.category === 'front-page-slide';
                return (
                  <div
                    key={sl.id}
                    className={`group w-full flex items-center justify-between gap-1 p-2 rounded-xl transition border text-left cursor-pointer ${
                      isActive 
                        ? 'bg-indigo-50/80 text-indigo-700 border-indigo-400' 
                        : 'bg-slate-50 hover:bg-slate-100/60 text-slate-500 border-transparent'
                    }`}
                    onClick={() => setActiveSlideIndex(index)}
                  >
                    <div className="truncate flex-1 flex items-center gap-2 min-w-0">
                      <span className="font-mono bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[9px] font-bold">
                        {index + 1}
                      </span>
                      <div className="truncate text-[11px]">
                        <p className={`font-bold truncate ${isActive ? 'text-indigo-900' : 'text-slate-800'}`}>
                          {sl.title}
                        </p>
                        <p className="text-[9px] text-slate-400 truncate">
                          {isFront ? "Title slide" : sl.lines[0] || "[Empty]"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Slide Arrangement Tools */}
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 flex-shrink-0">
              <button
                type="button"
                onClick={handleMoveSlideUp}
                disabled={activeSlideIndex === 0}
                className="py-1 px-2 border border-slate-200 hover:border-slate-350 disabled:opacity-40 hover:bg-slate-50 text-[10px] font-mono font-bold rounded-lg text-slate-700 flex items-center justify-center gap-1 transition"
              >
                <ArrowUp className="w-3 h-3" /> Move Up
              </button>
              <button
                type="button"
                onClick={handleMoveSlideDown}
                disabled={activeSlideIndex === slides.length - 1}
                className="py-1 px-2 border border-slate-200 hover:border-slate-350 disabled:opacity-40 hover:bg-slate-50 text-[10px] font-mono font-bold rounded-lg text-slate-700 flex items-center justify-center gap-1 transition"
              >
                <ArrowDown className="w-3 h-3" /> Move Down
              </button>
            </div>
          </div>

          {/* MIDDLE COLUMN: ACTIVE CANVAS DISPLAY PREVIEW & CONTROLS (Lg: col-span-5) */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
            
            {/* Visual stage displaying styled properties */}
            <div 
              style={{ backgroundColor: activeTheme.bgStr, fontFamily: currentFontFace }}
              className={`relative flex-1 flex flex-col justify-between border shadow-lg rounded-3xl transition-all duration-300 min-h-[350px] ${
                isFullScreen ? 'fixed inset-0 z-50 p-12 border-0 rounded-none' : 'border-slate-200/85 p-8'
              }`}
            >
              {/* Cover slide display logic strictly with Song Name / Church Name */}
              {activeSlide.category === 'front-page-slide' ? (
                <>
                  <div className="text-center my-auto space-y-4">
                    <h1 style={{ color: activeTheme.textColor }} className="text-xl md:text-3xl font-extrabold tracking-tight filter drop-shadow-md">
                      {activeSlide.title}
                    </h1>
                    <p style={{ color: activeTheme.accentColor }} className="text-sm md:text-lg font-bold font-mono tracking-wide italic">
                      {activeSlide.lines[0] || churchName}
                    </p>
                  </div>

                  <div className="border-t border-slate-20/10 pt-4 flex items-center justify-between text-[10px]">
                    <span style={{ color: activeTheme.accentColor }} className="font-mono tracking-widest uppercase opacity-70">
                      Front Cover Slide
                    </span>
                    <span className="text-slate-400 opacity-60">Slide 1 of {slides.length}</span>
                  </div>
                </>
              ) : (
                <>
                  {/* Standard Slide View */}
                  <div className="space-y-1 relative z-10 select-none">
                    <p style={{ color: activeTheme.accentColor }} className="text-[10px] font-mono tracking-widest uppercase font-bold">
                      {activeSlide.category}
                    </p>
                    <h1 style={{ color: activeTheme.accentColor }} className="text-xs md:text-sm font-extrabold tracking-wide">
                      {activeSlide.title}
                    </h1>
                  </div>

                  <div className="flex-1 flex items-center justify-start py-6 relative z-10 select-none">
                    <div className="space-y-3 max-w-full">
                      {activeSlide.lines.map((line, lIdx) => (
                        <p 
                          key={lIdx} 
                          style={{ color: activeTheme.textColor }}
                          className="text-sm md:text-xl font-bold leading-normal tracking-wide text-left filter drop-shadow-sm truncate"
                        >
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-50/10 pt-3 relative z-10 select-none text-[10px]">
                    <span style={{ color: activeTheme.accentColor }} className="font-mono tracking-widest uppercase opacity-70">
                      Smart slide deck
                    </span>
                    <span className="text-slate-400 opacity-55">
                      Slide {activeSlideIndex + 1} of {slides.length}
                    </span>
                  </div>
                </>
              )}

              {/* Toggle fullscreen */}
              {isFullScreen && (
                <button
                  type="button"
                  onClick={() => setIsFullScreen(false)}
                  className="absolute right-6 top-6 p-2 bg-slate-900/60 backdrop-blur-md rounded-full text-white cursor-pointer hover:bg-slate-900"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Pagination player block */}
            {!isFullScreen && (
              <div className="flex items-center justify-between bg-slate-900 p-4 border border-slate-800 rounded-2xl">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setActiveSlideIndex(prev => Math.max(0, prev - 1))}
                    disabled={activeSlideIndex === 0}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono font-bold text-slate-300 min-w-[50px] text-center">
                    {activeSlideIndex + 1} / {slides.length}
                  </span>
                  <button
                    onClick={() => setActiveSlideIndex(prev => Math.min(slides.length - 1, prev + 1))}
                    disabled={activeSlideIndex === slides.length - 1}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => setIsFullScreen(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-[10px] font-mono font-bold rounded-lg text-indigo-400 transition"
                >
                  <Presentation className="w-3.5 h-3.5" /> Presenter Mode
                </button>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: ACTIVE SLIDE EDITOR & AI BEAUTIFIER / DESIGNER (Lg: col-span-4) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* 1. SLIDE DETAILED TEXT EDITOR */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-5 space-y-4 shadow-xs">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <Edit2 className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Configure Active Slide ({activeSlideIndex + 1})</h4>
              </div>

              <div className="space-y-3 font-mono">
                {/* Check if Slide is Cover Page */}
                {activeSlide.category === 'front-page-slide' ? (
                  <>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Song Title (Display Title)</label>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200/90 focus:border-indigo-400 rounded-xl outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Church Name</label>
                      <input
                        type="text"
                        placeholder="Calvary Church"
                        value={editLinesRaw}
                        onChange={(e) => setEditLinesRaw(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200/90 focus:border-indigo-400 rounded-xl outline-none"
                      />
                    </div>
                    <p className="text-[9px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-2 leading-relaxed">
                      ⚠️ <strong>Front Page Constraints:</strong> Display is restricted strictly to the <strong>Song Name</strong> and <strong>Church Name</strong> only (all other metadata is hidden on cover).
                    </p>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Slide Title</label>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200/90 focus:border-indigo-400 rounded-xl outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Top Tag/Category</label>
                        <input
                          type="text"
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200/90 focus:border-indigo-400 rounded-xl outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Slide Lyrics Lines (Separate by return)</label>
                      <textarea
                        rows={5}
                        value={editLinesRaw}
                        onChange={(e) => setEditLinesRaw(e.target.value)}
                        className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200/90 focus:border-indigo-400 rounded-xl outline-none font-sans"
                        placeholder="Type lyrics..."
                      />
                    </div>
                  </>
                )}

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={handleSaveActiveSlideEdits}
                    className="w-full py-2 bg-slate-900 border border-slate-950 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" /> Save Edits
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteActiveSlide}
                    className="py-2 px-3 border border-red-200 hover:border-red-500 hover:bg-red-50 rounded-xl text-red-600 transition cursor-pointer"
                    title="Delete slide"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* 2. AI PPT BEAUTIFIER PANEL */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 text-white shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2 text-rose-400">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">Gemini AI Tone Beautifier</h4>
                </div>
                {customAITheme && (
                  <span className="text-[9px] bg-rose-500/20 text-rose-400 px-2.5 py-0.5 rounded-full font-bold">Active</span>
                )}
              </div>

              <div className="space-y-3 text-xs leading-relaxed font-mono">
                <p className="text-[10px] text-slate-400">
                  Analyze lyrics and automatically color/typography customize, recommending themes based on visual song sentiments.
                </p>

                {aiExplanation && (
                  <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl space-y-1">
                    <p className="text-[9px] text-rose-400 font-bold">Detected sentiment:</p>
                    <p className="text-[11px] text-slate-200 font-sans italic">"{aiExplanation}"</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleAIBeautify}
                  disabled={isBeautifying}
                  className="w-full py-2.5 bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-400 hover:to-indigo-550 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  {isBeautifying ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Applying Smart Theme...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{customAITheme ? 'Run AI Analysis Again' : 'AI Beautify PPT Deck'}</span>
                    </>
                  )}
                </button>

                {customAITheme && (
                  <button
                    type="button"
                    onClick={handleResetAITheme}
                    className="w-full py-1.5 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-lg text-[9px] transition flex items-center justify-center gap-1 cursor-pointer bg-slate-950/20"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset to Defaults
                  </button>
                )}
              </div>
            </div>

            {/* 3. STYLE PALETTE SELECTOR */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-5 space-y-4 shadow-xs">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <Palette className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Theme Designer Palette</h4>
              </div>

              <div className="space-y-1.5 font-mono">
                {allAvailableThemes.map((th) => {
                  const isSel = th.id === selectedThemeId;
                  return (
                    <button
                      key={th.id}
                      onClick={() => setSelectedThemeId(th.id)}
                      className={`w-full flex items-center justify-between p-2 rounded-xl border text-left text-xs transition cursor-pointer ${
                        isSel
                          ? 'border-indigo-500 bg-indigo-50/70 text-indigo-900 font-bold'
                          : 'border-slate-150 hover:border-slate-300 bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span style={{ backgroundColor: th.bgStr }} className="w-3.5 h-3.5 rounded-full border border-slate-300 block flex-shrink-0" />
                        <span className="text-[11px] truncate">{th.name}</span>
                      </div>
                      {isSel && <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. DESIGN TYPOGRAPHY SCREEN OVERRIDES */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-5 space-y-4 shadow-xs">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <Type className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Override Slide Font</h4>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
                {[
                  { label: 'Theme Default', family: null },
                  { label: 'Poppins (Hindi Modern)', family: 'Poppins' },
                  { label: 'Rajdhani (Tech Bold)', family: 'Rajdhani' },
                  { label: 'Yatra One (Hindi Ancient)', family: 'Yatra One' },
                  { label: 'Georgia (Serif Elegant)', family: 'Georgia' },
                  { label: 'Arial (San-Serif Clean)', family: 'Arial' }
                ].map((f) => {
                  const isSelected = pptFontOverride === f.family;
                  return (
                    <button
                      key={f.label}
                      onClick={() => setPptFontOverride(f.family)}
                      className={`p-2 border rounded-xl text-left transition truncate cursor-pointer ${
                        isSelected 
                          ? 'border-indigo-400 bg-indigo-50/50 text-indigo-800 font-bold'
                          : 'border-slate-150 hover:border-slate-250 bg-slate-50 text-slate-600'
                      }`}
                    >
                      <span className="block truncate">{f.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}

// Subcomponent trick to handle Plus SVG + Text cleanly
function PlusAndText({ text }: { text: string }) {
  return (
    <span className="flex items-center gap-1">
      <Plus className="w-3.5 h-3.5 text-emerald-400" /> {text}
    </span>
  );
}
