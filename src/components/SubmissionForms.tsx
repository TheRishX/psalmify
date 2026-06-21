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
  const [album, setAlbum] = useState('');
  const [genre, setGenre] = useState('Contemporary');
  const [duration, setDuration] = useState('3:30');
  const [rawLyrics, setRawLyrics] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const genres = inputGenres && inputGenres.length > 0
    ? inputGenres
    : ['Contemporary', 'Hymn', 'Synthwave', 'Bluegrass', 'Lofi Pop', 'Rock', 'Acoustic'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !artist.trim() || !rawLyrics.trim()) {
      setError('Please provide title, artist, and raw lyrics.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Parse the raw lyrics on client side to format section list
      const formatted = parseRawLyrics(rawLyrics);

      await addDoc(collection(db, "songs"), {
        title: title.trim(),
        artist: artist.trim(),
        album: album.trim() || null,
        genre,
        duration: duration.trim() || "3:30",
        rawLyrics: rawLyrics,
        formattedLyrics: formatted,
        coverUrl: coverUrl.trim() || null,
        youtubeUrl: youtubeUrl.trim() || null,
        status: 'pending', // Goes to moderation desk
        submittedBy: user.email,
        submittedByName: user.displayName || user.email.split('@')[0],
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
    <div className="space-y-5">
      <div className="border-b border-slate-100 pb-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Music className="w-5 h-5 text-rose-500" />
          Submit Track Lyrics Proposal
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Your lyric submission will go to the moderation queue. Upon administrator approval, it will go live in the public catalog.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase block">Song Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Amazing Grace"
              className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white outline-none rounded-xl p-2.5 text-xs font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase block">Artist / Band Name *</label>
            <input
              type="text"
              required
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="e.g. John Newton"
              className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white outline-none rounded-xl p-2.5 text-xs font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase block">Album (Optional)</label>
            <input
              type="text"
              value={album}
              onChange={(e) => setAlbum(e.target.value)}
              placeholder="e.g. Traditional Hymns Collection"
              className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white outline-none rounded-xl p-2.5 text-xs font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase block">Genre</label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white outline-none rounded-xl p-2.5 text-xs font-mono capitalize"
              >
                {genres.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase block">Duration</label>
              <input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g. 3:45"
                className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white outline-none rounded-xl p-2.5 text-xs font-mono"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase block flex items-center justify-between">
            <span>Raw Track Lyrics *</span>
            <span className="text-[9px] font-normal tracking-normal text-slate-400 lowercase italic">Use labels: [Verse 1], [Chorus], [Bridge]</span>
          </label>
          <textarea
            required
            rows={8}
            value={rawLyrics}
            onChange={(e) => setRawLyrics(e.target.value)}
            placeholder="[Intro]&#10;(Soft piano chords)&#10;&#10;[Verse 1]&#10;Amazing grace! How sweet the sound&#10;That saved a wretch like me!&#10;&#10;[Chorus]&#10;My chains are gone, I've been set free!&#10;My God, my Savior has ransomed me!&#10;And like a flood His mercy reigns..."
            className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white outline-none rounded-xl p-3 text-xs font-mono leading-relaxed resize-y min-h-[160px]"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase block">Media / YouTube Video URL</label>
            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="e.g. https://www.youtube.com/watch?v=..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white outline-none rounded-xl p-2.5 text-xs font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase block">Cover Image URL (Direct)</label>
            <input
              type="url"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="e.g. https://images.unsplash.com/promo..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white outline-none rounded-xl p-2.5 text-xs font-mono"
            />
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
                <span>Submitting Track...</span>
              </>
            ) : (
              <>
                <span>Submit Track Proposals</span>
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
        submittedBy: user.email,
        submittedByName: user.displayName || user.email.split('@')[0],
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
