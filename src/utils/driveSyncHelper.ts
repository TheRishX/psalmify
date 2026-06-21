import { Song } from '../types';

/**
 * Ensures that the folder "Psamify Lyrics" exists in Google Drive.
 * Return: Folder ID string.
 */
export async function checkAndCreateFolder(token: string): Promise<string> {
  try {
    const q = encodeURIComponent("name = 'Psamify Lyrics' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }

    // Create the folder if it does not exist
    const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "Psamify Lyrics",
        mimeType: "application/vnd.google-apps.folder"
      })
    });
    const folderMeta = await createRes.json();
    if (folderMeta.error) {
      throw new Error(folderMeta.error.message);
    }
    return folderMeta.id;
  } catch (err) {
    console.error("Error in checkAndCreateFolder on Google Drive:", err);
    throw err;
  }
}

/**
 * Checks if a specific lyrical file exists inside a folder.
 */
export async function checkFileExistsInFolder(token: string, folderId: string, songTitle: string): Promise<string | null> {
  try {
    const fileName = `${songTitle.replace(/[\s\/]+/g, '_')}_lyrics.txt`;
    const q = encodeURIComponent(`name = '${fileName}' and '${folderId}' in parents and trashed = false`);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
  } catch (err) {
    console.error("Error checking single lyric existence on Drive:", err);
  }
  return null;
}

/**
 * Saves or updates a single song's lyrics text file inside the specific folder.
 */
export async function syncSingleSongToDrive(token: string, folderId: string, song: Song): Promise<void> {
  try {
    const fileName = `${song.title.replace(/[\s\/]+/g, '_')}_lyrics.txt`;
    const englishText = song.rawLyrics;
    const hindiText = song.rawLyricsHindi || "No Hindi translation provided.";
    
    const fileContent = `===================================================
TITLE: ${song.title.toUpperCase()}
ARTIST: ${song.artist}
GENRE: ${song.genre}
ALBUM: ${song.album || 'N/A'}
EXPORTED AT: ${new Date().toISOString()}
===================================================

[ENGLISH VERSION LYRICS]
---------------------------------------------------
${englishText}

---------------------------------------------------

[HINDI VERSION LYRICS]
---------------------------------------------------
${hindiText}

===================================================
Synced automatically with Psamify Lyrics Database.`;

    const existingFileId = await checkFileExistsInFolder(token, folderId, song.title);
    
    if (existingFileId) {
      // Patch existing file with updated lyrics content
      const mediaRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "text/plain; charset=utf-8"
        },
        body: fileContent
      });
      if (!mediaRes.ok) {
        throw new Error(`Media patch request failed for file id ${existingFileId}`);
      }
    } else {
      // Create a brand new file
      const metaRes = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: fileName,
          mimeType: "text/plain",
          parents: [folderId]
        })
      });
      const fileMeta = await metaRes.json();
      if (fileMeta.error) {
        throw new Error(fileMeta.error.message);
      }

      if (fileMeta.id) {
        const mediaRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileMeta.id}?uploadType=media`, {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "text/plain; charset=utf-8"
          },
          body: fileContent
        });
        if (!mediaRes.ok) {
          throw new Error(`Media patch request failed during original upload for file id ${fileMeta.id}`);
        }
      }
    }
  } catch (err) {
    console.error(`Error syncing track "${song.title}" to Google Drive:`, err);
  }
}

/**
 * Automates synchronization backups of all catalog items to Google Drive folder.
 */
export async function syncAllSongsToDrive(token: string, songsList: Song[]): Promise<number> {
  if (!token || songsList.length === 0) return 0;
  try {
    const folderId = await checkAndCreateFolder(token);
    let count = 0;
    for (const song of songsList) {
      await syncSingleSongToDrive(token, folderId, song);
      count++;
    }
    console.log(`Automatic Google Drive sync complete. Backed up ${count} items.`);
    return count;
  } catch (e) {
    console.error("Bulk auto-backup sync failed on Drive:", e);
    return 0;
  }
}
