import React, { useState, useEffect } from 'react';
import { Song, Playlist, FormattedSection } from '../types';
import { parseRawLyrics, buildHTMLFromSections } from '../utils/lyricParser';
import { 
  Key, Lock, Sparkles, FileText, Globe, RefreshCcw, Check, 
  AlertTriangle, Loader2, Save, Trash2, ListMusic as PlaylistIcon, Plus, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminUploaderProps {
  playlists: Playlist[];
  songs: Song[];
  onRefreshData: () => void;
}

export default function AdminUploader({ playlists, songs, onRefreshData }: AdminUploaderProps) {
  // Session Authentication state
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginError, setAdminLoginError] = useState('');

  // Song Form States
  const [selectedSongId, setSelectedSongId] = useState<string>('');
  const [songTitle, setSongTitle] = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [songAlbum, setSongAlbum] = useState('');
  const [songGenre, setSongGenre] = useState('Synthwave');
  const [songDuration, setSongDuration] = useState('3:30');
  const [songRawLyrics, setSongRawLyrics] = useState('');
  const [songCoverUrl, setSongCoverUrl] = useState('');
  const [songYoutubeUrl, setSongYoutubeUrl] = useState('');
  const [assignedPlaylists, setAssignedPlaylists] = useState<string[]>([]);

  // Simulated WordPress Integration credentials
  const [wpUsername, setWpUsername] = useState('admin');
  const [wpPassword, setWpPassword] = useState('admin123');
  const [wpToken, setWpToken] = useState<string>('');
  const [wpTokenExpiry, setWpTokenExpiry] = useState<number>(0);
  const [wpTokenTimeLeft, setWpTokenTimeLeft] = useState<number>(0);
  const [wpIsAuthenticating, setWpIsAuthenticating] = useState(false);
  const [wpAuthError, setWpAuthError] = useState('');

  // Auto-beautifying engine preview state
  const [previewSections, setPreviewSections] = useState<FormattedSection[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiInsights, setAiInsights] = useState<string>('');
  const [isAiBeautifying, setIsAiBeautifying] = useState(false);

  // WordPress Database Sync States
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');
  const [syncedWPLink, setSyncedWPLink] = useState('');
  const [localSaveStatus, setLocalSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');

  // Real WordPress OAuth 2.0 States
  const [isRealWP, setIsRealWP] = useState(false);
  const [wpBlogId, setWpBlogId] = useState('');
  const [wpBlogUrl, setWpBlogUrl] = useState('psalmify.wordpress.com');
  const [wpMode, setWpMode] = useState<'live' | 'simulated'>('live');

  // Listen to OAuth success events from popup
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      const origin = event.origin;
      // Allow AI Studio preview domains & localhost
      if (!origin.endsWith('.run.app') && !origin.includes('localhost') && !origin.includes('ai.studio')) {
        return;
      }

      if (event.data?.type === 'WP_OAUTH_SUCCESS') {
        const { token, blog_id, blog_url } = event.data;
        if (token) {
          setWpToken(token);
          // Real WordPress.com tokens do not expire quickly (usually long-lived), so let's set a 1-year expiry
          const longExpiry = Date.now() + 365 * 24 * 60 * 60 * 1000;
          setWpTokenExpiry(longExpiry);
          setWpTokenTimeLeft(365 * 24 * 60 * 60);
          setIsRealWP(true);
          if (blog_id) setWpBlogId(blog_id);
          if (blog_url) {
            // strip http/https for blog domain
            const stripped = blog_url.replace(/^https?:\/\//, '').replace(/\/$/, '');
            setWpBlogUrl(stripped);
          }
          setWpAuthError('');
          setSyncStatus('idle');
          setSyncMessage('Successfully authenticated with psalmify.wordpress.com!');
        }
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, []);

  // Trigger preview on raw lyric input
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
        // Automatically fetch WordPress token to kickstart uploader convenience
        autoWPLogin();
      } else {
        const d = await res.json();
        setAdminLoginError(d.message || 'Verification failed.');
      }
    } catch (err) {
      setAdminLoginError('Server communication issue.');
    }
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

  const handleDisconnectWP = () => {
    setWpToken('');
    setWpTokenExpiry(0);
    setWpTokenTimeLeft(0);
    setIsRealWP(false);
    setSyncStatus('idle');
    setSyncMessage('Disconnected WordPress site successfully.');
  };

  // Acquire Simulated WordPress JWT rest credential
  const autoWPLogin = async () => {
    try {
      const response = await fetch('/api/wordpress/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' })
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
      } else {
        setWpAuthError(data.message || 'WordPress authentication rejected.');
      }
    } catch (e) {
      setWpAuthError('Unable to locate WordPress REST gateway.');
    } finally {
      setWpIsAuthenticating(false);
    }
  };

  // Explicitly force JWT token expiration to test fallback state
  const triggerSimulatedTokenExpiry = () => {
    setWpToken('EXPIRED_TEST_TOKEN');
    setWpTokenExpiry(Date.now() - 5000); // 5 seconds in pasture
    setWpTokenTimeLeft(0);
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
    
    // Find playlists containing this song
    const containingPlists = playlists
      .filter(p => p.songIds.includes(song.id))
      .map(p => p.id);
    setAssignedPlaylists(containingPlists);

    // Reset sync warnings
    setSyncStatus('idle');
    setSyncMessage('');
  };

  // Clear song editing form
  const handleNewSongReset = () => {
    setSelectedSongId('');
    setSongTitle('');
    setSongArtist('');
    setSongAlbum('');
    setSongGenre('Synthwave');
    setSongDuration('3:30');
    setSongRawLyrics('');
    setSongCoverUrl('');
    setSongYoutubeUrl('');
    setAssignedPlaylists([]);
    setSyncStatus('idle');
    setSyncMessage('');
  };

  // Auto-beautifier triggers local formatting or server Gemini integration
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
        // If Gemini formatted text was returned, apply it to raw lyrics form
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

  // Save changes locally to the dashboard server
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

  // Delete Song Execution
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

  // Automated WordPress Sync Rest handler
  const handleWordPressSync = async () => {
    if (!songTitle || !songRawLyrics) {
      setSyncStatus('error');
      setSyncMessage('Must have song title and raw lyrics before syncing to WordPress.');
      return;
    }

    setIsSyncing(true);
    setSyncStatus('idle');
    setSyncMessage('');
    setSyncedWPLink('');

    // Prepare compiled formatted HTML payload containing inline/Tailwind styles intact
    // to preserve structure permanently in WordPress DB
    const compiledHTML = buildHTMLFromSections(previewSections, songTitle, songArtist);

    try {
      // Small simulated latency to depict real gateway handshakes
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
        setSyncMessage(isRealWP ? `Published successfully to ${wpBlogUrl || 'psalmify.wordpress.com'}!` : 'Payload Successfully published! Synced to remote WordPress database.');
        setSyncedWPLink(data.link || '#');
        
        // Also save changes to local in-memory database representation to be nice & sync!
        await handleSaveLocal();
      } else {
        setSyncStatus('error');
        // Extracted descriptive WordPress structure error
        setSyncMessage(data.message || 'REST Synchronization failed. Check credentials.');
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
          // Standard Credentials Gate
          <motion.div 
            key="login-box"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-md mx-auto bg-[#0a0a0c] border border-white/10 rounded-3xl p-8 space-y-6"
          >
            <div className="text-center space-y-2">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white">Administrator Access Gate</h2>
              <p className="text-xs text-white/50 font-mono">
                Provide the administrator master passphrase to manage song catalogs and WordPress REST publishers.
              </p>
            </div>

            <form onSubmit={handleAdminAuth} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-mono text-white/40 block">MASTER PASSPHRASE</label>
                <div className="relative">
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter passphrase (hint: admin123)"
                    className="w-full bg-[#0d0d10] border border-white/10 focus:border-rose-500/40 outline-none rounded-xl p-3 text-sm text-white font-mono placeholder:text-white/30"
                  />
                  <Key className="absolute right-3.5 top-3.5 w-4 h-4 text-white/30" />
                </div>
                {adminLoginError && (
                  <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1 font-mono">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {adminLoginError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-mono font-bold uppercase transition cursor-pointer"
              >
                Authenticate Token Session →
              </button>
            </form>
          </motion.div>
        ) : (
          // Full Split Screen Admin Workspace
          <motion.div
            key="uploader-workspace"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Catalog quick-picker bar */}
            <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-xs font-mono text-white/80 font-bold uppercase">Quick Edit Song:</span>
                <div className="flex gap-1 flex-wrap">
                  {songs.map(song => (
                    <button
                      key={song.id}
                      onClick={() => selectSongToEdit(song)}
                      className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                        selectedSongId === song.id 
                          ? 'bg-rose-600 text-white font-bold border border-rose-500' 
                          : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white border border-white/5'
                      }`}
                    >
                      {song.title}
                    </button>
                  ))}
                  <button
                    onClick={handleNewSongReset}
                    className="px-3 py-1 bg-white/5 text-rose-450 hover:bg-white/10 hover:text-rose-400 border border-white/10 rounded-lg text-xs font-bold font-mono uppercase flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Track
                  </button>
                </div>
              </div>
              <button 
                onClick={() => setIsAdminLoggedIn(false)}
                className="text-[10px] font-mono text-red-400 border border-red-500/20 bg-red-500/5 hover:bg-red-500/15 px-2.5 py-1 rounded-lg cursor-pointer transition-colors font-bold"
              >
                Disconnect Session
              </button>
            </div>

            {/* SPLIT SCREEN LAYOUT */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              
              {/* LEFT COLUMN: Input form & controls (W: 45%) */}
              <div className="xl:col-span-5 space-y-6">
                
                {/* Lyric Paste & Metadata Form Box */}
                <div className="bg-[#0f0f12] border border-white/10 rounded-3xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <h3 className="font-bold text-white text-sm tracking-tight flex items-center gap-1.5 font-sans">
                      <FileText className="w-4 h-4 text-rose-500" />
                      {selectedSongId ? 'Edit Track Workspace' : 'Smart Lyric Uploader Dashboard'}
                    </h3>
                    <span className="text-[10px] font-mono text-white/30">
                      {selectedSongId ? `ID: ${selectedSongId}` : 'NEW WORKSPACE'}
                    </span>
                  </div>

                  {/* Metadata Row 1 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-white/40 block font-bold">SONG TITLE *</label>
                      <input
                        type="text"
                        value={songTitle}
                        onChange={(e) => setSongTitle(e.target.value)}
                        placeholder="e.g. Starry Overdrive"
                        className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-rose-500/40"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-white/40 block font-bold">ARTIST / BAND *</label>
                      <input
                        type="text"
                        value={songArtist}
                        onChange={(e) => setSongArtist(e.target.value)}
                        placeholder="e.g. Retro Horizon"
                        className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-rose-500/40"
                      />
                    </div>
                  </div>

                  {/* Metadata Row 2 */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-white/40 block font-bold">GENRE</label>
                      <select
                        value={songGenre}
                        onChange={(e) => setSongGenre(e.target.value)}
                        className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-rose-500/40"
                      >
                        <option value="Synthwave">Synthwave</option>
                        <option value="Bluegrass">Bluegrass</option>
                        <option value="Lofi Pop">Lofi Pop</option>
                        <option value="Indie Rock">Indie Rock</option>
                        <option value="Americana">Americana</option>
                        <option value="Cinematic">Cinematic</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-white/40 block font-bold">ALBUM</label>
                      <input
                        type="text"
                        value={songAlbum}
                        onChange={(e) => setSongAlbum(e.target.value)}
                        placeholder="e.g. Neon Grid"
                        className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-rose-500/40"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-white/40 block font-bold">DURATION</label>
                      <input
                        type="text"
                        value={songDuration}
                        onChange={(e) => setSongDuration(e.target.value)}
                        placeholder="e.g. 3:45"
                        className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-rose-500/40 font-mono"
                      />
                    </div>
                  </div>

                  {/* Multimedia Resources Links */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-white/40 block font-bold">COVER IMAGE URL</label>
                      <input
                        type="text"
                        value={songCoverUrl}
                        onChange={(e) => setSongCoverUrl(e.target.value)}
                        placeholder="https://images.unsplash.com/..."
                        className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-rose-500/40"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-white/40 block font-bold">YOUTUBE VIDEO LINK</label>
                      <input
                        type="text"
                        value={songYoutubeUrl}
                        onChange={(e) => setSongYoutubeUrl(e.target.value)}
                        placeholder="https://youtube.com/..."
                        className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-rose-500/40"
                      />
                    </div>
                  </div>

                  {/* Assign to Playlists Grid checkboxes */}
                  <div className="space-y-1.5 p-3.5 bg-white/[0.02] border border-white/10 rounded-xl">
                    <label className="text-[10px] font-mono text-white/50 block font-bold uppercase flex items-center gap-1">
                      <PlaylistIcon className="w-3.5 h-3.5 text-rose-450" />
                      Map Song to Playlists
                    </label>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {playlists.map(pl => {
                        const isChecked = assignedPlaylists.includes(pl.id);
                        return (
                          <button
                            key={pl.id}
                            type="button"
                            onClick={() => handlePlaylistToggle(pl.id)}
                            className={`px-2.5 py-1 rounded text-[11px] font-mono border transition-all cursor-pointer ${
                              isChecked
                                ? 'bg-rose-500/10 border-rose-400 text-rose-300 font-bold'
                                : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'
                            }`}
                          >
                            {isChecked ? '✓ ' : '+ '} {pl.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Raw unformatted input textarea */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-mono text-rose-400 font-bold block uppercase">
                        Unstructured Raw Lyrics Content *
                      </label>
                      <span className="text-[9px] text-white/30 font-mono">
                        Seperate paragraphs with blank double newlines
                      </span>
                    </div>
                    <textarea
                      value={songRawLyrics}
                      onChange={(e) => setSongRawLyrics(e.target.value)}
                      rows={10}
                      placeholder="Paste raw lyrics here. Place labels like [Chorus] or [Verse 1] on their own line above each block."
                      className="w-full bg-[#0a0a0c] border border-white/10 rounded-2xl p-4 text-xs font-mono text-white/95 leading-relaxed outline-none focus:border-rose-500/45"
                    />
                  </div>

                  {/* Auto-beautify formatting engine triggers */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const parsed = parseRawLyrics(songRawLyrics);
                        setPreviewSections(parsed);
                      }}
                      className="py-2.5 px-3 bg-white/5 text-white hover:bg-white/10 border border-white/10 rounded-xl text-xs font-mono font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RefreshCcw className="w-3.5 h-3.5" />
                      Instant Format Preview
                    </button>
                    
                    <button
                      type="button"
                      onClick={handleGeminiFormat}
                      disabled={isAiBeautifying || !songRawLyrics}
                      className="py-2.5 px-3 bg-rose-600 text-white hover:bg-rose-500 hover:border-rose-400 border border-transparent disabled:opacity-50 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-rose-600/15 cursor-pointer"
                    >
                      {isAiBeautifying ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          AI Formatting...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 fill-current" />
                          Gemini AI Format & Enrich
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Simulated WordPress Credential Console panel */}
                <div className="bg-[#0f0f12] border border-white/10 rounded-3xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <h3 className="font-bold text-white text-xs tracking-tight flex items-center gap-1.5 font-sans">
                      <Globe className="w-4 h-4 text-rose-500" />
                      WordPress Publish Manager
                    </h3>
                    
                    {/* Switcher Tab */}
                    <div className="flex bg-[#0a0a0c] border border-white/10 p-0.5 rounded-lg text-[9px] font-mono">
                      <button
                        type="button"
                        onClick={() => { setWpMode('live'); setIsRealWP(true); }}
                        className={`px-2 py-1 rounded-md font-bold cursor-pointer transition ${
                          wpMode === 'live' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'text-white/40 hover:text-white/70 border border-transparent'
                        }`}
                      >
                        Live Blog (OAuth)
                      </button>
                      <button
                        type="button"
                        onClick={() => { setWpMode('simulated'); setIsRealWP(false); }}
                        className={`px-2 py-1 rounded-md font-bold cursor-pointer transition ${
                          wpMode === 'simulated' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-white/40 hover:text-white/70 border border-transparent'
                        }`}
                      >
                        Local Simulator
                      </button>
                    </div>
                  </div>

                  {wpMode === 'live' ? (
                    <div className="space-y-3">
                      {!wpToken || !isRealWP ? (
                        <div className="space-y-3">
                          <p className="text-[11px] text-white/50 leading-relaxed font-mono">
                            Connect your live WordPress.com blog (<span className="text-rose-400 font-bold">psalmify.wordpress.com</span>) securely. No plugins or upgrades required!
                          </p>

                          <div className="p-3 bg-[#0a0a0c] border border-white/5 rounded-xl space-y-2 text-[11px] font-mono text-white/60">
                            <span className="text-[9px] text-white/30 block uppercase font-bold">Bridge Settings</span>
                            <div>• Target: <span className="text-white">psalmify.wordpress.com</span></div>
                            <div>• Auth Protocol: <span className="text-white">OAuth 2.0 Web Authorization flow</span></div>
                          </div>

                          <div className="p-3 bg-[#0c0a09] border border-rose-500/15 rounded-xl space-y-2 text-[11px] font-mono text-white/70">
                            <div className="flex items-center justify-between text-rose-400 font-bold text-[10px] uppercase">
                              <span>⚠️ ACTION REQUIRED IN WP PORTAL</span>
                            </div>
                            <p className="text-[10px] text-white/50 leading-relaxed">
                              Wordpress requires the exact redirect callback to be configured. Go to your developer portal on <a href="https://developer.wordpress.com/" target="_blank" rel="noreferrer" className="underline text-rose-400 hover:text-rose-300 font-bold">developer.wordpress.com</a>, open your application, and ensure your <strong>Redirect URLs</strong> matches or contains:
                            </p>
                            <div className="flex items-center gap-1.5 bg-black rounded p-1.5 border border-white/5">
                              <input 
                                type="text" 
                                readOnly 
                                value={`${window.location.origin}/auth/callback`}
                                className="flex-1 bg-transparent border-none text-[10px] text-rose-300 font-mono outline-none select-all focus:ring-0"
                              />
                              <button 
                                type="button" 
                                onClick={() => {
                                  navigator.clipboard.writeText(`${window.location.origin}/auth/callback`);
                                  alert("Redirect URL copied successfully!");
                                }}
                                className="px-1.5 py-0.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[9px] rounded border border-rose-500/20 transition active:scale-95 cursor-pointer font-bold"
                              >
                                Copy
                              </button>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={handleWordPressOAuth}
                            className="w-full py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 border border-rose-500/20 text-white rounded-xl text-xs font-mono font-bold transition shadow-md shadow-rose-600/10 cursor-pointer flex items-center justify-center gap-2"
                          >
                            <Globe className="w-4 h-4" />
                            Connect WordPress.com Site
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3 font-mono text-xs">
                          <div className="p-3 bg-[#0a0a0c] border border-white/5 rounded-xl space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-white/40 text-[10px]">CONNECTED HOST:</span>
                              <span className="text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                                LIVE SECURE SYNC
                              </span>
                            </div>
                            <p className="text-[12px] text-white font-bold">{wpBlogUrl || 'psalmify.wordpress.com'}</p>
                            
                            <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px]">
                              <span className="text-white/30">OAUTH ACCESS TOKEN:</span>
                              <span className="text-emerald-400 font-mono truncate max-w-[150px] block">{wpToken.substring(0, 15)}...</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={handleDisconnectWP}
                            className="w-full py-1.5 bg-red-950/10 hover:bg-red-950/25 border border-red-900/20 text-red-400 text-[10px] uppercase font-bold rounded-lg transition cursor-pointer"
                          >
                            Disconnect Site
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      {!wpToken || isRealWP ? (
                        <form onSubmit={handleWPLogin} className="space-y-3">
                          <p className="text-[11px] text-white/50 leading-relaxed font-mono">
                            To synchronize the final beautiful, styles-intact HTML layout directly into the WordPress post table databases, acquire a session JWT token.
                          </p>
                          
                          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                            <div className="bg-[#0a0a0c] border border-white/5 rounded p-1.5">
                              <span className="text-[9px] text-white/40 block">DEFAULT USER</span>
                              <span className="text-white/90 font-bold block">admin</span>
                            </div>
                            <div className="bg-[#0a0a0c] border border-white/5 rounded p-1.5">
                              <span className="text-[9px] text-white/40 block">DEFAULT PASSWORD</span>
                              <span className="text-white/90 font-bold block">admin123</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <span className="text-[9px] font-mono text-white/40 block">WP USERNAME</span>
                              <input
                                type="text"
                                value={wpUsername}
                                onChange={(e) => setWpUsername(e.target.value)}
                                className="w-full bg-[#0a0a0c] border border-white/10 rounded-lg p-2 text-xs text-white placeholder:text-white/20"
                              />
                            </div>
                            <div className="space-y-1">
                              <span className="text-[9px] font-mono text-white/40 block">WP PASSWORD</span>
                              <input
                                type="password"
                                value={wpPassword}
                                onChange={(e) => setWpPassword(e.target.value)}
                                className="w-full bg-[#0a0a0c] border border-white/10 rounded-lg p-2 text-xs text-white placeholder:text-white/20"
                              />
                            </div>
                          </div>

                          {wpAuthError && (
                            <p className="text-xs text-red-400 font-mono pt-1 flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Invalid WP details.
                            </p>
                          )}

                          <button
                            type="submit"
                            className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-mono transition-colors cursor-pointer"
                          >
                            {wpIsAuthenticating ? 'Issuing WP Rest Token...' : 'Acquire WordPress JWT Session Token'}
                          </button>
                        </form>
                      ) : (
                        <div className="space-y-3 font-mono text-xs">
                          <div className="p-3 bg-[#0a0a0c] border border-white/5 rounded-xl space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-white/40 text-[10px]">AUTH HANDSHAKE TOKEN:</span>
                              <span className="text-emerald-400 text-[10px] font-bold">✓ ACTIVE SESSION</span>
                            </div>
                            <p className="text-[11px] text-white/90 font-mono truncate">{wpToken}</p>
                            
                            <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px]">
                              <span className="text-white/30">JWT Token Expiry:</span>
                              {wpTokenTimeLeft > 0 ? (
                                <span className="text-amber-400 font-bold">{wpTokenTimeLeft} Seconds Remaining</span>
                              ) : (
                                <span className="text-red-400 font-bold">EXPIRED JWT STATUS</span>
                              )}
                            </div>
                          </div>

                          {/* Token operations panel cluster */}
                          <div className="flex justify-between gap-2.5">
                            <button
                              type="button"
                              onClick={autoWPLogin}
                              className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-[10px] uppercase font-bold rounded-lg transition cursor-pointer"
                            >
                              Refresh JWT Token
                            </button>
                            <button
                              type="button"
                              onClick={triggerSimulatedTokenExpiry}
                              className="flex-1 py-1.5 bg-red-950/10 hover:bg-red-950/25 border border-red-900/20 text-red-400 text-[10px] uppercase font-bold rounded-lg transition cursor-pointer"
                              title="Simulate token expiration to satisfy fallback verification check"
                            >
                              Simulate Token Expiry
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>

              {/* RIGHT COLUMN: The Real-Time styled visual preview and publishes (W: 55%) */}
              <div className="xl:col-span-7 space-y-6">
                
                {/* Visualizer header & publish triggers */}
                <div className="bg-[#0f0f12] border border-white/10 rounded-3xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <h3 className="font-bold text-white text-sm tracking-tight flex items-center gap-1.5 font-sans">
                      <Eye className="w-4 h-4 text-rose-500" />
                      Live Formatted Lyric Preview
                    </h3>

                    <div className="flex items-center gap-2">
                      {/* Local Save */}
                      <button
                        onClick={handleSaveLocal}
                        disabled={localSaveStatus === 'saving'}
                        className="py-1.5 px-3 bg-white/5 hover:bg-white/10 hover:border-white/20 border border-white/10 rounded-xl text-[11px] font-mono text-rose-450 font-bold flex items-center gap-1 transition cursor-pointer"
                      >
                        {localSaveStatus === 'saving' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : localSaveStatus === 'success' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        {selectedSongId ? 'Update Local' : 'Save Local'}
                      </button>

                      {/* Main publish button */}
                      <button
                        onClick={handleWordPressSync}
                        disabled={isSyncing}
                        className="py-1.5 px-4 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-[11px] font-mono font-black uppercase flex items-center gap-1 transition cursor-pointer"
                      >
                        {isSyncing ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Syncing database...
                          </>
                        ) : (
                          <>
                            <Globe className="w-3.5 h-3.5 fill-current" />
                            WordPress Sync & Publish
                          </>
                        )}
                      </button>
                    </div>

                  </div>

                  {/* Live WordPress publish alerts status states */}
                  {syncStatus !== 'idle' && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-4 rounded-2xl border text-xs leading-relaxed space-y-2 ${
                        syncStatus === 'success'
                          ? 'bg-emerald-950/20 border-emerald-500/25 text-emerald-400'
                          : 'bg-red-950/20 border-red-500/25 text-red-400'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold font-mono">
                        {syncStatus === 'success' ? (
                          <>
                            <div className="rounded-full bg-emerald-500 text-slate-950 p-0.5">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                            <span>REST SYNC OK - 210 CREATED SUCCESS STATUS RECEIVED!</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-4 h-4 text-red-400" />
                            <span>WP DATABASE ERROR ENCOUNTERED:</span>
                          </>
                        )}
                      </div>
                      
                      <p className="font-mono text-[11px]">{syncMessage}</p>

                      {syncStatus === 'success' && syncedWPLink && (
                        <div className="pt-1.5 border-t border-emerald-500/20 flex justify-between items-center text-[10px] font-mono">
                          <span>Payload rendering classes preserved permanently.</span>
                          <a 
                            href={syncedWPLink} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="bg-emerald-550 text-white px-2 py-0.5 rounded font-bold hover:bg-emerald-500 transition"
                          >
                            Explore Published Page
                          </a>
                        </div>
                      )}

                      {syncStatus === 'error' && (
                        <div className="pt-1.5 border-t border-red-500/20 flex flex-wrap justify-between items-center text-[10px] font-mono gap-2">
                          <span>Check if authorization JWT header token is missing or has expired.</span>
                          <button 
                            onClick={autoWPLogin}
                            className="bg-red-400 text-slate-950 px-2.5 py-0.5 rounded font-bold hover:bg-red-300 transition cursor-pointer"
                          >
                            Acquire Fresh JWT Token
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* AI advisor and suggestions block */}
                  {(aiInsights || aiSuggestions.length > 0) && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="bg-rose-500/5 border border-rose-500/15 p-4 rounded-2xl space-y-2 text-xs"
                    >
                      <span className="text-rose-400 font-bold flex items-center gap-1 font-mono">
                        <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                        AI producer advice:
                      </span>
                      {aiInsights && <p className="text-white/80 leading-relaxed font-mono">{aiInsights}</p>}
                      {aiSuggestions.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-white/50 pt-1 font-mono">
                          {aiSuggestions.map((s, idx) => (
                            <div key={idx} className="flex gap-1">
                              <span className="text-rose-450 font-bold">•</span>
                              <span>{s}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Render preview space mirroring SongLyricsView component precisely */}
                  <div className="bg-[#070708] border border-white/10 rounded-3xl p-5 md:p-6 space-y-5 max-h-[500px] overflow-y-auto custom-scrollbar">
                    
                    <div className="flex justify-between items-center border-b border-white/5 pb-3 mb-2">
                      <div>
                        <h4 className="text-rose-455 font-mono text-[10px] font-bold tracking-widest uppercase">Live Screen Preview Panel</h4>
                        <p className="text-white/40 text-[10px] font-mono">{songTitle || 'UNTITLED TRACK'} • {songArtist || 'UNKNOWN ARTIST'}</p>
                      </div>
                      <span className="text-[9px] bg-white/5 border border-white/5 text-white/55 px-1.5 py-0.5 rounded uppercase font-mono">WYSIWYG Mode</span>
                    </div>

                    {previewSections.length === 0 ? (
                      <div className="text-center py-20 text-white/30 text-xs font-mono">
                        Lyrics preview will generate and automatically format as you type lyrics content.
                      </div>
                    ) : (
                      previewSections.map((section, sIdx) => {
                        const isChorus = section.type === 'chorus';
                        const isBridge = section.type === 'bridge';
                        const isHook = section.type === 'hook';
                        const isIntro = section.type === 'intro' || section.type === 'outro';

                        // CSS classes matching the display board exactly
                        let containerClass = "relative rounded-2xl border p-4 transition-all ";
                        let headerClass = "text-[11px] font-bold tracking-wider font-mono mb-2 uppercase flex items-center justify-between ";
                        let lineClass = "leading-relaxed text-sm tracking-wide ";

                        if (isChorus) {
                          containerClass += "bg-rose-500/10 border-rose-500/25 border-l-4 border-l-rose-500 pl-5";
                          headerClass += "text-rose-400";
                          lineClass += "font-semibold text-white text-[16px] font-serif"; // slightly bolder slightly larger
                        } else if (isBridge || isHook) {
                          containerClass += "bg-amber-500/5 border-amber-500/25 border-l-4 border-l-amber-500 pl-5";
                          headerClass += "text-amber-400";
                          lineClass += "text-white/90 font-serif italic";
                        } else if (isIntro) {
                          containerClass += "bg-white/[0.01] border-white/5 border-l-4 border-l-white/25 pl-5 ";
                          headerClass += "text-white/40";
                          lineClass += "text-white/50 font-mono text-xs"; // smaller cleaner stanza sizes
                        } else {
                          containerClass += "bg-transparent border-transparent border-l-4 border-l-white/10 pl-5";
                          headerClass += "text-white/30";
                          lineClass += "text-white/95 text-[14px]"; // standard smaller font size
                        }

                        return (
                          <div key={sIdx} className={containerClass}>
                            <div className={headerClass}>
                              <span className="flex items-center gap-1">
                                {isChorus && <Sparkles className="w-3.5 h-3.5 text-rose-450" />}
                                {section.label}
                              </span>
                              <span className="text-[8px] font-mono text-white/40 bg-white/5 border border-white/5 px-1 py-0.5 rounded leading-none uppercase">
                                {section.type}
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              {section.lines.map((line, lIdx) => (
                                <p key={lIdx} className={lineClass}>{line}</p>
                              ))}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Database logs and validation indicators */}
                {selectedSongId && (
                  <div className="bg-[#0f0f12] border border-red-950/40 rounded-2xl p-4 flex items-center justify-between text-xs font-mono bg-red-950/5">
                    <span className="text-red-400 font-bold flex items-center gap-1.5">
                      <Trash2 className="w-4 h-4" /> Danger Zone operations:
                    </span>
                    <button
                      onClick={() => handleDeleteSong(selectedSongId)}
                      className="py-1 px-3 bg-red-600 text-white hover:bg-red-500 font-bold rounded-lg transition text-[10px] cursor-pointer"
                    >
                      Delete Track
                    </button>
                  </div>
                )}

              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
