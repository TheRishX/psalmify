export interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  genre: string;
  rawLyrics: string;
  formattedLyrics: FormattedSection[];
  youtubeUrl?: string;
  coverUrl?: string;
  duration?: string;
  isFeatured?: boolean;
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
}

export interface AdminCredentials {
  password?: string;
}

export interface WPToken {
  token: string;
  expiresAt: number; // timestamp in ms
}
