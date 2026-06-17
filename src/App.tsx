import React, { useState, useEffect } from 'react';
import { Song, Playlist } from './types';
import PlaylistListView from './components/PlaylistListView';
import SongLyricsView from './components/SongLyricsView';
import AdminUploader from './components/AdminUploader';
import { 
  Music, Eye, Search, Sparkles, Sliders, Headphones, 
  Flame, CheckCircle, Disc, Info, ChevronRight, HelpCircle
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

  // Fetch songs and playlists from fullstack database Express endpoints
  const loadData = async () => {
    try {
      const songsRes = await fetch('/api/songs');
      const playlistsRes = await fetch('/api/playlists');
      if (songsRes.ok && playlistsRes.ok) {
        const sData = await songsRes.json();
        const pData = await playlistsRes.json();
        setSongs(sData);
        setPlaylists(pData);
      }
    } catch (err) {
      console.error('Error synchronizing database content state:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

          {/* Minimal Status or back buttons based on routing */}
          <div>
            {activeTab === 'admin' ? (
              <button
                onClick={() => navigateTo('explore')}
                className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all cursor-pointer"
              >
                ← Back to Catalog
              </button>
            ) : (
              <span className="text-[10px] items-center font-mono text-slate-400 bg-slate-100 border border-slate-200/80 px-2.5 py-1 rounded-full uppercase hidden sm:flex gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                {songs.length} Tracks Live
              </span>
            )}
          </div>
        </div>
      </header>

      {/* CORE BODY CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 py-8 md:px-8 space-y-8" id="application-body">
        {loading ? (
          <div className="text-center py-24 font-mono text-xs text-slate-400 space-y-3 flex flex-col items-center">
            <Disc className="w-6 h-6 text-rose-500 animate-spin" />
            <span>Loading lyrics repository...</span>
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
                        className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white outline-none rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-800 font-mono placeholder:text-slate-400/90 transition-all"
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
                      <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl text-xs text-slate-500 font-mono space-y-2">
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
                                <div className="w-11 h-11 rounded-lg bg-slate-100 overflow-hidden border border-slate-200 flex-shrink-0">
                                  <img
                                    referrerPolicy="no-referrer"
                                    src={song.coverUrl || 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=600&auto=format&fit=crop'}
                                    alt={song.title}
                                    className="w-full h-full object-cover"
                                  />
                                </div>

                                <div className="flex-grow min-w-0">
                                  <div className="flex justify-between items-start gap-2">
                                    <h4 className="font-bold text-sm text-slate-900 truncate hover:text-rose-600 font-sans transition-colors">
                                      {song.title}
                                    </h4>
                                    <span className="text-[9px] bg-slate-100 font-mono text-slate-500 px-1.5 py-0.5 rounded uppercase border border-slate-200">
                                      {song.genre}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-500 truncate mt-0.5">{song.artist}</p>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-t border-slate-100 pt-3 mt-3">
                                <span className="flex items-center gap-1.5">
                                  <Flame className="w-3.5 h-3.5 text-orange-500" />
                                  Ready to view
                                </span>
                                <div className="flex items-center gap-2">
                                  {song.youtubeUrl && (
                                    <span className="text-red-600 bg-red-50 px-1.5 py-0.5 border border-red-200/50 rounded text-[8px] font-bold">
                                      MEDIA
                                    </span>
                                  )}
                                  <span className="text-slate-600 font-bold flex items-center gap-0.5">
                                    Open lyrics <ChevronRight className="w-3 h-3" />
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
                  onRefreshData={loadData}
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
          <p className="text-[10px] text-slate-400 max-w-lg mx-auto leading-relaxed">
            Beautifully structured typography rendering engine with responsive scaling control and quick WordPress publish capabilities.
          </p>
          <div className="pt-2">
            <button
              onClick={() => navigateTo('admin')}
              className="text-[10px] text-slate-400 hover:text-rose-500 hover:underline transition-colors cursor-pointer border-none bg-none outline-none"
            >
              Access Admin Workspace
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
