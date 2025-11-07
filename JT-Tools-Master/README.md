# ⚡ JT Power Tools

An all-in-one Chrome extension toolkit for JobTread with toggleable features and a sleek control panel.

## 🎯 Features

### 📅 Schedule Drag & Drop (Premium)
- Drag schedule items between dates seamlessly
- Automatically updates dates invisibly in the background
- Multi-month and multi-year support with intelligent date detection
- Visual feedback with drop zone highlighting
- Full year boundary support (Dec 2025 → Jan 2026)

### 🎨 Contrast Fix
- Automatically adjusts text colors for better readability
- Uses WCAG contrast formula for optimal visibility
- Highlights current date in schedule view
- Real-time updates as content changes

### 📝 Text Formatter
- Rich text formatting toolbar for text fields
- Supports bold, italic, underline, strikethrough
- Headings (H1, H2, H3)
- Lists (bullets, numbered)
- Text alignment and colors
- Tables, links, quotes, and alerts
- Keyboard shortcuts (Ctrl/Cmd + B/I/U)
- MS Word-style active button states
- Works on budget descriptions and other text areas

### ⚡ Quick Job Switcher
- Keyboard shortcut (J+S) to instantly open job switcher
- Type to search and filter jobs in real-time
- Press Enter to select top result and navigate
- Fully keyboard-driven workflow for power users

### 🌙 Dark Mode
- Beautiful dark theme for JobTread interface
- Reduces eye strain during long work sessions
- Smooth toggle on/off

### 🎨 Custom Theme (Premium)
- Personalize JobTread with your own color palette
- Choose primary, background, and text colors
- Inline color preview boxes
- Save up to 3 custom themes

## 📦 Installation

### ⭐ Recommended: Chrome Web Store (For All Users)

**[Install from Chrome Web Store](https://chromewebstore.google.com/detail/jt-power-tools/kfbcifdgmcendohejbiiojjkgdbjkpcn)**

1. Click the link above
2. Click **Add to Chrome**
3. Confirm the installation
4. The extension icon will appear in your Chrome toolbar

**Important:** Premium features (Schedule Drag & Drop, Custom Theme) ONLY work with the Chrome Web Store version due to additional security features. GitHub/unpacked versions cannot activate premium licenses.

### For Developers: Load Unpacked

**Note:** This method is for development only. Premium features will not work.

1. **Download or clone** this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked**
5. Select the `JT-Tools-Master` folder
6. The extension is now installed (free features only)

## 🚀 Usage

### First-Time Setup

1. After installation, navigate to any JobTread page (`*.jobtread.com`)
2. Click the extension icon in your Chrome toolbar
3. You'll see the JT Power Tools control panel with six toggle switches

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

#### Text Formatter
1. Go to any page with text fields (Budget, Notes, etc.)
2. Click in any text field
3. Formatting toolbar appears above the field
4. Use buttons to format text or keyboard shortcuts (Ctrl/Cmd + B/I/U)

#### Quick Job Switcher
1. Press J+S from any JobTread page
2. Type to search and filter jobs
3. Press Enter to select top result
4. Press Escape to cancel

## 🔑 Premium Features

Some features require a premium license to unlock:
- **Schedule Drag & Drop** - Drag schedule items between dates
- **Custom Theme** - Personalize JobTread with your own colors

### Premium License Activation

**⚠️ Important:** Premium features ONLY work with the [Chrome Web Store version](https://chromewebstore.google.com/detail/jt-power-tools/kfbcifdgmcendohejbiiojjkgdbjkpcn). Install from there before purchasing.

1. Install from [Chrome Web Store](https://chromewebstore.google.com/detail/jt-power-tools/kfbcifdgmcendohejbiiojjkgdbjkpcn)
2. Purchase a license from [Gumroad](https://gumroad.com/l/jtpowertools)
3. Open the extension popup
4. Navigate to the License section
5. Enter your license key
6. Click "Activate"
7. Premium features will be unlocked immediately

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
│   ├── drag-drop.js          # Drag & Drop module (Premium)
│   ├── drag-drop-modules/   # Drag & Drop sub-modules
│   ├── contrast-fix.js       # Contrast Fix module
│   ├── formatter.js          # Text Formatter module
│   ├── job-switcher.js       # Quick Job Switcher module
│   ├── dark-mode.js          # Dark Mode module
│   └── rgb-theme.js          # Custom Theme module (Premium)
├── styles/
│   └── formatter-toolbar.css # Formatter toolbar styles
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

### v1.0.0 (Current)
- Initial release
- Three core features: Drag & Drop, Contrast Fix, Formatter
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

[Your License Here]

## 🐛 Known Issues

- **Formatter**: Some complex formatting scenarios may require page refresh
- **Drag & Drop**: Only changes start date by default (use Alt key to modify end date)
- **General**: Extension must be reloaded after Chrome browser restart for optimal performance

## 📧 Support

For issues, questions, or feature requests:
- Open an issue on GitHub
- Contact: [Your Contact Info]

## 🙏 Acknowledgments

Built for the JobTread community to enhance productivity and user experience.

---

**Made with ❤️ for JobTread users**
