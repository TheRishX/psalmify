import React, { useState, useEffect } from 'react';
import { Song, Playlist } from './types';
import PlaylistListView from './components/PlaylistListView';
import SongLyricsView from './components/SongLyricsView';
import AdminUploader from './components/AdminUploader';
import { auth, db, googleProvider, OperationType, handleFirestoreError } from './utils/firebase';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, getDocs, setDoc, doc, limit } from 'firebase/firestore';
import { parseRawLyrics } from './utils/lyricParser';
import { DEFAULT_SONGS, DEFAULT_PLAYLISTS } from './data/defaultData';
import { SubmitSongForm, SubmitPlaylistForm } from './components/SubmissionForms';
import { 
  Music, Eye, Search, Sparkles, Sliders, Headphones, 
  Flame, CheckCircle, Disc, Info, ChevronRight, HelpCircle,
  PlusCircle, User, LogOut, ArrowRight, ShieldAlert, BadgeInfo,
  Calendar, Layers, CheckCircle2, ChevronDown, ListPlus, X, ShieldAlert as AdminIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'explore' | 'admin'>('explore');
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Public search filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [activeSongId, setActiveSongId] = useState<string | null>(null);

  // Authentication State
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Authentication troubleshoot state
  const [authError, setAuthError] = useState<{ code: string; message: string; domain: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Community Submissions Modal Trigger State
  const [isSubmissionModalOpen, setIsSubmissionModalOpen] = useState(false);
  const [submissionType, setSubmissionType] = useState<'song' | 'playlist'>('song');

  // Monitor location path name to handle url changes (/admin and back)
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      const searchParams = new URLSearchParams(window.location.search);
      
      if (
        path.startsWith('/admin') ||
        hash.includes('admin') ||
        searchParams.get('tab') === 'admin' ||
        searchParams.get('admin') === 'true'
      ) {
        setActiveTab('admin');
      } else {
        setActiveTab('explore');
      }
    };
    
    // Check initially
    handleLocationChange();

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const navigateTo = (tab: 'explore' | 'admin') => {
    const targetPath = tab === 'admin' ? '/?tab=admin#admin' : '/';
    window.history.pushState(null, '', targetPath);
    setActiveTab(tab);
    window.dispatchEvent(new Event('popstate'));
  };

  // Listen to Auth State changes on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Real-time snapshot synchronized listeners
  useEffect(() => {
    // Listen to songs real-time snapshot (extracting approved catalog)
    const qSongs = query(collection(db, "songs"), where("status", "==", "approved"));
    const unsubSongs = onSnapshot(qSongs, (snapshot) => {
      const list: Song[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Song);
      });
      setSongs(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "songs");
    });

    // Listen to playlists real-time snapshot (extracting approved playlists)
    const qPlaylists = query(collection(db, "playlists"), where("status", "==", "approved"));
    const unsubPlaylists = onSnapshot(qPlaylists, (snapshot) => {
      const list: Playlist[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Playlist);
      });
      setPlaylists(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "playlists");
    });

    return () => {
      unsubSongs();
      unsubPlaylists();
    };
  }, []);

  // Seeder trigger on empty Firestore instance: only runs if a user is authenticated (to permit writes)
  useEffect(() => {
    if (!user) return;

    const checkAndSeed = async () => {
      try {
        const q = query(collection(db, "songs"), limit(1));
        const snap = await getDocs(q).catch((error) => {
          handleFirestoreError(error, OperationType.GET, "songs");
        });
        if (snap && snap.empty) {
          console.log("Firestore collection empty. Initializing automatic database seed...");
          
          for (const s of DEFAULT_SONGS) {
            const parsed = parseRawLyrics(s.rawLyrics);
            try {
              await setDoc(doc(db, "songs", s.id), {
                ...s,
                formattedLyrics: parsed,
                status: 'approved',
                submittedBy: 'system',
                submittedByName: 'System Seed',
                createdAt: new Date().toISOString()
              });
            } catch (error) {
              handleFirestoreError(error, OperationType.CREATE, `songs/${s.id}`);
            }
          }

          for (const p of DEFAULT_PLAYLISTS) {
            try {
              await setDoc(doc(db, "playlists", p.id), {
                ...p,
                status: 'approved',
                submittedBy: 'system',
                submittedByName: 'System Seed',
                createdAt: new Date().toISOString()
              });
            } catch (error) {
              handleFirestoreError(error, OperationType.CREATE, `playlists/${p.id}`);
            }
          }
          console.log("Seeding process succeeded flawlessly.");
        }
      } catch (err) {
        console.error("Critical Firestore seed error:", err);
      }
    };

    checkAndSeed();
  }, [user]);

  // Manual fallback reload trigger
  const triggerReloadData = async () => {
    setLoading(true);
    try {
      const snapSongs = await getDocs(query(collection(db, "songs"), where("status", "==", "approved"))).catch((error) => {
        handleFirestoreError(error, OperationType.LIST, "songs");
      });
      const snapPlaylists = await getDocs(query(collection(db, "playlists"), where("status", "==", "approved"))).catch((error) => {
        handleFirestoreError(error, OperationType.LIST, "playlists");
      });
      
      const sList: Song[] = [];
      if (snapSongs) {
        snapSongs.forEach(docSnap => {
          sList.push({ id: docSnap.id, ...docSnap.data() } as Song);
        });
      }
      setSongs(sList);

      const pList: Playlist[] = [];
      if (snapPlaylists) {
        snapPlaylists.forEach(docSnap => {
          pList.push({ id: docSnap.id, ...docSnap.data() } as Playlist);
        });
      }
      setPlaylists(pList);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Google Sign-In helper method
  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (err: any) {
      console.error("Popup authentication rejected:", err?.message);
      if (err?.code === 'auth/unauthorized-domain' || err?.message?.includes('unauthorized-domain')) {
        setAuthError({
          code: err.code || 'auth/unauthorized-domain',
          message: err.message || '',
          domain: window.location.hostname
        });
      } else {
        alert("Authentication Handshake Failed: " + (err?.message || "Verify your connection or project setup in Google Cloud Console."));
      }
      return null;
    }
  };

  // Unified submission launcher guard
  const triggerSubmission = (type: 'song' | 'playlist') => {
    if (!user) {
      handleGoogleSignIn().then((loggedInUser) => {
        if (loggedInUser) {
          setSubmissionType(type);
          setIsSubmissionModalOpen(true);
        }
      });
    } else {
      setSubmissionType(type);
      setIsSubmissionModalOpen(true);
    }
  };

  const handleAdminWorkspaceClick = () => {
    if (!user) {
      handleGoogleSignIn().then((loggedInUser) => {
        if (loggedInUser) {
          navigateTo('admin');
        }
      });
    } else {
      navigateTo('admin');
    }
  };

  // Compute genre filter checklist dynamically
  const genresList = React.useMemo(() => {
    const unique = Array.from(new Set(songs.map(s => s.genre).filter(Boolean)));
    return ['All', ...unique];
  }, [songs]);

  // Handle live query filtration
  const filteredSongs = songs.filter(song => {
    const query = searchQuery.toLowerCase();
    const matchesQuery = 
      song.title.toLowerCase().includes(query) ||
      song.artist.toLowerCase().includes(query) ||
      song.rawLyrics.toLowerCase().includes(query) ||
      (song.album && song.album.toLowerCase().includes(query));

    const matchesGenre = selectedGenre === 'All' || song.genre === selectedGenre;

    return matchesQuery && matchesGenre;
  });

  const getActiveSong = () => {
    return songs.find(s => s.id === activeSongId);
  };

  const handleSelectSongFromList = (songId: string) => {
    setActiveSongId(songId);
    // Smooth scroll down to lyric display card
    setTimeout(() => {
      document.getElementById('lyrics-sheet-card')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const isAdmin = user?.email === 'therishx@gmail.com';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-rose-100 selection:text-rose-900" id="root-viewport">
      
      {/* HEADER: Public Minimalist Branding */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-4 md:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Logo & Headline */}
          <div 
            className="flex items-center gap-2.5 cursor-pointer select-none group" 
            onClick={() => { setActiveSongId(null); navigateTo('explore'); }}
          >
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white transition-transform group-hover:scale-105 shadow-sm">
              <Music className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-sm font-sans font-extrabold tracking-tight text-slate-900 uppercase flex items-center gap-1">
                Psalmify <span className="text-rose-600 font-normal lowercase tracking-normal">lyrics</span>
              </span>
              <p className="text-[10px] font-mono text-slate-400 tracking-wide uppercase leading-none mt-0.5">
                Praise & Worship Catalog
              </p>
            </div>
          </div>

          {/* User Sign-In block / Admin panel navigation */}
          <div className="flex items-center gap-3.5">
            {authLoading ? (
              <span className="w-4 h-4 rounded-full border-2 border-slate-100 border-t-slate-800 animate-spin" />
            ) : user ? (
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/80 rounded-xl p-1.5 pr-3">
                <div className="w-7 h-7 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0">
                  {user.photoURL ? (
                    <img 
                      referrerPolicy="no-referrer"
                      src={user.photoURL} 
                      alt="" 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="w-[100%] h-100 bg-rose-500 text-white flex items-center justify-center text-xs font-bold uppercase font-mono">
                      {user.email[0]}
                    </div>
                  )}
                </div>
                <div className="hidden sm:block text-left leading-none">
                  <span className="text-[10px] font-bold text-slate-900 flex items-center gap-1 leading-none">
                    {user.displayName || user.email.split('@')[0]}
                    {isAdmin && (
                      <span className="text-[8px] bg-emerald-500 text-slate-950 font-extrabold font-mono px-1 rounded uppercase">
                        Admin
                      </span>
                    )}
                  </span>
                  <p className="text-[8px] font-mono text-slate-400 mt-1 leading-none">{user.email}</p>
                </div>

                <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

                <button
                  onClick={() => signOut(auth)}
                  className="p-1 text-slate-400 hover:text-red-650 transition cursor-pointer"
                  title="Disconnect Workspace Session"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleGoogleSignIn}
                className="py-1.5 px-3.5 bg-slate-900 border border-slate-950 hover:bg-slate-850 text-white rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition cursor-pointer shadow-sm active:scale-[0.99]"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                <span>Google Sign-In</span>
              </button>
            )}

            {activeTab === 'admin' ? (
              <button
                onClick={() => navigateTo('explore')}
                className="px-3.5 py-2 rounded-xl text-xs font-mono font-bold text-slate-800 bg-white border border-slate-205 hover:bg-slate-50 transition-all cursor-pointer shadow-xs"
              >
                ← Public Catalogue
              </button>
            ) : (
              isAdmin && (
                <button
                  onClick={() => navigateTo('admin')}
                  className="px-3.5 py-2 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition whitespace-nowrap cursor-pointer shadow-xs"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                  <span>Admin Panel</span>
                </button>
              )
            )}
          </div>
        </div>
      </header>

      {/* CORE BODY CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 py-8 md:px-8 space-y-8" id="application-body">
        {loading ? (
          <div className="text-center py-24 font-mono text-xs text-slate-400 space-y-3 flex flex-col items-center">
            <Disc className="w-6 h-6 text-rose-500 animate-spin" />
            <span>Connecting to Cloud Realtime Firestore...</span>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            
            {/* PUBLIC EXPLORE VIEW */}
            {activeTab === 'explore' && (
              <motion.div
                key="tab-explore"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8 animate-fade-in"
              >
                
                {/* ACTIVE SONG LYRICS DISPLAY PANEL */}
                {activeSongId && (
                  <motion.div
                    key="active-lyrics-panel"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    id="focused-lyrics-pane"
                    className="pt-2"
                  >
                    {(() => {
                      const activeSong = getActiveSong();
                      return activeSong ? (
                        <SongLyricsView
                          song={activeSong}
                          onBackToSearch={() => setActiveSongId(null)}
                        />
                      ) : (
                        <div className="text-center py-6 text-slate-400 text-xs font-mono bg-white border border-slate-200 rounded-xl">
                          Song catalog is not synchronized.
                        </div>
                      );
                    })()}
                  </motion.div>
                )}

                {/* Community Submissions Callout banner */}
                <div className="bg-gradient-to-r from-rose-500/8 to-indigo-500/8 border border-rose-150 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xs relative overflow-hidden">
                  <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-rose-500/5 filter blur-2xl" />
                  <div className="absolute -bottom-12 -left-12 w-32 h-32 rounded-full bg-indigo-500/5 filter blur-2xl" />
                  
                  <div className="space-y-1.5 min-w-0 flex-grow text-center md:text-left">
                    <div className="flex items-center gap-2 justify-center md:justify-start">
                      <Sparkles className="w-4 h-4 text-rose-500 animate-pulse" />
                      <span className="text-[10px] font-mono tracking-widest text-rose-600 font-bold uppercase">Community Hymnal Desk</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">Share Your Favorite Worship Lyrics</h3>
                    <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
                      Submit new worship tracks or curated themed compilations. All proposals go instantly to review before posting live!
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 flex-wrap justify-center flex-shrink-0">
                    <button
                      onClick={() => triggerSubmission('song')}
                      className="py-2.5 px-4 bg-slate-900 border border-slate-950 hover:bg-slate-800 text-white rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition whitespace-nowrap cursor-pointer active:scale-98 shadow-sm"
                    >
                      <PlusCircle className="w-4 h-4 text-emerald-400" />
                      <span>Submit Track Lyrics</span>
                    </button>
                    <button
                      onClick={() => triggerSubmission('playlist')}
                      className="py-2.5 px-4 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition whitespace-nowrap cursor-pointer active:scale-98 shadow-sm"
                    >
                      <ListPlus className="w-4 h-4 text-rose-500" />
                      <span>Propose Playlist Theme</span>
                    </button>
                  </div>
                </div>

                {/* BROWSE CATALOUGE LISTS GRID */}
                <div id="browse-lyrics-directory" className="space-y-6">
                  
                  {/* Public Finder Bar & Chip filtres */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 border border-slate-200/80 rounded-2xl shadow-sm">
                    <div className="relative flex-grow">
                      <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search song titles, artists, or specific lyrics stanzas..."
                        className="w-full bg-slate-50 border border-slate-200/80 focus:border-slate-400 focus:bg-white outline-none rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-805 font-mono placeholder:text-slate-400/90 transition-all"
                      />
                    </div>

                    {/* Chips finder block */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none max-w-full font-mono text-[10px]">
                      {genresList.map(genre => (
                        <button
                          key={genre}
                          onClick={() => setSelectedGenre(genre)}
                          className={`px-3 py-1 rounded-lg border font-bold transition-all duration-150 capitalize whitespace-nowrap cursor-pointer ${
                            selectedGenre === genre
                              ? 'bg-slate-900 border-slate-950 text-white shadow-sm'
                              : 'bg-slate-100 border-slate-200/80 text-slate-500 hover:text-slate-900 hover:border-slate-300'
                          }`}
                        >
                          {genre}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Songs grid display */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-mono px-1">
                      <span>Available lyrics ({filteredSongs.length})</span>
                      <span>Select a track to view synced lyrics</span>
                    </div>

                    {filteredSongs.length === 0 ? (
                      <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl text-xs text-slate-500 font-mono space-y-2 relative">
                        <p className="font-bold">No tracks match your search queries.</p>
                        <p className="text-slate-400">Try testing different keywords or clear your active genre filters.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredSongs.map((song) => {
                          const isSelectedCard = activeSongId === song.id;

                          return (
                            <motion.div
                              key={song.id}
                              id={`song-discover-card-${song.id}`}
                              whileHover={{ y: -1.5 }}
                              onClick={() => handleSelectSongFromList(song.id)}
                              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                                isSelectedCard 
                                  ? 'bg-slate-50 border-rose-500 ring-1 ring-rose-500/20 shadow-sm' 
                                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                
                                {/* Track Cover Mini */}
                                <div className="w-11 h-11 rounded-lg bg-slate-100 overflow-hidden border border-slate-150 flex-shrink-0">
                                  <img
                                    referrerPolicy="no-referrer"
                                    src={song.coverUrl || 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=600&auto=format&fit=crop'}
                                    alt={song.title}
                                    className="w-full h-full object-cover"
                                  />
                                </div>

                                <div className="flex-grow min-w-0">
                                  <div className="flex justify-between items-start gap-2">
                                    <h4 className="font-bold text-sm text-slate-905 truncate hover:text-rose-650 font-sans transition-colors">
                                      {song.title}
                                    </h4>
                                    <span className="text-[9px] bg-slate-100 font-mono text-slate-550 px-1.5 py-0.5 rounded uppercase border border-slate-200">
                                      {song.genre}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-500 truncate mt-0.5">{song.artist}</p>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-t border-slate-100 pt-3 mt-3">
                                <span className="flex items-center gap-1.5">
                                  <Flame className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
                                  Ready to view
                                </span>
                                <div className="flex items-center gap-2">
                                  {song.youtubeUrl && (
                                    <span className="text-red-600 bg-red-50 px-1.5 py-0.5 border border-red-200/50 rounded text-[8px] font-bold">
                                      MEDIA
                                    </span>
                                  )}
                                  <span className="text-slate-700 font-bold flex items-center gap-0.5">
                                    Open lyrics <ChevronRight className="w-3 h-3 text-slate-500" />
                                  </span>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                </div>

                {/* Playlists integration */}
                <PlaylistListView
                  playlists={playlists}
                  songs={songs}
                  onSelectSong={handleSelectSongFromList}
                />
              </motion.div>
            )}

            {/* ADMIN WORKSPACE */}
            {activeTab === 'admin' && (
              <motion.div
                key="tab-admin"
                initial={{ opacity: 0, scale: 0.99 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.99 }}
              >
                <AdminUploader
                  playlists={playlists}
                  songs={songs}
                  onRefreshData={triggerReloadData}
                  user={user}
                  onAuthError={setAuthError}
                />
              </motion.div>
            )}

          </AnimatePresence>
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white py-12 mt-16 text-center text-slate-400 text-xs font-mono">
        <div className="max-w-7xl mx-auto px-4 space-y-3">
          <p className="tracking-wide text-slate-500 uppercase font-bold text-[11px]">
            Psalmify • Minimal Hymn & Lyric Directory
          </p>
          <p className="text-[10px] text-slate-405 max-w-lg mx-auto leading-relaxed">
            Beautifully structured typography rendering engine with responsive scaling control and quick WordPress publish capabilities.
          </p>
          <div className="pt-2">
            <button
              onClick={handleAdminWorkspaceClick}
              className="text-[10px] text-slate-400 hover:text-rose-500 hover:underline transition-colors cursor-pointer border-none bg-none outline-none font-bold"
            >
              Access Admin Workspace
            </button>
          </div>
        </div>
      </footer>

      {/* MODAL FOR USER LYRICS / PLAYLIST SUBMISSIONS */}
      <AnimatePresence>
        {isSubmissionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSubmissionModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />
            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 max-w-2xl w-full shadow-xl relative z-10"
              id="user-proposal-modal-card"
            >
              <button
                onClick={() => setIsSubmissionModalOpen(false)}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>

              {submissionType === 'song' ? (
                <SubmitSongForm
                  user={user}
                  onClose={() => setIsSubmissionModalOpen(false)}
                  onSuccess={() => {
                    setIsSubmissionModalOpen(false);
                    alert("Track lyrics submitted for moderation successfully! Thank you for your contribution!");
                  }}
                />
              ) : (
                <SubmitPlaylistForm
                  user={user}
                  songs={songs}
                  onClose={() => setIsSubmissionModalOpen(false)}
                  onSuccess={() => {
                    setIsSubmissionModalOpen(false);
                    alert("Playlist proposal submitted for review successfully! Perfect suggestion!");
                  }}
                />
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL FOR AUTH/UNAUTHORIZED-DOMAIN TROUBLESHOOTING */}
      <AnimatePresence>
        {authError && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id="auth-troubleshoot-gate">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAuthError(null)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs"
            />
            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative z-10 space-y-6 text-left"
              id="auth-troubleshoot-modal-card"
            >
              <button
                onClick={() => setAuthError(null)}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-start gap-4">
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-500 shadow-sm">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-sans font-black text-slate-900 tracking-tight">
                    Domain Authorization Required
                  </h3>
                  <p className="text-[10px] font-mono text-slate-400">
                    Error Code: auth/unauthorized-domain
                  </p>
                </div>
              </div>

              <div className="text-xs text-slate-500 space-y-3 leading-relaxed">
                <p>
                  Google Authentication has been rejected because this domain is not white-listed under the authorized domains list in your Firebase Configuration project.
                </p>
                
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Your Current Site Domain</span>
                  <div className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg p-2 font-mono text-xs text-slate-800">
                    <span className="truncate selection:bg-slate-100 select-all">{authError.domain}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(authError.domain);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="px-3 py-1.5 rounded-md bg-slate-900 text-white hover:bg-slate-800 text-[10px] font-bold font-sans cursor-pointer transition flex items-center gap-1.5 focus:outline-none"
                    >
                      {copied ? (
                        <>
                          <CheckCircle className="w-3 h-3" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <span>Copy</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Easy 3-Step Solution Guide</span>
                
                <ol className="text-xs text-slate-600 space-y-2.5 list-decimal pl-4 leading-relaxed font-sans">
                  <li>
                    Open your <a href="https://console.firebase.google.com/project/gen-lang-client-0356842658/authentication/providers" target="_blank" rel="noopener noreferrer" className="text-rose-500 hover:underline font-bold inline-flex items-center gap-0.5">Firebase Auth Console <ArrowRight className="w-3 h-3 inline" /></a>
                  </li>
                  <li>
                    Scroll down to the <strong className="text-slate-800 font-bold">Authorized Domains</strong> section near the bottom of that page.
                  </li>
                  <li>
                    Click <strong className="text-slate-800 font-bold">Add Domain</strong>, paste the copied domain string above, and hit <strong className="text-slate-800 font-bold">Add</strong>.
                  </li>
                </ol>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <p className="text-[10px] text-slate-400 leading-relaxed max-w-[280px]">
                  Requires configuration by the project owner in the Firebase Console admin panel. Once added, authentication resumes instantly.
                </p>
                <button
                  onClick={() => setAuthError(null)}
                  className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
