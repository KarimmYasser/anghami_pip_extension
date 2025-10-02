// Type definitions for Anghami PiP Extension

// Track Data Interface
export interface TrackData {
  title: string;
  artist: string;
  coverArt: string;
  currentTime: string;
  duration: string;
  remainingTime?: string;
  progress: number;
  isPlaying: boolean;
  isLiked?: boolean;
  isShuffled: boolean;
  repeatMode: "none" | "one" | "all";
}

// Lyrics Interface
export interface LyricsLine {
  text: string;
  startTime: number;
  endTime?: number;
}

export interface LyricsData {
  lines: LyricsLine[];
  currentLineIndex: number;
  available: boolean;
}

// Scraper Interface
export interface AnghamiScraper {
  currentTrack: TrackData | null;
  observers: any[];
  playerElement: Element | null;
  lyricsObserver: MutationObserver | null;
  bodyLyricsObserver: MutationObserver | null;
  lyricsObservingActive: boolean;
  _lastNotifiedCurrentLine: string | null;
  _lyricsElementObserved: Element | null;
  _lyricsAttachInterval: number | null;

  extractCurrentTrack(): TrackData | null;
  getCurrentTime(): string;
  getProgress(): number;
  togglePlayPause(): void;
  previousTrack(): void;
  nextTrack(): void;
  toggleLike(): void;
  toggleShuffle(): void;
  toggleRepeat(): void;
  getShuffleState(): boolean;
  seekTo(percentage: number): void;
  syncToPiP?(): void;
  stopLyricsObserving?(): void;
  startLyricsObserving?(): void;
  getLyrics?(): LyricsData | null;
  notifyPiP?(event: string, data: any): void;
}

// Document Picture-in-Picture API
export interface DocumentPictureInPicture {
  requestWindow(options: PipWindowConfig): Promise<Window>;
}

export interface PipWindowConfig {
  width: number;
  height: number;
}

// Message Response Types
export interface TogglePipResponse {
  success: boolean;
  mode?: string;
  error?: string;
}

export interface StatusResponse {
  success: boolean;
  status?: {
    isConnected: boolean;
    retryCount?: number;
  };
}

// Extend Window interface with custom properties
declare global {
  interface Window {
    anghamiScraper?: AnghamiScraper;
    latestTrackData?: TrackData;
    documentPictureInPicture?: DocumentPictureInPicture;
    anghamiPiPReady?: boolean;
    AnghamiDocumentPiP?: any;
    pipModeManager?: any;
    documentPiPInstance?: any;
    connectionManager?: any;
    testScraper?: () => void;
  }
}

// Ensure module mode
export {};
