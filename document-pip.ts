// Document Picture-in-Picture API implementation for Anghami
// This creates a true "outside browser" PiP window with full HTML controls

import type { TrackData, LyricsData, AnghamiScraper } from "./types";

export class AnghamiDocumentPiP {
  pipWindow: Window | null;
  isActive: boolean;
  trackData: TrackData | null;
  scraper: AnghamiScraper | null;
  minWidth: number;
  minHeight: number;
  windowConfig: {
    width: number;
    height: number;
    disallowReturnToOpener: boolean;
  };
  timeUpdateTimer: number | null;
  lyricsPollTimer: number | null;
  lastLyricsIndex: number;
  _lastCurrentLineText: string | null;

  constructor(options: { width?: number; height?: number } = {}) {
    this.pipWindow = null;
    this.isActive = false;
    this.trackData = null;
    this.scraper = null;
    this.timeUpdateTimer = null;
    this.lyricsPollTimer = null;
    this.lastLyricsIndex = 0;
    this._lastCurrentLineText = null;

    // PiP window dimensions (configurable) with minimum constraints
    this.minWidth = 220; // Minimum width to show all controls properly
    this.minHeight = 100; // Minimum height to prevent bad behaviors

    this.windowConfig = {
      width: Math.max(options.width || 280, this.minWidth),
      height: Math.max(options.height || 120, this.minHeight),
      disallowReturnToOpener: false,
    };
  }

  async init(scraper: AnghamiScraper): Promise<AnghamiDocumentPiP> {
    this.scraper = scraper;
    return this; // allow chaining
  }

  // Calculate remaining time based on current time, duration, and progress
  calculateRemainingTime(
    currentTime: string,
    duration: string,
    progress: number
  ): string {
    try {
      // If we have progress percentage and duration, calculate remaining
      if (progress && duration && duration !== "0:00") {
        const durationSeconds = this.timeToSeconds(duration);
        const currentSeconds = (durationSeconds * progress) / 100;
        const remainingSeconds = Math.max(0, durationSeconds - currentSeconds);
        return this.secondsToTime(remainingSeconds);
      }

      // If we have current time and duration, calculate remaining
      if (
        currentTime &&
        duration &&
        currentTime !== "0:00" &&
        duration !== "0:00"
      ) {
        const currentSeconds = this.timeToSeconds(currentTime);
        const durationSeconds = this.timeToSeconds(duration);
        const remainingSeconds = Math.max(0, durationSeconds - currentSeconds);
        return this.secondsToTime(remainingSeconds);
      }

      // Fallback to showing duration
      return duration || "0:00";
    } catch (error) {
      return duration || "0:00";
    }
  }

  // Helper: Convert MM:SS or HH:MM:SS to seconds
  timeToSeconds(timeString: string): number {
    if (!timeString) return 0;
    const parts = timeString.split(":").map(Number);
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1]; // MM:SS
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2]; // HH:MM:SS
    }
    return 0;
  }

  // Helper: Convert seconds to MM:SS or HH:MM:SS
  secondsToTime(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }
  }

  // Set up frequent time and progress updates
  setupTimeUpdates(): void {
    // Clear any existing timer
    if (this.timeUpdateTimer !== null) {
      clearInterval(this.timeUpdateTimer);
    }

    // Update time and progress every second for smooth updates
    this.timeUpdateTimer = setInterval(() => {
      if (!this.pipWindow || this.pipWindow.closed) {
        if (this.timeUpdateTimer !== null) {
          clearInterval(this.timeUpdateTimer);
        }
        this.timeUpdateTimer = null;
        return;
      }

      // Request fresh data from scraper for time/progress updates
      if (
        this.scraper &&
        typeof this.scraper.extractCurrentTrack === "function"
      ) {
        try {
          // Get current progress without full track extraction for performance
          const currentTime = this.scraper.getCurrentTime();
          const progress = this.scraper.getProgress();

          if (
            this.trackData &&
            (currentTime !== this.trackData.currentTime ||
              progress !== this.trackData.progress)
          ) {
            // Update only time-related data
            this.trackData.currentTime = currentTime;
            this.trackData.progress = progress;

            // Update the display
            this.updateTimeDisplay();
          }
        } catch (error) {}
      }
    }, 1000); // Update every second
  }

  // Update only time-related display elements (for performance)
  updateTimeDisplay() {
    if (!this.pipWindow || !this.trackData) return;

    const doc = this.pipWindow.document;

    try {
      // Update current time
      const currentTimeEl = doc.getElementById("currentTime");
      if (currentTimeEl) {
        currentTimeEl.textContent = this.trackData.currentTime || "0:00";
      }

      // Update remaining time - use directly from scraped data
      const remainingTime =
        this.trackData.remainingTime || this.trackData.duration || "0:00";
      const durationEl = doc.getElementById("duration");
      if (durationEl) {
        durationEl.textContent = remainingTime;
      }

      // Update progress bar
      const progress = this.trackData.progress || 0;
      const progressFill = doc.getElementById("progressFill");
      if (progressFill) {
        progressFill.style.width = `${progress}%`;
      }
    } catch (error) {}
  }
  async createPiPWindow() {
    try {
      // Request Document Picture-in-Picture window
      // Request a new Document PiP window
      if (!window.documentPictureInPicture) {
        throw new Error("Document Picture-in-Picture not supported");
      }
      this.pipWindow = await window.documentPictureInPicture.requestWindow(
        this.windowConfig
      );

      // Set up the PiP window content
      this.setupPiPContent();
      this.setupPiPStyles();
      this.setupPiPEvents();

      this.isActive = true;

      // Set up frequent time updates
      this.setupTimeUpdates();

      // Force scraper to extract current track data
      if (this.scraper) {
        this.scraper.extractCurrentTrack();
      }

      // Also try to get scraper from global window
      if (!this.scraper && window.anghamiScraper) {
        this.scraper = window.anghamiScraper;
        this.scraper.extractCurrentTrack();

        // Also try to force sync any existing data
        if (this.scraper.syncToPiP) {
          this.scraper.syncToPiP();
        }
      }

      // Check for stored track data
      if (window.latestTrackData) {
        this.updateTrackInfo(window.latestTrackData);
      }

      // Update with current track data
      if (this.trackData) {
        this.updatePiPContent();
      } else {
        // Show loading state and retry extraction
        this.showLoadingState();

        // Try multiple extraction attempts
        setTimeout(() => {
          if (window.anghamiScraper) {
            window.anghamiScraper.extractCurrentTrack();
          }
        }, 1000);

        setTimeout(() => {
          if (window.anghamiScraper && !this.trackData) {
            window.anghamiScraper.extractCurrentTrack();
          }
        }, 3000);
      }
      return true;
    } catch (error) {
      this.cleanup();
      return false;
    }
  }

  setupPiPContent(): void {
    const doc = this.pipWindow!.document;

    // Set title
    doc.title = "Anghami Mini Player";

    // Get extension URLs for icons
    const shuffleIcon = chrome.runtime.getURL("icons/shuffle.png");
    const backwardIcon = chrome.runtime.getURL("icons/backward.png");
    const playIcon = chrome.runtime.getURL("icons/play.png");
    const pauseIcon = chrome.runtime.getURL("icons/pause.png");
    const forwardIcon = chrome.runtime.getURL("icons/forward.png");
    const openAnghamiIcon = chrome.runtime.getURL("icons/open-anghami.png");
    const lyricsIcon = chrome.runtime.getURL("icons/lyrics.png");
    const musicIcon = chrome.runtime.getURL("icons/music.png");
    const repeatIcon = chrome.runtime.getURL("icons/repeat.png");

    // Create the HTML structure
    doc.body.innerHTML = `
      <div class="pip-container">
        <div class="track-section">
          <div class="track-cover" id="trackCover">
            <img src="${musicIcon}" alt="Music" class="cover-placeholder-img">
          </div>
          <div class="track-info">
            <div class="track-title" id="trackTitle">Anghami PiP</div>
            <div class="track-artist" id="trackArtist">Select a song</div>
            <div class="progress-bar" id="progressBar">
              <div class="progress-fill" id="progressFill"></div>
            </div>
            <div class="time-info">
              <span id="currentTime">0:00</span>
              <span id="duration">0:00</span>
            </div>
          </div>
        </div>
        <div class="lyrics-container" id="lyricsContainer" style="display: none;">
          <div class="lyrics-scroll" id="lyricsScroll"></div>
        </div>

        <div class="controls-wrapper">
          <button class="ctrl-btn edge-btn" id="repeatBtn" title="Toggle Repeat">
            <img src="${repeatIcon}" alt="Toggle Repeat" class="icon-img">
          </button>
          <div class="controls">
          <button class="ctrl-btn" id="shuffleBtn" title="Shuffle">
            <img src="${shuffleIcon}" alt="Shuffle" class="icon-img">
          </button>
          <button class="ctrl-btn" id="prevBtn" title="Previous">
            <img src="${backwardIcon}" alt="Previous" class="icon-img">
          </button>
          <button class="ctrl-btn play-btn" id="playPauseBtn" title="Play/Pause">
            <img id="playIcon" src="${playIcon}" alt="Play" class="icon-img play-pause-icon">
            <img id="pauseIcon" src="${pauseIcon}" alt="Pause" class="icon-img play-pause-icon" style="display: none;">
          </button>
          <button class="ctrl-btn" id="nextBtn" title="Next">
            <img src="${forwardIcon}" alt="Next" class="icon-img">
          </button>
          <button class="ctrl-btn" id="openAnghamiBtn" title="Open Anghami">
            <img src="${openAnghamiIcon}" alt="Open Anghami" class="icon-img">
          </button>
          </div>
          <button class="ctrl-btn edge-btn" id="lyricsBtn" title="Toggle Lyrics">
            <img src="${lyricsIcon}" alt="Toggle Lyrics" class="icon-img">
          </button>
        </div>
      </div>
    `;
  }

  setupPiPStyles(): void {
    const doc = this.pipWindow!.document;

    // Get CSS variables from the main document to ensure consistency
    const mainDoc = document.documentElement;
    const computedStyle = getComputedStyle(mainDoc);

    const cssVariables = {
      // Primary Theme Colors
      "--anghami-primary":
        computedStyle.getPropertyValue("--anghami-primary") || "#8d00f2",
      "--anghami-primary-light":
        computedStyle.getPropertyValue("--anghami-primary-light") || "#8d00f2",
      "--anghami-primary-dark":
        computedStyle.getPropertyValue("--anghami-primary-dark") || "#ff3b30",

      // Background Colors
      "--anghami-bg-primary":
        computedStyle.getPropertyValue("--anghami-bg-primary") || "#1a1a1a",
      "--anghami-bg-secondary":
        computedStyle.getPropertyValue("--anghami-bg-secondary") || "#2d2d2d",
      "--anghami-bg-overlay":
        computedStyle.getPropertyValue("--anghami-bg-overlay") ||
        "rgba(255, 255, 255, 0.05)",
      "--anghami-bg-button":
        computedStyle.getPropertyValue("--anghami-bg-button") ||
        "rgba(255, 255, 255, 0.1)",
      "--anghami-bg-button-hover":
        computedStyle.getPropertyValue("--anghami-bg-button-hover") ||
        "rgba(255, 255, 255, 0.2)",
      "--anghami-bg-button-active":
        computedStyle.getPropertyValue("--anghami-bg-button-active") ||
        "rgba(255, 107, 53, 0.2)",
      "--anghami-bg-progress":
        computedStyle.getPropertyValue("--anghami-bg-progress") ||
        "rgba(255, 255, 255, 0.2)",

      // Text Colors
      "--anghami-text-primary":
        computedStyle.getPropertyValue("--anghami-text-primary") || "#ffffff",
      "--anghami-text-secondary":
        computedStyle.getPropertyValue("--anghami-text-secondary") ||
        "rgba(255, 255, 255, 0.8)",
      "--anghami-text-tertiary":
        computedStyle.getPropertyValue("--anghami-text-tertiary") ||
        "rgba(255, 255, 255, 0.7)",
      "--anghami-text-muted":
        computedStyle.getPropertyValue("--anghami-text-muted") ||
        "rgba(255, 255, 255, 0.6)",

      // Border Colors
      "--anghami-border-primary":
        computedStyle.getPropertyValue("--anghami-border-primary") ||
        "rgba(255, 255, 255, 0.1)",
      "--anghami-border-secondary":
        computedStyle.getPropertyValue("--anghami-border-secondary") ||
        "rgba(255, 255, 255, 0.15)",

      // Shadow Colors
      "--anghami-shadow-light":
        computedStyle.getPropertyValue("--anghami-shadow-light") ||
        "rgba(0, 0, 0, 0.3)",
      "--anghami-shadow-medium":
        computedStyle.getPropertyValue("--anghami-shadow-medium") ||
        "rgba(0, 0, 0, 0.5)",
      "--anghami-shadow-dark":
        computedStyle.getPropertyValue("--anghami-shadow-dark") ||
        "rgba(0, 0, 0, 0.6)",
      "--anghami-shadow-heavy":
        computedStyle.getPropertyValue("--anghami-shadow-heavy") ||
        "rgba(0, 0, 0, 0.7)",
    };

    // Create and inject CSS
    const style = doc.createElement("style");
    style.textContent = `
      /* Sync color variables from main document */
      :root {
        ${Object.entries(cssVariables)
          .map(([key, value]) => `${key}: ${value.trim()};`)
          .join("\n        ")}
      }
      
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
        background: linear-gradient(135deg, #0a0a0a 0%, var(--anghami-bg-primary) 100%);
        color: var(--anghami-text-primary);
        width: 100%;
        height: 100vh;
        overflow: hidden;
        user-select: none;
        font-size: clamp(10px, 2vw, 14px); /* Fluid base font size */
      }
      
      .pip-container {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        padding: clamp(6px, 2vh, 12px);
        gap: clamp(4px, 1vh, 10px);
        justify-content: space-between; /* Space between content and controls */
      }
      
      .track-cover {
        width: clamp(40px, 15vw, 64px);
        height: clamp(40px, 15vw, 64px);
        border-radius: clamp(4px, 1vw, 8px);
        background: var(--anghami-bg-button);
        background-size: cover;
        background-position: center;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        border: 1px solid var(--anghami-border-primary);
      }
      
      .cover-placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
      }

      .track-section {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: clamp(8px, 2vw, 16px);
      }
      
      .track-info {
        flex: 1;
        min-width: 0;
      }
      
      .track-title {
        font-size: clamp(15px, 2.8vw, 17px);
        font-weight: 600;
        margin-bottom: 2px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--anghami-text-primary);
      }
      
      .track-artist {
        font-size: clamp(10px, 2.2vw, 12px);
        color: var(--anghami-text-tertiary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin-bottom: 4px;
      }
      
      .progress-bar {
        height: clamp(4px, 0.5vh, 6px);
        background: var(--anghami-border-secondary);
        border-radius: 2px;
        position: relative;
        cursor: pointer;
        margin-bottom: 3px;
      }
      
      .progress-fill {
        height: 100%;
        background: var(--anghami-primary);
        border-radius: 2px;
        width: 0%;
        transition: width 0.2s ease;
      }
      
      .time-info {
        display: flex;
        justify-content: space-between;
        font-size: clamp(10px, 2vw, 12px);
        color: var(--anghami-text-muted);
        font-weight: 500;
      }
      
      .controls-wrapper {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-top: auto; /* Push to bottom */
        padding-top: clamp(4px, 1vh, 8px);
        flex-shrink: 0; /* Prevent controls from shrinking */
      }

      .controls {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 4px;
      }

      #lyricsBtn.edge-btn {
        position: absolute;
        right: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 26px;
        height: 26px;
        background: var(--anghami-bg-button);
      }

      #lyricsBtn.edge-btn.active {
        background: var(--anghami-bg-button-active);
      }

      #repeatBtn.edge-btn {
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 26px;
        height: 26px;
        background: var(--anghami-bg-button);
      }

      #repeatBtn.edge-btn.active {
        background: var(--anghami-bg-button-active);
      }
      
      .ctrl-btn {
        background: var(--anghami-bg-button);
        border: none;
        color: var(--anghami-text-secondary);
        width: clamp(24px, 6vw, 32px);
        height: clamp(24px, 6vw, 32px);
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
        backdrop-filter: blur(10px);
      }
      
      .ctrl-btn:hover {
        background: var(--anghami-bg-button-active);
        color: var(--anghami-primary);
        transform: scale(1.1);
      }
      
      .ctrl-btn:active {
        transform: scale(0.95);
      }
      
      .ctrl-btn.play-btn {
        width: clamp(32px, 8vw, 44px);
        height: clamp(32px, 8vw, 44px);
        background: linear-gradient(45deg, var(--anghami-primary), var(--anghami-primary-light));
        color: var(--anghami-text-primary);
        margin: 0 clamp(4px, 1vw, 8px);
        box-shadow: 0 2px 8px var(--anghami-shadow-light);
      }
      
      .ctrl-btn.play-btn:hover {
        background: linear-gradient(45deg, var(--anghami-primary-dark), var(--anghami-primary));
        transform: scale(1.05);
        box-shadow: 0 4px 12px var(--anghami-shadow-medium);
      }
      
      .ctrl-btn.active {
        background: var(--anghami-bg-button-active);
        color: var(--anghami-primary);
      }
      
      .icon-img {
        width: clamp(12px, 3vw, 16px);
        height: clamp(12px, 3vw, 16px);
        pointer-events: none;
        opacity: 1;
        transition: all 0.15s ease;
      }
      
      .ctrl-btn:hover .icon-img {
        opacity: 1;
      }
      
      .ctrl-btn.play-btn .play-pause-icon {
        width: clamp(14px, 3.5vw, 18px);
        height: clamp(14px, 3.5vw, 18px);
      }
      
      .ctrl-btn.active .icon-img {
        /* No filter - preserve original icon colors */
      }
      
      .cover-placeholder-img {
        width: 24px;
        height: 24px;
        opacity: 0.8;
        /* No filter - preserve original icon colors */
      }
      
      /* Edge Buttons (Repeat on left, Lyrics on right) */
      .edge-btn-left {
        position: absolute;
        left: clamp(6px, 2vw, 12px);
        bottom: clamp(6px, 2vh, 12px);
      }
      
      /* Lyrics Button Styles */
      .lyrics-text {
        font-size: 10px;
        font-weight: 600;
        color: var(--anghami-text-primary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      #lyricsBtn.active .lyrics-text {
        color: var(--anghami-primary);
      }
      
      /* Lyrics Container Styles */
      .lyrics-container {
        margin-top: clamp(4px, 1vh, 8px);
        flex: 1 1 auto;
        min-height: 0;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      
      .lyrics-scroll {
        padding: clamp(6px, 1.5vh, 12px) clamp(8px, 2vw, 14px);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        height: 100%;
        overflow: hidden;
        position: relative;
      }
      
      .lyrics-line {
        font-size: clamp(14px, 3vw, 20px);
        line-height: 1.4;
        color: rgba(255, 255, 255, 0.4);
        margin: clamp(3px, 0.8vh, 6px) 0;
        text-align: center;
        opacity: 0.6;
        width: 100%;
        transform-origin: center center;
      }
      
      .lyrics-line.past {
        font-size: clamp(9px, 2vw, 12px);
        opacity: 0.6;
        color: rgba(255, 255, 255, 0.4);
      }
      
      .lyrics-line.current {
        color: rgba(255, 255, 255, 1);
        font-size: clamp(12px, 3vw, 16px);
        font-weight: 600;
        margin: clamp(6px, 1.5vh, 10px) 0;
        text-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
        opacity: 1;
      }
      
      .lyrics-line.future {
        font-size: clamp(9px, 2vw, 12px);
        opacity: 0.6;
        color: rgba(255, 255, 255, 0.4);
      }
    `;

    doc.head.appendChild(style);
  }

  setupPiPEvents(): void {
    const doc = this.pipWindow!.document;

    // Check for all expected elements
    const elements = {
      playPauseBtn: doc.getElementById("playPauseBtn"),
      prevBtn: doc.getElementById("prevBtn"),
      nextBtn: doc.getElementById("nextBtn"),
      shuffleBtn: doc.getElementById("shuffleBtn"),
      openAnghamiBtn: doc.getElementById("openAnghamiBtn"),
      progressBar: doc.getElementById("progressBar"),
    };

    // Log missing elements
    const missing = Object.entries(elements)
      .filter(([_key, element]) => !element)
      .map(([key]) => key);
    if (missing.length > 0) {
    }

    // Close button (only if it exists)
    const closeBtn = doc.getElementById("closeBtn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        this.close();
      });
    }

    // Play/Pause button
    const playPauseBtn = doc.getElementById("playPauseBtn");
    if (playPauseBtn) {
      playPauseBtn.addEventListener("click", () => {
        try {
          if (
            this.scraper &&
            typeof this.scraper.togglePlayPause === "function"
          ) {
            this.scraper.togglePlayPause();
          } else {
          }
        } catch (error) {}
      });
    } else {
    }

    // Previous/Next buttons
    const prevBtn = doc.getElementById("prevBtn");
    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        try {
          if (
            this.scraper &&
            typeof this.scraper.previousTrack === "function"
          ) {
            this.scraper.previousTrack();
          } else {
          }
        } catch (error) {}
      });
    } else {
    }

    const nextBtn = doc.getElementById("nextBtn");
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        try {
          if (this.scraper && typeof this.scraper.nextTrack === "function") {
            this.scraper.nextTrack();
          } else {
          }
        } catch (error) {}
      });
    } else {
    }

    // Repeat button
    const repeatBtn = doc.getElementById("repeatBtn");
    if (repeatBtn) {
      repeatBtn.addEventListener("click", () => {
        try {
          if (this.scraper && typeof this.scraper.toggleRepeat === "function") {
            console.log("Repeat button clicked, calling toggleRepeat");
            this.scraper.toggleRepeat();

            // Don't toggle class here - let the state update drive it
            // The scraper will extract the new repeat mode and updatePiPContent will be called
          } else {
            console.error("Scraper or toggleRepeat not available");
          }
        } catch (error) {
          console.error("Error toggling repeat:", error);
        }
      });
    }

    // Lyrics button
    const lyricsBtn = doc.getElementById("lyricsBtn");
    if (lyricsBtn) {
      lyricsBtn.addEventListener("click", () => {
        this.toggleLyricsDisplay();
      });
    }

    // Open Anghami button (moved from like button position)
    const openAnghamiBtn = doc.getElementById("openAnghamiBtn");
    if (openAnghamiBtn) {
      openAnghamiBtn.addEventListener("click", () => {
        try {
          // Focus the original window
          if (window.opener) {
            window.opener.focus();
          } else {
            window.focus();
          }
        } catch (error) {}
      });
    }

    // Shuffle button
    const shuffleBtn = doc.getElementById("shuffleBtn");
    if (shuffleBtn) {
      shuffleBtn.addEventListener("click", () => {
        try {
          if (
            this.scraper &&
            typeof this.scraper.toggleShuffle === "function"
          ) {
            this.scraper.toggleShuffle();

            // Immediately get updated shuffle state and refresh UI
            setTimeout(() => {
              if (
                this.scraper &&
                typeof this.scraper.getShuffleState === "function"
              ) {
                const updatedShuffleState = this.scraper.getShuffleState();
                if (this.trackData) {
                  this.trackData.isShuffled = updatedShuffleState;
                  // Update shuffle button visual state immediately
                  shuffleBtn.classList.toggle("active", updatedShuffleState);
                }
              }
            }, 100); // Small delay to let DOM update
          } else {
          }
        } catch (error) {}
      });
    } else {
    }

    // Note: Repeat button removed from layout - not needed in compact design

    // Open Anghami button event already bound above

    // Progress bar seeking
    const progressBar = doc.getElementById("progressBar");
    if (progressBar) {
      progressBar.addEventListener("click", (e) => {
        try {
          const rect = progressBar.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const percentage = Math.max(0, 100 - (clickX / rect.width) * 100);

          if (this.scraper && typeof this.scraper.seekTo === "function") {
            this.scraper.seekTo(percentage);
          } else {
          }
        } catch (error) {}
      });
    } else {
    }

    // Handle window close
    this.pipWindow!.addEventListener("unload", () => {
      this.cleanup();
    });

    // Note: Document PiP windows don't support programmatic resizeTo() without user activation
    // Minimum size is enforced via CSS and window creation options instead
    // Keyboard shortcuts
    doc.addEventListener("keydown", (e) => {
      switch (e.code) {
        case "Space":
          e.preventDefault();
          if (this.scraper) this.scraper.togglePlayPause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (this.scraper) this.scraper.previousTrack();
          break;
        case "ArrowRight":
          e.preventDefault();
          if (this.scraper) this.scraper.nextTrack();
          break;
        case "KeyL":
          if (this.scraper) this.scraper.toggleLike();
          break;
        case "KeyS":
          if (this.scraper) this.scraper.toggleShuffle();
          break;
        case "KeyR":
          if (this.scraper) this.scraper.toggleRepeat();
          break;
      }
    });
  }

  updateTrackInfo(trackData: TrackData): void {
    // Check if this is a new track (reset lyrics index for duplicates handling)
    if (
      this.trackData &&
      trackData &&
      (this.trackData.title !== trackData.title ||
        this.trackData.artist !== trackData.artist)
    ) {
      this.lastLyricsIndex = 0;
      this._lastCurrentLineText = null;
    }

    this.trackData = trackData;

    if (this.pipWindow && this.isActive) {
      this.updatePiPContent();
    } else {
    }
  }

  showLoadingState(): void {
    if (!this.pipWindow) return;

    const doc = this.pipWindow.document;
    doc.getElementById("trackTitle")!.textContent = "Loading...";
    doc.getElementById("trackArtist")!.textContent = "Connecting to Anghami";

    // Reset progress
    const progressFill = doc.getElementById("progressFill");
    if (progressFill) {
      progressFill.style.width = "0%";
    }
  }

  updatePiPContent(): void {
    if (!this.pipWindow) {
      return;
    }

    const doc = this.pipWindow.document;

    if (!this.trackData) {
      this.showLoadingState();
      return;
    }

    // Update track info with fallbacks
    doc.getElementById("trackTitle")!.textContent =
      this.trackData.title || "Unknown Track";
    doc.getElementById("trackArtist")!.textContent =
      this.trackData.artist || "Unknown Artist";
    doc.getElementById("currentTime")!.textContent =
      this.trackData.currentTime || "0:00";

    // Display remaining time - use directly from scraped data
    const remainingTime =
      this.trackData.remainingTime || this.trackData.duration || "0:00";
    doc.getElementById("duration")!.textContent = remainingTime;

    // Update cover art
    const coverElement = doc.getElementById("trackCover");
    if (coverElement) {
      if (this.trackData.coverArt) {
        (
          coverElement as HTMLElement
        ).style.backgroundImage = `url(${this.trackData.coverArt})`;
        coverElement.innerHTML = "";
      } else {
        (coverElement as HTMLElement).style.backgroundImage = "";
        const musicIconUrl = chrome.runtime.getURL("icons/music.png");
        coverElement.innerHTML = `<div class="cover-placeholder"><img src="${musicIconUrl}" alt="Music" class="cover-placeholder-img"></div>`;
      }
    }

    // Update progress
    const progress = this.trackData.progress || 0;
    const progressFill = doc.getElementById("progressFill");
    if (progressFill) {
      progressFill.style.width = `${progress}%`;
    }

    // Update play/pause button
    const playIcon = doc.getElementById("playIcon");
    const pauseIcon = doc.getElementById("pauseIcon");
    if (playIcon && pauseIcon) {
      if (this.trackData.isPlaying) {
        playIcon.style.display = "none";
        pauseIcon.style.display = "block";
      } else {
        playIcon.style.display = "block";
        pauseIcon.style.display = "none";
      }
    }

    // Update shuffle button active state
    const shuffleBtn = doc.getElementById("shuffleBtn");
    if (shuffleBtn) {
      shuffleBtn.classList.toggle("active", this.trackData.isShuffled);
    }

    // Update repeat button (if it exists)
    const repeatBtn = doc.getElementById("repeatBtn");
    if (repeatBtn) {
      repeatBtn.classList.toggle(
        "active",
        this.trackData.repeatMode !== "none"
      );
    }

    // Lyrics are now controlled by button, not automatic

    // Log successful update
  }

  toggleLyricsDisplay(): void {
    if (!this.pipWindow) return;

    const doc = this.pipWindow.document;
    const lyricsContainer = doc.getElementById("lyricsContainer");
    const lyricsScroll = doc.getElementById("lyricsScroll");
    const lyricsBtn = doc.getElementById("lyricsBtn");

    if (!lyricsContainer || !lyricsScroll || !lyricsBtn) {
      return;
    }

    const isVisible = lyricsContainer.style.display !== "none";

    if (isVisible) {
      lyricsContainer.style.display = "none";
      lyricsBtn.classList.remove("active");

      // Stop observing via direct scraper access
      if (window.anghamiScraper) {
        window.anghamiScraper.stopLyricsObserving?.();
      }

      if (this.lyricsPollTimer) {
        clearInterval(this.lyricsPollTimer);
        this.lyricsPollTimer = null;
      }
    } else {
      lyricsContainer.style.display = "block";
      lyricsBtn.classList.add("active");
      lyricsScroll.innerHTML = `<div class=\"lyrics-line\">Loading lyrics...</div>`;

      console.log("🎵 Lyrics button clicked - requesting lyrics...");

      // Access scraper directly from main window instead of chrome.runtime messaging
      if (window.anghamiScraper) {
        console.log("✅ Scraper available, starting observation...");
        window.anghamiScraper.startLyricsObserving?.();

        // Get initial lyrics snapshot
        const lyrics = window.anghamiScraper.getLyrics?.();
        console.log("📊 Initial lyrics snapshot:", {
          hasLyrics: !!lyrics,
          linesCount: lyrics?.lines?.length || 0,
          currentIndex: lyrics?.currentLineIndex ?? -1,
        });

        this.updateLyricsDisplay(lyrics);

        // Also trigger the notification manually
        window.anghamiScraper.notifyPiP?.("lyricsUpdated", lyrics);
      } else {
        console.error("❌ Scraper not available!");
        lyricsScroll.innerHTML = `<div class=\"lyrics-line\">Error: Scraper not available</div>`;
      }

      // Set up polling as fallback
      const snapshot = () => {
        if (window.anghamiScraper) {
          const lyrics = window.anghamiScraper.getLyrics?.();
          this.updateLyricsDisplay(lyrics);
        }
      };

      if (this.lyricsPollTimer) clearInterval(this.lyricsPollTimer);
      this.lyricsPollTimer = setInterval(() => {
        if (lyricsContainer.style.display === "none") return;
        snapshot();
      }, 4000);
    }
  }

  getCurrentLyrics(): LyricsData | null {
    return null;
  }

  async toggle(): Promise<boolean> {
    if (this.isActive) {
      this.close();
      return false;
    } else {
      return await this.createPiPWindow();
    }
  }

  close(): void {
    if (this.pipWindow) {
      this.pipWindow.close();
    }
    this.cleanup();
  }

  cleanup(): void {
    // Clear time update timer
    if (this.timeUpdateTimer !== null) {
      clearInterval(this.timeUpdateTimer);
      this.timeUpdateTimer = null;
    }

    this.isActive = false;
    this.pipWindow = null;
  }

  updateLyricsDisplay(lyrics: any): void {
    try {
      if (!this.pipWindow) {
        return;
      }
      const doc = this.pipWindow.document;
      const lyricsContainer = doc.getElementById("lyricsContainer");
      const lyricsScroll = doc.getElementById("lyricsScroll");

      // Only proceed if lyrics UI is visible
      if (!lyricsContainer || lyricsContainer.style.display === "none") {
        return;
      }
      if (!lyricsScroll) {
        return;
      }

      if (!lyrics || !lyrics.lines || lyrics.lines.length === 0) {
        // Show fallback
        lyricsScroll.innerHTML = `
          <div class="lyrics-line current">♪ No lyrics available</div>
          <div class="lyrics-line">Open lyrics on Anghami to enable them</div>
        `;
        return;
      }

      // Use the currentLineIndex from the lyrics data
      let currentIndex = lyrics.currentLineIndex ?? 0;

      // Ensure the index is valid
      if (currentIndex < 0 || currentIndex >= lyrics.lines.length) {
        currentIndex = 0;
      }

      // Get current and next lines using the LyricsLine interface
      const currentLine = lyrics.lines[currentIndex]?.text || "";
      const nextLine =
        currentIndex < lyrics.lines.length - 1
          ? lyrics.lines[currentIndex + 1]?.text
          : null;

      // Check if the ACTUAL current line text changed (not just index)
      const currentLineChanged = this._lastCurrentLineText !== currentLine;
      const indexChanged = this.lastLyricsIndex !== currentIndex;

      console.log("📝 Lyrics update check:", {
        currentLineChanged,
        indexChanged,
        currentIndex,
        totalLines: lyrics.lines.length,
        existingCount: lyricsScroll.querySelectorAll(".lyrics-line").length,
        currentLine: currentLine?.substring(0, 30),
        nextLine: nextLine?.substring(0, 30),
      });

      // Update tracking
      this.lastLyricsIndex = currentIndex;
      this._lastCurrentLineText = currentLine;

      // Get existing elements
      const existingLines = lyricsScroll.querySelectorAll(".lyrics-line");

      // Animate if we have existing elements and something changed
      // Use View Transitions for smooth morphing when available
      if ((currentLineChanged || indexChanged) && existingLines.length === 2) {
        // Use native View Transitions API for hero animations
        const doc = this.pipWindow.document;

        // Check if View Transitions API is supported
        if (doc.startViewTransition) {
          console.log("🎬 Starting View Transition");

          // Start a view transition
          const transition = doc.startViewTransition(() => {
            console.log("🔄 Inside transition callback");
            const oldCurrent = existingLines[0];
            const oldNext = existingLines[1];

            // Strategy: Keep elements in same DOM positions (slots)
            // Just update their content and styling
            // Each slot keeps its view-transition-name (slot-0, slot-1)

            // Slot 0 (top) - update from old current to new current
            // The old current line morphs into new current (with style changes)
            oldCurrent.className = "lyrics-line current";
            oldCurrent.textContent = currentLine;
            // view-transition-name stays as slot-0

            // Slot 1 (bottom) - update from old next to new next
            oldNext.className = "lyrics-line future";
            oldNext.textContent = nextLine || "\u00A0";
            // view-transition-name stays as slot-1

            console.log("✅ DOM updated in place - slots morphing:", {
              slot0: (oldCurrent as HTMLElement).style.viewTransitionName,
              slot1: (oldNext as HTMLElement).style.viewTransitionName,
            });
          });

          // Handle transition completion
          transition.finished
            .then(() => {
              console.log("✨ Transition completed successfully");
            })
            .catch(() => {
              console.log("⚠️ Transition was skipped or interrupted");
            });
        } else {
          // Fallback for browsers without View Transitions API
          const oldCurrent = existingLines[0] as HTMLElement;
          const oldNext = existingLines[1] as HTMLElement;

          oldCurrent.style.transition = "all 0.3s ease";
          oldCurrent.textContent = currentLine;

          oldNext.style.transition = "all 0.3s ease";
          oldNext.textContent = nextLine || "\u00A0";
        }
      } else {
        // First render or no animation needed
        this.renderLyricsLines(doc, lyricsScroll, currentLine, nextLine);
      }
    } catch (e) {
      // Silent fail; we deliberately avoid console noise
    }
  }

  renderLyricsLines(
    doc: Document,
    lyricsScroll: HTMLElement,
    currentLine: string,
    nextLine: string | null
  ): void {
    // Build the 2-line display (used for initial render)
    lyricsScroll.innerHTML = "";

    // Slot 0 - Current line
    const currentEl = doc.createElement("div");
    currentEl.className = "lyrics-line current";
    currentEl.textContent = currentLine;
    currentEl.style.viewTransitionName = "slot-0";
    lyricsScroll.appendChild(currentEl);

    // Slot 1 - Next line
    const nextEl = doc.createElement("div");
    nextEl.className = "lyrics-line future";
    nextEl.textContent = nextLine || "\u00A0";
    nextEl.style.viewTransitionName = "slot-1";
    lyricsScroll.appendChild(nextEl);
  }

  handleEvent(event: string, data: any): void {
    switch (event) {
      case "trackUpdated":
        this.updateTrackInfo(data);
        break;
      case "progressUpdated":
        if (this.trackData) {
          this.trackData.progress = data.progress;
          this.trackData.currentTime = data.currentTime;
          this.trackData.remainingTime = data.remainingTime;
        } else {
          this.trackData = { ...data };
        }
        this.updatePiPContent();
        break;
      case "playStateUpdated":
        if (this.trackData) {
          this.trackData.isPlaying = data.isPlaying;
        }
        this.updatePiPContent();
        break;
      case "lyricsUpdated":
        // Update lyrics in real-time when observing is active
        this.updateLyricsDisplay(data);
        break;
      default:
    }
  }
}

// Instantiate and make available globally
window.AnghamiDocumentPiP = new AnghamiDocumentPiP();

console.log("✅ Document PiP class loaded and instantiated");
