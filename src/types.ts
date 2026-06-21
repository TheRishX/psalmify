export interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  genre: string;
  rawLyrics: string;
  formattedLyrics: FormattedSection[];
  rawLyricsHindi?: string;
  formattedLyricsHindi?: FormattedSection[];
  youtubeUrl?: string;
  coverUrl?: string;
  duration?: string;
  isFeatured?: boolean;
  status?: string;
  createdAt?: string;
  submittedBy?: string;
  submittedByName?: string;
}

export interface FormattedSection {
  type: 'verse' | 'chorus' | 'bridge' | 'hook' | 'intro' | 'outro' | 'stanza';
  label: string;
  lines: string[];
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  genre: string;
  songIds: string[];
  status?: string;
  createdAt?: string;
}

export interface AdminCredentials {
  password?: string;
}

export interface WPToken {
  token: string;
  expiresAt: number; // timestamp in ms
}

export interface Genre {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
}
