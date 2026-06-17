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

  const genresList = ['All', 'Synthwave', 'Bluegrass', 'Lofi Pop', 'Indie Rock', 'Americana'];

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
    // Smooth scroll down to lyric display card if on mobile
    setTimeout(() => {
      document.getElementById('lyrics-sheet-card')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-[#f8f9fa] font-sans selection:bg-rose-500/35 selection:text-white" id="root-viewport">
      
      {/* Decorative Gradient Accents */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-rose-500/5 rounded-full filter blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] bg-amber-500/5 rounded-full filter blur-[150px] pointer-events-none" />

      {/* STUNNING HEADER NAVIGATION */}
      <header className="sticky top-0 z-40 bg-[#0f0f12]/90 backdrop-blur-md border-b border-white/10 px-4 py-4 md:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Logo & Headline */}
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => { setActiveSongId(null); setActiveTab('explore'); }}>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 p-0.5 flex items-center justify-center shadow-lg shadow-rose-500/15">
              <div className="w-full h-full rounded-2xl bg-[#0a0a0c] flex items-center justify-center">
                <Disc className="w-5 h-5 text-rose-500 rotate-slow animate-spin" style={{ animationDuration: '4s' }} />
              </div>
            </div>
            <div>
              <span className="text-base font-display font-black tracking-wider text-white uppercase flex items-center gap-1">
                AURA <span className="text-rose-500 font-light">Lyrics</span>
              </span>
              <p className="text-[9px] font-mono text-white/50 uppercase tracking-widest leading-none">
                SIMULATED PRODUCTION SERVER
              </p>
            </div>
          </div>

          {/* Nav Links Tabs */}
          <nav className="flex items-center gap-1.5 p-1 bg-white/5 rounded-2xl border border-white/10 font-mono text-xs">
            <button
              onClick={() => { setActiveTab('explore'); setActiveSongId(null); }}
              className={`px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
                activeTab === 'explore' 
                  ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-slate-950 shadow-md shadow-rose-500/20' 
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              Public Lyrics Portal
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1 cursor-pointer ${
                activeTab === 'admin' 
                  ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-slate-950 shadow-md shadow-rose-500/20' 
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Admin Dashboard
            </button>
          </nav>
        </div>
      </header>

      {/* CORE BODY CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 py-8 md:px-8 space-y-8" id="application-body">
        {loading ? (
          <div className="text-center py-20 font-mono text-xs text-white/50 space-y-2 flex flex-col items-center">
            <Sliders className="w-8 h-8 text-rose-500 animate-pulse" />
            <span>Establishing secure local and simulated WordPress database handshakes...</span>
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
                className="space-y-12"
              >
                {/* HERO STATS OVERLAY BANNER */}
                <div className="bg-[#0f0f12] border border-white/10 rounded-3xl p-6 md:p-8 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
                  {/* Subtle red/blue glows inside cards like in the design */}
                  <div className="absolute inset-0 opacity-15 pointer-events-none overflow-hidden">
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-rose-500 blur-[80px] rounded-full"></div>
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500 blur-[80px] rounded-full"></div>
                  </div>
                  
                  <div className="space-y-2 flex-grow max-w-2xl text-center md:text-left relative z-10">
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold tracking-widest text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full uppercase border border-rose-500/20">
                      <Sparkles className="w-3 h-3 fill-current animate-pulse hover:rotate-45 transition" /> LIVE LYRIC DATA SOURCE
                    </span>
                    <h2 className="text-2xl md:text-4xl font-display font-bold text-white tracking-tight leading-slug">
                      Find Synced Song Verses & Curated Audiophile Playlists.
                    </h2>
                    <p className="text-xs md:text-sm text-white/60 leading-relaxed font-mono">
                      This catalog is maintained via our <span className="text-rose-400 font-bold hover:underline cursor-pointer" onClick={() => setActiveTab('admin')}>Smart Lyric Dashboard admin interface</span>. Live-syncing and layout previews available.
                    </p>
                  </div>

                  {/* Core metric stats */}
                  <div className="grid grid-cols-3 gap-6 text-center bg-[#070708] border border-white/10 p-4 rounded-2xl w-full md:w-auto font-mono min-w-[320px] relative z-10">
                    <div>
                      <div className="text-xl md:text-2xl font-black text-white">{songs.length}</div>
                      <span className="text-[8px] text-white/40 uppercase tracking-wider font-bold">Tracks Live</span>
                    </div>
                    <div className="border-x border-white/10">
                      <div className="text-xl md:text-2xl font-black text-rose-400">{playlists.length}</div>
                      <span className="text-[8px] text-white/40 uppercase tracking-wider font-bold">Playlists</span>
                    </div>
                    <div>
                      <div className="text-xl md:text-2xl font-black text-amber-500">201</div>
                      <span className="text-[8px] text-white/40 uppercase tracking-wider font-bold">WP Sync Ready</span>
                    </div>
                  </div>
                </div>

                {/* ACTIVE SONG LYRICS DISPLAY PANEL */}
                {activeSongId && (
                  <motion.div
                    key="active-lyrics-panel"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    id="focused-lyrics-pane"
                    className="pt-4 border-t border-white/10"
                  >
                    {(() => {
                      const activeSong = getActiveSong();
                      return activeSong ? (
                        <SongLyricsView
                          song={activeSong}
                          onBackToSearch={() => setActiveSongId(null)}
                        />
                      ) : (
                        <div className="text-center py-6 text-white/40 text-xs font-mono">Song catalog not synchronized.</div>
                      );
                    })()}
                  </motion.div>
                )}

                {/* BROWSE CATALOUGE LISTS GRID */}
                <div id="browse-lyrics-directory" className="space-y-6">
                  
                  {/* Public Finder Bar & Chip filtres */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0d0d10] p-4 border border-white/10 rounded-2xl">
                    <div className="relative flex-grow">
                      <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-white/40" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search songs, artists, or specific lyrics stanzas..."
                        className="w-full bg-white/5 border border-white/10 focus:border-rose-500/50 outline-none rounded-xl py-2.5 pl-10 pr-4 text-xs text-white font-mono placeholder:text-white/30"
                      />
                    </div>

                    {/* Chips finder block */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none max-w-full font-mono text-[10px]">
                      {genresList.map(genre => (
                        <button
                          key={genre}
                          onClick={() => setSelectedGenre(genre)}
                          className={`px-3 py-1 rounded-lg border font-bold transition-all duration-200 capitalize whitespace-nowrap cursor-pointer ${
                            selectedGenre === genre
                              ? 'bg-rose-500/10 border-rose-400 text-rose-400 shadow-md shadow-rose-500/5'
                              : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:border-white/20'
                          }`}
                        >
                          {genre}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Songs grid display */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-white/40 font-mono px-2">
                      <span>Available lyrics records ({filteredSongs.length})</span>
                      <span>Click track to open formatted previewer</span>
                    </div>

                     {filteredSongs.length === 0 ? (
                      <div className="text-center py-16 bg-[#0f0f12] border border-dashed border-white/10 rounded-3xl text-sm text-white/40 font-mono space-y-1">
                        <p>No songs match your search filters.</p>
                        <p className="text-xs text-white/20">Consider clearing terms or adding tracks via the uploader.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredSongs.map((song) => {
                          const numChoruses = song.formattedLyrics ? song.formattedLyrics.filter(s => s.type === 'chorus').length : 2;
                          const hasYoutube = !!song.youtubeUrl;

                          const isSelectedCard = activeSongId === song.id;

                          return (
                            <motion.div
                              key={song.id}
                              id={`song-discover-card-${song.id}`}
                              whileHover={{ y: -3, scale: 1.01 }}
                              onClick={() => handleSelectSongFromList(song.id)}
                              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                                isSelectedCard 
                                  ? 'bg-[#0f0f12] border-rose-500 shadow-lg shadow-rose-500/10' 
                                  : 'bg-[#0a0a0c]/80 border-white/10 hover:bg-[#0f0f12] hover:border-white/20'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                
                                {/* Track Cover Mini */}
                                <div className="w-12 h-12 rounded-xl bg-white/5 overflow-hidden border border-white/10 flex-shrink-0">
                                  <img
                                    referrerPolicy="no-referrer"
                                    src={song.coverUrl || 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=600&auto=format&fit=crop'}
                                    alt={song.title}
                                    className="w-full h-full object-cover"
                                  />
                                </div>

                                <div className="flex-grow min-w-0">
                                  <div className="flex justify-between items-start gap-2">
                                    <h4 className="font-bold text-sm text-white truncate hover:text-rose-400 font-sans transition-colors">
                                      {song.title}
                                    </h4>
                                    <span className="text-[9px] bg-white/5 font-mono text-white/50 px-1.5 py-0.5 rounded uppercase border border-white/10">
                                      {song.genre}
                                    </span>
                                  </div>
                                  <p className="text-xs text-white/60 truncate">{song.artist}</p>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[11px] font-mono text-white/40 border-t border-white/5 pt-3 mt-3">
                                <span className="flex items-center gap-1">
                                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                                  Chorus standard: {numChoruses} block{numChoruses === 1 ? '' : 's'}
                                </span>
                                <div className="flex items-center gap-2">
                                  {hasYoutube && (
                                    <span className="text-rose-400 bg-rose-400/5 px-2 py-0.5 border border-rose-500/20 rounded text-[9px] font-bold">
                                      MEDIA LINK
                                    </span>
                                  )}
                                  <span className="text-rose-400 font-bold flex items-center gap-0.5 transition-colors group-hover:text-rose-300">
                                    VIEW LYRICS <ChevronRight className="w-3.5 h-3.5" />
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

                {/* Playlists grid component integration */}
                <PlaylistListView
                  playlists={playlists}
                  songs={songs}
                  onSelectSong={handleSelectSongFromList}
                />
              </motion.div>
            )}

            {/* ADMIN SPLIT SCREEN WORKSPACE */}
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

      {/* FOOTER METRIC BRAND */}
      <footer className="border-t border-white/5 bg-[#070708] py-10 mt-16 text-center text-white/30 text-xs font-mono">
        <div className="max-w-7xl mx-auto px-4 space-y-4">
          <p className="tracking-tight text-white/50 uppercase">
            Aura • Smart Lyric Uploader Dashboard System v2.10
          </p>
          <div className="flex select-none flex-wrap justify-center gap-4 text-[10px] text-white/20">
            <span>WordPress REST API Integrations Checked</span>
            <span>•</span>
            <span>Formatted Paragraph Breakdown Engine Active</span>
            <span>•</span>
            <span>Tailwind CSS Inline Class compiler ready</span>
          </div>
          <p className="text-[10px] text-white/25">
            Simulated WordPress Sync Gateway binds client-side POST structures with remote JWT authorisations.
          </p>
        </div>
      </footer>
    </div>
  );
}
