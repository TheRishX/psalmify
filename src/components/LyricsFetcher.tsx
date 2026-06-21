import React, { useState, useEffect } from 'react';
import { db, OperationType, handleFirestoreError } from '../utils/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { parseRawLyrics } from '../utils/lyricParser';
import { Song, Genre } from '../types';
import { 
  Sparkles, Search, CheckCircle, RefreshCw, AlertCircle, 
  Tv, Eye, Play, PlusCircle, Check, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LyricsFetcherProps {
  genres: Genre[];
  onRefreshData: () => void;
  user: any;
}

export default function LyricsFetcher({ genres, onRefreshData, user }: LyricsFetcherProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [previewSong, setPreviewSong] = useState<Partial<Song> | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  // Editable preview values
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editGenre, setEditGenre] = useState('');
  const [editRawLyrics, setEditRawLyrics] = useState('');
  const [editRawLyricsHindi, setEditRawLyricsHindi] = useState('');
  const [editYoutubeUrl, setEditYoutubeUrl] = useState('');
  const [editCoverUrl, setEditCoverUrl] = useState('');

  const stages = [
    "Establishing secure search tunnel...",
    "Querying Google Search Grounding for Song & Artist...",
    "Crawling lyrics databases and official lyric registries...",
    "Harvesting English lyric body paragraph details...",
    "Beautifying lines and grouping into section blocks...",
    "Formulating matching Hindi Devanagari translation layout...",
    "Bridges built: structuring dual-language bracket sections...",
    "Locating official YouTube video & extracting thumbnail..."
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStage(prev => (prev + 1) % stages.length);
      }, 3500);
    } else {
      setLoadingStage(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    setPreviewSong(null);

    try {
      const response = await fetch('/api/gemini/fetch-lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery.trim() })
      });

      const data = await response.json();
      if (data.success) {
        setPreviewSong({
          title: data.title,
          artist: data.artist,
          genre: data.genre,
          rawLyrics: data.lyricsEnglish,
          rawLyricsHindi: data.lyricsHindi,
          youtubeUrl: data.youtubeUrl,
          coverUrl: data.coverUrl
        });

        // Initialize editable states
        setEditTitle(data.title || '');
        setEditArtist(data.artist || '');
        setEditGenre(data.genre || 'Contemporary');
        setEditRawLyrics(data.lyricsEnglish || '');
        setEditRawLyricsHindi(data.lyricsHindi || '');
        setEditYoutubeUrl(data.youtubeUrl || '');
        setEditCoverUrl(data.coverUrl || '');
      } else {
        setErrorMsg(data.error || 'Failed to fetch lyric data. Please try another song query.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Connection error: Failed to fetch lyrics from server.');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!editTitle.trim() || !editArtist.trim()) {
      alert('Official Song Title and Artist Name are required to publish!');
      return;
    }

    setIsPublishing(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const songId = `song-${Date.now()}`;
      const parsedLyrics = parseRawLyrics(editRawLyrics);
      const parsedLyricsHindi = editRawLyricsHindi.trim() ? parseRawLyrics(editRawLyricsHindi) : [];

      const payload: Song = {
        id: songId,
        title: editTitle.trim(),
        artist: editArtist.trim(),
        genre: editGenre || 'Contemporary',
        duration: '3:30',
        rawLyrics: editRawLyrics,
        formattedLyrics: parsedLyrics,
        rawLyricsHindi: editRawLyricsHindi.trim() || undefined,
        formattedLyricsHindi: parsedLyricsHindi.length > 0 ? parsedLyricsHindi : undefined,
        youtubeUrl: editYoutubeUrl.trim() || undefined,
        coverUrl: editCoverUrl.trim() || 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=400&q=80',
        isFeatured: false,
        status: 'approved', // Bypasses moderation automatically as administrator action
        createdAt: new Date().toISOString(),
        submittedBy: user?.email || 'admin',
        submittedByName: 'Lyrics Fetcher agent'
      };

      await setDoc(doc(db, "songs", songId), payload).catch((err) => {
        handleFirestoreError(err, OperationType.CREATE, `songs/${songId}`);
      });

      setSuccessMsg(`"${editTitle}" has been successfully imported, aligned, and published directly to the public catalog!`);
      setPreviewSong(null);
      setSearchQuery('');
      onRefreshData();
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Failed to publish the track: ' + err.message);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Search Bar & Description */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-violet-50 text-violet-600 rounded-xl">
            <Sparkles className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base md:text-lg tracking-tight">AI Song Lyrics Fetcher</h3>
            <p className="text-slate-500 text-xs leading-relaxed">
              Type any song name. Gemini AI will use real-time search grounding to fetch the track, beautify the formatting, align parallel Devanagari Hindi/English stanzas, locate YouTube streaming links, and capture high-res thumbnails automatically.
            </p>
          </div>
        </div>

        <form onSubmit={handleFetch} className="flex gap-2">
          <div className="relative flex-grow">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              required
              disabled={loading}
              placeholder="e.g. Perfect by Ed Sheeran, Tum Hi Ho, Kesariya, Mockingbird..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-2xl outline-none transition text-xs font-mono disabled:opacity-60"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !searchQuery.trim()}
            className="px-6 py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 text-white font-bold text-xs rounded-2xl transition shadow-xs hover:shadow-md cursor-pointer flex items-center gap-1.5 flex-shrink-0"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            {loading ? 'Fetching...' : 'Fetch Song'}
          </button>
        </form>

        {/* Status / Error Boxes */}
        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 font-mono">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-250 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800 font-sans font-semibold">
            <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Dynamic Step-by-Step Loader Panel */}
        {loading && (
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center space-y-4">
            <div className="relative flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-violet-600 animate-spin" />
              <Sparkles className="w-4 h-4 text-amber-500 absolute animate-pulse" />
            </div>
            <div className="space-y-1.5">
              <p className="font-bold text-xs text-slate-800 uppercase tracking-widest font-mono">
                Gemini AI Is Fetching & Aligning
              </p>
              <p className="text-slate-500 text-xs italic font-medium">
                "{stages[loadingStage]}"
              </p>
            </div>
            <div className="w-full max-w-xs bg-slate-200/60 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-violet-600 h-full rounded-full transition-all duration-1000"
                style={{ width: `${((loadingStage + 1) / stages.length) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Interactive Review and Polish Panel */}
      {previewSong && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
          <div className="flex border-b border-slate-100 pb-3 justify-between items-center">
            <div>
              <h4 className="font-bold text-sm uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-violet-500" /> Review Generated Track
              </h4>
              <p className="text-slate-500 text-xs">Verify AI structured fields before importing directly into matching catalogs.</p>
            </div>
            <span className="text-[10px] uppercase font-bold text-violet-700 bg-violet-50 px-2.5 py-1 rounded-full border border-violet-100">
              Fetched Successfully
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Left: General Track Details */}
            <div className="space-y-4 md:col-span-1 border-r border-slate-100 pr-0 md:pr-6">
              
              <div className="space-y-2">
                <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">Cover Art (YouTube Derived)</label>
                <div className="aspect-square w-full rounded-2xl bg-slate-100 overflow-hidden relative border border-slate-200 group">
                  <img 
                    src={editCoverUrl}
                    alt="Album Cover"
                    className="w-full h-full object-cover transition duration-300"
                    onError={(e) => {
                      (e.target as any).src = "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=400&q=80";
                    }}
                  />
                  <div className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-0 hover:opacity-100 transition duration-350">
                    <Play className="w-10 h-10 text-white fill-white animate-pulse" />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider block">Official Title *</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl outline-none transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider block">Official Artist *</label>
                <input
                  type="text"
                  required
                  value={editArtist}
                  onChange={(e) => setEditArtist(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl outline-none transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider block">Genre</label>
                <select
                  value={editGenre}
                  onChange={(e) => setEditGenre(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl outline-none transition"
                >
                  {genres.map(g => (
                    <option key={g.id} value={g.name}>{g.name}</option>
                  ))}
                  <option value="Bollywood">Bollywood</option>
                  <option value="Pop">Pop</option>
                  <option value="Rock">Rock</option>
                  <option value="Indie">Indie</option>
                  <option value="Devotional">Devotional</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider block">YouTube Link</label>
                <div className="relative">
                  <Tv className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-red-600" />
                  <input
                    type="url"
                    value={editYoutubeUrl}
                    onChange={(e) => setEditYoutubeUrl(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl outline-none transition"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider block">Cover Image URL</label>
                <input
                  type="text"
                  value={editCoverUrl}
                  onChange={(e) => setEditCoverUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl outline-none transition text-ellipsis"
                />
              </div>
            </div>

            {/* Right: Parallel English & Hindi Textareas */}
            <div className="md:col-span-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* English Content */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">English source</span>
                    <span className="text-[8px] bg-indigo-50 border border-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded font-bold uppercase font-mono">Clean Block</span>
                  </div>
                  <textarea
                    required
                    value={editRawLyrics}
                    onChange={(e) => setEditRawLyrics(e.target.value)}
                    rows={12}
                    className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-2xl outline-none transition resize-y leading-relaxed min-h-[250px]"
                    placeholder="English lyrics lyrics body..."
                  />
                </div>

                {/* Hindi Content */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Hindi Devanagari translation</span>
                    <span className="text-[8px] bg-rose-50 border border-rose-200 text-rose-700 px-1.5 py-0.5 rounded font-bold uppercase font-mono">Matched Sections</span>
                  </div>
                  <textarea
                    required
                    value={editRawLyricsHindi}
                    onChange={(e) => setEditRawLyricsHindi(e.target.value)}
                    rows={12}
                    className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-2xl outline-none transition resize-y leading-relaxed min-h-[250px]"
                    placeholder="Hindi Devnagari lyrics body (matched stanza layout)..."
                  />
                </div>

              </div>

              {/* Publish Action Button */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                  <Info className="w-3.5 h-3.5 text-violet-500" />
                  Stanza structures will be calculated automatically based on bracket tags.
                </div>
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={isPublishing}
                  className="px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 text-white font-bold text-xs rounded-2xl transition shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  {isPublishing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                  {isPublishing ? 'Publishing...' : 'Publish Track to Catalog'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
