import React, { useState } from 'react';
import { db, OperationType, handleFirestoreError } from '../utils/firebase';
import { 
  collection, doc, setDoc, deleteDoc, updateDoc, addDoc 
} from 'firebase/firestore';
import { Song, Playlist, Genre } from '../types';
import { 
  Music, Layers, Cloud, Presentation, Plus, Search, Trash2, 
  Edit3, CheckCircle, Clock, Check, AlertCircle, Sparkles, 
  Tv, LogOut, ChevronLeft, ChevronRight, ListMusic, PlusCircle, 
  HelpCircle, Trash, RefreshCw, X, Wand2, Database
} from 'lucide-react';
import { parseRawLyrics } from '../utils/lyricParser';
import { motion, AnimatePresence } from 'motion/react';

// Import our modular subcomponents
import CategoryManager from './CategoryManager';
import DriveSync from './DriveSync';
import PPTGenerator from './PPTGenerator';
import SongEditorModal from './SongEditorModal';
import LyricsFetcher from './LyricsFetcher';
import MasterBackupManager from './MasterBackupManager';

interface AdminUploaderProps {
  playlists: Playlist[];
  songs: Song[];
  onRefreshData: () => void;
  user: any;
  onAuthError: (err: any) => void;
  genres: Genre[];
}

type AdminTab = 'songs' | 'playlists' | 'categories' | 'gdrive' | 'fetcher' | 'backup';

export default function AdminUploader({ 
  playlists, 
  songs, 
  onRefreshData, 
  user, 
  genres 
}: AdminUploaderProps) {
  
  const [activeTab, setActiveTab] = useState<AdminTab>('songs');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal controllers
  const [selectedSongToEdit, setSelectedSongToEdit] = useState<Song | null>(null);
  const [selectedSongForPPT, setSelectedSongForPPT] = useState<Song | null>(null);

  // Pagination states
  const [songPage, setSongPage] = useState(1);
  const songsPerPage = 8;

  // Add Song Form states
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newArtist, setNewArtist] = useState('');
  const [newAlbum, setNewAlbum] = useState('');
  const [newGenre, setNewGenre] = useState('');
  const [newDuration, setNewDuration] = useState('3:30');
  const [newRawLyrics, setNewRawLyrics] = useState('');
  const [newRawLyricsHindi, setNewRawLyricsHindi] = useState('');
  const [newYoutubeUrl, setNewYoutubeUrl] = useState('');
  const [newCoverUrl, setNewCoverUrl] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // States for dynamic AI tools inside Add Song dialog
  const [activeUploadLangTab, setActiveUploadLangTab] = useState<'english' | 'hindi'>('english');
  const [isBeautifyingUpload, setIsBeautifyingUpload] = useState(false);
  const [isCorrectingUpload, setIsCorrectingUpload] = useState(false);
  const [isTranslatingUpload, setIsTranslatingUpload] = useState(false);
  const [isGeneratingCoverUpload, setIsGeneratingCoverUpload] = useState(false);

  // Create Playlist states
  const [isAddPlaylistOpen, setIsAddPlaylistOpen] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const [playlistDesc, setPlaylistDesc] = useState('');
  const [playlistCover, setPlaylistCover] = useState('');
  const [playlistSelectedSongs, setPlaylistSelectedSongs] = useState<string[]>([]);

  // Category mapping tracker
  const songsCountByCategory = React.useMemo(() => {
    const counts: Record<string, number> = {};
    songs.forEach(song => {
      counts[song.genre] = (counts[song.genre] || 0) + 1;
    });
    return counts;
  }, [songs]);

  // Handle saving editing songs back to Firestore Doc 
  const handleEditSave = async (id: string, updatedFields: Partial<Song>) => {
    try {
      await updateDoc(doc(db, "songs", id), updatedFields).catch((err) => {
        handleFirestoreError(err, OperationType.UPDATE, `songs/${id}`);
      });
      alert('Lyric sheet updated successfully inside Firestore!');
      onRefreshData();
    } catch (e: any) {
      alert('Failed saving changes to database: ' + e.message);
    }
  };

  // Handle approving pending items 
  const handleApproveSong = async (id: string) => {
    try {
      await updateDoc(doc(db, "songs", id), { status: 'approved' }).catch((err) => {
        handleFirestoreError(err, OperationType.UPDATE, `songs/${id}`);
      });
      onRefreshData();
    } catch (e: any) {
      alert('Approval failed: ' + e.message);
    }
  };

  // Handle deletion of song doc
  const handleDeleteSong = async (id: string, title: string) => {
    if (window.confirm(`Are you absolutely sure you want to permanently delete the song "${title}" from the database?`)) {
      try {
        await deleteDoc(doc(db, "songs", id)).catch((err) => {
          handleFirestoreError(err, OperationType.DELETE, `songs/${id}`);
        });
        onRefreshData();
      } catch (e: any) {
        alert('Deletion failed: ' + e.message);
      }
    }
  };

  // Create a song doc directly from admin dashboard
  const handleCreateSong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newArtist.trim() || !newRawLyrics.trim()) {
      alert('Song Title, Artist, and Lyrics body are required.');
      return;
    }

    setLoading(true);
    setStatusMsg('');

    try {
      const parsedLyrics = parseRawLyrics(newRawLyrics);
      const songId = `song-${Date.now()}`;
      
      let resolvedCover = newCoverUrl.trim();
      if (!resolvedCover) {
        try {
          const coverRes = await fetch("/api/gemini/generate-cover", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: newTitle.trim(), artist: newArtist.trim(), genre: newGenre })
          });
          if (coverRes.ok) {
            const coverData = await coverRes.json();
            if (coverData.success && coverData.url) {
              resolvedCover = coverData.url;
            }
          }
        } catch (coverErr) {
          console.warn("AI cover fetch failed, fallback to default unsplash asset:", coverErr);
        }
      }
      if (!resolvedCover) {
        resolvedCover = "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=400&q=80";
      }

      const parsedLyricsHindi = newRawLyricsHindi.trim() ? parseRawLyrics(newRawLyricsHindi) : [];

      const payload: Song = {
        id: songId,
        title: newTitle.trim(),
        artist: newArtist.trim(),
        album: newAlbum.trim() || undefined,
        genre: newGenre || 'Contemporary',
        duration: newDuration.trim(),
        rawLyrics: newRawLyrics,
        formattedLyrics: parsedLyrics,
        rawLyricsHindi: newRawLyricsHindi.trim() || undefined,
        formattedLyricsHindi: parsedLyricsHindi.length > 0 ? parsedLyricsHindi : undefined,
        youtubeUrl: newYoutubeUrl.trim() || undefined,
        coverUrl: resolvedCover,
        isFeatured: false
      };

      await setDoc(doc(db, "songs", songId), {
        ...payload,
        status: 'approved', // admins passmoderation desks automatically
        submittedBy: user?.email || 'admin',
        submittedByName: 'Dashboard Admin',
        createdAt: new Date().toISOString()
      }).catch((err) => {
        handleFirestoreError(err, OperationType.CREATE, `songs/${songId}`);
      });

      // Reset
      setNewTitle('');
      setNewArtist('');
      setNewAlbum('');
      setNewDuration('3:30');
      setNewRawLyrics('');
      setNewRawLyricsHindi('');
      setNewYoutubeUrl('');
      setNewCoverUrl('');
      setIsAddSongOpen(false);
      onRefreshData();
      alert('Awesome! Successfully registered and published lyrics!');
    } catch (err: any) {
      console.error(err);
      alert('Failed saving lyrics to database: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Create a playlist in Firestore
  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistName.trim()) {
      alert('Playlist title name is required.');
      return;
    }

    try {
      const playlistId = `playlist-${Date.now()}`;
      await setDoc(doc(db, "playlists", playlistId), {
        id: playlistId,
        name: playlistName.trim(),
        description: playlistDesc.trim(),
        coverUrl: playlistCover.trim() || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80",
        genre: 'Worship Mix',
        songIds: playlistSelectedSongs,
        status: 'approved',
        createdAt: new Date().toISOString()
      }).catch((err) => {
        handleFirestoreError(err, OperationType.CREATE, `playlists/${playlistId}`);
      });

      setPlaylistName('');
      setPlaylistDesc('');
      setPlaylistCover('');
      setPlaylistSelectedSongs([]);
      setIsAddPlaylistOpen(false);
      onRefreshData();
      alert('Dynamic Playlist established successfully!');
    } catch (err: any) {
      alert('Failed to establish playlist: ' + err.message);
    }
  };

  // Delete a playlist doc
  const handleDeletePlaylist = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this playlist?")) {
      try {
        await deleteDoc(doc(db, "playlists", id)).catch((err) => {
          handleFirestoreError(err, OperationType.DELETE, `playlists/${id}`);
        });
        onRefreshData();
      } catch (err: any) {
        alert("Deletion failed: " + err.message);
      }
    }
  };

  // Queries all songs (unlike explore, here we filter list in-memory to handle approved vs pending)
  const allFilteredSongs = songs.filter(s => {
    const q = searchQuery.toLowerCase();
    return s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q) || s.genre.toLowerCase().includes(q);
  });

  const approvedSongs = allFilteredSongs.filter(s => s.status !== 'pending');
  const pendingSongs = songs.filter(s => s.status === 'pending');

  // Handle table pagination math
  const totalApprovedSongs = approvedSongs.length;
  const totalPages = Math.ceil(totalApprovedSongs / songsPerPage) || 1;
  const paginatedSongs = approvedSongs.slice((songPage - 1) * songsPerPage, songPage * songsPerPage);

  const tabs: { id: AdminTab; label: string; icon: any; color: string }[] = [
    { id: 'songs', label: 'Lyrics Desk', icon: Music, color: 'text-indigo-500 bg-indigo-50 border-indigo-100' },
    { id: 'playlists', label: 'Playlists Creator', icon: ListMusic, color: 'text-sky-500 bg-sky-50 border-sky-100' },
    { id: 'categories', label: 'Categories Hub', icon: Layers, color: 'text-emerald-500 bg-emerald-50 border-emerald-100' },
    { id: 'gdrive', label: 'GDrive Backups', icon: Cloud, color: 'text-amber-500 bg-amber-50 border-amber-100' },
    { id: 'fetcher', label: 'Lyrics Fetcher', icon: Sparkles, color: 'text-violet-500 bg-violet-50 border-violet-100' },
    { id: 'backup', label: 'Master Backup', icon: Database, color: 'text-rose-500 bg-rose-50 border-rose-100' }
  ];

  return (
    <div id="admin-uploader-panel" className="max-w-7xl mx-auto space-y-8 p-1 sm:p-4">
      
      {/* Tab bar header switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1 overflow-x-auto scroller-none py-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-4 py-3 text-xs font-semibold rounded-2xl border transition-all cursor-pointer select-none ${
                  isActive 
                    ? 'border-slate-300 text-slate-950 bg-white shadow-xs font-bold' 
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="text-xs font-mono text-slate-500 bg-slate-50 border border-slate-200/50 px-3 py-1.5 rounded-xl">
          Logged in as: <span className="font-bold text-slate-800">{user?.email}</span>
        </div>
      </div>

      {/* Main workspace container switch */}
      <div className="min-h-[400px]">
        
        {/* TAB 1: SONGS MANAGEMENT */}
        {activeTab === 'songs' && (
          <div className="space-y-6">
            
            {/* Moderate Pending desk (renders ONLY if pending submissions exist) */}
            {pendingSongs.length > 0 && (
              <div className="bg-amber-50/70 border border-amber-200 rounded-3xl p-6 space-y-4 shadow-xs">
                <div className="flex items-center gap-2 text-amber-700">
                  <div className="p-1.5 bg-amber-100 rounded-lg">
                    <Clock className="w-4 h-4 animate-spin" />
                  </div>
                  <h4 className="font-bold text-sm tracking-tight">Pending User Submissions ({pendingSongs.length})</h4>
                </div>
                <p className="text-amber-600 text-[11px] md:text-xs">
                  The following lyric sheets have been submitted by community users and require your approval to go live on the main directory wall.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingSongs.map((ps) => (
                    <div key={ps.id} className="bg-white border border-amber-200/60 rounded-2xl p-4 flex items-center justify-between gap-4">
                      <div className="space-y-1 truncate">
                        <p className="font-bold text-slate-900 text-sm truncate">{ps.title}</p>
                        <p className="text-xs text-slate-500 truncate">by {ps.artist} ({ps.genre})</p>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono flex-shrink-0">
                        <button
                          onClick={() => handleApproveSong(ps.id)}
                          className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[10px] font-bold shadow-xs transition cursor-pointer"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => setSelectedSongToEdit(ps)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-600 transition cursor-pointer"
                          title="Inspect and edit details"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteSong(ps.id, ps.title)}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-lg transition cursor-pointer"
                          title="Discard submission"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Approved songs index search and table */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
              
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-900 text-base md:text-lg tracking-tight">Active Lyric Directory</h3>
                  <p className="text-slate-500 text-xs">Search, pagination-cycle, present, or manage registered songs database.</p>
                </div>

                <div className="flex items-center gap-2 self-start md:self-center">
                  <button
                    onClick={() => setIsAddSongOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-2xl shadow-md transition cursor-pointer"
                  >
                    <PlusAndText text="Register Song" />
                  </button>
                </div>
              </div>

              {/* Filtering row */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search catalog directory (by title, artist, or tag)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200 focus:border-slate-400 rounded-xl outline-none transition"
                />
              </div>

              {/* Table list */}
              <div className="overflow-x-auto">
                <table className="w-full text-left font-sans text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-widest font-bold text-[9px] font-mono">
                      <th className="py-3 px-4">Song Details</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">YouTube Sync</th>
                      <th className="py-3 px-4 text-center">PowerPoint Slides</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {paginatedSongs.map((song) => (
                      <tr key={song.id} className="hover:bg-slate-50/70 transition">
                        {/* Title details */}
                        <td className="py-3 px-4 max-w-xs">
                          <div className="flex items-center gap-3">
                            <img 
                              src={song.coverUrl || "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=100&q=80"} 
                              alt="Thumbnail fallback" 
                              className="w-9 h-9 object-cover rounded-lg bg-slate-100 border border-slate-200/50 flex-shrink-0"
                              onError={(e) => {
                                (e.target as any).src = "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=100&q=80";
                              }}
                            />
                            <div className="truncate space-y-0.5">
                              <p className="font-bold text-slate-900 truncate text-[13px]">{song.title}</p>
                              <p className="text-slate-400 text-[10px] uppercase font-mono tracking-wider">{song.artist}</p>
                            </div>
                          </div>
                        </td>

                        {/* Category */}
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                          {song.genre}
                        </td>

                        {/* Video */}
                        <td className="py-3 px-4">
                          {song.youtubeUrl ? (
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full uppercase">
                              Active Loop
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px] font-mono italic">None Configured</span>
                          )}
                        </td>

                        {/* Presentation clicker */}
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => setSelectedSongForPPT(song)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/40 text-indigo-700 font-semibold font-mono text-[10px] uppercase rounded-xl transition cursor-pointer"
                          >
                            <Tv className="w-3.5 h-3.5" />
                            Slideshow Presentation
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1 font-mono">
                            <button
                              onClick={() => setSelectedSongToEdit(song)}
                              className="p-2 text-slate-500 hover:text-slate-950 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                              title="Edit lyric sheet"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSong(song.id, song.title)}
                              className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                              title="Permanently remove"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {paginatedSongs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 border-dashed border-2 border-slate-100 rounded-2xl text-center text-slate-400">
                          No matching songs discovered. Try mapping categories or resetting queries.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Custom table pagination controller row */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-100 pt-4 flex-wrap gap-2 text-xs font-semibold">
                  <span className="text-slate-500 font-mono">
                    Showing Page {songPage} of {totalPages} ({totalApprovedSongs} approved entries)
                  </span>
                  
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSongPage(p => Math.max(1, p - 1))}
                      disabled={songPage === 1}
                      className="p-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 disabled:opacity-40 rounded-xl transition cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-3.5 font-mono">{songPage}</span>
                    <button
                      onClick={() => setSongPage(p => Math.min(totalPages, p + 1))}
                      disabled={songPage === totalPages}
                      className="p-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 disabled:opacity-40 rounded-xl transition cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

            </div>

          </div>
        )}

        {/* TAB 2: PLAYLISTS CREATOR */}
        {activeTab === 'playlists' && (
          <div className="space-y-6">
            
            {/* Playlist dashboard card header */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-900 text-base md:text-lg tracking-tight">Dynamic Playlist established core</h3>
                  <p className="text-slate-500 text-xs text-[11px] sm:text-xs">Compile, structure and manage public play track orders of church hymns or concert blocks.</p>
                </div>

                <button
                  onClick={() => setIsAddPlaylistOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-2xl shadow-md transition cursor-pointer self-start"
                >
                  <PlusCircle className="w-4 h-4" />
                  Establish Playlist
                </button>
              </div>

              {/* Playlists visual list */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {playlists.map((play) => (
                  <div key={play.id} className="border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md transition bg-slate-50/50 flex flex-col justify-between">
                    <div>
                      <img 
                        src={play.coverUrl || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80"} 
                        alt="Playlist Cover preview" 
                        className="w-full h-36 object-cover bg-slate-200"
                        onError={(e) => {
                          (e.target as any).src = "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80";
                        }}
                      />
                      <div className="p-4 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-slate-900 text-sm tracking-tight truncate">{play.name}</h4>
                          <span className="text-[10px] font-mono font-bold bg-slate-100 border border-slate-200/60 text-slate-500 px-2 py-0.5 rounded uppercase flex-shrink-0">
                            {play.songIds?.length || 0} songs
                          </span>
                        </div>
                        <p className="text-slate-500 text-[11px] leading-relaxed line-clamp-2 min-h-[32px]">
                          {play.description || "Collection of select worship and community lyrics."}
                        </p>
                      </div>
                    </div>

                    <div className="p-4 border-t border-slate-200/60 bg-white flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-mono">ID: {play.id}</span>
                      <button
                        onClick={() => handleDeletePlaylist(play.id)}
                        className="p-1.5 text-xs font-semibold text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 hover:border-rose-600 rounded-xl transition cursor-pointer"
                        title="Delete this order block"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {playlists.length === 0 && (
                  <div className="col-span-full py-12 p-6 rounded-2xl bg-slate-50 border border-slate-250 border-dashed text-slate-400 text-center flex flex-col items-center justify-center">
                    <ListMusic className="w-8 h-8 text-slate-350 mb-2" />
                    <p className="font-semibold text-xs">No Playlists Created</p>
                    <p className="text-[10px] mt-1 max-w-sm">Create a playlist pack using the dashboard button above.</p>
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* TAB 3: CATEGORIES MANAGER */}
        {activeTab === 'categories' && (
          <CategoryManager 
            genres={genres} 
            songsCountByCategory={songsCountByCategory} 
          />
        )}

        {/* TAB 4: GOOGLE DRIVE BACKUPS */}
        {activeTab === 'gdrive' && (
          <DriveSync 
            songs={songs} 
            playlists={playlists} 
            onRefreshData={onRefreshData} 
          />
        )}

        {/* TAB 5: AI LYRICS FETCHER */}
        {activeTab === 'fetcher' && (
          <LyricsFetcher 
            genres={genres}
            onRefreshData={onRefreshData}
            user={user}
          />
        )}

        {/* TAB 6: MASTER BACKUP IMPORT/EXPORT */}
        {activeTab === 'backup' && (
          <MasterBackupManager 
            songs={songs}
            playlists={playlists}
            onRefreshData={onRefreshData}
          />
        )}

      </div>

      {/* CREATE SONG MODAL SHEET */}
      <AnimatePresence>
        {isAddSongOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <PlusCircle className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-base md:text-lg font-bold text-slate-900 tracking-tight">Publish New Lyrics</h3>
                    <p className="text-[11px] text-slate-400 font-mono">Bypasses moderation desk and registers immediately</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddSongOpen(false)}
                  className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSong} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">Song Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Amazing Grace"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl outline-none transition"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">Artist / Composer</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Newton"
                      value={newArtist}
                      onChange={(e) => setNewArtist(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl outline-none transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">Album</label>
                    <input
                      type="text"
                      placeholder="e.g. Hymns Vol. 1"
                      value={newAlbum}
                      onChange={(e) => setNewAlbum(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl outline-none transition"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">Category</label>
                    <select
                      value={newGenre}
                      onChange={(e) => setNewGenre(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl outline-none transition cursor-pointer"
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
                </div>

                {/* Dual-Language Lyrics Entry with AI tools inside Admin Upload */}
                <div className="space-y-3 pt-2">
                  <div className="flex border-b border-slate-100 pb-1 flex-shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveUploadLangTab('english')}
                      className={`px-4 py-2 text-xs font-bold transition-all uppercase flex items-center gap-1.5 border-b-2 cursor-pointer ${
                        activeUploadLangTab === 'english'
                          ? 'border-indigo-600 text-indigo-705 font-black'
                          : 'border-transparent text-slate-400 hover:text-slate-650'
                      }`}
                    >
                      🇬🇧 English Source
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveUploadLangTab('hindi')}
                      className={`px-4 py-2 text-xs font-bold transition-all uppercase flex items-center gap-1.5 border-b-2 cursor-pointer ${
                        activeUploadLangTab === 'hindi'
                          ? 'border-rose-600 text-rose-750 font-black'
                          : 'border-transparent text-slate-400 hover:text-slate-650'
                      }`}
                    >
                      🇮🇳 Hindi Translation
                    </button>
                  </div>

                  {activeUploadLangTab === 'english' ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <label className="text-[10px] font-mono font-bold text-slate-450 uppercase tracking-wider block">
                          English Text Body *
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={async () => {
                              if (!newRawLyrics.trim()) return;
                              setIsBeautifyingUpload(true);
                              try {
                                const response = await fetch('/api/gemini/beautify', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    rawLyrics: newRawLyrics,
                                    songInfo: { title: newTitle, artist: newArtist }
                                  })
                                });
                                const data = await response.json();
                                if (data.success && data.formattedText) {
                                  setNewRawLyrics(data.formattedText);
                                }
                              } catch (e) {
                                console.error(e);
                              } finally {
                                setIsBeautifyingUpload(false);
                              }
                            }}
                            disabled={isBeautifyingUpload || !newRawLyrics.trim()}
                            className="p-1 px-2.5 bg-teal-50 hover:bg-teal-100 text-teal-700 text-[9px] font-sans font-bold uppercase rounded-lg border border-teal-200 tracking-wider flex items-center gap-1 transition cursor-pointer"
                          >
                            {isBeautifyingUpload ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Wand2 className="w-2.5 h-2.5" />}
                            AI Beautify
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              if (!newRawLyrics.trim()) return;
                              setIsCorrectingUpload(true);
                              try {
                                const response = await fetch('/api/gemini/correct', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    rawLyrics: newRawLyrics,
                                    songInfo: { title: newTitle, artist: newArtist }
                                  })
                                });
                                const data = await response.json();
                                if (data.success && data.formattedText) {
                                  setNewRawLyrics(data.formattedText);
                                }
                              } catch (e) {
                                console.error(e);
                              } finally {
                                setIsCorrectingUpload(false);
                              }
                            }}
                            disabled={isCorrectingUpload || !newRawLyrics.trim()}
                            className="p-1 px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-[9px] font-sans font-bold uppercase rounded-lg border border-amber-200 tracking-wider flex items-center gap-1 transition cursor-pointer"
                          >
                            {isCorrectingUpload ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Sparkles className="w-2.5 h-2.5" />}
                            AI Correct
                          </button>
                        </div>
                      </div>
                      <textarea
                        required
                        placeholder="Paste English song lyrics paragraphs. Double line breaks denote stanzas."
                        value={newRawLyrics}
                        onChange={(e) => setNewRawLyrics(e.target.value)}
                        rows={6}
                        className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-2xl outline-none transition resize-y leading-relaxed min-h-[140px]"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <label className="text-[10px] font-mono font-bold text-slate-450 uppercase tracking-wider block">
                          Hindi Devanagari Lyrics
                        </label>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!newRawLyrics.trim()) {
                              alert("Please fill out the English source lyrics first!");
                              return;
                            }
                            setIsTranslatingUpload(true);
                            try {
                              const res = await fetch("/api/gemini/translate", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  rawLyrics: newRawLyrics,
                                  songInfo: { title: newTitle, artist: newArtist }
                                })
                              });
                              if (res.ok) {
                                const data = await res.json();
                                if (data.success && data.formattedText) {
                                  setNewRawLyricsHindi(data.formattedText);
                                }
                              }
                            } catch (err) {
                              console.error(err);
                            } finally {
                              setIsTranslatingUpload(false);
                            }
                          }}
                          disabled={isTranslatingUpload || !newRawLyrics.trim()}
                          className="p-1 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[9px] font-sans font-bold uppercase rounded-lg border border-rose-200 tracking-wider flex items-center gap-1 transition cursor-pointer"
                        >
                          {isTranslatingUpload ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Sparkles className="w-2.5 h-2.5" />}
                          AI Translate Hindi
                        </button>
                      </div>
                      <textarea
                        placeholder="Provide Devanagari lyrics or trigger 'AI Translate' helper above to convert dynamically..."
                        value={newRawLyricsHindi}
                        onChange={(e) => setNewRawLyricsHindi(e.target.value)}
                        rows={6}
                        className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-2xl outline-none transition resize-y leading-relaxed min-h-[140px]"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">Media Link (Optional)</label>
                      <input
                        type="url"
                        placeholder="e.g. https://youtube.com/watch?v=..."
                        value={newYoutubeUrl}
                        onChange={(e) => setNewYoutubeUrl(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl outline-none transition"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">Cover Art URL (Optional)</label>
                      <input
                        type="text"
                        placeholder="Paste image URL, or leave blank for AI Auto Art"
                        value={newCoverUrl}
                        onChange={(e) => setNewCoverUrl(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl outline-none transition text-ellipsis"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsAddSongOpen(false)}
                    className="px-5 py-2 text-xs font-semibold hover:bg-slate-100 border border-transparent hover:border-slate-200 rounded-xl text-slate-500 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-55 rounded-xl shadow-md transition"
                  >
                    {loading ? 'Publishing...' : 'Publish Lyrics'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CREATE PLAYLIST MODAL SHEET */}
      <AnimatePresence>
        {isAddPlaylistOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <ListMusic className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 tracking-tight">Create Worship Playlist</h3>
                    <p className="text-slate-400 text-[10px] font-mono">Bundle lyric sheets into visual play tracks</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddPlaylistOpen(false)}
                  className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreatePlaylist} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">Playlist Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sunday Morning Service"
                    value={playlistName}
                    onChange={(e) => setPlaylistName(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">Descriptor Summary</label>
                  <textarea
                    placeholder="Worship order block list sequence."
                    value={playlistDesc}
                    onChange={(e) => setPlaylistDesc(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl outline-none transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">Cover Photo URL (Optional)</label>
                  <input
                    type="text"
                    placeholder="Paste public unsplash image URL..."
                    value={playlistCover}
                    onChange={(e) => setPlaylistCover(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl outline-none"
                  />
                </div>

                {/* Song list selector checkboxes */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">Select Songs to Include</label>
                  <div className="max-h-[140px] overflow-y-auto border border-slate-200 rounded-2xl bg-slate-50/50 p-2.5 space-y-1">
                    {songs.filter(s => s.status !== 'pending').map(song => (
                      <div key={song.id} className="flex items-center gap-2 bg-white border border-slate-200/50 p-2 rounded-xl text-xs hover:bg-slate-50/50 transition">
                        <input
                          type="checkbox"
                          id={`pl-song-${song.id}`}
                          checked={playlistSelectedSongs.includes(song.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPlaylistSelectedSongs(prev => [...prev, song.id]);
                            } else {
                              setPlaylistSelectedSongs(prev => prev.filter(id => id !== song.id));
                            }
                          }}
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                        />
                        <label htmlFor={`pl-song-${song.id}`} className="truncate max-w-[250px] font-semibold text-slate-700 cursor-pointer flex items-center justify-between flex-1">
                          <span>{song.title}</span>
                          <span className="text-[10px] font-mono font-medium text-slate-400">{song.artist}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsAddPlaylistOpen(false)}
                    className="px-5 py-2 text-xs font-semibold border border-transparent hover:border-slate-200 hover:bg-slate-100 text-slate-500 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl shadow-md transition"
                  >
                    Create Playlist
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DYNAMIC EDIT SONG MODAL PANEL */}
      <AnimatePresence>
        {selectedSongToEdit && (
          <SongEditorModal 
            song={selectedSongToEdit} 
            genres={genres} 
            onClose={() => setSelectedSongToEdit(null)} 
            onSave={handleEditSave} 
          />
        )}
      </AnimatePresence>

      {/* DYNAMIC PPT COMPRESSED SLIDESHOW VIEW */}
      <AnimatePresence>
        {selectedSongForPPT && (
          <PPTGenerator 
            song={selectedSongForPPT} 
            onClose={() => setSelectedSongForPPT(null)} 
          />
        )}
      </AnimatePresence>

    </div>
  );
}

// Subordinate pure components
function PlusAndText({ text }: { text: string }) {
  return (
    <>
      <Plus className="w-4 h-4 font-bold" />
      <span>{text}</span>
    </>
  );
}
