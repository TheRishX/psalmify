import React, { useState } from 'react';
import { Playlist, Song } from '../types';
import { Disc, Music, Headphones, ChevronRight, Eye } from 'lucide-react';
import { motion } from 'motion/react';

interface PlaylistListViewProps {
  playlists: Playlist[];
  songs: Song[];
  onSelectSong: (songId: string) => void;
}

export default function PlaylistListView({ playlists, songs, onSelectSong }: PlaylistListViewProps) {
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

  const handlePlaylistClick = (id: string) => {
    setSelectedPlaylistId(selectedPlaylistId === id ? null : id);
  };

  const getSongsForPlaylist = (playlist: Playlist) => {
    return songs.filter(s => playlist.songIds.includes(s.id));
  };

  return (
    <div className="space-y-6" id="playlist-section">
      {/* Playlists Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
              <Headphones className="w-5 h-5 text-slate-900" id="headphones-icon" />
              Worship Hymnal Collections
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Curated lyric bundles compiled for specific congregations, services, and tempos.
            </p>
          </div>
          <span className="text-[10px] bg-slate-100 px-2.5 py-1 rounded-full text-slate-500 border border-slate-200 font-mono">
            {playlists.length} Lists
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {playlists.map((playlist) => {
            const plistSongs = getSongsForPlaylist(playlist);
            const isSelected = selectedPlaylistId === playlist.id;

            return (
              <motion.div
                key={playlist.id}
                id={`playlist-card-${playlist.id}`}
                whileHover={{ y: -1.5 }}
                onClick={() => handlePlaylistClick(playlist.id)}
                className={`relative overflow-hidden rounded-xl border cursor-pointer transition-all duration-200 shadow-sm ${
                  isSelected 
                    ? 'bg-slate-50 border-slate-900 ring-1 ring-slate-950/10' 
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Playlist Cover Art with Gradient Overlay */}
                <div className="relative h-32 w-full bg-slate-100 overflow-hidden border-b border-slate-100">
                  <img
                    referrerPolicy="no-referrer"
                    src={playlist.coverUrl || 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=650&auto=format&fit=crop'}
                    alt={playlist.name}
                    className="w-full h-full object-cover opacity-80"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent opacity-90" />
                  
                  {/* Genre Tag */}
                  <span className="absolute top-3 right-3 text-[9px] font-mono font-bold tracking-wider uppercase bg-slate-900/10 text-slate-800 px-2 py-0.5 rounded border border-slate-900/10 backdrop-blur-sm">
                    {playlist.genre}
                  </span>
                </div>

                <div className="p-4 space-y-2">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
                      {playlist.name}
                    </h3>
                    <p className="text-[10px] font-mono text-rose-600 font-bold tracking-wide mt-0.5">
                      {plistSongs.length} {plistSongs.length === 1 ? 'track' : 'tracks'} loaded
                    </p>
                  </div>

                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {playlist.description}
                  </p>

                  <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 font-mono">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Disc className="w-3 h-3 text-slate-300" />
                      PACK ID: {playlist.id.toUpperCase()}
                    </span>
                    <button className="text-[10px] font-bold text-slate-800 hover:text-slate-900 cursor-pointer flex items-center gap-0.5 transition-colors">
                      {isSelected ? 'Collapse' : 'View Tracks'}
                      <ChevronRight className={`w-3 h-3 transition-transform duration-250 ${isSelected ? 'rotate-90' : ''}`} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Selected Playlist Songs Drawer */}
      {selectedPlaylistId && (
        <motion.div
          id="playlist-tracks-drawer"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm"
        >
          {(() => {
            const playlist = playlists.find(p => p.id === selectedPlaylistId);
            if (!playlist) return null;
            const pSongs = getSongsForPlaylist(playlist);

            return (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                    <Music className="w-4 h-4 text-slate-700" />
                    Viewing Collections: <span className="text-slate-650 font-normal">&ldquo;{playlist.name}&rdquo;</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    Select any track below to view synced lyrics, adjust font sizes, and launch full-screen sing-along cards.
                  </p>
                </div>

                {pSongs.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs font-mono border border-dashed border-slate-200 rounded-xl bg-slate-50">
                    No tracks assigned to this bundle collection yet. Link tracks in the uploader.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {pSongs.map((song, idx) => (
                      <div
                        key={song.id}
                        id={`playlist-song-row-${song.id}`}
                        onClick={() => onSelectSong(song.id)}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 border border-slate-200/60 hover:bg-slate-50 hover:border-slate-300 cursor-pointer transition-all duration-150 group"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-slate-400 w-5 text-center">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <div className="w-8 h-8 rounded bg-slate-100 overflow-hidden border border-slate-200">
                            <img
                              referrerPolicy="no-referrer"
                              src={song.coverUrl || 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=600&auto=format&fit=crop'}
                              alt={song.title}
                              className="w-full h-full object-cover truncate"
                            />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-900 group-hover:text-rose-650 transition-colors">
                              {song.title}
                            </h4>
                            <p className="text-[11px] text-slate-500">
                              {song.artist} {song.album ? `• ${song.album}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <span className="text-[9px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 border border-slate-200 uppercase">
                            {song.genre}
                          </span>
                          <span className="text-xs font-mono text-slate-400">
                            {song.duration || '3:30'}
                          </span>
                          <span className="p-1.5 bg-white rounded-lg border border-slate-200 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Eye className="w-3.5 h-3.5 text-slate-700" />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </motion.div>
      )}
    </div>
  );
}
