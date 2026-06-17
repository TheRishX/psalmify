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
    <div className="space-y-8" id="playlist-section">
      {/* Playlists Grid */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Headphones className="w-5 h-5 text-rose-500" id="headphones-icon" />
              Featured Vibe Playlists
            </h2>
            <p className="text-sm text-white/50 mt-1">
              Curated lyric libraries synchronized with dynamic themes and tempos.
            </p>
          </div>
          <span className="text-xs bg-white/5 px-2.5 py-1 rounded-full text-white/40 border border-white/10">
            {playlists.length} Curations
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {playlists.map((playlist) => {
            const plistSongs = getSongsForPlaylist(playlist);
            const isSelected = selectedPlaylistId === playlist.id;

            return (
              <motion.div
                key={playlist.id}
                id={`playlist-card-${playlist.id}`}
                whileHover={{ y: -4, scale: 1.01 }}
                onClick={() => handlePlaylistClick(playlist.id)}
                className={`relative overflow-hidden rounded-2xl border cursor-pointer transition-all duration-300 ${
                  isSelected 
                    ? 'bg-[#0f0f12] border-rose-500 shadow-lg shadow-rose-500/10' 
                    : 'bg-[#0a0a0c]/80 border-white/10 hover:border-white/20 hover:bg-[#0f0f12]/40'
                }`}
              >
                {/* Playlist Cover Art with Gradient Overlay */}
                <div className="relative h-44 w-full bg-[#0a0a0c] overflow-hidden">
                  <img
                    referrerPolicy="no-referrer"
                    src={playlist.coverUrl}
                    alt={playlist.name}
                    className="w-full h-full object-cover opacity-60 transition-transform duration-500 hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/40 to-transparent" />
                  
                  {/* Genre Tag */}
                  <span className="absolute top-3 right-3 text-[10px] font-bold tracking-wider uppercase bg-rose-500/15 text-rose-300 px-2 py-0.5 rounded border border-rose-500/30">
                    {playlist.genre}
                  </span>

                  <div className="absolute bottom-3 left-4 right-4">
                    <h3 className="font-bold text-lg text-white leading-snug tracking-tight drop-shadow-md">
                      {playlist.name}
                    </h3>
                    <p className="text-xs text-rose-400 font-medium tracking-wide">
                      {plistSongs.length} {plistSongs.length === 1 ? 'track' : 'tracks'} loaded
                    </p>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <p className="text-xs text-white/70 line-clamp-2 leading-relaxed">
                    {playlist.description}
                  </p>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                    <span className="text-white/40 flex items-center gap-1.5 font-mono">
                      <Disc className="w-3.5 h-3.5 animate-spin text-white/25" style={{ animationDuration: '6s' }} />
                      LYRIC PACK {playlist.id.toUpperCase()}
                    </span>
                    <button className="text-[11px] font-bold text-rose-400 hover:text-rose-300 cursor-pointer flex items-center gap-1 transition-colors">
                      {isSelected ? 'Collapse' : 'Explore Pack'}
                      <ChevronRight className={`w-3 h-3 transition-transform duration-300 ${isSelected ? 'rotate-90' : ''}`} />
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
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#0d0d10] border border-white/10 rounded-2xl p-6"
        >
          {(() => {
            const playlist = playlists.find(p => p.id === selectedPlaylistId);
            if (!playlist) return null;
            const pSongs = getSongsForPlaylist(playlist);

            return (
              <div>
                <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2 font-display">
                  <Music className="w-4 h-4 text-rose-400" />
                  Tracks inside: <span className="text-rose-400">{playlist.name}</span>
                </h3>
                <p className="text-xs text-white/50 mb-4 font-mono">
                  Select a song below to display its interactive lyrics sheet and simulated pitch tracker.
                </p>

                {pSongs.length === 0 ? (
                  <div className="text-center py-6 text-white/30 text-sm font-mono border border-dashed border-white/10 rounded-xl">
                    No songs assigned to this playlist yet. Edit songs in the admin panel to links!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pSongs.map((song, idx) => (
                      <div
                        key={song.id}
                        id={`playlist-song-row-${song.id}`}
                        onClick={() => onSelectSong(song.id)}
                        className="flex items-center justify-between p-3 rounded-xl bg-[#0a0a0c]/60 border border-white/5 hover:bg-white/5 hover:border-white/10 cursor-pointer transition-all duration-200 group"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-white/30 w-5">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#0a0a0c] border border-white/10">
                            <img
                              referrerPolicy="no-referrer"
                              src={song.coverUrl || 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=600&auto=format&fit=crop'}
                              alt={song.title}
                              className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-300"
                            />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-slate-150 group-hover:text-rose-400 transition-colors">
                              {song.title}
                            </h4>
                            <p className="text-xs text-white/50">
                              {song.artist} {song.album ? `• ${song.album}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <span className="text-xs font-mono bg-white/5 px-2 py-0.5 rounded text-white/70 border border-white/10">
                            {song.genre}
                          </span>
                          <span className="text-xs font-mono text-white/40">
                            {song.duration || '3:30'}
                          </span>
                          <span className="p-1.5 bg-white/5 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Eye className="w-3.5 h-3.5 text-rose-400" />
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
