import React, { useState, useRef } from 'react';
import { db } from '../utils/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Song, Playlist } from '../types';
import { 
  Database, Download, Upload, AlertCircle, CheckCircle, RefreshCw, Sparkles 
} from 'lucide-react';

interface MasterBackupManagerProps {
  songs: Song[];
  playlists: Playlist[];
  onRefreshData: () => void;
}

export default function MasterBackupManager({ 
  songs, 
  playlists, 
  onRefreshData 
}: MasterBackupManagerProps) {
  const [importStatus, setImportStatus] = useState<'idle' | 'reading' | 'writing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [progressText, setProgressText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Single Click Master Export
  const handleMasterExport = () => {
    try {
      const backupPayload = {
        version: "1.1",
        exportedAt: new Date().toISOString(),
        appName: "Psamify Lyrics",
        songs: songs,
        playlists: playlists
      };

      const jsonStr = JSON.stringify(backupPayload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      const fileDate = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `psamify_master_backup_${fileDate}.json`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Failed to compile master backup export: " + err.message);
    }
  };

  // Parse and process file contents for core imports
  const processBackupFile = async (file: File) => {
    setImportStatus('reading');
    setErrorMessage('');
    setProgressText('Reading backup file...');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);

        if (!data || (!Array.isArray(data.songs) && !Array.isArray(data.playlists))) {
          throw new Error("Invalid backup file format. Must contain 'songs' or 'playlists' records.");
        }

        const importedSongs: Song[] = data.songs || [];
        const importedPlaylists: Playlist[] = data.playlists || [];

        setImportStatus('writing');
        let processedSongs = 0;
        let processedPlaylists = 0;

        const totalToImport = importedSongs.length + importedPlaylists.length;
        if (totalToImport === 0) {
          throw new Error("Excellent backup file, but it contains zero songs and zero playlists to import.");
        }

        // Import songs collection doc-by-doc inside firestore
        for (const s of importedSongs) {
          setProgressText(`Importing song lyrics: ${processedSongs + 1}/${importedSongs.length} (${s.title})`);
          
          // Ensure structure matches
          const songRef = doc(db, "songs", s.id);
          await setDoc(songRef, {
            ...s,
            status: s.status || 'approved',
            updatedAt: new Date().toISOString()
          }, { merge: true });
          processedSongs++;
        }

        // Import playlists collection doc-by-doc inside firestore
        for (const p of importedPlaylists) {
          setProgressText(`Importing playlists: ${processedPlaylists + 1}/${importedPlaylists.length} (${p.name})`);
          
          const playlistRef = doc(db, "playlists", p.id);
          await setDoc(playlistRef, {
            ...p,
            status: p.status || 'approved',
            updatedAt: new Date().toISOString()
          }, { merge: true });
          processedPlaylists++;
        }

        setProgressText(`Successfully imported ${processedSongs} songs and ${processedPlaylists} playlists!`);
        setImportStatus('success');
        onRefreshData();
      } catch (err: any) {
        console.error(err);
        setErrorMessage(err.message || "Failed to process backup json file.");
        setImportStatus('error');
      }
    };

    reader.onerror = () => {
      setErrorMessage("File reader error reading JSON file.");
      setImportStatus('error');
    };

    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processBackupFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
        setErrorMessage("Please drop a valid .json master backup file.");
        setImportStatus('error');
        return;
      }
      processBackupFile(file);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-6" id="master-backup-wrapper">
      
      {/* Alert Warning Box */}
      <div className="bg-amber-50/80 border border-amber-200 text-amber-800 rounded-2xl p-4 flex gap-3 text-xs leading-relaxed">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
        <div>
          <span className="font-bold block text-[#5c4015]">⚠️ Important Notice on Master Overwriting</span>
          <p className="mt-0.5 text-[#6c4e20]">
            Importing a master file merges song datasets into your active Cloud Firestore database. Existing songs or collections sharing matching IDs will be cleanly updated with the backup file data. Backup files with unique IDs are registered as new entries.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* PANEL LEFT: MASTER EXPORT */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 space-y-6 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100/50">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base tracking-tight">Master Export</h4>
                <p className="text-slate-400 text-[11px] font-mono">Download absolute master save</p>
              </div>
            </div>

            <p className="text-slate-650 text-xs leading-relaxed mt-4">
              Packages files in a highly optimized payload containing all raw song texts, translated Hindi Devanagari lyrics stanzas, timing metrics metadata, categories, playlists, and cover arts. Ideal for master recovery, migrating instances, or full offline archives.
            </p>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <div className="p-3 bg-slate-50 border border-slate-200/50 rounded-2xl font-mono">
                <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-bold">TOTAL HYMNS</span>
                <span className="font-extrabold text-slate-800 text-lg">{songs.length}</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200/50 rounded-2xl font-mono">
                <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-bold">PLAYLIST SELECTION</span>
                <span className="font-extrabold text-slate-800 text-lg">{playlists.length}</span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100">
            <button
              onClick={handleMasterExport}
              disabled={songs.length === 0}
              className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-bold uppercase tracking-wider rounded-2xl shadow-lg shadow-rose-600/10 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Download className="w-4 h-4 text-white" />
              Export Full Catalog ({songs.length} Items)
            </button>
          </div>
        </div>

        {/* PANEL RIGHT: MASTER IMPORT */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100/50">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-base tracking-tight">Master Import</h4>
              <p className="text-slate-400 text-[11px] font-mono">Instant single-click catalog restore</p>
            </div>
          </div>

          {/* Import Interactive Zone container */}
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-3xl p-6 text-center transition-all ${
              dragOver 
                ? 'border-indigo-600 bg-indigo-50/20' 
                : 'border-slate-200 hover:border-slate-355 bg-slate-50/50'
            }`}
          >
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />

            {importStatus === 'idle' && (
              <div className="space-y-3 cursor-pointer" onClick={triggerFileSelect}>
                <div className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center mx-auto shadow-xs text-slate-450 hover:text-indigo-605">
                  <Database className="w-6 h-6 text-slate-400" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Drag & drop JSON backup file here</span>
                  <span className="text-slate-400 text-[10px] block mt-0.5">Or tap to browse computer drives</span>
                </div>
              </div>
            )}

            {(importStatus === 'reading' || importStatus === 'writing') && (
              <div className="py-2 space-y-3">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                <div>
                  <span className="text-xs font-bold text-slate-800 block uppercase tracking-wider">{importStatus === 'reading' ? 'parsing files' : 'writing firestore database'}</span>
                  <p className="text-[11px] font-mono text-slate-500 max-w-sm mx-auto leading-relaxed mt-1">
                    {progressText}
                  </p>
                </div>
              </div>
            )}

            {importStatus === 'success' && (
              <div className="space-y-3">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-bold text-emerald-800 block">Master Catalog Restored!</span>
                  <p className="text-[10px] text-slate-500 max-w-sm mx-auto mt-0.5">
                    All exported songs, Devanagari lyrics stanzas, and playlists are active inside your Cloud Firestore dataset.
                  </p>
                </div>
                <button
                  onClick={() => setImportStatus('idle')}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold tracking-wide rounded-lg transition"
                >
                  Import Another File
                </button>
              </div>
            )}

            {importStatus === 'error' && (
              <div className="space-y-3">
                <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-bold text-rose-800 block">Import Failed</span>
                  <p className="text-[10px] text-rose-500 max-w-sm mx-auto leading-relaxed mt-0.5">
                    {errorMessage || "Check JSON layout structure and retry."}
                  </p>
                </div>
                <button
                  onClick={() => setImportStatus('idle')}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold tracking-wide rounded-lg transition"
                >
                  Reset & Retry
                </button>
              </div>
            )}

          </div>
        </div>

      </div>

    </div>
  );
}
