import React, { useState } from 'react';
import { db, OperationType, handleFirestoreError } from '../utils/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { parseRawLyrics } from '../utils/lyricParser';
import { 
  Music, Plus, HelpCircle, X, Sparkles, CheckCircle2, 
  ChevronRight, Youtube, Eye, AlertCircle, ListPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Song, Playlist } from '../types';

interface SubmitSongFormProps {
  user: any;
  onClose: () => void;
  onSuccess: () => void;
  genres?: string[];
}

export function SubmitSongForm({ user, onClose, onSuccess, genres: inputGenres }: SubmitSongFormProps) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [rawLyrics, setRawLyrics] = useState('');
  const [rawLyricsHindi, setRawLyricsHindi] = useState('');
  const [formLanguageTab, setFormLanguageTab] = useState<'english' | 'hindi'>('english');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide the Song Title.');
      return;
    }
    
    const hasEnglish = rawLyrics.trim().length > 0;
    const hasHindi = rawLyricsHindi.trim().length > 0;
    
    if (!hasEnglish && !hasHindi) {
      setError('Please provide song lyrics in at least one language (English or Hindi Devanagari).');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Parse whichever lyrics are provided
      const formatted = hasEnglish ? parseRawLyrics(rawLyrics) : [];
      const formattedHindi = hasHindi ? parseRawLyrics(rawLyricsHindi) : [];

      let resolvedCover = "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=400&q=80";
      try {
        const coverRes = await fetch("/api/gemini/generate-cover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            title: title.trim(), 
            artist: artist.trim() || 'Traditional', 
            genre: 'Contemporary' 
          })
        });
        if (coverRes.ok) {
          const coverData = await coverRes.json();
          if (coverData.success && coverData.url) {
            resolvedCover = coverData.url;
          }
        }
      } catch (coverErr) {
        console.warn("AI cover art generation exception, falling back to placeholder:", coverErr);
      }

      await addDoc(collection(db, "songs"), {
        title: title.trim(),
        artist: artist.trim() || "Unknown Artist",
        album: "Community Contribution",
        genre: "Contemporary",
        duration: "3:30",
        rawLyrics: rawLyrics,
        formattedLyrics: formatted,
        rawLyricsHindi: rawLyricsHindi,
        formattedLyricsHindi: formattedHindi,
        coverUrl: resolvedCover,
        youtubeUrl: null,
        status: 'pending', // Goes to moderation desk
        submittedBy: user ? user.email : 'guest',
        submittedByName: user ? (user.displayName || user.email.split('@')[0]) : 'Guest Collaborator',
        createdAt: new Date().toISOString()
      }).catch((error) => {
        handleFirestoreError(error, OperationType.CREATE, "songs");
      });

      onSuccess();
    } catch (err: any) {
      console.error("Error submitting song lyric:", err);
      setError(err?.message || "Failed to submit lyrics request. Please retry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4" id="submit-song-proposal-root">
      <div className="border-b border-slate-100 pb-3">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Music className="w-5 h-5 text-rose-500" />
          Submit Track Lyrics Proposal
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Provide the track name and paste lyric sheets in English, Hindi/Devanagari, or both. Your submission will instantly enter the administrator desk queue for approval.
        </p>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-xs text-rose-700 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed font-medium">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Core Song Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">Song Title / Name *</span>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. He is Yahweh"
              className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white outline-none rounded-xl p-2.5 text-xs font-mono transition"
            />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">Artist Name (Optional)</span>
            <input
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="e.g. Steve Kuban"
              className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white outline-none rounded-xl p-2.5 text-xs font-mono transition"
            />
          </div>
        </div>

        {/* Dual Language Tab Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">Track Lyrics Input Sheets</span>
            <span className="text-[9px] font-normal text-slate-400 lowercase italic">use tags like [Verse 1], [Chorus], [Bridge]</span>
          </div>

          {/* Interactive Toggle Pill Bar */}
          <div className="p-1 bg-slate-100 rounded-xl flex gap-1 w-full relative">
            <button
              type="button"
              onClick={() => setFormLanguageTab('english')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition duration-200 relative z-10 ${
                formLanguageTab === 'english'
                  ? 'bg-white shadow-xs text-slate-900 border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
               English Lyrics Version {rawLyrics.trim() && '•'}
            </button>
            <button
              type="button"
              onClick={() => setFormLanguageTab('hindi')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition duration-200 relative z-10 ${
                formLanguageTab === 'hindi'
                  ? 'bg-white shadow-xs text-slate-900 border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Hindi Devanagari Version {rawLyricsHindi.trim() && '•'}
            </button>
          </div>

          {/* Tab Panes */}
          <div className="relative overflow-hidden min-h-[220px] bg-slate-50 border border-slate-250/70 rounded-2xl">
            {formLanguageTab === 'english' ? (
              <div className="p-3.5 space-y-2">
                <span className="text-[9px] font-mono tracking-wider font-bold text-indigo-500 uppercase flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                  English Lyrics Sheet
                </span>
                <textarea
                  rows={8}
                  value={rawLyrics}
                  onChange={(e) => setRawLyrics(e.target.value)}
                  placeholder="[Intro]&#10;(Acoustic chords)&#10;&#10;[Verse 1]&#10;Who is like Him, the Lion and the Lamb?&#10;Seated on the throne...&#10;&#10;[Chorus]&#10;He is Yahweh, He is Yahweh!&#10;Lord of Creation, awesome in power..."
                  className="w-full bg-transparent focus:bg-white/40 border-0 outline-none text-xs font-mono leading-relaxed resize-y max-h-[300px]"
                />
              </div>
            ) : (
              <div className="p-3.5 space-y-2">
                <span className="text-[9px] font-mono tracking-wider font-bold text-rose-500 uppercase flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                  Hindi Devanagari Lyrics Sheet
                </span>
                <textarea
                  rows={8}
                  value={rawLyricsHindi}
                  onChange={(e) => setRawLyricsHindi(e.target.value)}
                  placeholder="[Intro]&#10;(धून शुरू होती है)&#10;&#10;[Verse 1]&#10;यहोवा की स्तुति करो उसके पवित्र स्थान में,&#10;उसका सुसमाचार सारे जगत में सुनाओ...&#10;&#10;[Chorus]&#10;वह महान है, वह यहोवा है!&#10;सृष्टि का स्वामी, सामर्थ्य से भरा..."
                  className="w-full bg-transparent focus:bg-white/40 border-0 outline-none text-xs font-mono leading-relaxed resize-y max-h-[300px]"
                />
              </div>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-3 pt-3.5 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-mono hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-mono font-bold hover:bg-slate-800 disabled:opacity-50 transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-slate-900/10"
          >
            {isSubmitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Submitting Proposal...</span>
              </>
            ) : (
              <>
                <span>Submit to Moderator</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

interface SubmitPlaylistFormProps {
  user: any;
  songs: Song[];
  onClose: () => void;
  onSuccess: () => void;
}

export function SubmitPlaylistForm({ user, songs, onClose, onSuccess }: SubmitPlaylistFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [iconGenre, setIconGenre] = useState('Contemporary');
  const [playlistCoverUrl, setPlaylistCoverUrl] = useState('');
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const toggleSongSelection = (sId: string) => {
    setSelectedSongIds(prev =>
      prev.includes(sId) ? prev.filter(id => id !== sId) : [...prev, sId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) {
      setError('Please provide playlist name and a short description.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await addDoc(collection(db, "playlists"), {
        name: name.trim(),
        description: description.trim(),
        genre: iconGenre,
        coverUrl: playlistCoverUrl.trim() || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600&auto=format&fit=crop',
        songIds: selectedSongIds,
        status: 'pending',
        submittedBy: user ? user.email : 'guest',
        submittedByName: user ? (user.displayName || user.email.split('@')[0]) : 'Guest Collaborator',
        createdAt: new Date().toISOString()
      }).catch((error) => {
        handleFirestoreError(error, OperationType.CREATE, "playlists");
      });

      onSuccess();
    } catch (err: any) {
      console.error("Error submitting playlist submission:", err);
      setError(err?.message || "Failed to submit playlist collection request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="border-b border-slate-100 pb-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <ListPlus className="w-5 h-5 text-rose-500" />
          Propose Playlists Theme Collection
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Suggest a custom compilation playlist compile from existing tracks. This thematic compilation will be reviewed and approved by the admin.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin">
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase block">Playlist Collection Name *</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Morning Devotions Mix"
            className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white outline-none rounded-xl p-2.5 text-xs font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase block">Short Description / Subtitle *</label>
          <textarea
            required
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A compilation of warm acoustic hymns for reflecting during personal daily devotions."
            className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white outline-none rounded-xl p-2.5 text-xs font-mono leading-relaxed"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase block">Genre Accent</label>
            <select
              value={iconGenre}
              onChange={(e) => setIconGenre(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white outline-none rounded-xl p-2.5 text-xs font-mono capitalize"
            >
              {['Contemporary', 'Hymn', 'Synthwave', 'Bluegrass', 'Lofi Pop', 'Rock', 'Acoustic'].map(item => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase block">Cover Banner URL</label>
            <input
              type="url"
              value={playlistCoverUrl}
              onChange={(e) => setPlaylistCoverUrl(e.target.value)}
              placeholder="e.g. https://images.unsplash.com/photo-..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white outline-none rounded-xl p-2.5 text-xs font-mono"
            />
          </div>
        </div>

        {/* Multi Select Songs */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">
            <span>Select Sync Songs ({selectedSongIds.length} Selected)</span>
            <span>Checklist</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-[160px] overflow-y-auto space-y-1.5 scrollbar-thin">
            {songs.filter(s => s.isFeatured !== false).length === 0 ? (
              <span className="text-[10px] font-mono text-slate-400 block text-center py-4">No active approved songs to bundle in compilation.</span>
            ) : (
              songs.map((song) => {
                const checked = selectedSongIds.includes(song.id);
                return (
                  <div 
                    key={song.id}
                    onClick={() => toggleSongSelection(song.id)}
                    className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition text-xs border ${
                      checked 
                        ? 'bg-rose-50/50 border-rose-300 text-slate-905 font-bold' 
                        : 'bg-white border-slate-150 hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    <input 
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}} // Handle on parent div click
                      className="accent-slate-900 pointer-events-none"
                    />
                    <div className="flex-grow min-w-0 flex items-center justify-between">
                      <span className="truncate">{song.title} • <span className="opacity-75">{song.artist}</span></span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 opacity-80">{song.genre}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-mono hover:bg-slate-55 transition"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-mono font-bold hover:bg-slate-800 disabled:opacity-50 transition flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Submitting Playlist...</span>
              </>
            ) : (
              <>
                <span>Propose Themes Checklist</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
