# ⚡ JT Power Tools

An all-in-one Chrome extension toolkit for JobTread with toggleable features and a sleek control panel.

## 🎯 Features

### 📅 Schedule Drag & Drop
- Drag schedule items between dates seamlessly with full year boundary support
- Works across December→January transitions (2025→2026)
- Automatically updates dates invisibly in the background
- Multi-month and multi-year support with intelligent date detection
- Visual feedback with drop zone highlighting
- Preserves task details and assignments during moves

### 🎨 Contrast Fix
- Automatically adjusts text colors for better readability
- Uses WCAG contrast formula for optimal visibility
- Highlights current date in schedule view
- Real-time updates as content changes
- Mutual exclusivity with Dark Mode and Custom Theme

### 📝 Budget Formatter
- Rich text formatting toolbar for budget descriptions
- Supports bold, italic, underline, strikethrough
- Headings (H1, H2, H3)
- Lists (bullets, numbered)
- Text alignment and colors with smart color switching
- Detects active formatting and highlights buttons
- Click same color to toggle off formatting
- Tables, links, quotes, and alerts
- Keyboard shortcuts (Ctrl/Cmd + B/I/U)
- MS Word-style active button states

### 🌙 Dark Mode
- Beautiful dark theme for JobTread interface
- Reduces eye strain during long work sessions
- Customized for construction management workflows
- Smooth toggle on/off
- Syncs across devices
- Mutual exclusivity with Contrast Fix and Custom Theme

### 🎨 Custom Theme (Premium)
- Personalize JobTread with your own color palette
- Choose primary, background, and text colors via RGB sliders
- Intelligent color coordination across entire interface
- Preserves task type colors with enhanced visibility
- 5px thick colored borders for clear task identification
- Themed formatter toolbar, buttons, links, and inputs
- Task cards blend seamlessly with custom background
- Mutual exclusivity with Contrast Fix and Dark Mode

## 📦 Installation

### Method 1: Load Unpacked (Development)

1. **Download or clone** this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked**
5. Select the `JT-Tools-Master` folder
6. The extension is now installed!

### Method 2: From Chrome Web Store (Coming Soon)
*Once published, users can install directly from the Chrome Web Store*

## 🚀 Usage

### First-Time Setup

1. After installation, navigate to any JobTread page (`*.jobtread.com`)
2. Click the extension icon in your Chrome toolbar
3. You'll see the JT Power Tools control panel with four toggle switches

### Toggling Features

- **Enable/Disable** any feature by clicking the toggle switch
- Features activate/deactivate instantly without page reload
- Settings are saved automatically and sync across devices
- Click **Refresh Current Tab** to reload the page with new settings

### Using the Features

#### Drag & Drop
1. Go to JobTread Schedule view
2. Click and hold a schedule item
3. Drag to another date cell
4. Drop and watch the date change automatically!

#### Contrast Fix
- Automatically active on schedule views
- No user interaction needed
- Adjusts text colors in real-time

#### Budget Formatter
1. Go to JobTread Budget page
2. Click in any description field
3. Formatting toolbar appears above the field
4. Use buttons to format text or keyboard shortcuts (Ctrl/Cmd + B/I/U)

## 🔑 Premium Features

Some features require a premium license to unlock:

### Premium License Activation
1. Purchase a license from [Gumroad](https://gumroad.com/l/jtpowertools)
2. Open the extension popup
3. Navigate to the License section
4. Enter your license key
5. Click "Activate"
6. Premium features will be unlocked immediately

### Product Configuration
The extension is configured with:
- **Product Permalink**: `jtpowertools`
- **Product ID**: `x2GbSvLBfUSQcwVGDRSj1w==`

For setup instructions, see [PREMIUM_SETUP.md](../PREMIUM_SETUP.md)

## 🏗️ Architecture

### File Structure
```
JT-Tools-Master/
├── manifest.json              # Extension manifest (Manifest V3)
├── content.js                 # Main orchestrator script
├── popup/
│   ├── popup.html            # Settings UI
│   ├── popup.js              # Settings logic
│   └── popup.css             # Settings styling
├── background/
│   └── service-worker.js     # Background service worker
├── features/
│   ├── drag-drop.js          # Drag & Drop module
│   ├── contrast-fix.js       # Contrast Fix module
│   ├── formatter.js          # Budget Formatter module
│   ├── dark-mode.js          # Dark Mode module
│   └── rgb-theme.js          # Custom Theme module (Premium)
├── styles/
│   ├── formatter-toolbar.css # Formatter toolbar styles
│   └── dark-mode.css         # Dark mode styles
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### How It Works

1. **Content Script** (`content.js`) loads on all JobTread pages
2. **Feature Modules** are loaded dynamically based on user settings
3. **Popup UI** allows users to toggle features on/off
4. **Background Service Worker** manages settings and coordinates updates
5. **Chrome Storage API** persists settings across sessions

### Key Design Decisions

- **Modular Architecture**: Each feature is self-contained and can be enabled/disabled independently
- **Dynamic Loading**: Features are only loaded when enabled (performance optimization)
- **Hot Toggle**: Features can be toggled without page reload where possible
- **Separation of Concerns**: Settings, features, and UI are completely separate
- **Easy Updates**: Individual features can be updated without affecting others

## 🔧 Development

### Adding a New Feature

1. **Create feature module** in `features/new-feature.js`:
```javascript
const NewFeature = (() => {
  let isActive = false;

  function init() {
    isActive = true;
    // Your initialization code
  }

  function cleanup() {
    isActive = false;
    // Your cleanup code
  }

  return {
    init,
    cleanup,
    isActive: () => isActive
  };
})();

window.NewFeature = NewFeature;
```

2. **Register in content.js**:
```javascript
const featureModules = {
  // ... existing features
  newFeature: {
    name: 'New Feature',
    scriptPath: 'features/new-feature.js',
    instance: null,
    loaded: false
  }
};
```

3. **Add to popup UI** (`popup/popup.html`):
```html
<div class="feature-item">
  <div class="feature-info">
    <div class="feature-icon">🆕</div>
    <div class="feature-details">
      <h3>New Feature</h3>
      <p>Description of your feature</p>
    </div>
  </div>
  <label class="toggle">
    <input type="checkbox" id="newFeature" data-feature="newFeature">
    <span class="slider"></span>
  </label>
</div>
```

4. **Update manifest** if needed (web accessible resources, permissions, etc.)

### Testing

1. Make changes to your code
2. Go to `chrome://extensions`
3. Click the **Reload** button on the JT Power Tools extension
4. Test on JobTread

### Debugging

- Open Chrome DevTools (F12)
- Check the **Console** tab for logs
- All features log their status with prefixes like `DragDrop:`, `ContrastFix:`, etc.
- Use `chrome://extensions` to view background service worker logs

## 📝 Version History

### v3.1.0 (Current)
- **Major Drag & Drop Fixes**: Complete rewrite of year boundary handling
  - Fixed December→January year transitions (2025→2026)
  - Fixed date moves in future years (Jan 2026, Feb 2026)
  - Always includes year in date format for accuracy
  - Intelligent year inference using source date as baseline
  - Year validation when page shows different months
- **Custom Theme Enhancements** (Premium):
  - Enhanced task type color visibility with 5px thick borders
  - Task cards now use theme background with colored border
  - Subtle shadow effect for better visual depth
  - Preserves task type identification while unifying appearance
- **Formatter Improvements**:
  - Color switching: Change colors by clicking different color buttons
  - Active color detection and button highlighting
  - Click same color to toggle off formatting

### v3.0.0
- Added Custom Theme feature (Premium)
- RGB color sliders for personalized themes
- Mutual exclusivity between appearance modes
- Integrated contrast fix into custom theme
- Enhanced popup UI with collapsible sections

### v1.0.0
- Initial public release
- Four core features: Schedule Drag & Drop, Contrast Fix, Budget Formatter, Dark Mode
- Premium licensing system via Gumroad
- Clean, professional popup interface
- Cross-year drag & drop support
- Smart weekend detection with override
- React-compatible formatting events
- Dark mode theme with schedule card overrides
- Toggle controls via popup UI
- Modular architecture for easy expansion

## 🤝 Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details.

## 📦 Chrome Web Store Submission

All documentation for publishing to the Chrome Web Store is in the [`chrome-web-store/`](chrome-web-store/) folder:

- **Store Listing**: [CHROME_WEB_STORE_LISTING.md](chrome-web-store/CHROME_WEB_STORE_LISTING.md)
- **Privacy Policy**: [PRIVACY_POLICY.md](chrome-web-store/PRIVACY_POLICY.md)
- **Submission Guide**: [CHROME_WEB_STORE_SUBMISSION_GUIDE.md](chrome-web-store/CHROME_WEB_STORE_SUBMISSION_GUIDE.md)
- **Screenshot Guide**: [SCREENSHOT_CAPTIONS.md](chrome-web-store/SCREENSHOT_CAPTIONS.md)
- **Single Purpose**: [SINGLE_PURPOSE_STATEMENT.txt](chrome-web-store/SINGLE_PURPOSE_STATEMENT.txt)

## 🐛 Known Issues

- **Formatter**: Some complex formatting scenarios may require page refresh
- **Drag & Drop**: Only changes start date (end date adjustment coming in future version)

## 🔮 Future Enhancements

- [ ] End date adjustment for drag & drop
- [ ] Multi-select drag for multiple tasks
- [ ] Undo functionality for drag operations
- [ ] More formatting options (code blocks, inline code, etc.)
- [ ] Custom keyboard shortcuts
- [ ] Export/import settings
- [ ] Additional custom theme presets
- [ ] Theme sharing and import/export

## 📧 Support

For issues, questions, or feature requests:
- Open an issue on [GitHub Issues](https://github.com/King0lightai/JT-Tools/issues)
- Premium support: [Gumroad](https://lightking7.gumroad.com/l/jtpowertools)

## 🙏 Acknowledgments

Built for the JobTread community to enhance productivity and user experience.

---

**Made with ❤️ for JobTread users**
