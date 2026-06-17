import React, { useState, useEffect } from 'react';
import { Song, Playlist, FormattedSection } from '../types';
import { parseRawLyrics, buildHTMLFromSections } from '../utils/lyricParser';
import { 
  Key, Lock, Sparkles, FileText, Globe, RefreshCcw, Check, 
  AlertTriangle, Loader2, Save, Trash2, ListMusic as PlaylistIcon, Plus, Eye,
  Settings, LogOut, CheckCircle2, ChevronRight, Share2, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminUploaderProps {
  playlists: Playlist[];
  songs: Song[];
  onRefreshData: () => void;
}

export default function AdminUploader({ playlists, songs, onRefreshData }: AdminUploaderProps) {
  // Session Authentication state
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => {
    return typeof window !== 'undefined' && localStorage.getItem('isAdminLoggedIn') === 'true';
  });
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginError, setAdminLoginError] = useState('');

  // Song Form States
  const [selectedSongId, setSelectedSongId] = useState<string>('');
  const [songTitle, setSongTitle] = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [songAlbum, setSongAlbum] = useState('');
  const [songGenre, setSongGenre] = useState('Contemporary');
  const [songDuration, setSongDuration] = useState('3:45');
  const [songRawLyrics, setSongRawLyrics] = useState('');
  const [songCoverUrl, setSongCoverUrl] = useState('');
  const [songYoutubeUrl, setSongYoutubeUrl] = useState('');
  const [assignedPlaylists, setAssignedPlaylists] = useState<string[]>([]);

  // Simulated WordPress Integration credentials
  const [wpUsername, setWpUsername] = useState('admin');
  const [wpPassword, setWpPassword] = useState('Jesus@9664808@');
  const [wpToken, setWpToken] = useState<string>(() => {
    return (typeof window !== 'undefined' && localStorage.getItem('wpToken')) || '';
  });
  const [wpTokenExpiry, setWpTokenExpiry] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const expires = localStorage.getItem('wpTokenExpiry');
    return expires ? parseInt(expires, 10) : 0;
  });
  const [wpTokenTimeLeft, setWpTokenTimeLeft] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const expires = localStorage.getItem('wpTokenExpiry');
    if (!expires) return 0;
    return Math.max(0, Math.round((parseInt(expires, 10) - Date.now()) / 1000));
  });
  const [wpIsAuthenticating, setWpIsAuthenticating] = useState(false);
  const [wpAuthError, setWpAuthError] = useState('');

  // Real WordPress OAuth 2.0 States
  const [isRealWP, setIsRealWP] = useState<boolean>(() => {
    return typeof window !== 'undefined' && localStorage.getItem('isRealWP') === 'true';
  });
  const [wpBlogId, setWpBlogId] = useState<string>(() => {
    return (typeof window !== 'undefined' && localStorage.getItem('wpBlogId')) || '';
  });
  const [wpBlogUrl, setWpBlogUrl] = useState<string>(() => {
    return (typeof window !== 'undefined' && localStorage.getItem('wpBlogUrl')) || 'psalmify.wordpress.com';
  });
  const [wpMode, setWpMode] = useState<'live' | 'simulated'>(() => {
    return (typeof window !== 'undefined' && (localStorage.getItem('wpMode') as 'live' | 'simulated')) || 'simulated';
  });

  // Track state changes and keep localStorage updated
  useEffect(() => {
    localStorage.setItem('isAdminLoggedIn', isAdminLoggedIn ? 'true' : 'false');
  }, [isAdminLoggedIn]);

  useEffect(() => {
    localStorage.setItem('wpToken', wpToken);
    localStorage.setItem('wpTokenExpiry', String(wpTokenExpiry));
    localStorage.setItem('isRealWP', isRealWP ? 'true' : 'false');
    localStorage.setItem('wpBlogId', wpBlogId);
    localStorage.setItem('wpBlogUrl', wpBlogUrl);
    localStorage.setItem('wpMode', wpMode);
  }, [wpToken, wpTokenExpiry, isRealWP, wpBlogId, wpBlogUrl, wpMode]);

  // Listen to OAuth success events from popup
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data && event.data.type === 'WP_OAUTH_SUCCESS') {
        const { access_token, blog_id, blog_url } = event.data;
        if (access_token) {
          setWpToken(access_token);
          // Real WordPress.com tokens are long lived (usually 1 year)
          const longExpiry = Date.now() + 365 * 24 * 60 * 60 * 1000;
          setWpTokenExpiry(longExpiry);
          setWpTokenTimeLeft(365 * 24 * 60 * 60);
          setIsRealWP(true);
          if (blog_id) setWpBlogId(blog_id);
          if (blog_url) {
            const stripped = blog_url.replace(/^https?:\/\//, '').replace(/\/$/, '');
            setWpBlogUrl(stripped);
          }
          setWpAuthError('');
          setSyncStatus('idle');
          setSyncMessage('Successfully authenticated WordPress.com credentials!');
        }
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, []);

  // Sync previews on raw lyric input
  const [previewSections, setPreviewSections] = useState<FormattedSection[]>([]);
  useEffect(() => {
    const parsed = parseRawLyrics(songRawLyrics);
    setPreviewSections(parsed);
  }, [songRawLyrics]);

  // Live countdown timer for Simulated WordPress JWT token
  useEffect(() => {
    if (!wpToken || wpTokenExpiry <= 0) return;

    const interval = setInterval(() => {
      const left = Math.max(0, Math.round((wpTokenExpiry - Date.now()) / 1000));
      setWpTokenTimeLeft(left);
      if (left <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [wpToken, wpTokenExpiry]);

  // Admin Single-Login execution
  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoginError('');
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword })
      });
      if (res.ok) {
        setIsAdminLoggedIn(true);
        // Automatically fetch Simulated WordPress Token
        autoWPLogin();
      } else if (res.status === 404) {
        setAdminLoginError('Server endpoint not found (404). Verification API route could not be reached.');
      } else if (res.status === 401) {
        setAdminLoginError('Incorrect administrator passphrase. Access denied.');
      } else {
        setAdminLoginError(`Authentication failed with HTTP code ${res.status}.`);
      }
    } catch (err: any) {
      setAdminLoginError('Connection failed. Verify server response.');
    }
  };

  const handleDisconnectWP = () => {
    setWpToken('');
    setWpTokenExpiry(0);
    setWpTokenTimeLeft(0);
    setIsRealWP(false);
    setSyncStatus('idle');
    setSyncMessage('Disconnected WordPress site successfully.');
  };

  // Trigger real WordPress OAuth popups
  const handleWordPressOAuth = async () => {
    try {
      const finalRedirectUri = window.location.origin + '/auth/callback';
      const res = await fetch(`/api/wordpress/oauth/url?redirect_uri=${encodeURIComponent(finalRedirectUri)}`);
      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || 'To connect your real blog, please configure WORDPRESS_CLIENT_ID and WORDPRESS_CLIENT_SECRET variables in your workspace settings.');
        return;
      }
      const { url } = await res.json();
      
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      window.open(
        url,
        'wordpress_oauth_popup',
        `width=${width},height=${height},top=${top},left=${left},scrollbars=yes`
      );
    } catch (err: any) {
      alert('Could not start WordPress OAuth flow: ' + err.message);
    }
  };

  const autoWPLogin = async () => {
    try {
      const response = await fetch('/api/wordpress/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'Jesus@9664808@' })
      });
      if (response.ok) {
        const d = await response.json();
        setWpToken(d.token);
        setWpTokenExpiry(d.expiresAt);
        setWpTokenTimeLeft(Math.max(0, Math.round((d.expiresAt - Date.now()) / 1000)));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleWPLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setWpIsAuthenticating(true);
    setWpAuthError('');
    try {
      const response = await fetch('/api/wordpress/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: wpUsername, password: wpPassword })
      });
      const data = await response.json();
      if (response.ok) {
        setWpToken(data.token);
        setWpTokenExpiry(data.expiresAt);
        setWpTokenTimeLeft(Math.max(0, Math.round((data.expiresAt - Date.now()) / 1000)));
        setWpAuthError('');
      } else {
        setWpAuthError(data.message || 'WordPress authentication rejected.');
      }
    } catch (e) {
      setWpAuthError('Unable to locate WordPress REST gateway.');
    } finally {
      setWpIsAuthenticating(false);
    }
  };

  // Load selected song into forms
  const selectSongToEdit = (song: Song) => {
    setSelectedSongId(song.id);
    setSongTitle(song.title);
    setSongArtist(song.artist);
    setSongAlbum(song.album || '');
    setSongGenre(song.genre);
    setSongDuration(song.duration || '3:30');
    setSongRawLyrics(song.rawLyrics);
    setSongCoverUrl(song.coverUrl || '');
    setSongYoutubeUrl(song.youtubeUrl || '');
    
    const containingPlists = playlists
      .filter(p => p.songIds.includes(song.id))
      .map(p => p.id);
    setAssignedPlaylists(containingPlists);

    setSyncStatus('idle');
    setSyncMessage('');
  };

  const handleNewSongReset = () => {
    setSelectedSongId('');
    setSongTitle('');
    setSongArtist('');
    setSongAlbum('');
    setSongGenre('Contemporary');
    setSongDuration('3:45');
    setSongRawLyrics('');
    setSongCoverUrl('');
    setSongYoutubeUrl('');
    setAssignedPlaylists([]);
    setSyncStatus('idle');
    setSyncMessage('');
  };

  // AI Formatting states
  const [isAiBeautifying, setIsAiBeautifying] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiInsights, setAiInsights] = useState('');

  const handleGeminiFormat = async () => {
    if (!songRawLyrics.trim()) return;
    setIsAiBeautifying(true);
    setAiSuggestions([]);
    setAiInsights('');
    try {
      const res = await fetch('/api/gemini/beautify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawLyrics: songRawLyrics,
          songInfo: { title: songTitle, artist: songArtist }
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.formattedText) {
          setSongRawLyrics(data.formattedText);
        }
        setPreviewSections(data.formatted);
        setAiInsights(data.enrichment || '');
        if (data.suggestions) {
          setAiSuggestions(data.suggestions);
        }
      }
    } catch (e) {
      console.error("AI error, carrying on with advanced local parse.", e);
    } finally {
      setIsAiBeautifying(false);
    }
  };

  // Checkbox playlist mapper toggle handler
  const handlePlaylistToggle = (pId: string) => {
    setAssignedPlaylists(prev => 
      prev.includes(pId) ? prev.filter(id => id !== pId) : [...prev, pId]
    );
  };

  // Save changes locally to the database
  const [localSaveStatus, setLocalSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');
  const handleSaveLocal = async () => {
    if (!songTitle || !songArtist || !songRawLyrics) {
      alert("Please complete the required fields: Title, Artist, and Lyrics.");
      return;
    }
    setLocalSaveStatus('saving');
    try {
      const res = await fetch('/api/songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedSongId || undefined,
          title: songTitle,
          artist: songArtist,
          album: songAlbum,
          genre: songGenre,
          duration: songDuration,
          rawLyrics: songRawLyrics,
          coverUrl: songCoverUrl || undefined,
          youtubeUrl: songYoutubeUrl || undefined,
          playlistIds: assignedPlaylists
        })
      });
      if (res.ok) {
        setLocalSaveStatus('success');
        onRefreshData();
        setTimeout(() => setLocalSaveStatus('idle'), 2000);
      } else {
        setLocalSaveStatus('idle');
        alert("Server failed to save lyric form.");
      }
    } catch (e) {
      setLocalSaveStatus('idle');
    }
  };

  const handleDeleteSong = async (sId: string) => {
    if (!confirm("Are you sure you want to delete this track entirely from databases?")) return;
    try {
      const res = await fetch(`/api/songs/${sId}`, { method: 'DELETE' });
      if (res.ok) {
        handleNewSongReset();
        onRefreshData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Automated WordPress Sync REST API handler
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncedWPLink, setSyncedWPLink] = useState('');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');

  const handleWordPressSync = async () => {
    if (!songTitle || !songRawLyrics) {
      setSyncStatus('error');
      setSyncMessage('Must provide song title and lyrics before syncing to WordPress.');
      return;
    }

    setIsSyncing(true);
    setSyncStatus('idle');
    setSyncMessage('');
    setSyncedWPLink('');

    const compiledHTML = buildHTMLFromSections(previewSections, songTitle, songArtist);

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      const endpoint = isRealWP ? '/api/wordpress/post' : '/wp-json/wp/v2/posts';
      const bodyPayload = isRealWP 
        ? {
            title: `Lyrics: ${songTitle} - ${songArtist}`,
            content: compiledHTML,
            token: wpToken,
            blog_url: wpBlogUrl
          }
        : {
            title: `Lyrics: ${songTitle} - ${songArtist}`,
            content: compiledHTML,
            status: 'publish'
          };

      const headersPayload: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (!isRealWP) {
        headersPayload['Authorization'] = `Bearer ${wpToken}`;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: headersPayload,
        body: JSON.stringify(bodyPayload)
      });

      const data = await res.json();

      if (res.status === 201) {
        setSyncStatus('success');
        setSyncMessage(`Published successfully to ${isRealWP ? wpBlogUrl : 'simulated blog'} database!`);
        setSyncedWPLink(data.link || '#');
        
        // Also sync local catalog to database
        await handleSaveLocal();
      } else {
        setSyncStatus('error');
        setSyncMessage(data.message || 'REST synchronization failed. Check credentials.');
      }
    } catch (e) {
      setSyncStatus('error');
      setSyncMessage('Connection handshake refused by WordPress REST handler.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6" id="admin-main">
      <AnimatePresence mode="wait">
        {!isAdminLoggedIn ? (
          // Master Passphrase Entrance
          <motion.div 
            key="login-box"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl p-8 space-y-6 shadow-sm hover:shadow-md transition-shadow duration-300"
          >
            <div className="text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-700 shadow-sm">
                <Lock className="w-5 h-5 stroke-[1.5]" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Admin Authorization</h2>
                <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                  Please enter your administrator passphrase to manage lyrics, upload new tracks, and utilize publishing gateways.
                </p>
              </div>
            </div>

            <form onSubmit={handleAdminAuth} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold tracking-wider text-slate-400 block uppercase">Passphrase</label>
                <div className="relative">
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter master password"
                    className="w-full bg-slate-50/50 border border-slate-200/80 focus:border-slate-900 focus:ring-1 focus:ring-slate-950/5 focus:bg-white outline-none rounded-xl py-3 pl-3.5 pr-10 text-xs font-mono placeholder:text-slate-400 text-slate-800 transition-all"
                    required
                  />
                  <Key className="absolute right-3.5 top-3.5 w-4 h-4 text-slate-450 stroke-[1.5]" />
                </div>
                {adminLoginError && (
                  <div className="bg-red-50/60 border border-red-200/60 rounded-xl p-3 mt-2 text-xs text-red-700 font-mono flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{adminLoginError}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-850 text-white rounded-xl text-xs font-mono font-bold tracking-wider uppercase transition-all shadow-sm active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Authenticate Session</span>
                <span className="text-slate-400 text-xs font-normal">→</span>
              </button>
            </form>
          </motion.div>
        ) : (
          // Fully Light-Themed, Polished Split-Screen Workspace
          <motion.div
            key="uploader-workspace"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Quick Song Switcher Bar */}
            <div className="bg-white border border-slate-200/85 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono text-slate-450 font-bold uppercase tracking-wider whitespace-nowrap">Edit Existing:</span>
                <div className="flex gap-1.5 flex-wrap items-center">
                  {songs.map(song => (
                    <button
                      key={song.id}
                      onClick={() => selectSongToEdit(song)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-sans transition-all cursor-pointer border ${
                        selectedSongId === song.id 
                          ? 'bg-slate-900 text-white font-semibold border-slate-950 shadow-sm' 
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-850 border-slate-200/70'
                      }`}
                    >
                      {song.title}
                    </button>
                  ))}
                  <button
                    onClick={handleNewSongReset}
                    className="px-3 py-1.5 bg-rose-50/70 text-rose-750 hover:bg-rose-100/70 border border-rose-200/60 rounded-xl text-xs font-semibold font-mono uppercase flex items-center gap-1 cursor-pointer transition-all active:scale-[0.98]"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2]" /> Add Song
                  </button>
                </div>
              </div>

              <button 
                onClick={() => setIsAdminLoggedIn(false)}
                className="text-[10px] font-mono text-slate-500 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200/70 px-3 py-1.5 rounded-xl cursor-pointer transition-all font-bold flex items-center gap-1.5 active:scale-[0.98]"
              >
                <LogOut className="w-3.5 h-3.5 stroke-[1.5]" /> Disconnect
              </button>
            </div>

            {/* Split Screen Workspace Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              
              {/* Form Input fields column */}
              <div className="xl:col-span-5 space-y-6">
                
                {/* Form fields card */}
                <div className="bg-white border border-slate-200/85 rounded-2xl p-6 space-y-5 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="font-bold text-slate-900 text-sm tracking-tight flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-500 stroke-[1.5]" />
                      {selectedSongId ? 'Update Lyric Form' : 'Add New Lyric Form'}
                    </h3>
                    <span className="text-[9px] font-mono bg-slate-100 border border-slate-200/60 px-2 py-0.5 rounded-lg text-slate-505 font-semibold">
                      {selectedSongId ? `ID: ${selectedSongId}` : 'New Track Draft'}
                    </span>
                  </div>

                  {/* Metadata fields Row 1 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-slate-500 block font-bold tracking-wider uppercase">Song Title *</label>
                      <input
                        type="text"
                        value={songTitle}
                        onChange={(e) => setSongTitle(e.target.value)}
                        placeholder="e.g. Amazing Grace"
                        className="w-full bg-slate-50/50 border border-slate-200/80 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-slate-900 focus:bg-white transition-all font-sans placeholder:text-slate-400"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-slate-500 block font-bold tracking-wider uppercase">Artist / Developer *</label>
                      <input
                        type="text"
                        value={songArtist}
                        onChange={(e) => setSongArtist(e.target.value)}
                        placeholder="e.g. John Newton"
                        className="w-full bg-slate-50/50 border border-slate-200/80 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-slate-900 focus:bg-white transition-all font-sans placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Metadata fields Row 2 */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-slate-500 block font-bold tracking-wider uppercase">Genre</label>
                      <select
                        value={songGenre}
                        onChange={(e) => setSongGenre(e.target.value)}
                        className="w-full bg-slate-50/50 border border-slate-200/80 rounded-xl p-2.5 text-xs text-slate-850 outline-none focus:border-slate-900 focus:bg-white transition-all cursor-pointer"
                      >
                        <option value="Contemporary">Contemporary</option>
                        <option value="Hymn">Hymn</option>
                        <option value="Gospel">Gospel</option>
                        <option value="Acoustic">Acoustic</option>
                        <option value="Worship">Worship</option>
                        <option value="Traditional">Traditional</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-slate-500 block font-bold tracking-wider uppercase">Album</label>
                      <input
                        type="text"
                        value={songAlbum}
                        onChange={(e) => setSongAlbum(e.target.value)}
                        placeholder="e.g. Legacy"
                        className="w-full bg-slate-50/50 border border-slate-200/80 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-slate-900 focus:bg-white transition-all placeholder:text-slate-400"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-slate-500 block font-bold tracking-wider uppercase">Duration</label>
                      <input
                        type="text"
                        value={songDuration}
                        onChange={(e) => setSongDuration(e.target.value)}
                        placeholder="e.g. 3:45"
                        className="w-full bg-slate-50/50 border border-slate-200/80 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-slate-900 focus:bg-white transition-all font-mono placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Resource URLs */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-slate-500 block font-bold tracking-wider uppercase">Cover Image URL</label>
                      <input
                        type="text"
                        value={songCoverUrl}
                        onChange={(e) => setSongCoverUrl(e.target.value)}
                        placeholder="https://images.unsplash.com/..."
                        className="w-full bg-slate-50/50 border border-slate-200/80 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-slate-900 focus:bg-white transition-all placeholder:text-slate-400"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-slate-500 block font-bold tracking-wider uppercase">YouTube Video Link</label>
                      <input
                        type="text"
                        value={songYoutubeUrl}
                        onChange={(e) => setSongYoutubeUrl(e.target.value)}
                        placeholder="https://youtube.com/..."
                        className="w-full bg-slate-50/50 border border-slate-200/80 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-slate-900 focus:bg-white transition-all placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Align playlist mapping checks */}
                  <div className="space-y-2 p-4 bg-slate-50/50 border border-slate-200/70 rounded-xl">
                    <label className="text-[10px] font-mono text-slate-500 block font-bold tracking-wider uppercase flex items-center gap-1.5">
                      <PlaylistIcon className="w-3.5 h-3.5 text-slate-500" />
                      Map Song to Collections
                    </label>
                    <div className="flex flex-wrap gap-1.5 pt-1.5">
                      {playlists.map(p => {
                        const isAssigned = assignedPlaylists.includes(p.id);
                        return (
                          <button
                            type="button"
                            key={p.id}
                            onClick={() => handlePlaylistToggle(p.id)}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-sans font-semibold tracking-wide transition-all flex items-center gap-1 cursor-pointer border ${
                              isAssigned 
                                ? 'bg-slate-900 border-slate-950 text-white shadow-sm' 
                                : 'bg-white border-slate-200/80 text-slate-500 hover:border-slate-350 hover:text-slate-800'
                            }`}
                          >
                            {isAssigned && <Check className="w-3 h-3 text-white" />}
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Lyrics raw pasting block */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-mono text-slate-500 block font-bold tracking-wider uppercase">Lyrics Entry Sheet *</label>
                      <span className="text-[9px] text-slate-400 font-mono italic">Support: [Chorus], [Verse 1], [Bridge]</span>
                    </div>
                    <textarea
                      value={songRawLyrics}
                      onChange={(e) => setSongRawLyrics(e.target.value)}
                      placeholder="Type or paste lyrics. Highlight sections with brackets:
[Verse 1]
Amazing grace, how sweet the sound
That saved a wretch like me!

[Chorus]
My chains are gone, I've been set free..."
                      rows={14}
                      className="w-full bg-slate-50/50 border border-slate-200/80 rounded-xl p-3 text-xs text-slate-800 font-mono outline-none focus:border-slate-900 focus:bg-white transition-all leading-relaxed resize-y"
                    />
                  </div>

                  {/* AI & Local actions button grid */}
                  <div className="grid grid-cols-2 gap-3.5 pt-1">
                    {/* Gemini integration trigger */}
                    <button
                      type="button"
                      onClick={handleGeminiFormat}
                      disabled={isAiBeautifying || !songRawLyrics}
                      className="py-2.5 px-3 bg-indigo-50/80 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 disabled:opacity-45 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98]"
                    >
                      {isAiBeautifying ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Formatting...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 stroke-[1.5]" />
                          <span>AI format lyrics</span>
                        </>
                      )}
                    </button>

                    {/* Local DB save */}
                    <button
                      type="button"
                      onClick={handleSaveLocal}
                      disabled={localSaveStatus === 'saving'}
                      className="py-2.5 px-3 bg-slate-900 hover:bg-slate-850 text-white rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-[0.98]"
                    >
                      {localSaveStatus === 'saving' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : localSaveStatus === 'success' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Save className="w-3.5 h-3.5 stroke-[1.5]" />
                      )}
                      <span>
                        {localSaveStatus === 'saving' ? 'Saving...' : localSaveStatus === 'success' ? 'Saved' : selectedSongId ? 'Update Song' : 'Create Song'}
                      </span>
                    </button>
                  </div>

                  {/* Delete Song if selected */}
                  {selectedSongId && (
                    <button
                      type="button"
                      onClick={() => handleDeleteSong(selectedSongId)}
                      className="w-full py-2.5 px-3 border border-red-200/60 bg-red-50/60 text-red-700 hover:bg-red-100/60 text-xs font-semibold font-mono transition-all rounded-xl cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.98]"
                    >
                      <Trash2 className="w-3.5 h-3.5 stroke-[1.5]" /> Delete Track
                    </button>
                  )}

                </div>

                {/* AI advice if any has occurred */}
                {aiInsights && (
                  <div className="bg-indigo-50/40 p-5 border border-indigo-100 rounded-2xl text-xs space-y-2.5">
                    <span className="text-indigo-850 font-bold font-mono text-[10px] tracking-wide flex items-center gap-1.5 uppercase">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-spin" style={{ animationDuration: '4s' }} /> Gemini Composer Advice
                    </span>
                    <p className="text-indigo-900 leading-relaxed font-sans">{aiInsights}</p>
                    {aiSuggestions.length > 0 && (
                      <div className="pt-2.5 space-y-1.5 border-t border-indigo-100/60">
                        <span className="text-[9px] text-indigo-650 font-bold block uppercase font-mono tracking-wider">Suggested Improvements:</span>
                        <ul className="list-disc pl-4 space-y-1 text-indigo-800 font-sans">
                          {aiSuggestions.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* RIGHT COLUMN: WordPress Sync & Beautified real-time Live previews */}
              <div className="xl:col-span-7 space-y-6">
                
                {/* WordPress Rest synchronization gateway */}
                <div className="bg-white border border-slate-200/85 rounded-2xl p-6 space-y-5 shadow-sm">
                  
                  {/* WordPress Header block */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-700 shadow-sm">
                        <Globe className="w-4 h-4 stroke-[1.5]" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs tracking-tight">WordPress Sync Gateway</h4>
                        <p className="text-[9px] text-slate-450 font-mono tracking-wider uppercase">REST Publish integration</p>
                      </div>
                    </div>

                    {/* Mode selector tab */}
                    <div className="flex bg-slate-100/65 p-1 rounded-xl border border-slate-200/60">
                      <button
                        type="button"
                        onClick={() => { setWpMode('simulated'); setIsRealWP(false); }}
                        className={`px-3 py-1 rounded-lg text-[9px] font-mono font-bold tracking-wider uppercase transition-all cursor-pointer ${
                          wpMode === 'simulated' 
                            ? 'bg-white text-slate-800 shadow-sm border border-slate-200/40 font-extrabold' 
                            : 'text-slate-400 hover:text-slate-650'
                        }`}
                      >
                        Simulated
                      </button>
                      <button
                        type="button"
                        onClick={() => { setWpMode('live'); setIsRealWP(true); }}
                        className={`px-3 py-1 rounded-lg text-[9px] font-mono font-bold tracking-wider uppercase transition-all cursor-pointer ${
                          wpMode === 'live' 
                            ? 'bg-white text-slate-800 shadow-sm border border-slate-200/40 font-extrabold' 
                            : 'text-slate-400 hover:text-slate-650'
                        }`}
                      >
                        Live Blog
                      </button>
                    </div>
                  </div>

                  {/* Simulation Credentials Information details */}
                  {wpMode === 'simulated' ? (
                    <div className="space-y-4">
                      <div className="space-y-2 bg-slate-50/50 border border-slate-200/70 p-4 rounded-xl">
                        <p className="text-xs text-slate-600 font-sans leading-relaxed">
                          We provide a fully pre-configured sandbox to mock WordPress REST schema operations. Fill in the default local credentials to test publishing.
                        </p>
                        
                        <div className="grid grid-cols-2 gap-3 text-[10px] font-mono pt-1">
                          <div className="bg-white border border-slate-150 p-2.5 rounded-lg shadow-sm">
                            <span className="text-[8px] text-slate-400 block font-bold tracking-wider uppercase mb-0.5">Mock User</span>
                            <span className="text-slate-700 block font-bold">admin</span>
                          </div>
                          <div className="bg-white border border-slate-150 p-2.5 rounded-lg shadow-sm">
                            <span className="text-[8px] text-slate-400 block font-bold tracking-wider uppercase mb-0.5">Mock Passphrase</span>
                            <span className="text-slate-700 block font-bold">Jesus@9664808@</span>
                          </div>
                        </div>
                      </div>

                      {wpToken ? (
                        <div className="flex items-center justify-between p-4 bg-emerald-50/60 border border-emerald-150 rounded-xl text-xs text-emerald-800 shadow-sm">
                          <div className="flex items-center gap-3 font-mono">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 stroke-[1.5]" />
                            <div>
                              <p className="font-bold">Sandbox REST Connected</p>
                              <p className="text-[9px] text-emerald-650 block leading-none mt-1 uppercase">Token active: {wpToken.substring(0, 12)}...</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleDisconnectWP}
                            className="px-3 py-1.5 rounded-xl border border-emerald-200 text-[10px] bg-white hover:bg-emerald-50 text-emerald-800 transition font-mono font-bold cursor-pointer active:scale-[0.98]"
                          >
                            Disconnect
                          </button>
                        </div>
                      ) : (
                        // Form to fetch JWT
                        <form onSubmit={handleWPLogin} className="space-y-3">
                          <div className="grid grid-cols-2 gap-3.5">
                            <div className="space-y-1">
                              <span className="text-[10px] font-mono font-bold tracking-wide text-slate-505 block uppercase">Username</span>
                              <input
                                type="text"
                                value={wpUsername}
                                onChange={(e) => setWpUsername(e.target.value)}
                                className="w-full bg-slate-50/50 border border-slate-200/80 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-slate-900 transition-all"
                              />
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] font-mono font-bold tracking-wide text-slate-505 block uppercase">Password</span>
                              <input
                                type="password"
                                value={wpPassword}
                                onChange={(e) => setWpPassword(e.target.value)}
                                className="w-full bg-slate-50/50 border border-slate-200/80 rounded-xl p-2.5 text-xs text-slate-800 outline-none font-mono focus:border-slate-900 transition-all"
                              />
                            </div>
                          </div>
                          
                          {wpAuthError && (
                            <p className="text-xs text-red-650 font-mono bg-red-50 border border-red-250/65 p-2 rounded-xl leading-relaxed">{wpAuthError}</p>
                          )}

                          <button
                            type="submit"
                            disabled={wpIsAuthenticating}
                            className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-700 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-[0.98]"
                          >
                            {wpIsAuthenticating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5 text-slate-600 stroke-[1.5]" />}
                            <span>Authorize WordPress Sandbox JWT</span>
                          </button>
                        </form>
                      )}
                    </div>
                  ) : (
                    // REAL WORDPRESS OAUTH WIDGET
                    <div className="space-y-4">
                      <p className="text-xs text-slate-500 font-sans leading-relaxed bg-slate-50/40 p-4 rounded-xl border border-slate-200/60 shadow-sm">
                        Redirect live-formatted responsive postings to your official personal blog using secure REST OAuth 2.0 handshake endpoints.
                      </p>

                      <div className="space-y-3.5">
                        <div className="space-y-1.5">
                          <span className="text-[9px] font-mono font-bold text-slate-450 block uppercase tracking-wider">WordPress.com Blog Domain</span>
                          <input
                            type="text"
                            value={wpBlogUrl}
                            onChange={(e) => setWpBlogUrl(e.target.value)}
                            placeholder="e.g. psalmify.wordpress.com"
                            className="w-full bg-slate-50/50 border border-slate-200/80 rounded-xl p-2.5 text-xs text-slate-800 outline-none font-mono focus:border-slate-900 transition-all"
                          />
                        </div>

                        {wpToken && isRealWP ? (
                          <div className="p-4 bg-emerald-50/60 border border-emerald-150 rounded-xl text-xs text-emerald-800 space-y-2 shadow-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold block flex items-center gap-1.5">
                                <Check className="w-4 h-4 text-emerald-600" /> Linked: {wpBlogUrl}
                              </span>
                              <button
                                type="button"
                                onClick={handleDisconnectWP}
                                className="px-2.5 py-1 rounded-xl border border-emerald-200 bg-white hover:bg-emerald-50 font-mono font-bold text-[9px] cursor-pointer"
                              >
                                Disconnect
                              </button>
                            </div>
                            <p className="text-[10px] text-emerald-600 font-sans">Handshake credentials successfully initialized for remote posting.</p>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={handleWordPressOAuth}
                            className="w-full py-2.5 bg-slate-950 hover:bg-slate-900 text-white rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-[0.98]"
                          >
                            <Globe className="w-3.5 h-3.5 text-slate-300 stroke-[1.5]" />
                            <span>Connect WordPress.com Live Account</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Post Publish actions */}
                  {wpToken && (
                    <div className="pt-3 border-t border-slate-100 space-y-3.5">
                      
                      {syncStatus !== 'idle' && (
                        <div className={`p-4 rounded-xl border text-xs font-mono flex items-start gap-2.5 ${
                          syncStatus === 'success' 
                            ? 'bg-emerald-50/60 border-emerald-250 text-emerald-800 shadow-sm' 
                            : 'bg-red-50 border-red-200 text-red-650'
                        }`}>
                          {syncStatus === 'success' ? (
                            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600 mt-0.5" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-500 mt-0.5" />
                          )}
                          <div className="space-y-1">
                            <p className="font-bold">{syncStatus === 'success' ? 'Published successfully!' : 'Gateway Refusal'}</p>
                            <p className="text-[10px] text-slate-500 font-sans leading-relaxed">{syncMessage}</p>
                            {syncedWPLink && (
                              <a 
                                href={syncedWPLink} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 text-emerald-950 underline font-bold mt-1 text-[10px] font-mono leading-none hover:text-emerald-800"
                              >
                                View Lyrics Post <ChevronRight className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleWordPressSync}
                        disabled={isSyncing}
                        className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-850 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.98]"
                      >
                        {isSyncing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Publishing to WordPress REST API Table...</span>
                          </>
                        ) : (
                          <>
                            <Share2 className="w-4 h-4 text-emerald-450 stroke-[1.5] animate-pulse" />
                            <span>Publish directly to WordPress REST DB</span>
                          </>
                        )}
                      </button>

                    </div>
                  )}

                </div>

                {/* Real-time HTML live layout previewer */}
                <div className="bg-white border border-slate-200/85 rounded-2xl p-6 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-xs font-mono font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wide">
                      <Eye className="w-3.5 h-3.5 text-slate-500" /> Live Render Preview
                    </span>
                    <span className="text-[9px] font-mono bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded-lg text-slate-400 font-semibold tracking-wider">
                      AUTO GENERATED
                    </span>
                  </div>

                  {previewSections.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 text-xs font-mono bg-slate-50/50 border border-dashed border-slate-200 rounded-xl leading-relaxed">
                      Please select/create a lyric draft to launch the styled HTML live previewer.
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar bg-slate-50/40 p-5 border border-slate-200 rounded-xl">
                      <div className="text-center pb-4 border-b border-slate-200/60 space-y-1">
                        <h2 className="text-xl font-serif text-slate-900 font-bold">{songTitle || 'Amazing Grace'}</h2>
                        <span className="text-[10px] tracking-wider text-slate-400 font-mono uppercase">BY {songArtist || 'John Newton'}</span>
                      </div>

                      <div className="space-y-4 pt-1">
                        {previewSections.map((section, idx) => {
                          const isChorus = section.type === 'chorus';
                          return (
                            <div 
                              key={idx}
                              className={`p-4 rounded-xl border text-xs leading-relaxed ${
                                isChorus 
                                  ? 'bg-rose-50/30 border-rose-150 pl-4 border-l-4 border-l-rose-500 font-serif italic text-slate-900' 
                                  : 'bg-white border-slate-150 pl-4 border-l-4 border-l-slate-400 text-slate-700 font-sans'
                              }`}
                            >
                              <span className={`text-[9px] font-mono block font-bold uppercase mb-2 tracking-wider ${isChorus ? 'text-rose-600 font-extrabold' : 'text-slate-450'}`}>
                                {section.label}
                              </span>
                              <div className="space-y-1 text-slate-800">
                                {section.lines.map((line, lIdx) => (
                                  <p key={lIdx} className="leading-6">{line}</p>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

              </div>
              
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
