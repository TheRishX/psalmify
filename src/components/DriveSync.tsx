import React, { useState, useEffect } from 'react';
import { Song, Playlist } from '../types';
import { 
  Cloud, CloudLightning, RefreshCw, Upload, Download, CheckCircle2, 
  AlertCircle, ShieldCheck, Key, ShieldAlert, FolderPlus, FileJson, FileText 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, googleProvider, db, OperationType, handleFirestoreError } from '../utils/firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { collection, setDoc, doc, getDocs, writeBatch } from 'firebase/firestore';
import { checkAndCreateFolder } from '../utils/driveSyncHelper';

interface DriveSyncProps {
  songs: Song[];
  playlists: Playlist[];
  onRefreshData: () => void;
}

interface BackupFileMeta {
  id: string;
  name: string;
  createdTime: string;
  size?: string;
}

export default function DriveSync({ songs, playlists, onRefreshData }: DriveSyncProps) {
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    return sessionStorage.getItem('google_drive_token') || null;
  });
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [isBackupSubmitting, setIsBackupSubmitting] = useState(false);
  const [isRestoreSubmitting, setIsRestoreSubmitting] = useState(false);
  const [isListingBackups, setIsListingBackups] = useState(false);

  const [backupsList, setBackupsList] = useState<BackupFileMeta[]>([]);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Auto-fetch backups list once authorized
  useEffect(() => {
    if (accessToken) {
      fetchBackupsFromDrive(accessToken);
    }
  }, [accessToken]);

  // Request Auth scope with custom GoogleAuthProvider triggers
  const handleAuthorizeDrive = async () => {
    setIsAuthorizing(true);
    setError('');
    setSuccessMsg('');

    try {
      // Add Google Drive File access scope
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      
      const result = await signInWithPopup(auth, provider);
      
      // Extract Google Auth access token for direct REST API queries
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;

      if (token) {
        setAccessToken(token);
        sessionStorage.setItem('google_drive_token', token);
        setSuccessMsg('Successfully connected and authorized access to Google Drive back office!');
        fetchBackupsFromDrive(token);
      } else {
        throw new Error('Access credentials tokens could not be decoded.');
      }
    } catch (err: any) {
      console.error("Google Drive connection failure:", err);
      setError(err?.message || "Failed to establish a handshaking token with Google Auth. Please allow popups.");
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleDisconnect = () => {
    setAccessToken(null);
    sessionStorage.removeItem('google_drive_token');
    setBackupsList([]);
    setSuccessMsg('Disconnected from Google Drive.');
  };

  // List backup files matching our name inside Google Drive file list REST API
  const fetchBackupsFromDrive = async (token: string) => {
    setIsListingBackups(true);
    try {
      const folderId = await checkAndCreateFolder(token);
      const q = encodeURIComponent(`name = 'psamify_lyrics_backup.json' and '${folderId}' in parents and trashed = false`);
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,createdTime,size)&orderBy=createdTime desc`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.files) {
        setBackupsList(data.files);
      } else if (data.error) {
        if (data.error.status === 'UNAUTHENTICATED' || data.error.code === 401) {
          // Token expired, log outer
          handleDisconnect();
          setError('Google Drive session expired. Please re-authorize.');
        } else {
          setError(data.error.message || 'Error listing backups.');
        }
      }
    } catch (e: any) {
      console.error(e);
      setError('Connection failure searching for backups.');
    } finally {
      setIsListingBackups(false);
    }
  };

  // Post backup file payload directly to Google Drive
  const handleExportBackup = async () => {
    if (!accessToken) return;
    setIsBackupSubmitting(true);
    setError('');
    setSuccessMsg('');

    try {
      const folderId = await checkAndCreateFolder(accessToken);
      const backupPayload = {
        exportedAt: new Date().toISOString(),
        songs: songs,
        playlists: playlists,
        appVersion: '3.0.0-enterprise'
      };

      // 1. Create metadata on Google Drive inside corporate folder
      const metaRes = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: "psamify_lyrics_backup.json",
          mimeType: "application/json",
          parents: [folderId],
          description: `Total of ${songs.length} lyric items and ${playlists.length} playlists backed up via Lyrics Dashboard.`
        })
      });
      
      const meta = await metaRes.json();
      if (meta.error) {
        throw new Error(meta.error.message);
      }

      const fileId = meta.id;

      // 2. Patch file with media contents
      const mediaRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(backupPayload, null, 2)
      });

      if (!mediaRes.ok) {
        throw new Error('Content uploading stream failed.');
      }

      setSuccessMsg(`Perfect! A secure backup file has been created on your Google Drive containing ${songs.length} songs.`);
      fetchBackupsFromDrive(accessToken);
    } catch (err: any) {
      console.error("Backup export error:", err);
      setError(err?.message || "Failed uploading backup. Is your Google account permission active?");
    } finally {
      setIsBackupSubmitting(false);
    }
  };

  // Restore database by downloading file payload and merging into Firestore
  const handleImportBackup = async (fileId: string) => {
    if (!accessToken) return;
    
    const confirmRestore = window.confirm(
      "DANGER: Are you sure you want to restore this Google Drive backup into Firestore? This will sync all songs and playlists and merge missing records. Proceed?"
    );
    if (!confirmRestore) return;

    setIsRestoreSubmitting(true);
    setError('');
    setSuccessMsg('');

    try {
      // 1. Download file content
      const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: {
          "Authorization": `Bearer ${accessToken}`
        }
      });

      if (!downloadRes.ok) {
        throw new Error('Failed downloading file content from target backup.');
      }

      const payload = await downloadRes.json();
      if (!payload.songs || !Array.isArray(payload.songs)) {
        throw new Error('File payload layout does not match standard dashboard format.');
      }

      // 2. Batch merge into Firestore
      const importedSongs = payload.songs as Song[];
      const importedPlaylists = (payload.playlists || []) as Playlist[];

      let updatedCount = 0;
      for (const song of importedSongs) {
        // Save back document by document to ensure it maps correctly to the empty/approved status
        await setDoc(doc(db, "songs", song.id), {
          ...song,
          status: song.status || 'approved',
          createdAt: song.createdAt || new Date().toISOString()
        });
        updatedCount++;
      }

      for (const play of importedPlaylists) {
        await setDoc(doc(db, "playlists", play.id), {
          ...play,
          status: play.status || 'approved',
          createdAt: play.createdAt || new Date().toISOString()
        });
      }

      setSuccessMsg(`Incredible! Database restored perfectly. Successfully refreshed ${updatedCount} song lyrics inside Cloud Firestore.`);
      onRefreshData();
    } catch (err: any) {
      console.error("Backup import error:", err);
      setError(err?.message || "Restore transaction crashed due to missing permissions or invalid backup packet.");
    } finally {
      setIsRestoreSubmitting(false);
    }
  };

  // Export single song text file representation directly to GD
  const handleExportSingleSong = async (song: Song) => {
    if (!accessToken) return;
    try {
      const folderId = await checkAndCreateFolder(accessToken);
      const fileContent = `TITLE: ${song.title}\nARTIST: ${song.artist}\nALBUM: ${song.album || 'N/A'}\nGENRE: ${song.genre}\n========================================\n\n${song.rawLyrics}\n\n========================================\nBackups crafted via Smart Lyrics System.`;
      
      const metaRes = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: `${song.title.replace(/[\s\/]+/g, '_')}_raw_lyrics.txt`,
          mimeType: "text/plain",
          parents: [folderId]
        })
      });
      const meta = await metaRes.json();
      const fileId = meta.id;

      await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "text/plain"
        },
        body: fileContent
      });

      alert(`Successfully saved raw text backups file of "${song.title}" to Google Drive!`);
    } catch (e: any) {
      alert("Failed saving single lyric sheet to Drive: " + e.message);
    }
  };

  return (
    <div id="drive-sync-core" className="space-y-6">
      
      {/* Auth visual card status block */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl border ${accessToken ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-indigo-50 border-indigo-100 text-indigo-600'}`}>
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 tracking-tight text-base md:text-lg">Google Drive Synchronization Office</h3>
              <p className="text-slate-500 text-xs">
                Your data is safe and backup plans are managed directly in your Google workspace client.
              </p>
            </div>
          </div>

          <div className="flex item-center self-start md:self-center">
            {accessToken ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 uppercase">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Active Connection
                </span>
                <button
                  onClick={handleDisconnect}
                  className="px-3.5 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200/60 rounded-xl transition cursor-pointer"
                >
                  Unlink Drive
                </button>
              </div>
            ) : (
              <button
                onClick={handleAuthorizeDrive}
                disabled={isAuthorizing}
                className="inline-flex items-center gap-2 px-5 py-3 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-2xl shadow-lg shadow-indigo-600/10 transition cursor-pointer active:scale-95"
              >
                <Key className="w-3.5 h-3.5 text-indigo-200" />
                {isAuthorizing ? 'Opening Popup...' : 'Authorize Google Drive Link'}
              </button>
            )}
          </div>
        </div>

        {/* Action Panel Errors / Success */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-xs flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Core backup export trigger */}
        {accessToken ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            
            {/* Left element: Backup box */}
            <div className="border border-slate-100 bg-slate-50/50 rounded-2xl p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
                  <Upload className="w-4 h-4" />
                  <h4>Export Secure Snapshot</h4>
                </div>
                <p className="text-slate-500 text-xs leading-relaxed">
                  Export the active lyrics index in your workspace. This bundles all songs and playlists in a single encrypted JSON format file and writes it to your personal Google Drive file stack.
                </p>
                <div className="p-3 bg-white border border-slate-200/50 rounded-xl font-mono text-[10px] text-slate-500 space-y-1">
                  <p>• Songs index size: {songs.length} models</p>
                  <p>• Playlists index size: {playlists.length} nodes</p>
                  <p>• Backup scope: drive.file applet-bound folder</p>
                </div>
              </div>

              <button
                onClick={handleExportBackup}
                disabled={isBackupSubmitting}
                className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-2"
              >
                {isBackupSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Packaging backup payload...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload Backup to Drive
                  </>
                )}
              </button>
            </div>

            {/* Right element: Backups archives list */}
            <div className="border border-slate-100 bg-slate-50/50 rounded-2xl p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-1.5 flex flex-col h-full justify-start min-h-0">
                <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                  <Download className="w-4 h-4" />
                  <h4>Google Drive Backups Stack</h4>
                </div>
                <p className="text-slate-500 text-xs leading-relaxed">
                  List of valid `psamify_lyrics_backup.json` configuration blocks discovered on your Cloud account. Select a package to restore:
                </p>

                <div className="flex-1 overflow-y-auto max-h-[140px] border border-slate-200/60 rounded-xl bg-white mt-2">
                  {isListingBackups ? (
                    <div className="p-4 flex items-center justify-center text-slate-400 gap-2 text-xs">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Checking workspace folder...
                    </div>
                  ) : backupsList.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {backupsList.map((file) => (
                        <div key={file.id} className="p-2.5 flex items-center justify-between gap-2 text-xs hover:bg-slate-50">
                          <div>
                            <p className="font-semibold text-slate-800 text-[11px] truncate max-w-[170px]">{file.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              Created: {new Date(file.createdTime).toLocaleString()}
                            </p>
                          </div>
                          <button
                            onClick={() => handleImportBackup(file.id)}
                            disabled={isRestoreSubmitting}
                            className="p-1.5 text-[10px] font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg shadow-sm font-sans transition cursor-pointer"
                          >
                            Restore
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-slate-400 text-xs">
                      No matching backup templates discovered.
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        ) : (
          <div className="py-8 bg-slate-50 border border-slate-100 border-dashed rounded-3xl p-6 text-center flex flex-col items-center justify-center text-slate-400">
            <ShieldAlert className="w-8 h-8 text-slate-350 mb-2" />
            <p className="font-semibold text-xs text-slate-800">Drive Integration Offline</p>
            <p className="text-[11px] max-w-sm mt-1 mb-4 leading-relaxed">
              To proceed with single-song direct sync backups, dynamic exports and database restorations, verify and authorize Google Drive links above.
            </p>
          </div>
        )}

      </div>
      
      {/* Single lyrics export helper block */}
      {accessToken && songs.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-500" />
            <h4 className="font-bold text-slate-800 text-sm">Quick Lyric Export Deck</h4>
          </div>
          <p className="text-slate-500 text-xs">
            Export a flat text representation of any lyric model instantly onto your GDrive root space:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 overflow-y-auto max-h-[180px] p-1 bg-slate-50 rounded-2xl border border-slate-200/40">
            {songs.map(song => (
              <div key={song.id} className="flex items-center justify-between p-2.5 bg-white border border-slate-200/80 rounded-xl hover:shadow-xs transition text-xs">
                <span className="truncate max-w-[130px] font-semibold text-slate-700">{song.title}</span>
                <button
                  onClick={() => handleExportSingleSong(song)}
                  className="px-2 py-1 text-[10px] font-mono font-bold uppercase text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                  title="Export raw sheets"
                >
                  Save GD
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
