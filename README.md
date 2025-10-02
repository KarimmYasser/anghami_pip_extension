---
noteId: "418699c09f4711f0a5c0c78e3d51e79e"
tags: []
---

# 🎵 Anghami PiP Mini Player Extension

A Chrome extension that creates a **TRUE "Outside Browser" Picture-in-Picture window** for Anghami web using the Document Picture-in-Picture API.

## 🖼️ **Features**

- **Full HTML interface** in a system-level window like YouTube PiP
- **Interactive controls** - all buttons work natively in the PiP window
- **Always on top** of all applications, not just browser
- **Move anywhere** on screen, even to other monitors
- **Complete player** with cover art, progress bar, all controls
- **Keyboard shortcuts** work directly in the PiP window
- **Real-time sync** with main Anghami player
- **Smart DOM scraping** for accurate data extraction
- **Purple theme** - Modern UI with consistent purple branding (#8d00f2)
- **Minimum size constraints** - Prevents window from becoming too small (280x100px minimum)
- **Clean console output** - No verbose logging for production use
- **Robust error handling** - Graceful recovery from connection issues
- **Lyrics support** - Shows synchronized lyrics with smooth animations (⭐ **Anghami Plus required**)

> **Note**: Some features like lyrics display require an Anghami Plus subscription. See [Subscription Plan Limitations](#anghami-subscription-plan-limitations) for details.

## Main Features

### 🪟 Document Picture-in-Picture Window

- **System-level PiP window** using Chrome's Document PiP API
- **Always on top** of all applications, not just browser windows
- **Interactive HTML interface** - all controls work natively
- **Draggable and resizable** anywhere on screen or other monitors
- **True "outside browser" experience** like YouTube's PiP

### 🎮 Playback Controls

- **Play/Pause** - Controls Anghami's native playback
- **Next/Previous** - Skip tracks using Anghami's controls
- **Seek Support** - Click progress bar to seek to any position
- **Real-time sync** with the main Anghami player
- **Immediate UI feedback** - Button states update instantly on interaction

### ⭐ Additional Features

- **Like/Unlike** button with visual feedback
- **Shuffle** and **Repeat** mode toggles with immediate response
- **Real-time progress tracking** with smooth updates
- **Auto-update** track info when songs change
- **Consistent purple theming** throughout all components
- **Minimum size enforcement** - Window maintains usability at all sizes
- **Error recovery** - Handles connection issues gracefully

### 🎤 Lyrics Support (Anghami Plus Required)

> ⭐ **Anghami Plus subscription required for lyrics functionality**

- **Toggle lyrics display** with dedicated button
- **Current and next line view** - Shows current lyric with preview of next line
- **Hero morphing animations** - Smooth View Transitions API animations between lyrics
- **Smart duplicate handling** - Intelligent tracking for repeated lyrics
- **Responsive sizing** - Lyrics scale with window size
- **Auto-hide when unavailable** - Gracefully handles songs without lyrics
- **Real-time synchronization** - Lyrics update as the song plays

**Note**: If you're on Anghami's free plan, the lyrics button will be visible but lyrics won't be displayed. Consider upgrading to Anghami Plus to unlock this feature.

### ⌨️ Keyboard Shortcuts

- `Space` - Play/Pause
- `←` - Previous track
- `→` - Next track
- `L` - Toggle like
- `S` - Toggle shuffle
- `R` - Toggle repeat

### 🔄 Real-time Synchronization

- Uses MutationObserver to detect DOM changes
- Instantly updates when track changes
- Progress bar syncs with Anghami's progress indicator
- Button states reflect current player state

## Installation

### From Source

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. Navigate to [Anghami](https://play.anghami.com)
6. Click the extension icon to toggle the mini-player

### Required Files

Make sure you have all these files in your extension directory:

```
anghami_pip_extension/
├── manifest.json           # Extension configuration
├── content.js             # Main DOM scraping and PiP management
├── document-pip.js        # Document PiP API implementation
├── popup.html            # Extension popup interface
├── popup.js              # Popup functionality
├── styles.css            # Purple theme and CSS variables
├── README.md             # This documentation
└── icons/                # Extension icons
    ├── icon16.png (16x16)
    ├── icon32.png (32x32)
    ├── icon48.png (48x48)
    ├── icon128.png (128x128)
    ├── backward.png       # Control icons
    ├── forward.png
    ├── like.png
    ├── liked.png
    ├── pause.png
    ├── play.png
    ├── repeat.png
    ├── repeat-active.png
    ├── shuffle.png
    └── shuffle-active.png
```

## Technical Implementation

### Architecture

- **Manifest V3** - Latest Chrome extension standard
- **Content Script** (`content.js`) - DOM scraping and communication with PiP window
- **Document PiP** (`document-pip.js`) - Creates system-level PiP window using Chrome's API
- **Popup Interface** (`popup.html`) - Extension popup for quick access and controls

### DOM Scraping Strategy

The extension analyzes Anghami's DOM structure to extract:

- Track metadata from `.track-info` sections
- Progress from `.stream-controls.indicator` positioning
- Play state from button visibility and classes
- Control elements for interaction simulation

### Key Components

#### AnghamiScraper Class

- Extracts song information from DOM elements
- Sets up MutationObservers for real-time updates
- Provides methods to control playbook via DOM manipulation
- Handles progress tracking and state management

#### AnghamiDocumentPiP Class

- Creates and manages the Document PiP window
- Renders interactive HTML interface in system-level window
- Handles button interactions and real-time data updates
- Communicates with main page via message passing

## Browser Support

- **Chrome 116+** ✅ **Recommended** - Full Document Picture-in-Picture API support
- **Chrome 120+** ✅ **Best Experience** - Latest API features and stability
- **Edge 116+** ✅ Chromium-based with Document PiP support
- **Brave Browser** ⚠️ Limited support - Document PiP may not work in all versions
- **Chromium-based browsers** ⚠️ Variable support depending on version

### Feature Support by Browser:

| Feature                  | Chrome 116+ | Chrome 120+ | Edge 116+ | Brave |
| ------------------------ | ----------- | ----------- | --------- | ----- |
| Document PiP             | ✅          | ✅          | ✅        | ⚠️    |
| Minimum Size Constraints | ✅          | ✅          | ✅        | ⚠️    |
| Purple Theme             | ✅          | ✅          | ✅        | ✅    |
| Error Recovery           | ✅          | ✅          | ✅        | ✅    |
| Immediate UI Feedback    | ✅          | ✅          | ✅        | ✅    |

## Permissions Used

- `scripting` - Inject content scripts into Anghami pages
- `activeTab` - Access current tab for extension functionality
- `host_permissions` - Access Anghami domains for DOM manipulation
  - `https://play.anghami.com/*`
  - `https://*.anghami.com/*`

### Security & Privacy:

- **No data collection** - Extension works entirely locally
- **No network requests** - All functionality uses existing Anghami APIs
- **No special permissions** - Document Picture-in-Picture API requires no additional permissions
- **Clean console output** - No verbose logging in production

## Limitations

### Technical Limitations

- Only works on Anghami web player (play.anghami.com)
- Requires JavaScript to be enabled
- Some features depend on Anghami's current DOM structure
- No offline functionality

### Anghami Subscription Plan Limitations

⚠️ **Important**: Some features require an **Anghami Plus subscription** and will not work for free plan users:

| Feature                   | Free Plan | Anghami Plus |
| ------------------------- | --------- | ------------ |
| Basic Playback Controls   | ✅ Yes    | ✅ Yes       |
| Track Information Display | ✅ Yes    | ✅ Yes       |
| Progress Bar              | ✅ Yes    | ✅ Yes       |
| Play/Pause/Next/Previous  | ✅ Yes    | ✅ Yes       |
| **Lyrics Display**        | ❌ No     | ✅ Yes       |
| Shuffle/Repeat            | ❌ No     | ✅ Yes       |
| Like/Unlike Tracks        | ✅ Yes    | ✅ Yes       |

**Note**: Lyrics are only available to Anghami Plus subscribers. If you're on a free plan, the lyrics button will be present in the PiP window but no lyrics will be displayed. The extension will show a message indicating that lyrics are not available.

\*Some playback features may have limitations on the free plan as determined by Anghami's service restrictions.

## Development

### Project Structure

```javascript
// content.js - Main DOM interaction logic
class AnghamiScraper {
  // Extracts track data and controls playbook
}

// document-pip.js - Document PiP management
class AnghamiDocumentPiP {
  // Creates and manages Document PiP window
}
```

### Extending Functionality

To add new features:

1. Add DOM selectors to `AnghamiScraper`
2. Implement control methods in the scraper class
3. Add UI elements to `AnghamiDocumentPiP.createPiPWindow()`
4. Update HTML template in `document-pip.js`

## Troubleshooting

### Mini-player not appearing

- ✅ Ensure you're on play.anghami.com
- ✅ Check that the extension is enabled in chrome://extensions/
- ✅ Verify Document PiP API is enabled
- ✅ Refresh the page and try again
- ✅ Check popup shows "Ready" status

### Controls not working

- ✅ Verify Anghami player is fully loaded
- ✅ Check that a song is selected/playing
- ✅ Try clicking shuffle button in main player first
- ✅ Ensure no other extensions are interfering with DOM

### Progress bar not updating

- ✅ Check that a song is currently playing
- ✅ Verify Anghami's progress indicator is visible
- ✅ Extension auto-recovers from connection issues
- ✅ Try refreshing if issues persist

### Window too small or sizing issues

- ✅ Extension enforces minimum size of 280x100px automatically
- ✅ Drag window edges to resize
- ✅ Window prevents becoming unusably small

### Purple theme not showing

- ✅ All components use consistent purple theme (#8d00f2)
- ✅ Check popup matches Document PiP colors
- ✅ Refresh extension if colors seem inconsistent

## License

This project is for educational purposes. Anghami is a trademark of Anghami Inc.

## Contributing

Feel free to submit issues and enhancement requests. This extension demonstrates DOM scraping techniques for creating enhanced user interfaces.

---

**Note**: This extension works by analyzing Anghami's DOM structure. If Anghami updates their interface, the extension may need updates to maintain compatibility.
