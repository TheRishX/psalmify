import React, { useState } from 'react';
import { Song, Genre } from '../types';
import { 
  X, Sparkles, Check, AlertTriangle, Wand2, RefreshCw, 
  PlaySquare, Image as ImageIcon, Link as LinkIcon, Music, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { parseRawLyrics } from '../utils/lyricParser';

interface SongEditorModalProps {
  song: Song;
  genres: Genre[];
  onClose: () => void;
  onSave: (id: string, updatedFields: Partial<Song>) => Promise<void>;
}

export default function SongEditorModal({ song, genres, onClose, onSave }: SongEditorModalProps) {
  const [title, setTitle] = useState(song.title);
  const [artist, setArtist] = useState(song.artist);
  const [album, setAlbum] = useState(song.album || '');
  const [genre, setGenre] = useState(song.genre);
  const [duration, setDuration] = useState(song.duration || '3:30');
  const [youtubeUrl, setYoutubeUrl] = useState(song.youtubeUrl || '');
  const [coverUrl, setCoverUrl] = useState(song.coverUrl || '');
  const [rawLyrics, setRawLyrics] = useState(song.rawLyrics);
  const [isFeatured, setIsFeatured] = useState(song.isFeatured || false);

  // States for AI integrations
  const [isBeautifying, setIsBeautifying] = useState(false);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  // 1. AI Beautify lyrics
  const handleAIBeautify = async () => {
    if (!rawLyrics.trim()) return;
    setIsBeautifying(true);
    setError('');
    setInfoMsg('');
    try {
      const response = await fetch('/api/gemini/beautify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawLyrics,
          songInfo: { title, artist }
        })
      });
      const data = await response.json();
      if (data.success && data.formattedText) {
        setRawLyrics(data.formattedText);
        setInfoMsg(data.enrichment || 'AI formatted stanzas successfully!');
      } else {
        setError(data.error || 'Failed to beautify lyrics.');
      }
    } catch (e: any) {
      setError('Connection to AI formatter failed.');
    } finally {
      setIsBeautifying(false);
    }
  };

  // 2. AI Spell Correct spellings/typos
  const handleAICorrect = async () => {
    if (!rawLyrics.trim()) return;
    setIsCorrecting(true);
    setError('');
    setInfoMsg('');
    try {
      const response = await fetch('/api/gemini/correct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawLyrics,
          songInfo: { title, artist }
        })
      });
      const data = await response.json();
      if (data.success && data.formattedText) {
        setRawLyrics(data.formattedText);
        setInfoMsg(data.enrichment || 'AI has reviewed and spell-corrected lyrics.');
      } else {
        setError(data.error || 'Failed to proofread lyrics.');
      }
    } catch (e: any) {
      setError('Connection to AI proofreader failed.');
    } finally {
      setIsCorrecting(false);
    }
  };

  // 3. AI Thumbnail Fetcher/Art Generator
  const handleAIGenerateCover = async () => {
    setIsGeneratingCover(true);
    setError('');
    setInfoMsg('');
    try {
      const response = await fetch('/api/gemini/generate-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, artist, genre })
      });
      const data = await response.json();
      if (data.success && data.url) {
        setCoverUrl(data.url);
        setInfoMsg(data.source === 'imagen' 
          ? 'Generated a custom AI artwork cover!' 
          : 'Retrieved an aesthetic curated Unsplash cover art!'
        );
      } else {
        setError(data.error || 'Failed to pull cover illustration.');
      }
    } catch (e: any) {
      setError('Connection failure on cover art generation stream.');
    } finally {
      setIsGeneratingCover(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !artist.trim() || !rawLyrics.trim()) {
      setError('Fields Title, Artist, and Lyrics are required.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const parsedSections = parseRawLyrics(rawLyrics);
      const fields: Partial<Song> = {
        title: title.trim(),
        artist: artist.trim(),
        album: album.trim() || undefined,
        genre,
        duration: duration.trim(),
        youtubeUrl: youtubeUrl.trim() || undefined,
        coverUrl: coverUrl.trim() || undefined,
        rawLyrics: rawLyrics,
        formattedLyrics: parsedSections,
        isFeatured: isFeatured
      };

      await onSave(song.id, fields);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed saving song.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="song-editor-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl bg-white border border-slate-200 text-slate-900 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto flex flex-col"
      >
        {/* Header absolute close */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Music className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base md:text-lg font-bold text-slate-900 tracking-tight">Edit Song Lyrics</h3>
              <p className="text-[11px] text-slate-400 font-mono">Modifying song ID: {song.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info alerts */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs flex items-center gap-2 flex-shrink-0">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {infoMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl text-xs flex items-center gap-2 flex-shrink-0">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>{infoMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto flex-1 pr-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left Column: Metadata */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">Song Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 focus:bg-white border border-slate-200 focus:border-slate-400 rounded-xl outline-none transition"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">Artist</label>
                  <input
                    type="text"
                    required
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 focus:bg-white border border-slate-200 focus:border-slate-400 rounded-xl outline-none transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">Album</label>
                  <input
                    type="text"
                    value={album}
                    onChange={(e) => setAlbum(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 focus:bg-white border border-slate-200 focus:border-slate-400 rounded-xl outline-none transition"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">Duration</label>
                  <input
                    type="text"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="e.g. 3:45"
                    className="w-full px-3 py-2 text-xs bg-slate-50 focus:bg-white border border-slate-200 focus:border-slate-400 rounded-xl outline-none transition"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">Category</label>
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs bg-slate-50 focus:bg-white border border-slate-200 focus:border-slate-400 rounded-xl outline-none transition cursor-pointer"
                >
                  <option value="">-- Choose Category --</option>
                  {genres.map(g => (
                    <option key={g.id} value={g.name}>{g.name}</option>
                  ))}
                  <option value="Acoustic">Acoustic</option>
                  <option value="Contemporary">Contemporary</option>
                  <option value="Gospel">Gospel</option>
                  <option value="Traditional">Traditional</option>
                  <option value="Rock">Rock</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <PlaySquare className="w-3 h-3 text-red-500" />
                  YouTube Link (For Play Sync Tracker)
                </label>
                <input
                  type="text"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 focus:bg-white border border-slate-200 focus:border-slate-400 rounded-xl outline-none transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <ImageIcon className="w-3 h-3 text-blue-500" />
                    Cover Image URL
                  </span>
                  <button
                    type="button"
                    onClick={handleAIGenerateCover}
                    disabled={isGeneratingCover}
                    className="p-1 px-2.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 text-[9px] font-sans font-bold uppercase rounded-lg tracking-wider flex items-center gap-1 transition cursor-pointer"
                  >
                    {isGeneratingCover ? (
                      <>
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                        AI Fetching...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-2.5 h-2.5" />
                        Fetch with AI
                      </>
                    )}
                  </button>
                </label>
                <input
                  type="text"
                  placeholder="Paste URL, or click 'Fetch with AI' above"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 focus:bg-white border border-slate-200 focus:border-slate-400 rounded-xl outline-none transition text-ellipsis"
                />
              </div>

              {coverUrl && (
                <div className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-100 rounded-2xl">
                  <img 
                    src={coverUrl} 
                    alt="Cover preview" 
                    className="w-12 h-12 object-cover rounded-lg bg-slate-200 shadow-xs border border-slate-200/50"
                    onError={(e) => {
                      (e.target as any).src = "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=100&q=80";
                    }}
                  />
                  <div>
                    <p className="text-[10px] font-mono text-slate-500">Image Source preview:</p>
                    <p className="text-[9px] text-slate-400 max-w-[200px] truncate">{coverUrl}</p>
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="feat-checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="w-4 h-4 text-emerald-500 border-slate-300 rounded-sm focus:ring-emerald-400"
                />
                <label htmlFor="feat-checkbox" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                  Highlight as Featured Song on Explore Wall
                </label>
              </div>
            </div>

            {/* Right Column: Raw Lyrics & AI Editing Tools */}
            <div className="flex flex-col space-y-1.5 h-full">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
                  Raw Lyrics Content
                </label>
                
                {/* AI Action Triggers */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleAIBeautify}
                    disabled={isBeautifying || !rawLyrics.trim()}
                    className="p-1 px-2.5 bg-teal-50 hover:bg-teal-100 text-teal-700 text-[9px] font-sans font-bold uppercase rounded-lg border border-teal-200 tracking-wider flex items-center gap-1 transition cursor-pointer"
                    title="Structure lyrics into sections with bracket tags like [CHORUS] using AI"
                  >
                    {isBeautifying ? (
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                    ) : (
                      <Wand2 className="w-2.5 h-2.5" />
                    )}
                    AI Beautify
                  </button>

                  <button
                    type="button"
                    onClick={handleAICorrect}
                    disabled={isCorrecting || !rawLyrics.trim()}
                    className="p-1 px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-[9px] font-sans font-bold uppercase rounded-lg border border-amber-200 tracking-wider flex items-center gap-1 transition cursor-pointer"
                    title="Fix spelling, typos and typos while maintaining song context with AI"
                  >
                    {isCorrecting ? (
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-2.5 h-2.5" />
                    )}
                    AI Correct Spell
                  </button>
                </div>
              </div>

              <textarea
                required
                value={rawLyrics}
                onChange={(e) => setRawLyrics(e.target.value)}
                placeholder="Paste song lyrics blocks here. Separate stanzas with double blank lines."
                className="w-full flex-1 min-h-[280px] p-4 text-xs font-mono bg-slate-50 focus:bg-white border border-slate-200 focus:border-slate-400 rounded-2xl outline-none transition resize-none leading-relaxed"
              />
              <p className="text-[9px] text-slate-400 font-mono italic">
                Tip: Type double blank lines to separate stanzas. Insert tags like [Chorus] or [Verse 1] on their own line.
              </p>
            </div>

          </div>

          <div className="flex items-center justify-end gap-2 pt-6 border-t border-slate-100 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-semibold border border-transparent hover:border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-60 rounded-xl shadow-lg transition flex items-center gap-2"
            >
              {isSaving ? 'Saving Changes...' : 'Save Lyrics'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
