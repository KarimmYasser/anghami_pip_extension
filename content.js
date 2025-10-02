// Anghami PiP Extension - Content Script
// Handles DOM scraping and communication with the native Anghami player

// Global ready state
window.anghamiPiPReady = false;

class AnghamiScraper {
  constructor() {
    this.currentTrack = null;
    this.observers = [];
    this.playerElement = null;
    this.init();
  }

  init() {
    // Debug DOM structure
    this.debugDOM();

    // Wait for the player to be ready
    this.waitForPlayer().then(() => {
      this.setupObservers();
      this.extractCurrentTrack();

      // Force extract track data after a short delay
      setTimeout(() => {
        this.extractCurrentTrack();
      }, 1000);

      // Set up periodic extraction as fallback
      this.setupPeriodicExtraction();
    });
  }

  debugDOM() {}

  setupPeriodicExtraction() {
    // Extract track data every 5 seconds as fallback
    setInterval(() => {
      this.extractCurrentTrack();
    }, 5000);
  }

  waitForPlayer() {
    return new Promise((resolve) => {
      const checkPlayer = () => {
        this.playerElement = document.querySelector(".player-wrapper");
        if (this.playerElement) {
          resolve();
        } else {
          setTimeout(checkPlayer, 100);
        }
      };
      checkPlayer();
    });
  }

  setupObservers() {
    // Observe changes to track info
    const trackInfoObserver = new MutationObserver(() => {
      this.extractCurrentTrack();
    });

    const trackInfoElement = document.querySelector(".track-info");
    if (trackInfoElement) {
      trackInfoObserver.observe(trackInfoElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class"],
      });
      this.observers.push(trackInfoObserver);
    }

    // Observe progress changes
    const progressObserver = new MutationObserver(() => {
      this.updateProgress();
    });

    const progressElement = document.querySelector("anghami-buffer");
    if (progressElement) {
      progressObserver.observe(progressElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style"],
      });
      this.observers.push(progressObserver);
    }

    // Observe duration-text changes (elapsed and remaining time)
    const timeObserver = new MutationObserver(() => {
      this.updateProgress(); // This will now include remaining time updates
    });

    const timeElements = document.querySelectorAll(".duration-text");
    timeElements.forEach((timeElement) => {
      if (timeElement) {
        timeObserver.observe(timeElement, {
          childList: true,
          subtree: true,
          characterData: true, // Listen for text content changes
        });
      }
    });
    if (timeElements.length > 0) {
      this.observers.push(timeObserver);
    }

    // Observe play/pause state changes
    const controlsObserver = new MutationObserver(() => {
      this.updatePlayState();
    });

    const controlsElement = document.querySelector(".player-controls");
    if (controlsElement) {
      controlsObserver.observe(controlsElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class"],
      });
      this.observers.push(controlsObserver);
    }

    // Lyrics observers are now conditional - only enabled when lyrics display is active
    this.lyricsObserver = null;
    this.bodyLyricsObserver = null;
    this.lyricsObservingActive = false;
  }

  extractCurrentTrack() {
    try {
      const trackData = {
        title: this.getTrackTitle(),
        artist: this.getArtistName(),
        coverArt: this.getCoverArt(),
        duration: this.getDuration(),
        currentTime: this.getCurrentTime(),
        remainingTime: this.getRemainingTime(),
        progress: this.getProgress(),
        isPlaying: this.getPlayState() === "playing",
        isLiked: this.getLikeState(),
        isShuffled: this.getShuffleState(),
        repeatMode: this.getRepeatState(),
      };

      // Debug individual extractions

      // Always send data (even if empty) to verify communication
      this.currentTrack = trackData;
      this.notifyPiP("trackUpdated", trackData);

      // If no real data found, also send test data to verify communication is working
      if (trackData.title === "No track playing" || !trackData.title) {
        const testData = {
          title: "🧪 Test Song (Communication Check)",
          artist: "Test Artist - If you see this, communication works!",
          coverArt: null,
          duration: "3:45",
          currentTime: "1:23",
          progress: 35,
          isPlaying: true,
          isLiked: false,
          isShuffled: false,
          repeatMode: "none",
          lyrics: {
            lines: [
              "🎵 This is a test lyric line",
              "🎶 Lyrics will appear here when available",
              "♪ Extension communication is working ♪",
            ],
            currentLine: "🎶 Lyrics will appear here when available",
            isAvailable: true,
          },
        };

        setTimeout(() => {
          this.notifyPiP("trackUpdated", testData);
        }, 500);
      }
    } catch (error) {
      // Send test data even on error
      const errorTestData = {
        title: "Error Test - Communication Check",
        artist: "Debug Mode",
        duration: "0:00",
        currentTime: "0:00",
        progress: 0,
        isPlaying: false,
      };
      this.notifyPiP("trackUpdated", errorTestData);
    }
  }

  getTrackTitle() {
    const titleSelectors = [
      // Current Anghami selectors
      ".track-info .info .action-title .trim span",
      ".action-title .trim span",
      ".track-info .info .d-block.action-title .trim span",
      ".player-section.track-info .info .trim span",
      ".main-player .track-info .action-title span",
      ".player-wrapper .track-info .action-title",

      // Modern/updated selectors
      "[data-testid='track-title']",
      "[data-cy='track-title']",
      ".track-title",
      ".song-title",
      ".current-track-title",
      ".player-track-title",
      ".now-playing-title",

      // Broader selectors
      ".player-info .title",
      ".track-details .title",
      ".media-info .title",
      ".playback-info .title",
      ".mini-player .title",

      // Generic but targeted
      ".player [class*='title']",
      ".track-info [class*='title']",
      "[class*='player'] [class*='title']",
    ];

    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }

    // Fallback: look for any element that might contain title
    const allElements = document.querySelectorAll("span, div, h1, h2, h3");
    for (const el of allElements) {
      const text = el.textContent?.trim();
      if (
        text &&
        text.length > 3 &&
        text.length < 100 &&
        el.closest(".track-info, .player, .main-player")
      ) {
        return text;
      }
    }

    return "No track playing";
  }

  getArtistName() {
    const artistSelectors = [
      // Current Anghami selectors
      ".track-info .info .action-artist .trim",
      ".action-artist .trim",
      ".d-block.action-artist .trim",
      ".player-section.track-info .info .action-artist .trim",

      // Modern/updated selectors
      "[data-testid='track-artist']",
      "[data-cy='track-artist']",
      ".track-artist",
      ".song-artist",
      ".current-track-artist",
      ".player-track-artist",
      ".now-playing-artist",

      // Broader selectors
      ".player-info .artist",
      ".track-details .artist",
      ".media-info .artist",
      ".playback-info .artist",
      ".mini-player .artist",

      // Generic but targeted
      ".player [class*='artist']",
      ".track-info [class*='artist']",
      "[class*='player'] [class*='artist']",
    ];

    for (const selector of artistSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }
    return "Unknown Artist";
  }

  getCoverArt() {
    const coverSelectors = [
      // Current Anghami selectors
      ".track-img-cntr .track-coverart",
      ".player-section.track-info .track-coverart",
      ".image-info-container .track-coverart",
      ".track-info .track-img-cntr .track-coverart",

      // Modern/updated selectors
      "[data-testid='track-image']",
      "[data-cy='track-image']",
      ".track-image",
      ".song-image",
      ".album-art",
      ".cover-art",
      ".track-cover",
      ".current-track-image",
      ".player-image",
      ".now-playing-image",

      // Broader selectors
      ".player-info img",
      ".track-details img",
      ".media-info img",
      ".playback-info img",
      ".mini-player img",

      // Generic but targeted
      ".player [class*='image']",
      ".player [class*='cover']",
      ".track-info img",
      "[class*='player'] img",
    ];

    for (const selector of coverSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        // Check for background-image style
        const style = element.style.backgroundImage;
        if (style) {
          const match = style.match(/url\(['"]?(.*?)['"]?\)/);
          if (match && match[1]) {
            return match[1].replace(/&amp;/g, "&");
          }
        }

        // Check for src attribute (if it's an img tag)
        const src = element.src;
        if (src && src.startsWith("http")) {
          return src;
        }
      }
    }
    return null;
  }

  getDuration() {
    // Calculate total duration from current time + remaining time
    const currentTime = this.getCurrentTime();
    const remainingTime = this.getRemainingTime();

    if (
      currentTime &&
      remainingTime &&
      currentTime !== "0:00" &&
      remainingTime !== "0:00"
    ) {
      try {
        const currentSeconds = this.timeToSeconds(currentTime);
        const remainingSeconds = this.timeToSeconds(remainingTime);
        const totalSeconds = currentSeconds + remainingSeconds;
        return this.secondsToTime(totalSeconds);
      } catch (error) {}
    }

    // Fallback: try the second element as duration (old behavior)
    const durationElements = document.querySelectorAll(".duration-text");
    if (durationElements.length >= 2) {
      return durationElements[1].textContent.trim();
    }
    return "0:00";
  }

  getCurrentTime() {
    const durationElements = document.querySelectorAll(".duration-text");
    if (durationElements.length >= 1) {
      return durationElements[0].textContent.trim();
    }
    return "0:00";
  }

  getRemainingTime() {
    // Get remaining time directly from the second duration-text element
    const durationElements = document.querySelectorAll(".duration-text");
    if (durationElements.length >= 2) {
      const remainingTime = durationElements[1].textContent.trim();
      return remainingTime;
    }

    // Fallback: calculate from current time and duration if available
    const currentTime = this.getCurrentTime();
    if (currentTime && currentTime !== "0:00") {
      return "0:00";
    }

    return "0:00";
  }

  // Helper: Convert MM:SS or HH:MM:SS to seconds
  timeToSeconds(timeString) {
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
  secondsToTime(totalSeconds) {
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

  getProgress() {
    const progressSelectors = [
      "anghami-buffer .fullsize.stream-controls.play.with-animation",
      ".fullsize.stream-controls.play.with-animation",
      "anghami-buffer .stream-controls.play",
      ".stream-controls.play.with-animation",
    ];

    for (const selector of progressSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        // Try to get width from style
        const style = element.style.width;
        if (style && typeof style === "string" && style.includes("%")) {
          const percentage = parseFloat(style.replace("%", ""));
          if (!isNaN(percentage)) {
            return percentage; // Return as percentage (0-100)
          }
        }
      }
    }

    // Fallback: check for indicator with left positioning
    const leftIndicator = document.querySelector(
      '.stream-controls.indicator[style*="left"]'
    );
    if (leftIndicator && leftIndicator.style.left) {
      const percentage = parseFloat(leftIndicator.style.left.replace("%", ""));
      if (!isNaN(percentage)) {
        return percentage;
      }
    }

    return 0;
  }

  getPlayState() {
    // Check if pause icon is visible (meaning it's currently playing)
    const pauseIconSelectors = [
      '.play-pause-cont .icon.pause use[xlink\\:href="#all--pause-shape"]',
      ".player-controls .play-pause-cont .icon.pause",
      ".play-pause-cont anghami-icon.pause",
      ".main-player .play-pause-cont .pause",
    ];

    for (const selector of pauseIconSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        return "playing";
      }
    }

    // Check if play icon is visible (meaning it's currently paused)
    const playIconSelectors = [
      '.play-pause-cont .icon.play use[xlink\\:href="#all--play"]',
      ".player-controls .play-pause-cont .icon.play",
      ".play-pause-cont anghami-icon.play",
      ".main-player .play-pause-cont .play",
    ];

    for (const selector of playIconSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        return "paused";
      }
    }

    return "paused";
  }

  getLikeState() {
    // Check for liked icon in track info actions
    const likedIcon =
      document.querySelector(".track-info-actions .icon.song.liked") ||
      document.querySelector('use[xlink\\:href="#all--liked"]');

    if (likedIcon) {
      // Check if parent has 'liked' class or if it's the liked icon
      const parentIcon = likedIcon.closest(".icon");
      return (
        parentIcon?.classList.contains("liked") ||
        likedIcon.getAttribute("xlink:href") === "#all--liked"
      );
    }

    return false;
  }

  getShuffleState() {
    const shuffleIcon =
      document.querySelector(".icon.shuffle") ||
      document
        .querySelector('use[xlink\\:href="#all--scrub"]')
        ?.closest(".icon");

    if (shuffleIcon) {
      return (
        shuffleIcon.classList.contains("active") ||
        shuffleIcon.classList.contains("selected") ||
        shuffleIcon.style.color === "rgb(255, 107, 53)"
      ); // Anghami orange
    }

    return false;
  }

  getRepeatState() {
    const repeatIcon =
      document.querySelector('.icon[title="repeat"]') ||
      document
        .querySelector('use[xlink\\:href="#all--repeat"]')
        ?.closest(".icon");

    if (!repeatIcon) return "none";

    // Check for active/selected states
    if (
      repeatIcon.classList.contains("repeat-one") ||
      repeatIcon.querySelector('use[xlink\\:href="#all--repeat-one"]')
    ) {
      return "one";
    }

    if (
      repeatIcon.classList.contains("repeat-all") ||
      repeatIcon.classList.contains("active") ||
      repeatIcon.classList.contains("selected")
    ) {
      return "all";
    }
    return "none";
  }

  getLyrics() {
    try {
      // Priority selector order based on actual observed DOM (.mini-lyrics > .mini-lyrics-holder > .lyrics)
      const selectorCandidates = [
        ".mini-lyrics-holder .lyrics",
        ".mini-lyrics .mini-lyrics-holder .lyrics",
        ".mini-lyrics .lyrics",
        "anghami-mini-lyrics .mini-lyrics-holder .lyrics",
        "anghami-mini-lyrics .lyrics",
        ".lyrics",
      ];

      let lyricsContainer = null;
      let matchedSelector = null;
      for (const sel of selectorCandidates) {
        const el = document.querySelector(sel);
        if (el) {
          lyricsContainer = el;
          matchedSelector = sel;
          break;
        }
      }

      if (!lyricsContainer) {
        return null;
      }

      // Collect spans that usually carry lyric lines
      let lyricsSpans = lyricsContainer.querySelectorAll(
        "span.arabic-textContent, span[anghamicheckarlang], span"
      );

      if (!lyricsSpans || lyricsSpans.length === 0) {
        return null;
      }

      const lines = [];
      lyricsSpans.forEach((span) => {
        // Ignore spans that are structural only (no text & no <br>)
        const text = span.textContent ? span.textContent.trim() : "";
        if (text) {
          lines.push(text);
        }
      });

      // Fallback: if no lines but innerHTML has <br>, split by <br>
      let filtered = lines.filter((l) => l.length > 0);
      if (
        filtered.length === 0 &&
        /<br\s*\/?>/i.test(lyricsContainer.innerHTML)
      ) {
        filtered = lyricsContainer.innerHTML
          .split(/<br\s*\/?>/i)
          .map((s) => s.replace(/<[^>]+>/g, "").trim())
          .filter((l) => l.length > 0);
      }

      if (filtered.length === 0) {
        return null;
      }

      return {
        lines: filtered,
        currentLine: this.getCurrentLyricsLine(lyricsContainer),
        isAvailable: true,
      };
    } catch (error) {
      return null;
    }
  }

  getCurrentLyricsLine(lyricsContainer) {
    try {
      // Highlighted/current line variants
      const highlightedSpan = lyricsContainer.querySelector(
        'span.arabic-textContent.highlighted, span.highlighted, span[class*="highlighted"], span[class*="current"], .highlighted'
      );

      if (highlightedSpan) {
        return highlightedSpan.textContent?.trim() || null;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  updateProgress() {
    if (this.currentTrack) {
      const newProgress = this.getProgress();
      const newCurrentTime = this.getCurrentTime();
      const newRemainingTime = this.getRemainingTime();

      if (
        newProgress !== this.currentTrack.progress ||
        newCurrentTime !== this.currentTrack.currentTime ||
        newRemainingTime !== this.currentTrack.remainingTime
      ) {
        this.currentTrack.progress = newProgress;
        this.currentTrack.currentTime = newCurrentTime;
        this.currentTrack.remainingTime = newRemainingTime;

        this.notifyPiP("progressUpdated", {
          progress: newProgress,
          currentTime: newCurrentTime,
          remainingTime: newRemainingTime,
        });
      }
    }
  }

  updatePlayState() {
    if (this.currentTrack) {
      const newPlayState = this.getPlayState() === "playing";
      if (newPlayState !== this.currentTrack.isPlaying) {
        this.currentTrack.isPlaying = newPlayState;
        this.notifyPiP("playStateUpdated", { isPlaying: newPlayState });
      }
    }
  }

  // Lyrics observer control methods
  startLyricsObserving() {
    if (this.lyricsObservingActive) return; // Already observing

    this.lyricsObservingActive = true;

    // Observe lyrics changes - watch for both content and highlighted line changes
    this.lyricsObserver = new MutationObserver(() => {
      const newLyrics = this.getLyrics();
      if (this.currentTrack) {
        // Check if the current line actually changed (not just styling/class changes)
        const currentLineChanged =
          !this._lastNotifiedCurrentLine ||
          this._lastNotifiedCurrentLine !== newLyrics?.currentLine;

        // Only notify if current line changed or lyrics structure changed
        if (currentLineChanged) {
          this._lastNotifiedCurrentLine = newLyrics?.currentLine;
          this.currentTrack.lyrics = newLyrics;
          this.notifyPiP("lyricsUpdated", newLyrics);
        }
      }
    });

    const attachObserverTo = (el) => {
      if (!el || this._lyricsElementObserved === el) return;
      this._lyricsElementObserved = el;
      this.lyricsObserver.observe(el, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class"],
        characterData: true,
      });
    };

    // Try immediate attach
    let lyricsElement =
      document.querySelector(".mini-lyrics") ||
      document.querySelector("anghami-mini-lyrics");
    if (lyricsElement) attachObserverTo(lyricsElement);

    // Retry for late-loaded component up to 10 seconds (every 1s)
    if (!lyricsElement) {
      let attempts = 0;
      this._lyricsAttachInterval = setInterval(() => {
        if (!this.lyricsObservingActive) {
          clearInterval(this._lyricsAttachInterval);
          this._lyricsAttachInterval = null;
          return;
        }
        attempts++;
        const el =
          document.querySelector(".mini-lyrics") ||
          document.querySelector("anghami-mini-lyrics");
        if (el) {
          attachObserverTo(el);
          clearInterval(this._lyricsAttachInterval);
          this._lyricsAttachInterval = null;
        } else if (attempts >= 10) {
          clearInterval(this._lyricsAttachInterval);
          this._lyricsAttachInterval = null;
        }
      }, 1000);
    }

    // Also observe the entire body for when lyrics component is added/removed
    this.bodyLyricsObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          const addedNodes = Array.from(mutation.addedNodes);
          const removedNodes = Array.from(mutation.removedNodes);

          // Check if lyrics component was added or removed
          const hasLyricsChange = [...addedNodes, ...removedNodes].some(
            (node) => {
              if (node.nodeType !== 1) return false;
              if (
                node.classList?.contains("mini-lyrics") ||
                node.tagName === "ANGHAMI-MINI-LYRICS" ||
                (node.querySelector &&
                  (node.querySelector(".mini-lyrics") ||
                    node.querySelector("anghami-mini-lyrics")))
              ) {
                return true;
              }
              return false;
            }
          );

          if (hasLyricsChange) {
            // Re-extract lyrics data when lyrics component changes
            setTimeout(() => {
              // Reset tracking for new track
              this._lastNotifiedCurrentLine = null;
              const newLyrics = this.getLyrics();
              if (this.currentTrack) {
                this._lastNotifiedCurrentLine = newLyrics?.currentLine;
                this.currentTrack.lyrics = newLyrics;
                this.notifyPiP("lyricsUpdated", newLyrics);
              }
            }, 500);
          }
        }
      }
    });

    this.bodyLyricsObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  stopLyricsObserving() {
    if (!this.lyricsObservingActive) return; // Already stopped

    this.lyricsObservingActive = false;
    this._lastNotifiedCurrentLine = null; // Reset tracking

    if (this.lyricsObserver) {
      this.lyricsObserver.disconnect();
      this.lyricsObserver = null;
    }

    if (this.bodyLyricsObserver) {
      this.bodyLyricsObserver.disconnect();
      this.bodyLyricsObserver = null;
    }

    if (this._lyricsAttachInterval) {
      clearInterval(this._lyricsAttachInterval);
      this._lyricsAttachInterval = null;
    }
  }

  // Player control methods
  togglePlayPause() {
    const playPauseSelectors = [
      ".main-player .play-pause-cont anghami-icon",
      ".player-controls .play-pause-cont .icon.pause",
      ".player-controls .play-pause-cont .icon.play",
      ".play-pause-cont anghami-icon",
      ".player-controls .play-pause-cont",
    ];

    for (const selector of playPauseSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        element.click();
        return true;
      }
    }
    return false;
  }

  previousTrack() {
    const prevSelectors = [
      ".main-player .player-controls .icon.prev",
      ".player-controls anghami-icon.prev",
      ".play-prev-next .icon.prev",
      ".player-controls .prev",
    ];

    for (const selector of prevSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        element.click();
        return true;
      }
    }
    return false;
  }

  nextTrack() {
    const nextSelectors = [
      ".main-player .player-controls .icon.next",
      ".player-controls anghami-icon.next",
      ".play-prev-next .icon.next",
      ".player-controls .next",
    ];

    for (const selector of nextSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        element.click();
        return true;
      }
    }
    return false;
  }

  toggleLike() {
    const likeButton =
      document.querySelector(".track-info-actions .icon.song") ||
      document
        .querySelector(
          'use[xlink\\:href="#all--liked"], use[xlink\\:href="#all--like"]'
        )
        ?.closest(".icon");

    if (likeButton) {
      likeButton.click();
    } else {
    }
  }

  toggleShuffle() {
    const shuffleButton =
      document.querySelector(".icon.shuffle") ||
      document
        .querySelector('use[xlink\\:href="#all--scrub"]')
        ?.closest(".icon");
    if (shuffleButton) {
      shuffleButton.click();
    } else {
    }
  }

  toggleRepeat() {
    // Try multiple selectors for the repeat button
    const repeatButton =
      document.querySelector('.icon[title="repeat"]') ||
      document.querySelector('anghami-icon[title="repeat"]') ||
      document.querySelector('svg[title="repeat"]')?.closest("anghami-icon") ||
      document.querySelector('svg[title="repeat"]')?.closest(".icon") ||
      document
        .querySelector('use[xlink\\:href="#all--repeat"]')
        ?.closest("anghami-icon") ||
      document
        .querySelector('use[xlink\\:href="#all--repeat"]')
        ?.closest(".icon");

    if (repeatButton) {
      console.log("Found repeat button:", repeatButton);
      repeatButton.click();
    } else {
      console.warn("Repeat button not found");
    }
  }

  seekTo(percentage) {
    // Try multiple selectors for the progress bar
    const progressBar =
      document.querySelector("anghami-buffer .cont") ||
      document.querySelector("anghami-buffer") ||
      document.querySelector(".bar.fullsize")?.parentElement;
    if (progressBar) {
      const rect = progressBar.getBoundingClientRect();
      const clickX = rect.left + (rect.width * percentage) / 100;
      const clickY = rect.top + rect.height / 2;

      // Create multiple event types to ensure compatibility
      const events = ["mousedown", "mouseup", "click"];

      events.forEach((eventType) => {
        const event = new MouseEvent(eventType, {
          clientX: clickX,
          clientY: clickY,
          bubbles: true,
          cancelable: true,
        });
        progressBar.dispatchEvent(event);
      });
    } else {
    }
  }

  // Communication with Document PiP
  notifyPiP(event, data) {
    // Try multiple ways to reach the Document PiP
    let pipInstance = null;

    // Method 1: Direct global access
    if (window.AnghamiDocumentPiP && window.AnghamiDocumentPiP.handleEvent) {
      pipInstance = window.AnghamiDocumentPiP;
    }
    // Method 2: Through PiP mode manager
    else if (window.pipModeManager && window.pipModeManager.pipInstances) {
      pipInstance = window.pipModeManager.pipInstances.document;
    }
    // Method 3: Check if it's stored elsewhere
    else if (window.documentPiPInstance) {
      pipInstance = window.documentPiPInstance;
    }

    if (pipInstance && pipInstance.handleEvent) {
      pipInstance.handleEvent(event, data);
    } else {
      // Store the latest data for when PiP opens
      if (event === "trackUpdated") {
        window.latestTrackData = data;
      }
    }
  }

  // Force sync latest data to PiP (called when PiP window opens)
  syncToPiP() {
    if (this.currentTrack) {
      this.notifyPiP("trackUpdated", this.currentTrack);
    } else {
      // Force extract current data
      this.extractCurrentTrack();
    }
  }

  // Cleanup
  destroy() {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];
  }
}

// PiP Mode Manager - Prevents conflicts between different PiP implementations
class PiPModeManager {
  constructor() {
    this.activeMode = null;
    this.availableModes = [];
    this.scraper = null;
  }

  init(scraper) {
    this.scraper = scraper;

    // Only Document PiP is supported
    if ("documentPictureInPicture" in window) {
      this.availableModes.push("document");
    } else {
    }
  }

  async togglePiP(preferredMode = null) {
    // If a specific mode is requested, try that first
    if (
      preferredMode &&
      this.availableModes &&
      Array.isArray(this.availableModes) &&
      this.availableModes.includes(preferredMode)
    ) {
      return await this.activateMode(preferredMode);
    }

    // Otherwise, try modes in order of preference
    for (const mode of this.availableModes) {
      try {
        return await this.activateMode(mode);
      } catch (error) {
        continue;
      }
    }

    throw new Error("No PiP mode available");
  }

  async activateMode(mode) {
    // Deactivate any currently active mode
    if (this.activeMode && this.activeMode !== mode) {
      await this.deactivateCurrentMode();
    }

    switch (mode) {
      case "document":
        if (!window.AnghamiDocumentPiP) {
          throw new Error("Document PiP not initialized");
        }
        const docResult = await window.AnghamiDocumentPiP.toggle();
        if (docResult) {
          this.activeMode = "document";
          return { success: true, mode: "document" };
        }
        throw new Error("Document PiP failed to activate");

      case "floating":
        // Floating PiP was removed, this case is kept for compatibility
        throw new Error("Floating PiP not available");

      default:
        throw new Error(`Unknown PiP mode: ${mode}`);
    }
  }

  async deactivateCurrentMode() {
    if (!this.activeMode) return;

    try {
      switch (this.activeMode) {
        case "document":
          if (window.AnghamiDocumentPiP && window.AnghamiDocumentPiP.isActive) {
            await window.AnghamiDocumentPiP.closePiP();
          }
          break;
        case "native":
        case "floating":
          // These modes were removed
          break;
      }
    } catch (error) {}

    this.activeMode = null;
  }

  getAvailableModes() {
    return [...this.availableModes];
  }

  getActiveMode() {
    return this.activeMode;
  }
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    if (request.action === "checkDocumentPiPSupport") {
      // Return Document PiP support info only
      const support = {
        document: "documentPictureInPicture" in window,
        available: window.pipModeManager
          ? window.pipModeManager.getAvailableModes()
          : [],
        active: window.pipModeManager
          ? window.pipModeManager.getActiveMode()
          : null,
        initialized: !!window.pipModeManager,
        ready: !!window.anghamiPiPReady,
      };
      sendResponse(support);
      return true;
    }

    if (request.action === "toggleDocumentPiP") {
      // Check connection health and attempt recovery if needed
      if (!window.connectionManager.isHealthy || !window.pipModeManager) {
        // Attempt to reinitialize
        window.connectionManager
          .initializeWithRetry()
          .then((success) => {
            if (success && window.pipModeManager) {
              return window.pipModeManager.togglePiP(request.preferredMode);
            } else {
              throw new Error("Failed to reinitialize extension");
            }
          })
          .then((result) => {
            sendResponse(result);
          })
          .catch((error) => {
            sendResponse({
              success: false,
              error: error.message,
              suggestion:
                "Extension is recovering. Please try again in a moment.",
            });
          });

        return true; // Keep message channel open for async response
      }

      // Use the mode manager to handle PiP activation
      window.pipModeManager
        .togglePiP(request.preferredMode)
        .then((result) => {
          sendResponse(result);
        })
        .catch((error) => {
          // If PiP fails, check if it's a connection issue and attempt recovery
          if (!window.connectionManager.isHealthy) {
            window.connectionManager.initializeWithRetry();
          }

          sendResponse({
            success: false,
            error: error.message,
            suggestion:
              "If this persists, the extension will attempt automatic recovery.",
          });
        });

      return true; // Keep message channel open for async response
    }

    // Add new action to get connection status
    if (request.action === "getConnectionStatus") {
      const status = window.connectionManager
        ? window.connectionManager.getStatus()
        : {
            isHealthy: false,
            retryCount: 0,
            lastSuccessfulConnection: null,
            timeSinceLastSuccess: null,
          };

      sendResponse({ success: true, status });
      return true;
    }

    if (request.action === "getLyricsSnapshot") {
      if (window.anghamiScraper) {
        const lyrics = window.anghamiScraper.getLyrics();
        sendResponse({ success: true, lyrics });
      } else {
        sendResponse({ success: false, error: "Scraper not ready" });
      }
      return true;
    }

    // Handle lyrics observer control
    if (request.action === "startLyricsObserving") {
      if (window.anghamiScraper) {
        window.anghamiScraper.startLyricsObserving();
        // Immediately send a snapshot so PiP can render without waiting for mutation
        // IMPORTANT: Always send update even if null, so PiP shows "No lyrics" instead of stuck loading
        const lyrics = window.anghamiScraper.getLyrics();
        // Set initial tracking
        window.anghamiScraper._lastNotifiedCurrentLine = lyrics?.currentLine;
        window.anghamiScraper.notifyPiP("lyricsUpdated", lyrics);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: "Scraper not initialized" });
      }
      return true;
    }

    if (request.action === "stopLyricsObserving") {
      if (window.anghamiScraper) {
        window.anghamiScraper.stopLyricsObserving();
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: "Scraper not initialized" });
      }
      return true;
    }

    // Unknown action - send response to prevent connection error
    sendResponse({
      success: false,
      error: "Unknown action: " + request.action,
    });
    return true;
  } catch (error) {
    sendResponse({
      success: false,
      error: "Message handler error: " + error.message,
    });
    return true;
  }
});

// Auto-recovery and connection management
class ConnectionManager {
  constructor() {
    this.retryCount = 0;
    this.maxRetries = 5;
    this.retryDelay = 2000; // Start with 2 seconds
    this.isHealthy = false;
    this.healthCheckInterval = null;
    this.lastSuccessfulConnection = null;
  }

  async initializeWithRetry() {
    try {
      // Clear any existing initialization
      this.cleanup();

      // Initialize scraper
      window.anghamiScraper = new AnghamiScraper();

      // Wait for scraper to be ready
      await this.waitForScraper();

      // Initialize PiP Mode Manager
      window.pipModeManager = new PiPModeManager();
      await window.pipModeManager.init(window.anghamiScraper);

      // Initialize all PiP modes
      await initializePiPModes();

      // Mark as healthy and start monitoring
      this.isHealthy = true;
      this.lastSuccessfulConnection = Date.now();
      this.retryCount = 0;
      this.startHealthMonitoring();

      return true;
    } catch (error) {
      return this.handleConnectionError(error);
    }
  }

  async waitForScraper() {
    return new Promise((resolve) => {
      const checkScraper = () => {
        if (window.anghamiScraper && document.querySelector(".track-info")) {
          resolve();
        } else {
          setTimeout(checkScraper, 100);
        }
      };
      checkScraper();
    });
  }

  async handleConnectionError(error) {
    this.isHealthy = false;

    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      const delay = this.retryDelay * Math.pow(2, this.retryCount - 1); // Exponential backoff

      setTimeout(() => {
        this.initializeWithRetry();
      }, delay);

      return false;
    } else {
      // Max retries reached, but don't give up completely
      // Set up periodic retry attempts
      this.setupPeriodicRetry();
      return false;
    }
  }

  setupPeriodicRetry() {
    // Try to reconnect every 30 seconds
    setTimeout(() => {
      this.retryCount = 0; // Reset retry count for periodic attempts
      this.initializeWithRetry();
    }, 30000);
  }

  startHealthMonitoring() {
    // Check connection health every 10 seconds
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 10000);
  }

  performHealthCheck() {
    try {
      // Check if core components are still available
      const hasAnghamiPlayer = !!document.querySelector(".player-wrapper");
      const hasTrackInfo = !!document.querySelector(".track-info");
      const hasScraperInstance = !!window.anghamiScraper;
      const hasPipManager = !!window.pipModeManager;

      if (
        !hasAnghamiPlayer ||
        !hasTrackInfo ||
        !hasScraperInstance ||
        !hasPipManager
      ) {
        throw new Error("Core components missing");
      }

      // Try to extract track data to verify scraper is working
      if (
        window.anghamiScraper &&
        typeof window.anghamiScraper.extractCurrentTrack === "function"
      ) {
        window.anghamiScraper.extractCurrentTrack();
      }

      this.lastSuccessfulConnection = Date.now();
      this.isHealthy = true;
    } catch (error) {
      this.isHealthy = false;
      // Attempt recovery
      this.initializeWithRetry();
    }
  }

  cleanup() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  getStatus() {
    return {
      isHealthy: this.isHealthy,
      retryCount: this.retryCount,
      lastSuccessfulConnection: this.lastSuccessfulConnection,
      timeSinceLastSuccess: this.lastSuccessfulConnection
        ? Date.now() - this.lastSuccessfulConnection
        : null,
    };
  }
}

// Initialize connection manager
window.connectionManager = new ConnectionManager();

// Initialize scraper when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => window.connectionManager.initializeWithRetry(), 1000);
  });
} else {
  setTimeout(() => window.connectionManager.initializeWithRetry(), 1000);
}

function initializeScraper() {
  // This function is now handled by ConnectionManager
  // Keep for backward compatibility but redirect to connection manager
  return window.connectionManager.initializeWithRetry();
}

// Debug: Make scraper available globally for console testing
window.testScraper = () => {
  if (window.anghamiScraper) {
    window.anghamiScraper.extractCurrentTrack();
  }
};

// Force multiple extraction attempts
setTimeout(() => {
  if (window.anghamiScraper) {
    window.anghamiScraper.extractCurrentTrack();
  }
}, 2000);

setTimeout(() => {
  if (window.anghamiScraper) {
    window.anghamiScraper.extractCurrentTrack();
  }
}, 5000);

// Mark as ready
window.anghamiPiPReady = true;

async function initializePiPModes() {
  // Initialize Document PiP if supported
  if (
    "documentPictureInPicture" in window &&
    typeof AnghamiDocumentPiP !== "undefined"
  ) {
    if (!window.AnghamiDocumentPiP) {
      window.AnghamiDocumentPiP = new AnghamiDocumentPiP();
      await window.AnghamiDocumentPiP.init(window.anghamiScraper);

      // Make it accessible in multiple ways
      window.documentPiPInstance = window.AnghamiDocumentPiP;

      // If we have stored track data, sync it now
      if (window.latestTrackData) {
        window.AnghamiDocumentPiP.handleEvent(
          "trackUpdated",
          window.latestTrackData
        );
      }
    }
  }

  return true;
}
