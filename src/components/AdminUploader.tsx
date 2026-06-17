import React, { useState, useEffect } from 'react';
import { Song, Playlist, FormattedSection } from '../types';
import { parseRawLyrics, buildHTMLFromSections } from '../utils/lyricParser';
import { db, auth, OperationType, handleFirestoreError } from '../utils/firebase';
import { 
  collection, doc, onSnapshot, updateDoc, deleteDoc, 
  addDoc, setDoc, query, where, getDocs 
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { 
  Lock, Sparkles, FileText, Globe, RefreshCcw, Check, 
  AlertTriangle, Loader2, Save, Trash2, ListMusic as PlaylistIcon, Plus, Eye,
  Settings, LogOut, CheckCircle2, ChevronRight, Share2, ArrowRight,
  Inbox, List, Layers, ShieldAlert, BadgeInfo, FileEdit, PlusCircle, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminUploaderProps {
  playlists: Playlist[];
  songs: Song[];
  onRefreshData: () => void;
  user: any; // Checked Firebase user
  onAuthError?: (errInfo: { code: string; message: string; domain: string }) => void;
}

export default function AdminUploader({ playlists, songs, onRefreshData, user, onAuthError }: AdminUploaderProps) {
  // Check if current user is admin
  const isAdmin = user?.email === 'therishx@gmail.com';

  // Active Admin Subsystem Tab
  const [adminTab, setAdminTab] = useState<'approvals' | 'songs_director' | 'playlists_director' | 'composer' | 'wordpress'>('approvals');

  // Unified lists synced in real-time from Firestore
  const [allFirestoreSongs, setAllFirestoreSongs] = useState<Song[]>([]);
  const [allFirestorePlaylists, setAllFirestorePlaylists] = useState<Playlist[]>([]);
  const [dbLoading, setDbLoading] = useState(true);

  // Song Composer Form States
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

  // Playlist Manager Form States
  const [playlistEditId, setPlaylistEditId] = useState<string>('');
  const [playlistName, setPlaylistName] = useState('');
  const [playlistDescription, setPlaylistDescription] = useState('');
  const [playlistGenre, setPlaylistGenre] = useState('Contemporary');
  const [playlistCoverUrlForm, setPlaylistCoverUrlForm] = useState('');
  const [playlistSongIds, setPlaylistSongIds] = useState<string[]>([]);
  const [isSavingPlaylist, setIsSavingPlaylist] = useState(false);

  // WordPress Synchronization Integration States
  const [wpUsername, setWpUsername] = useState('admin');
  const [wpPassword, setWpPassword] = useState('Jesus@9664808@');
  const [wpToken, setWpToken] = useState<string>(() => (typeof window !== 'undefined' && localStorage.getItem('wpToken')) || '');
  const [wpTokenExpiry, setWpTokenExpiry] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const expires = localStorage.getItem('wpTokenExpiry');
    return expires ? parseInt(expires, 10) : 0;
  });
  const [wpTokenTimeLeft, setWpTokenTimeLeft] = useState<number>(0);
  const [wpIsAuthenticating, setWpIsAuthenticating] = useState(false);
  const [wpAuthError, setWpAuthError] = useState('');

  // WordPress Blog Connect config
  const [isRealWP, setIsRealWP] = useState<boolean>(() => typeof window !== 'undefined' && localStorage.getItem('isRealWP') === 'true');
  const [wpBlogId, setWpBlogId] = useState<string>(() => (typeof window !== 'undefined' && localStorage.getItem('wpBlogId')) || '');
  const [wpBlogUrl, setWpBlogUrl] = useState<string>(() => (typeof window !== 'undefined' && localStorage.getItem('wpBlogUrl')) || 'psalmify.wordpress.com');
  const [wpMode, setWpMode] = useState<'live' | 'simulated'>(() => (typeof window !== 'undefined' && (localStorage.getItem('wpMode') as 'live' | 'simulated')) || 'simulated');
  const [redirectCopied, setRedirectCopied] = useState(false);
  const [wpDiaOpen, setWpDiaOpen] = useState(true); // default true to proactively assist the user with their diagnosis!

  const [diagResults, setDiagResults] = useState<any>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagError, setDiagError] = useState<string | null>(null);

  const handleRunDiagnostics = async () => {
    setDiagLoading(true);
    setDiagError(null);
    setDiagResults(null);
    try {
      const res = await fetch('/api/wordpress/oauth/diagnostics');
      const contentType = res.headers.get('content-type') || '';
      
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        console.error("Diagnostics returned non-JSON:", text);
        
        let extraInfo = "The server did not respond with a valid JSON payload. Instead, it returned an HTML body.";
        if (text.includes("A server error occurred") || text.includes("An error occurred") || text.includes("500") || text.includes("Vercel Boot Exception")) {
          extraInfo = "Vercel's serverless backend function has crashed at boot-time. This is often caused by a compilation error, a syntax problem in server.ts, or a missing environment variable dependency.";
        } else if (text.trim().startsWith("<!DOCTYPE html>") || text.includes("<html")) {
          extraInfo = "Vercel returned your static index.html. This means the rewrites inside your `vercel.json` are inactive, or Vercel failed to map the serverless dynamic functions at `/api/wordpress/*` correctly.";
        }
        
        setDiagError(`${extraInfo}\n\n[Raw Output Segment]:\n${text.substring(0, 500)}${text.length > 500 ? '...' : ''}`);
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        setDiagError(data.error || 'Server returned an error status during diagnostic checks.');
        return;
      }
      setDiagResults(data);
    } catch (err: any) {
      console.error("Failed to run diagnostics:", err);
      setDiagError(`Unreachable server or connection issue: ${err.message || String(err)}`);
    } finally {
      setDiagLoading(false);
    }
  };

  const [previewSections, setPreviewSections] = useState<FormattedSection[]>([]);

  // Real-time listener for ALL Firestore collections
  useEffect(() => {
    if (!isAdmin) return;

    setDbLoading(true);
    // Listen to all songs
    const unsubSongs = onSnapshot(collection(db, "songs"), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      // Sort: pending first, then by title
      list.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return a.title.localeCompare(b.title);
      });
      setAllFirestoreSongs(list);
      setDbLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "songs");
    });

    // Listen to all playlists
    const unsubPlaylists = onSnapshot(collection(db, "playlists"), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      list.sort((a, b) => b.createdAt?.localeCompare(a.createdAt || '') || 0);
      setAllFirestorePlaylists(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "playlists");
    });

    return () => {
      unsubSongs();
      unsubPlaylists();
    };
  }, [isAdmin]);

  // Sync previews on raw lyric input
  useEffect(() => {
    const parsed = parseRawLyrics(songRawLyrics);
    setPreviewSections(parsed);
  }, [songRawLyrics]);

  // WordPress JWT expiry countdown
  useEffect(() => {
    if (!wpToken || wpTokenExpiry <= 0) return;
    const interval = setInterval(() => {
      const left = Math.max(0, Math.round((wpTokenExpiry - Date.now()) / 1000));
      setWpTokenTimeLeft(left);
    }, 1000);
    return () => clearInterval(interval);
  }, [wpToken, wpTokenExpiry]);

  // Handle localstorage options for WordPress config
  useEffect(() => {
    localStorage.setItem('wpToken', wpToken);
    localStorage.setItem('wpTokenExpiry', String(wpTokenExpiry));
    localStorage.setItem('isRealWP', isRealWP ? 'true' : 'false');
    localStorage.setItem('wpBlogId', wpBlogId);
    localStorage.setItem('wpBlogUrl', wpBlogUrl);
    localStorage.setItem('wpMode', wpMode);
  }, [wpToken, wpTokenExpiry, isRealWP, wpBlogId, wpBlogUrl, wpMode]);

  // Connect Real WordPress OAuth Event listener
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data && event.data.type === 'WP_OAUTH_SUCCESS') {
        const { access_token, blog_id, blog_url } = event.data;
        if (access_token) {
          setWpToken(access_token);
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
          setSyncMessage('Successfully authenticated Google OAuth - WordPress.com connected!');
          setSyncStatus('success');
        }
      }
    };
    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, []);

  const handleDisconnectWP = () => {
    setWpToken('');
    setWpTokenExpiry(0);
    setWpTokenTimeLeft(0);
    setIsRealWP(false);
    setSyncStatus('idle');
    setSyncMessage('Disconnected WordPress blog site successfully.');
  };

  const handleWordPressOAuth = async () => {
    try {
      const finalRedirectUri = window.location.origin + '/auth/callback';
      const res = await fetch(`/api/wordpress/oauth/url?redirect_uri=${encodeURIComponent(finalRedirectUri)}`);
      
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        console.error('WordPress OAuth response was not JSON:', text);
        alert(
          "Could not initialize WordPress Connection:\n\n" +
          "Your current host is not running the full-stack server backend. If you are browsing from a static hosting provider (like Vercel), " +
          "the backend server routes in `server.ts` are unreachable. Real-time WordPress OAuth synchronization requires the full-stack server backend to be running.\n\n" +
          "Ensure you use the AI Studio preview URL, or configure your host to run the Node.js backend.\n\n" +
          "Required secrets:\n" +
          "- WORDPRESS_CLIENT_ID\n" +
          "- WORDPRESS_CLIENT_SECRET"
        );
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Enable WordPress configuration properties in workspace settings first.');
        return;
      }

      if (!data.url) {
        alert("Server failed to generate a valid WordPress authorization URL.");
        return;
      }

      const { url } = data;
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      window.open(url, 'wordpress_oauth_popup', `width=${width},height=${height},top=${top},left=${left},scrollbars=yes`);
    } catch (err: any) {
      alert('Could not open WordPress OAuth: ' + err.message);
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
      setWpAuthError('Unable to route WP login handshake.');
    } finally {
      setWpIsAuthenticating(false);
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

  // Automated WordPress REST Sync publishing
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncedWPLink, setSyncedWPLink] = useState('');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');

  const handleWordPressSync = async () => {
    if (!songTitle || !songRawLyrics) {
      setSyncStatus('error');
      setSyncMessage('Name of the song and lyric contents are required.');
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
      if (res.ok) {
        setSyncStatus('success');
        setSyncedWPLink(data.link || `https://${wpBlogUrl}/?p=${data.id}`);
        setSyncMessage(`Synced successfully to WordPress REST DB! Target ID: #${data.id}`);
        await handleSaveLyricComposer();
      } else {
        setSyncStatus('error');
        setSyncMessage(data.message || 'REST synchronization failed.');
      }
    } catch (e) {
      setSyncStatus('error');
      setSyncMessage('shake connection error with WordPress server.');
    } finally {
      setIsSyncing(false);
    }
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
      console.error("AI formatting failure - running local client-side backup parse.", e);
    } finally {
      setIsAiBeautifying(false);
    }
  };

  // Reset Lyric Composer form
  const handleComposerReset = () => {
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

  // Load song into Form Composer
  const handleLoadToComposer = (song: Song) => {
    setSelectedSongId(song.id);
    setSongTitle(song.title);
    setSongArtist(song.artist);
    setSongAlbum(song.album || '');
    setSongGenre(song.genre);
    setSongDuration(song.duration || '3:30');
    setSongRawLyrics(song.rawLyrics);
    setSongCoverUrl(song.coverUrl || '');
    setSongYoutubeUrl(song.youtubeUrl || '');
    
    // Check which playlists contain this song
    const listMap = allFirestorePlaylists
      .filter(p => p.songIds?.includes(song.id))
      .map(p => p.id);
    setAssignedPlaylists(listMap);

    setSyncStatus('idle');
    setSyncMessage('');
    setAdminTab('composer');
  };

  // Write new or updated Song to Firestore
  const [songSaveStatus, setSongSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');
  const handleSaveLyricComposer = async () => {
    if (!songTitle.trim() || !songArtist.trim() || !songRawLyrics.trim()) {
      alert("Missing required fields: Song Name, Artist Name, and Raw Lyrics.");
      return;
    }
    setSongSaveStatus('saving');
    try {
      const formatted = parseRawLyrics(songRawLyrics);
      const songId = selectedSongId || 'song_' + Math.random().toString(36).substring(2, 11);

      const songData = {
        id: songId,
        title: songTitle.trim(),
        artist: songArtist.trim(),
        album: songAlbum.trim() || null,
        genre: songGenre,
        duration: songDuration.trim() || "3:30",
        rawLyrics: songRawLyrics,
        formattedLyrics: formatted,
        coverUrl: songCoverUrl.trim() || null,
        youtubeUrl: songYoutubeUrl.trim() || null,
        status: 'approved', // Saving as Admin immediately approves it
        submittedBy: user?.email || 'admin',
        submittedByName: user?.displayName || 'Administrator',
        createdAt: new Date().toISOString()
      };

      // Upsert document
      await setDoc(doc(db, "songs", songId), songData);

      // Update playlists mapping
      for (const playlist of allFirestorePlaylists) {
        const inSelected = assignedPlaylists.includes(playlist.id);
        const containsSong = playlist.songIds?.includes(songId);

        if (inSelected && !containsSong) {
          // Add to playlist
          const updatedIds = [...(playlist.songIds || []), songId];
          await updateDoc(doc(db, "playlists", playlist.id), { songIds: updatedIds });
        } else if (!inSelected && containsSong) {
          // Remove from playlist
          const updatedIds = (playlist.songIds || []).filter(id => id !== songId);
          await updateDoc(doc(db, "playlists", playlist.id), { songIds: updatedIds });
        }
      }

      setSongSaveStatus('success');
      setTimeout(() => {
        setSongSaveStatus('idle');
        setAdminTab('songs_director');
        handleComposerReset();
        onRefreshData();
      }, 1500);

    } catch (err) {
      console.error("Error storing details in database:", err);
      alert("Failed to write to Cloud Database.");
      setSongSaveStatus('idle');
    }
  };

  // Delete song
  const handleDeleteSong = async (sId: string) => {
    if (!confirm("Are you sure you want to permanently delete this track from Cloud Database?")) return;
    try {
      await deleteDoc(doc(db, "songs", sId));
      onRefreshData();
    } catch (err) {
      console.error(err);
    }
  };

  // Moderate submittal approvals (Approve / Reject)
  const handleApproveSong = async (song: Song) => {
    try {
      await updateDoc(doc(db, "songs", song.id), { status: 'approved' });
      onRefreshData();
    } catch (err) {
      console.error("Error approving song:", err);
    }
  };

  const handleApprovePlaylist = async (pl: Playlist) => {
    try {
      await updateDoc(doc(db, "playlists", pl.id), { status: 'approved' });
      onRefreshData();
    } catch (err) {
      console.error("Error approving playlist:", err);
    }
  };

  // Playlists manager Operations
  const handleResetPlaylistForm = () => {
    setPlaylistEditId('');
    setPlaylistName('');
    setPlaylistDescription('');
    setPlaylistCoverUrlForm('');
    setPlaylistGenre('Contemporary');
    setPlaylistSongIds([]);
  };

  const handleLoadPlaylistToForm = (pl: Playlist) => {
    setPlaylistEditId(pl.id);
    setPlaylistName(pl.name);
    setPlaylistDescription(pl.description);
    setPlaylistCoverUrlForm(pl.coverUrl || '');
    setPlaylistGenre(pl.genre || 'Contemporary');
    setPlaylistSongIds(pl.songIds || []);
  };

  const handleSavePlaylistForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistName.trim() || !playlistDescription.trim()) {
      alert("Please provide the playlist name and a short description.");
      return;
    }

    setIsSavingPlaylist(true);
    try {
      const pId = playlistEditId || 'playlist_' + Math.random().toString(36).substring(2, 11);
      
      const playlistData = {
        id: pId,
        name: playlistName.trim(),
        description: playlistDescription.trim(),
        genre: playlistGenre,
        coverUrl: playlistCoverUrlForm.trim() || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600&auto=format&fit=crop',
        songIds: playlistSongIds,
        status: 'approved',
        submittedBy: user?.email || 'admin',
        submittedByName: user?.displayName || 'Administrator',
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, "playlists", pId), playlistData);
      handleResetPlaylistForm();
      onRefreshData();
      alert("Playlist details saved durably!");
    } catch (err) {
      console.error("Error saving playlist:", err);
    } finally {
      setIsSavingPlaylist(false);
    }
  };

  const handleDeletePlaylist = async (pId: string) => {
    if (!confirm("Are you sure you want to delete this compilation playlist from Cloud Databases?")) return;
    try {
      await deleteDoc(doc(db, "playlists", pId));
      onRefreshData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleTogglePlaylistSong = (songId: string) => {
    setPlaylistSongIds(prev => 
      prev.includes(songId) ? prev.filter(id => id !== songId) : [...prev, songId]
    );
  };

  const handleSubmissionsClean = async (id: string, isSong: boolean) => {
    if (!confirm("Are you sure you want to reject and delete this submittal proposal?")) return;
    try {
      const colName = isSong ? "songs" : "playlists";
      await deleteDoc(doc(db, colName, id));
      onRefreshData();
    } catch (err) {
      console.error("Error deleting document:", err);
    }
  };

  // If not logged in, show Google login screen
  if (!user) {
    return (
      <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-6 shadow-sm my-16">
        <div className="mx-auto w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 shadow-sm">
          <Lock className="w-6 h-6" />
        </div>
        <div className="space-y-2">
          <h2 className="text-base font-sans font-black text-slate-900 tracking-tight">Psalmify Workspace Directory</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Welcome to the secure submitter and administration portal. Please log in with your Google Account to contribute lyrics, propose curated playlists, or access owner tools.
          </p>
        </div>
        <div className="pt-2 flex justify-center">
          <button
            onClick={async () => {
              const { signInWithPopup } = await import('firebase/auth');
              const { auth, googleProvider } = await import('../utils/firebase');
              try {
                await signInWithPopup(auth, googleProvider);
              } catch (err: any) {
                if (err?.code === 'auth/unauthorized-domain' || err?.message?.includes('unauthorized-domain')) {
                  if (onAuthError) {
                    onAuthError({
                      code: err.code || 'auth/unauthorized-domain',
                      message: err.message || '',
                      domain: window.location.hostname
                    });
                  }
                } else {
                  alert("Authentication Failed: " + (err.message || err));
                }
              }
            }}
            className="w-full py-3 px-5 bg-slate-900 border border-slate-950 hover:bg-slate-800 text-white rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-2.5 transition cursor-pointer shadow-sm active:scale-[0.99]"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            <span>Sign In with Google</span>
          </button>
        </div>
      </div>
    );
  }

  // If logged in but not admin, show locked alert with account info
  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-6 shadow-sm my-16">
        <div className="mx-auto w-12 h-12 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-500 shadow-sm">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div className="space-y-2">
          <h2 className="text-base font-bold text-slate-905">Unauthorized Workspace Access</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            You are successfully logged in as <span className="font-semibold text-slate-800">{user?.email}</span>.
            However, this Admin dashboard workspace is reserved exclusively for the system administrator <span className="text-slate-900 font-bold">therishx@gmail.com</span>.
          </p>
          <div className="text-[11px] text-rose-500 font-mono mt-3 bg-rose-50 border border-rose-100 p-3 rounded-xl flex items-start gap-2 text-left leading-relaxed">
            <BadgeInfo className="w-4 h-4 flex-shrink-0 text-rose-500 mt-0.5" />
            <p>
              Regular contributors can submit lyrics or propose themed compilation playlists directly from the public catalogue layout!
            </p>
          </div>
        </div>
        <div className="pt-2 flex justify-center gap-3">
          <button
            onClick={() => signOut(auth)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    );
  }

  const pendedSongs = allFirestoreSongs.filter(s => s.status === 'pending');
  const pendedPlaylists = allFirestorePlaylists.filter(p => p.status === 'pending');
  const approvedSongsList = allFirestoreSongs.filter(s => s.status !== 'pending');

  return (
    <div className="space-y-6" id="admin-main">
      <div className="bg-slate-900 rounded-2xl p-6 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-mono bg-emerald-500 text-slate-950 font-extrabold px-2.5 py-0.5 rounded-full uppercase">
              Admin Access Active
            </span>
            <span className="text-slate-400 text-xs font-mono">{user?.email}</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">Portal Submissions & Cloud Director</h2>
          <p className="text-slate-400 text-xs mt-0.5 font-mono">
            Directly review user submissions, handle full database record edits (CRUD), and synchronise HTML posts to WordPress.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => signOut(auth)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-350 rounded-xl text-xs font-mono font-bold transition flex items-center gap-2 border border-slate-700/60 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out Workspace</span>
          </button>
        </div>
      </div>

      {/* ADMIN TABS GRID */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-px text-xs font-mono font-bold">
        <button
          onClick={() => setAdminTab('approvals')}
          className={`px-4 py-3 border-b-2 transition flex items-center gap-2.5 cursor-pointer ${
            adminTab === 'approvals' 
              ? 'border-slate-900 text-slate-900 bg-white/50' 
              : 'border-transparent text-slate-455 hover:text-slate-800'
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>Moderation Desk</span>
          {(pendedSongs.length + pendedPlaylists.length) > 0 && (
            <span className="bg-rose-500 text-white text-[9px] font-sans px-2 py-0.5 rounded-full animate-bounce">
              {pendedSongs.length + pendedPlaylists.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setAdminTab('songs_director')}
          className={`px-4 py-3 border-b-2 transition flex items-center gap-2.5 cursor-pointer ${
            adminTab === 'songs_director' 
              ? 'border-slate-900 text-slate-900 bg-white/50' 
              : 'border-transparent text-slate-455 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Lyrics Director (CRUD)</span>
        </button>

        <button
          onClick={() => setAdminTab('playlists_director')}
          className={`px-4 py-3 border-b-2 transition flex items-center gap-2.5 cursor-pointer ${
            adminTab === 'playlists_director' 
              ? 'border-slate-900 text-slate-900 bg-white/50' 
              : 'border-transparent text-slate-455 hover:text-slate-800'
          }`}
        >
          <PlaylistIcon className="w-4 h-4" />
          <span>Playlists Director (CRUD)</span>
        </button>

        <button
          onClick={() => setAdminTab('composer')}
          className={`px-4 py-3 border-b-2 transition flex items-center gap-2.5 cursor-pointer ${
            adminTab === 'composer' 
              ? 'border-slate-900 text-slate-900 bg-white/50' 
              : 'border-transparent text-slate-455 hover:text-slate-800'
          }`}
        >
          <FileEdit className="w-4 h-4" />
          <span>Lyrics Draft Composer</span>
        </button>

        <button
          onClick={() => setAdminTab('wordpress')}
          className={`px-4 py-3 border-b-2 transition flex items-center gap-2.5 cursor-pointer ${
            adminTab === 'wordpress' 
              ? 'border-slate-900 text-slate-900 bg-white/50' 
              : 'border-transparent text-slate-455 hover:text-slate-800'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>WordPress REST Gateway</span>
        </button>
      </div>

      {/* TAB PREVIEWS */}
      <div className="pt-2">
        <AnimatePresence mode="wait">
          {dbLoading ? (
            <div className="text-center py-24 text-xs font-mono text-slate-400 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-rose-500" />
              <span>Fetching Cloud Firestore documents...</span>
            </div>
          ) : (
            <motion.div
              key={adminTab}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              
              {/* TAB 1: APPROVALS & MODERATION DESK */}
              {adminTab === 'approvals' && (
                <div className="space-y-6">
                  <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-4 flex gap-3 text-xs leading-relaxed text-amber-800 max-w-xl">
                    <BadgeInfo className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
                    <p>
                      <strong>Moderation Desk Instructions:</strong> Proactive community drafts are listed below. Approve to push live immediately to public catalogs, edit, or reject the proposals cleanly.
                    </p>
                  </div>

                  {pendedSongs.length === 0 && pendedPlaylists.length === 0 ? (
                    <div className="text-center py-20 bg-white border border-slate-200 rounded-2xl text-xs text-slate-400 font-mono space-y-1.5 shadow-sm">
                      <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto" />
                      <p className="font-bold text-slate-800 text-sm">Approvals Desk is Clear!</p>
                      <p className="text-slate-400">All submitted lyrics and playlist proposals have been resolved.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* PENDING SONGS SUBMISSIONS */}
                      <div className="space-y-3">
                        <h3 className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase flex items-center justify-between">
                          <span>Pending Song Drafts ({pendedSongs.length})</span>
                          <span className="text-[10px] bg-slate-100 text-slate-650 px-2 py-0.5 rounded border border-slate-200">SONGS</span>
                        </h3>

                        {pendedSongs.length === 0 ? (
                          <div className="p-8 text-center bg-white border border-dashed border-slate-200 rounded-xl font-mono text-slate-400 text-xs">
                            No pending song lyrics at this time.
                          </div>
                        ) : (
                          pendedSongs.map((song) => (
                            <div key={song.id} className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 space-y-4 shadow-sm relative overflow-hidden">
                              <div className="absolute top-0 right-0 bg-amber-500 text-slate-950 font-mono font-bold text-[8px] px-2.5 py-0.5 rounded-bl uppercase">
                                PENDING REVIEW
                              </div>

                              <div className="space-y-1 pr-16">
                                <h4 className="font-bold text-sm text-slate-900 leading-tight">{song.title}</h4>
                                <p className="text-xs text-slate-500">Artist: <span className="font-bold">{song.artist}</span> • Genre: <span className="font-semibold text-slate-600">{song.genre}</span></p>
                                <p className="text-[10px] font-mono text-slate-400 mt-1">
                                  Submitted by: <span className="text-slate-600 font-semibold">{song.submittedByName}</span> ({song.submittedBy})
                                </p>
                              </div>

                              <div className="bg-slate-50 border border-slate-150 p-3 rounded-lg max-h-[140px] overflow-y-auto text-[10px] font-mono leading-relaxed text-slate-500 custom-scrollbar whitespace-pre-wrap">
                                {song.rawLyrics}
                              </div>

                              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                                <button
                                  onClick={() => handleSubmissionsClean(song.id, true)}
                                  className="px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 border border-red-150 rounded-lg font-mono font-bold transition cursor-pointer"
                                >
                                  Reject Proposal
                                </button>
                                <button
                                  onClick={() => handleLoadToComposer(song)}
                                  className="px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg font-mono font-bold transition flex items-center gap-1 cursor-pointer"
                                >
                                  <FileEdit className="w-3 h-3" />
                                  <span>Edit & Custom Approve</span>
                                </button>
                                <button
                                  onClick={() => handleApproveSong(song)}
                                  className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-mono font-bold transition flex items-center gap-1 cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Approve Immediately</span>
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* PENDING PLAYLISTS SUBMISSIONS */}
                      <div className="space-y-3">
                        <h3 className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase flex items-center justify-between">
                          <span>Pending Playlists Proposals ({pendedPlaylists.length})</span>
                          <span className="text-[10px] bg-slate-100 text-slate-650 px-2 py-0.5 rounded border border-slate-200">PLAYLISTS</span>
                        </h3>

                        {pendedPlaylists.length === 0 ? (
                          <div className="p-8 text-center bg-white border border-dashed border-slate-200 rounded-xl font-mono text-slate-400 text-xs">
                            No pending playlist themes currently.
                          </div>
                        ) : (
                          pendedPlaylists.map((pl) => (
                            <div key={pl.id} className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 space-y-4 shadow-sm relative overflow-hidden">
                              <div className="absolute top-0 right-0 bg-amber-500 text-slate-950 font-mono font-bold text-[8px] px-2.5 py-0.5 rounded-bl uppercase">
                                PENDING THEME
                              </div>

                              <div className="space-y-1.5 pr-14">
                                <h4 className="font-bold text-sm text-slate-900 leading-tight">{pl.name}</h4>
                                <p className="text-xs text-slate-600 leading-relaxed font-sans">{pl.description}</p>
                                <div className="text-[10px] font-mono text-slate-400 pt-0.5 flex flex-wrap gap-2">
                                  <span>Genre: <span className="text-slate-600 font-bold">{pl.genre}</span></span>
                                  <span>•</span>
                                  <span>Suggested Bundle Size: <span className="text-slate-600 font-bold">{pl.songIds?.length || 0} tracks</span></span>
                                </div>
                                <p className="text-[10px] font-mono text-slate-400 mt-1">
                                  Proposed by: <span className="text-slate-600 font-bold">{pl.submittedByName}</span> ({pl.submittedBy})
                                </p>
                              </div>

                              {/* Song Details Bundle Previews */}
                              <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-lg space-y-1 max-h-[140px] overflow-y-auto font-mono text-[10px] leading-relaxed custom-scrollbar">
                                <div className="text-slate-400 border-b border-slate-200 pb-1 mb-1 font-bold">SUGGESTED SOURCE SONGS Checklist:</div>
                                {pl.songIds && pl.songIds.map(sId => {
                                  const matching = songs.find(s => s.id === sId);
                                  return (
                                    <div key={sId} className="flex justify-between items-center bg-white border border-slate-150 p-1.5 rounded">
                                      <span className="truncate max-w-[200px]">{matching ? `${matching.title} - ${matching.artist}` : `ID: ${sId}`}</span>
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                                <button
                                  onClick={() => handleSubmissionsClean(pl.id, false)}
                                  className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 border border-red-150 rounded-lg font-mono font-bold transition cursor-pointer"
                                >
                                  Reject
                                </button>
                                <button
                                  onClick={() => handleApprovePlaylist(pl)}
                                  className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-mono font-bold transition flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Approve Theme Block</span>
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: SONGS DIRECTOR (CRUD CATALOG) */}
              {adminTab === 'songs_director' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                      Active Approved Song Catalog ({approvedSongsList.length} Tracks)
                    </h3>
                    <button
                      onClick={() => { handleComposerReset(); setAdminTab('composer'); }}
                      className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-950 hover:bg-slate-800 text-white rounded-xl font-mono font-bold flex items-center gap-1.5 cursor-pointer shadow-sm ml-auto"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Compose Track New</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {approvedSongsList.map((song) => (
                      <div key={song.id} className="bg-white border border-slate-205 rounded-xl p-4 flex gap-3 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all">
                        <div className="w-12 h-12 rounded bg-slate-50 border border-slate-150 overflow-hidden flex-shrink-0">
                          <img
                            referrerPolicy="no-referrer"
                            src={song.coverUrl || 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=600&auto=format&fit=crop'}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="flex-grow min-w-0 flex flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between gap-2.5">
                              <h4 className="font-bold text-slate-900 text-xs truncate leading-tight">{song.title}</h4>
                              <span className="text-[8px] bg-slate-100 font-mono text-slate-500 border border-slate-200 px-1 py-0.2 rounded uppercase">
                                {song.genre}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 truncate">{song.artist}</p>
                          </div>

                          <div className="flex items-center justify-end gap-1.5 border-t border-slate-50 pt-2 mt-2">
                            <button
                              onClick={() => handleDeleteSong(song.id)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-slate-50 transition cursor-pointer"
                              title="Delete permanently from databases"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleLoadToComposer(song)}
                              className="px-2 py-0.8 bg-slate-100 hover:bg-slate-200 font-mono font-bold text-[9px] text-slate-650 border border-slate-200 rounded transition cursor-pointer"
                            >
                              Edit / Composer
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: PLAYLISTS DIRECTOR (CRUD PLAYLIST BUILDER) */}
              {adminTab === 'playlists_director' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  
                  {/* Playlist Creator Form */}
                  <form onSubmit={handleSavePlaylistForm} className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm h-fit">
                    <h3 className="text-xs font-mono font-bold border-b border-slate-100 pb-2 text-slate-450 uppercase flex items-center justify-between">
                      <span>{playlistEditId ? 'Edit Compilation Playlist' : 'Create Custom Playlist'}</span>
                      <span className="text-[9px] font-normal tracking-normal lowercase italic text-rose-500 rounded">CRUD Engine</span>
                    </h3>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-mono font-bold tracking-wider text-slate-400 block uppercase">Playlist Title *</label>
                      <input
                        type="text"
                        required
                        value={playlistName}
                        onChange={(e) => setPlaylistName(e.target.value)}
                        placeholder="Morning Acoustic Devotionals"
                        className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white outline-none rounded-xl p-2.5 text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-mono font-bold tracking-wider text-slate-400 block uppercase">Description *</label>
                      <input
                        type="text"
                        required
                        value={playlistDescription}
                        onChange={(e) => setPlaylistDescription(e.target.value)}
                        placeholder="Compile peaceful hymns for quiet early reflections..."
                        className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white outline-none rounded-xl p-2.5 text-xs font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-mono font-bold tracking-wider text-slate-400 block uppercase">Genre Accent</label>
                        <select
                          value={playlistGenre}
                          onChange={(e) => setPlaylistGenre(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white outline-none rounded-xl p-2.5 text-xs font-mono capitalize"
                        >
                          {['Contemporary', 'Hymn', 'Synthwave', 'Bluegrass', 'Lofi Pop', 'Rock', 'Acoustic'].map(g => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-mono font-bold tracking-wider text-slate-400 block uppercase">Cover URL</label>
                        <input
                          type="text"
                          value={playlistCoverUrlForm}
                          onChange={(e) => setPlaylistCoverUrlForm(e.target.value)}
                          placeholder="Unsplash promo direct link..."
                          className="w-full bg-slate-50 border border-slate-200 focus:border-slate-405 focus:bg-white outline-none rounded-xl p-2.5 text-xs font-mono"
                        />
                      </div>
                    </div>

                    {/* Checkbox item songs tracker mapping */}
                    <div className="space-y-1.5">
                      <div className="text-[9px] font-mono font-bold tracking-wider text-slate-400 block uppercase flex justify-between items-center">
                        <span>Map Songs checklist ({playlistSongIds.length} Selected)</span>
                        <span>CHECKLIST</span>
                      </div>

                      <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3 max-h-[180px] overflow-y-auto space-y-1 custom-scrollbar">
                        {approvedSongsList.map(item => {
                          const isAssigned = playlistSongIds.includes(item.id);
                          return (
                            <div 
                              key={item.id}
                              onClick={() => handleTogglePlaylistSong(item.id)}
                              className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition text-[11px] ${
                                isAssigned 
                                  ? 'bg-rose-50 border border-rose-200/50 text-rose-900 font-bold' 
                                  : 'bg-white border border-slate-100 hover:bg-slate-100 text-slate-600'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isAssigned}
                                onChange={() => {}} // parent handled
                                className="accent-slate-900 pointer-events-none"
                              />
                              <span className="truncate leading-none">{item.title}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      {playlistEditId && (
                        <button
                          type="button"
                          onClick={handleResetPlaylistForm}
                          className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-mono text-slate-500 hover:bg-slate-100"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={isSavingPlaylist}
                        className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 rounded-xl text-xs font-mono font-bold tracking-wider uppercase transition-all shadow-sm"
                      >
                        {isSavingPlaylist ? 'Saving...' : playlistEditId ? 'Update Playlist' : 'Create Playlist'}
                      </button>
                    </div>

                  </form>

                  {/* Playlists Live Lists */}
                  <div className="lg:col-span-8 space-y-3">
                    <h3 className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase">
                      Existing Active playlists ({allFirestorePlaylists.length} Collections)
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {allFirestorePlaylists.map(pl => (
                        <div key={pl.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
                          {pl.status === 'pending' && (
                            <div className="absolute top-0 right-0 bg-yellow-500 text-slate-950 font-mono font-bold text-[8px] px-2 py-0.5 rounded-bl">
                              DRAFT PROPOSAL
                            </div>
                          )}

                          <div className="space-y-1.5">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded overflow-hidden bg-slate-50 border border-slate-150 flex-shrink-0">
                                <img
                                  referrerPolicy="no-referrer"
                                  src={pl.coverUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600&auto=format&fit=crop'}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-bold text-xs text-slate-900 leading-tight leading-none">{pl.name}</h4>
                                <span className="text-[8px] bg-slate-100 font-mono text-slate-500 border border-slate-150 px-1 py-0.2 rounded uppercase mt-1 inline-block">
                                  {pl.genre || 'Contemporary'}
                                </span>
                              </div>
                            </div>
                            <p className="text-[11px] text-slate-500 font-sans leading-relaxed line-clamp-2">{pl.description}</p>
                            <div className="text-[10px] font-mono text-slate-400">
                              Contains: <span className="text-slate-700 font-bold">{pl.songIds?.length || 0} track list mapped</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-1 px-1 border-t border-slate-50 pt-2.5 mt-2">
                            <button
                              onClick={() => handleDeletePlaylist(pl.id)}
                              className="p-1.5 text-slate-450 hover:text-red-600 hover:bg-slate-50 rounded transition cursor-pointer"
                              title="Delete permanently"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleLoadPlaylistToForm(pl)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-650 font-mono font-bold text-[9px] border border-slate-250/50 rounded transition cursor-pointer"
                            >
                              Load To Form
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                  </div>

                </div>
              )}

              {/* TAB 4: COMPOSER (CREATE / EDIT DRAFTS SHEET) */}
              {adminTab === 'composer' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  
                  {/* Left Aspect fields sheet */}
                  <div className="lg:col-span-7 space-y-6">
                    <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-5">
                      
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
                        <div>
                          <span className="text-[9px] font-mono bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded font-bold uppercase">
                            CLOUD COMPOSE SHEETS
                          </span>
                          <h3 className="text-sm font-bold text-slate-900 mt-1">
                            {selectedSongId ? `Editing Lyric ID: #${selectedSongId}` : 'Create Brand New Lyric Registry'}
                          </h3>
                        </div>

                        <button
                          type="button"
                          onClick={handleComposerReset}
                          className="px-2.5 py-1 text-slate-450 border border-slate-200 hover:bg-slate-50 rounded-lg text-[10px] font-mono font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCcw className="w-3 h-3" />
                          <span>Clear Fields</span>
                        </button>
                      </div>

                      {/* Song form items */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-mono font-bold tracking-wider text-slate-400 block uppercase">Track Title *</label>
                          <input
                            type="text"
                            value={songTitle}
                            onChange={(e) => setSongTitle(e.target.value)}
                            placeholder="Amazing Grace (Chains Are Gone)"
                            className="w-full bg-slate-50 border border-slate-205 focus:border-slate-400 focus:bg-white outline-none rounded-xl p-2.5 text-xs text-slate-850 font-mono"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-mono font-bold tracking-wider text-slate-400 block uppercase">Lead Artist *</label>
                          <input
                            type="text"
                            value={songArtist}
                            onChange={(e) => setSongArtist(e.target.value)}
                            placeholder="Chris Tomlin"
                            className="w-full bg-slate-50 border border-slate-205 focus:border-slate-400 focus:bg-white outline-none rounded-xl p-2.5 text-xs text-slate-850 font-mono"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-mono font-bold tracking-wider text-slate-400 block uppercase">Album Album</label>
                          <input
                            type="text"
                            value={songAlbum}
                            onChange={(e) => setSongAlbum(e.target.value)}
                            placeholder="See the Morning (2006)"
                            className="w-full bg-slate-50 border border-slate-205 focus:border-slate-400 focus:bg-white outline-none rounded-xl p-2.5 text-xs text-slate-850 font-mono"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-mono font-bold tracking-wider text-slate-400 block uppercase">Genre Catalog</label>
                            <select
                              value={songGenre}
                              onChange={(e) => setSongGenre(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-205 focus:border-slate-400 focus:bg-white outline-none rounded-xl p-2.5 text-xs text-slate-850 font-mono capitalize"
                            >
                              {['Contemporary', 'Hymn', 'Synthwave', 'Bluegrass', 'Lofi Pop', 'Rock', 'Acoustic'].map(g => (
                                <option key={g} value={g}>{g}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-mono font-bold tracking-wider text-slate-400 block uppercase">Track Duration</label>
                            <input
                              type="text"
                              value={songDuration}
                              onChange={(e) => setSongDuration(e.target.value)}
                              placeholder="3:45"
                              className="w-full bg-slate-50 border border-slate-205 focus:border-slate-400 focus:bg-white outline-none rounded-xl p-2.5 text-xs text-slate-850 font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Cover URL / Video URL */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-mono font-bold tracking-wider text-slate-400 block uppercase">Cover Banner URL</label>
                          <input
                            type="text"
                            value={songCoverUrl}
                            onChange={(e) => setSongCoverUrl(e.target.value)}
                            placeholder="https://images.unsplash.com/promo..."
                            className="w-full bg-slate-50 border border-slate-205 focus:border-slate-400 focus:bg-white outline-none rounded-xl p-2.5 text-xs text-slate-850 font-mono"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-mono font-bold tracking-wider text-slate-400 block uppercase">YouTube Media Link</label>
                          <input
                            type="text"
                            value={songYoutubeUrl}
                            onChange={(e) => setSongYoutubeUrl(e.target.value)}
                            placeholder="https://www.youtube.com/watch?v=..."
                            className="w-full bg-slate-50 border border-slate-205 focus:border-slate-400 focus:bg-white outline-none rounded-xl p-2.5 text-xs text-slate-850 font-mono"
                          />
                        </div>
                      </div>

                      {/* Map Playlists Checkbox */}
                      <div className="space-y-2">
                        <span className="text-[9px] font-mono font-bold tracking-wider text-slate-400 block uppercase">
                          Assign Mapped Compilation Playlists ({assignedPlaylists.length} Selected)
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {allFirestorePlaylists.map(playlist => {
                            const isSelected = assignedPlaylists.includes(playlist.id);
                            return (
                              <button
                                key={playlist.id}
                                type="button"
                                onClick={() => {
                                  setAssignedPlaylists(prev =>
                                    prev.includes(playlist.id) ? prev.filter(id => id !== playlist.id) : [...prev, playlist.id]
                                  );
                                }}
                                className={`px-2.5 py-1 text-[10px] font-bold font-mono border rounded-lg transition-all cursor-pointer ${
                                  isSelected 
                                    ? 'bg-rose-50 border-rose-300 text-rose-700 font-extrabold shadow-sm' 
                                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800'
                                }`}
                              >
                                {playlist.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* RAW LYRICS AND BEAUTIFICATION GRID */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[9px] font-mono font-bold tracking-wider text-slate-400 block uppercase">
                          <span>Raw Song Lyrics Entry</span>
                          <span>Format Sync Sheet</span>
                        </div>

                        <div className="relative">
                          <textarea
                            rows={12}
                            value={songRawLyrics}
                            onChange={(e) => setSongRawLyrics(e.target.value)}
                            placeholder="[Intro]&#10;(Acoustic keys)&#10;&#10;[Verse 1]&#10;My chains are gone...&#10;I've been set free..."
                            className="w-full bg-slate-50 border border-slate-200 focus:border-slate-405 focus:bg-white outline-none rounded-xl p-4 text-xs text-slate-800 font-mono leading-relaxed resize-y min-h-[220px]"
                          />
                          
                          {/* Floating Gemini formatting button */}
                          <button
                            type="button"
                            onClick={handleGeminiFormat}
                            disabled={isAiBeautifying || !songRawLyrics?.trim()}
                            className="absolute right-3 bottom-3 py-1.5 px-3 bg-slate-900 border border-slate-950 hover:bg-slate-800 disabled:opacity-50 text-white font-mono font-bold text-[9px] uppercase tracking-wider rounded-lg shadow flex items-center gap-1.5 cursor-pointer"
                          >
                            {isAiBeautifying ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Beautifying...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
                                <span>AI Format / Smart Beatify</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* AI Enrichment Insights panel */}
                      {aiInsights && (
                        <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl space-y-2 text-indigo-900 leading-relaxed">
                          <h4 className="text-xs font-mono font-bold text-indigo-950 flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-indigo-500" />
                            Gemini AI Song Insights & Analysis:
                          </h4>
                          <p className="text-[11px] font-sans whitespace-pre-wrap">{aiInsights}</p>
                          {aiSuggestions.length > 0 && (
                            <div className="pt-2 border-t border-indigo-100 mt-2 space-y-1">
                              <span className="text-[10px] uppercase font-mono font-bold text-indigo-400">Song Key/Vocal Recommendations:</span>
                              <div className="flex flex-wrap gap-1">
                                {aiSuggestions.map((item, idx) => (
                                  <span key={idx} className="bg-white/80 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-mono">{item}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Save locally / Sync WordPress Trigger Buttons */}
                      <div className="pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={handleWordPressSync}
                          disabled={isSyncing || !songTitle || !songRawLyrics}
                          className="py-3 px-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-mono font-bold uppercase transition flex items-center gap-1.5 disabled:opacity-40 cursor-pointer shadow-xs"
                        >
                          {isSyncing ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Publishing...</span>
                            </>
                          ) : (
                            <>
                              <Share2 className="w-4 h-4 text-emerald-500 animate-pulse" />
                              <span>Sync Publish directly to WordPress REST Blog</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={handleSaveLyricComposer}
                          disabled={songSaveStatus === 'saving'}
                          className="py-3 px-5 bg-slate-900 border border-slate-950 hover:bg-slate-850 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wide transition flex items-center gap-1.5 cursor-pointer shadow-sm ml-auto"
                        >
                          {songSaveStatus === 'saving' ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Saving to Database...</span>
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4" />
                              <span>Save & Approve lyrics</span>
                            </>
                          )}
                        </button>
                      </div>

                      {syncMessage && (
                        <div className={`p-3 rounded-xl border text-xs font-mono leading-relaxed mt-4 ${
                          syncStatus === 'success' 
                            ? 'bg-emerald-50/60 border-emerald-250/50 text-emerald-850'
                            : syncStatus === 'error'
                            ? 'bg-red-50/60 border-red-200 text-red-700'
                            : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`}>
                          <p>{syncMessage}</p>
                          {syncedWPLink && (
                            <a 
                              href={syncedWPLink} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-indigo-650 font-bold hover:underline mt-1.5 inline-flex items-center gap-1"
                            >
                              Explore Post on Live Blog <ArrowRight className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      )}

                    </div>
                  </div>

                  {/* Right Aspect styled Preview */}
                  <div className="lg:col-span-5 space-y-6">
                    <div className="bg-white border border-slate-200/85 rounded-2xl p-6 space-y-4 shadow-sm bg-[#fafafa]/50">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <span className="text-xs font-mono font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wide">
                          <Eye className="w-3.5 h-3.5 text-slate-500" /> HTML live previewer renderer
                        </span>
                        <span className="text-[9px] font-mono bg-slate-100 border border-slate-200/60 px-2 py-0.5 rounded text-slate-400 font-semibold tracking-wider">
                          DREAM PREVIEW
                        </span>
                      </div>

                      {previewSections.length === 0 ? (
                        <div className="text-center py-20 text-slate-400 text-xs font-mono bg-white border border-dashed border-slate-200 rounded-xl leading-relaxed">
                          Please enter lyric draft stanzas to render the responsive formatting.
                        </div>
                      ) : (
                        <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1 bg-white p-5 border border-slate-200 rounded-xl shadow-xs custom-scrollbar">
                          <div className="text-center pb-4 border-b border-slate-200/65 space-y-1">
                            <h2 className="text-xl font-serif text-slate-900 font-bold">{songTitle || 'Amazing Grace'}</h2>
                            <span className="text-[10px] tracking-wider text-slate-400 font-mono uppercase">BY {songArtist || 'Chris Tomlin'}</span>
                          </div>

                          <div className="space-y-4 pt-1">
                            {previewSections.map((section, idx) => {
                              const isChorus = section.type === 'chorus';
                              return (
                                <div 
                                  key={idx}
                                  className={`p-4 rounded-xl border text-xs leading-relaxed ${
                                    isChorus 
                                      ? 'bg-rose-50/20 border-rose-150 pl-4 border-l-4 border-l-rose-500 font-serif italic text-slate-900' 
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
              )}

              {/* TAB 5: WORDPRESS REST GATEWAY */}
              {adminTab === 'wordpress' && (
                <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 md:p-8 space-y-8 shadow-sm">
                  
                  <div className="flex items-center gap-4 border-b border-indigo-100 pb-5">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm flex-shrink-0">
                      <Globe className="w-6 h-6 stroke-[1.5]" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">WordPress REST API synchronization Gateway</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Configure authentication parameters with your WordPress server or blog instance.</p>
                    </div>
                  </div>

                  {/* ACTIVE CONNECTION MODULE */}
                  <div className="space-y-5">
                    <div>
                      <span className="text-[10px] font-mono font-bold tracking-wider text-slate-400 block uppercase mb-2">INTEGRATION ENGINE MODE</span>
                      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 border border-slate-200 rounded-xl">
                        <button
                          onClick={() => setWpMode('simulated')}
                          className={`py-2 rounded-lg font-mono font-bold text-xs capitalize transition cursor-pointer ${
                            wpMode === 'simulated' 
                              ? 'bg-white shadow border border-slate-200/80 text-slate-900' 
                              : 'text-slate-450 hover:text-slate-800'
                          }`}
                        >
                          Simulated Local REST Handler
                        </button>
                        <button
                          onClick={() => setWpMode('live')}
                          className={`py-2 rounded-lg font-mono font-bold text-xs capitalize transition cursor-pointer ${
                            wpMode === 'live' 
                              ? 'bg-white shadow border border-slate-200/80 text-slate-900' 
                              : 'text-slate-450 hover:text-slate-800'
                          }`}
                        >
                          Real WordPress.com Blog sync
                        </button>
                      </div>
                    </div>

                    <AnimatePresence mode="wait">
                      
                      {/* SIMULATED GATEWAY SETUPS */}
                      {wpMode === 'simulated' && (
                        <motion.div
                          key="simulated-wp"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="space-y-4"
                        >
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-slate-650 leading-relaxed text-xs">
                            <span className="font-bold block text-slate-800 font-mono text-[10px]">What is the Simulated REST Handler?</span>
                            <p>It provides an offline-friendly simulated mock REST gateway running locally on Node server (Express). Use this for testing instant HTML publishing pipeline transfers back and forth without real blogs credentials.</p>
                          </div>

                          <form onSubmit={handleWPLogin} className="space-y-4 pt-1">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-mono font-bold tracking-wider text-slate-400 block uppercase">REST API Username</label>
                              <input
                                type="text"
                                value={wpUsername}
                                onChange={(e) => setWpUsername(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-250 focus:border-slate-405 focus:bg-white outline-none rounded-xl p-2.5 text-xs font-mono"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-mono font-bold tracking-wider text-slate-400 block uppercase">Application Password</label>
                              <input
                                type="password"
                                value={wpPassword}
                                onChange={(e) => setWpPassword(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-250 focus:border-slate-405 focus:bg-white outline-none rounded-xl p-2.5 text-xs font-mono"
                              />
                            </div>

                            {wpAuthError && (
                              <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-mono p-3 rounded-lg flex items-start gap-2.5">
                                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <p>{wpAuthError}</p>
                              </div>
                            )}

                            <button
                              type="submit"
                              disabled={wpIsAuthenticating}
                              className="w-full py-3 px-4 bg-slate-900 border border-slate-950 hover:bg-slate-800 disabled:opacity-50 text-white font-mono font-bold text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                            >
                              {wpIsAuthenticating ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin animate-pulse" />
                                  <span>Routing REST Handshake...</span>
                                </>
                              ) : (
                                <>
                                  <span>Establish JWT connection</span>
                                  <span>→</span>
                                </>
                              )}
                            </button>
                          </form>
                        </motion.div>
                      )}

                      {/* REAL LIVE WORDPRESS GATEWAY */}
                      {wpMode === 'live' && (
                        <motion.div
                          key="live-wp"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="space-y-5"
                        >
                          <div className="p-4 bg-indigo-50 border border-indigo-150 rounded-xl space-y-2 text-indigo-900 leading-relaxed text-xs">
                            <span className="font-bold border-b border-indigo-100 pb-1 mb-1 block font-mono text-[10px] text-indigo-950">Active WordPress.com Syncing</span>
                            <p>Publishes beautifully styled, clean HTML lyric structures directly into post directories using OAuth credentials. Supports categories tagging, custom SEO headings formatting, and raw block embeddings.</p>
                          </div>

                          <div className="space-y-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-mono font-bold tracking-wider text-slate-400 block uppercase">WordPress Blog Custom Domain URL</label>
                              <input
                                type="text"
                                value={wpBlogUrl}
                                onChange={(e) => setWpBlogUrl(e.target.value)}
                                placeholder="psalmify.wordpress.com"
                                className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white outline-none rounded-xl p-2.5 text-xs font-mono text-slate-800"
                              />
                            </div>

                            {/* Show Token Status */}
                            {wpToken ? (
                              <div className="bg-emerald-50 border border-emerald-250 p-4 rounded-xl space-y-2.5 text-xs font-sans text-emerald-850">
                                <div className="flex items-center gap-2 font-bold font-mono text-[10px] uppercase text-emerald-900">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                  <span>OAuth Blog Handshake established</span>
                                </div>
                                <div className="space-y-1 font-mono text-[10px] text-emerald-700">
                                  <p>Blog Domain: <span className="font-bold text-slate-900">{wpBlogUrl}</span></p>
                                  {wpBlogId && <p>Registered Blog ID: #{wpBlogId}</p>}
                                  {wpTokenTimeLeft > 0 && <p>Key TTL: {Math.round(wpTokenTimeLeft / 3600 / 24)} Days remaining</p>}
                                </div>
                                <button
                                  type="button"
                                  onClick={handleDisconnectWP}
                                  className="mt-1 px-3 py-1 bg-red-50 hover:bg-red-100/80 border border-red-200 text-red-700 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer"
                                >
                                  Disconnect Credentials
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-4 pt-2">
                                <div className="space-y-2 text-center">
                                  <button
                                    type="button"
                                    onClick={handleWordPressOAuth}
                                    className="w-full py-3 px-5 bg-slate-900 border border-slate-950 hover:bg-slate-800 text-white rounded-xl text-xs font-mono font-bold tracking-wider uppercase transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                                  >
                                    <Globe className="w-4 h-4 text-emerald-400 fill-current animate-pulse" />
                                    <span>Connect to WordPress.com via OAuth</span>
                                  </button>
                                  <p className="text-[10px] text-slate-400 font-mono">Requires client identifiers inside your workspace secrets configuration.</p>
                                </div>

                                {/* WORDPRESS OAUTH DIAGNOSTICS & LOGGING TOOL */}
                                <div className="mt-6 border border-slate-200 bg-slate-50/50 rounded-2xl p-5 space-y-4 text-left">
                                  <div className="flex items-center justify-between border-b border-slate-150 pb-3">
                                    <div className="flex items-center gap-2">
                                      <ShieldAlert className="w-4 h-4 text-amber-500" />
                                      <span className="text-xs font-sans font-black text-slate-800 uppercase tracking-wider">OAuth Diagnostics & Callback Sync</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setWpDiaOpen(!wpDiaOpen)}
                                      className="px-2.5 py-1 rounded bg-slate-200 hover:bg-slate-300 transition text-[9px] font-mono font-bold text-slate-600 cursor-pointer"
                                    >
                                      {wpDiaOpen ? "Hide" : "Expand Guide"}
                                    </button>
                                  </div>

                                  {wpDiaOpen && (
                                    <div className="space-y-4 text-xs">
                                      <p className="text-slate-600 leading-relaxed font-sans">
                                        The <strong className="text-slate-800">"Mismatch in redirect_uri"</strong> error is triggered because the Redirect URL registered in your WordPress Application Developer Console does not exactly match the hostname/address you are browsing from.
                                      </p>

                                      <div className="space-y-2.5">
                                        <div className="bg-white border border-slate-205 rounded-xl p-3.5 space-y-2 shadow-xs">
                                          <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black text-slate-450 uppercase tracking-wider font-mono">Required Redirect URL</span>
                                            <span className="text-[9px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md font-bold">Copy & Paste inside WP</span>
                                          </div>
                                          
                                          <div className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-150 rounded-lg p-2 font-mono text-[11px] text-slate-700">
                                            <span className="truncate select-all bg-transparent outline-none max-w-[280px]">
                                              {typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : 'https://psalmify.vercel.app/auth/callback'}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const urlToCopy = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : 'https://psalmify.vercel.app/auth/callback';
                                                navigator.clipboard.writeText(urlToCopy);
                                                setRedirectCopied(true);
                                                setTimeout(() => setRedirectCopied(false), 2200);
                                              }}
                                              className="px-3 py-1.5 rounded-md bg-slate-900 text-white hover:bg-slate-800 text-[10px] font-bold font-sans cursor-pointer transition flex items-center gap-1.5 focus:outline-none"
                                            >
                                              {redirectCopied ? (
                                                <>
                                                  <Check className="w-3 h-3 text-emerald-400" />
                                                  <span>Copied!</span>
                                                </>
                                              ) : (
                                                <span>Copy</span>
                                              )}
                                            </button>
                                          </div>
                                        </div>

                                        {/* INTERACTIVE DIAGNOSTIC TRIGGER */}
                                        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs">
                                          <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black text-indigo-900 uppercase tracking-wider font-mono">Real-Time Flow Analysis</span>
                                            <button
                                              type="button"
                                              onClick={handleRunDiagnostics}
                                              disabled={diagLoading}
                                              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-indigo-300 font-bold transition text-[10px] font-sans flex items-center gap-1.5 cursor-pointer"
                                            >
                                              {diagLoading ? (
                                                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                              ) : (
                                                <ShieldCheck className="w-3.5 h-3.5" />
                                              )}
                                              <span>Run Flow Diagnostics</span>
                                            </button>
                                          </div>

                                          {/* DIAGNOSTIC RESULTS */}
                                          {diagError && (
                                            <div className="p-3 bg-rose-50 border border-rose-150 rounded-lg text-rose-800 font-sans text-[11px] leading-relaxed whitespace-pre-wrap font-medium">
                                              <strong className="text-rose-950 font-bold block mb-1">✕ Connection / Boot Error detected:</strong>
                                              {diagError}
                                            </div>
                                          )}

                                          {diagResults && (
                                            <div className="space-y-3 mt-2 text-[11px] font-sans leading-relaxed text-slate-700">
                                              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                                                <strong className="text-[10px] uppercase font-mono font-black text-slate-500 tracking-wider block">Server Secrets Check</strong>
                                                <div className="grid grid-cols-2 gap-3 font-mono text-[10px]">
                                                  <div className="p-2 bg-white rounded border border-slate-100">
                                                    <span className="text-slate-400 block text-[9px] uppercase">CLIENT_ID</span>
                                                    <span className={`font-bold ${diagResults.environment?.WORDPRESS_CLIENT_ID?.configured ? 'text-emerald-600' : 'text-rose-500'}`}>
                                                      {diagResults.environment?.WORDPRESS_CLIENT_ID?.configured ? '✓ Found' : 'Missing'}
                                                    </span>
                                                    <span className="block text-[9px] text-slate-500 mt-0.5">Masked: {diagResults.environment?.WORDPRESS_CLIENT_ID?.masked}</span>
                                                    {diagResults.environment?.WORDPRESS_CLIENT_ID?.hasSpaces && (
                                                      <span className="block text-amber-600 font-bold text-[8px] uppercase mt-0.5 animate-pulse">Contains spaces!</span>
                                                    )}
                                                  </div>
                                                  <div className="p-2 bg-white rounded border border-slate-100">
                                                    <span className="text-slate-400 block text-[9px] uppercase">CLIENT_SECRET</span>
                                                    <span className={`font-bold ${diagResults.environment?.WORDPRESS_CLIENT_SECRET?.configured ? 'text-emerald-600' : 'text-rose-500'}`}>
                                                      {diagResults.environment?.WORDPRESS_CLIENT_SECRET?.configured ? '✓ Found' : 'Missing'}
                                                    </span>
                                                    <span className="block text-[9px] text-slate-500 mt-0.5">Masked: {diagResults.environment?.WORDPRESS_CLIENT_SECRET?.masked}</span>
                                                    {diagResults.environment?.WORDPRESS_CLIENT_SECRET?.hasSpaces && (
                                                      <span className="block text-amber-600 font-bold text-[8px] uppercase mt-0.5 animate-pulse">Contains spaces!</span>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>

                                              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 font-mono text-[10px]">
                                                <strong className="text-[10px] uppercase font-black text-slate-500 tracking-wider block">Environment telemetry</strong>
                                                <div className="flex justify-between border-b border-white pb-1 pb-1">
                                                  <span>Vercel Platform:</span>
                                                  <span className="font-bold text-slate-900">{diagResults.environment?.VERCEL ? "Yes" : "No"}</span>
                                                </div>
                                                <div className="flex justify-between border-b border-white pb-1">
                                                  <span>Active Host:</span>
                                                  <span className="font-bold text-slate-900 truncate max-w-[150px]">{diagResults.activeRequest?.host || "N/A"}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span>Forwarded Protocol:</span>
                                                  <span className="font-bold text-slate-900">{diagResults.activeRequest?.xForwardedProto || "N/A"}</span>
                                                </div>
                                              </div>

                                              {/* sliding attempts log viewer */}
                                              <div className="space-y-1.5">
                                                <strong className="text-[10px] uppercase font-mono font-black text-slate-500 tracking-wider block">Flow Attempt Logs (Sliding Window Logging)</strong>
                                                {diagResults.lastOauthAttempts?.length === 0 ? (
                                                  <div className="text-[10px] text-slate-400 p-2 border border-dashed border-slate-200 rounded text-center font-mono">
                                                    No OAuth attempts logged yet on this restart cycle.
                                                  </div>
                                                ) : (
                                                  <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                                                    {diagResults.lastOauthAttempts.map((attempt: any, idx: number) => (
                                                      <div key={idx} className="p-2 border border-slate-150 rounded bg-indigo-50/25 text-[9px] font-mono space-y-1 leading-normal">
                                                        <div className="flex justify-between text-slate-450 text-[8px]">
                                                          <span>{new Date(attempt.timestamp).toLocaleTimeString()}</span>
                                                          <span className="text-indigo-600 uppercase font-black">Link Constructed</span>
                                                        </div>
                                                        <div className="truncate text-slate-700">
                                                          <span className="text-slate-400">client_id:</span> {attempt.clientIdMasked}
                                                        </div>
                                                        <div className="truncate text-red-600 font-bold">
                                                          <span className="text-slate-400 font-normal">redirect_uri:</span> {attempt.computedRedirectUri}
                                                        </div>
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>

                                        <div className="p-3.5 bg-amber-50/70 border border-amber-100 rounded-xl space-y-2">
                                          <div className="flex items-center gap-2 font-mono text-[10px] uppercase font-black text-amber-800 tracking-wider">
                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                            <span>Active Site Environment Detection</span>
                                          </div>
                                          <ul className="space-y-1.5 text-[11px] text-amber-900 leading-relaxed font-sans">
                                            <li>• Active Origin: <strong className="font-mono">{typeof window !== 'undefined' ? window.location.origin : 'https://psalmify.vercel.app'}</strong></li>
                                            <li>• WP Application Type: <strong className="font-mono">Web Application</strong></li>
                                            <li>• Auth Mechanism: <strong className="font-mono">OAuth 2.0 Authorization Code</strong></li>
                                          </ul>
                                        </div>
                                      </div>

                                      <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block font-mono">How to Configure Wordpress Dev Console</span>
                                        <ol className="list-decimal pl-4 space-y-2 text-slate-650 font-sans leading-relaxed text-[11px]">
                                          <li>
                                            Go to <a href="https://developer.wordpress.com/apps/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline inline-flex items-center gap-0.5 font-bold">Wordpress Developer Apps Dashboard <ArrowRight className="w-3 h-3 inline" /></a>
                                          </li>
                                          <li>
                                            Click on your application card (e.g. your active API client) or create a new application if needed.
                                          </li>
                                          <li>
                                            Locate the <strong className="text-slate-800 font-bold">Redirect URL</strong> text field field inside the App credentials section.
                                          </li>
                                          <li>
                                            Delete any outdated URLs or localhost paths, paste the exact URL copied above: <code className="bg-slate-100 px-1 rounded text-red-600 font-bold font-mono text-[10px]">{typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : 'https://psalmify.vercel.app/auth/callback'}</code>, and click <strong className="text-indigo-600 font-bold">Update / Save</strong>.
                                          </li>
                                        </ol>
                                      </div>

                                      <p className="text-[10px] text-slate-400 italic">
                                        OAuth protocol security guidelines forbid domain mismatches. If you deploy your app across different domains (e.g., from Vercel to AI Studio), you must update the registered Redirect URL in developer.wordpress.com each time.
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                          </div>
                        </motion.div>
                      )}

                    </AnimatePresence>
                  </div>

                </div>
              )}

            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
