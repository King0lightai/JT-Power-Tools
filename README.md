# ⚡ JT Power Tools

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Install-brightgreen?logo=googlechrome)](https://chromewebstore.google.com/detail/jt-power-tools/kfbcifdgmcendohejbiiojjkgdbjkpcn)
[![Version](https://img.shields.io/badge/version-3.2.3-blue)](https://chromewebstore.google.com/detail/jt-power-tools/kfbcifdgmcendohejbiiojjkgdbjkpcn)

An all-in-one Chrome extension toolkit for JobTread with toggleable features and a sleek control panel.

**[📥 Install from Chrome Web Store](https://chromewebstore.google.com/detail/jt-power-tools/kfbcifdgmcendohejbiiojjkgdbjkpcn)**

## 🎯 Features

### 📅 Schedule Drag & Drop (Premium)
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
- Hold Shift to drag a task to weekends
- Hold Alt to change the tasks end date

### 📝 Text Formatter
- Rich text formatting toolbar for text fields
- Supports bold, italic, underline, strikethrough
- Headings (H1, H2, H3)
- Lists (bullets, numbered)
- Text alignment and colors with smart color switching
- Detects active formatting and highlights buttons
- Click same color to toggle off formatting
- Tables, links, quotes, and alerts
- Keyboard shortcuts (Ctrl/Cmd + B/I/U)
- MS Word-style active button states
- Works on budget descriptions and other text areas

### ⚡ Quick Job Switcher
- Keyboard shortcut (J+S) to instantly open job switcher
- Type to search and filter jobs in real-time
- Press Enter to select top result and navigate
- Press Escape to cancel and close
- Fully keyboard-driven workflow for power users
- No mouse needed for job switching

### 🌙 Dark Mode
- Beautiful dark theme for JobTread interface
- Reduces eye strain during long work sessions
- Customized for construction management workflows
- Smooth toggle on/off
- Syncs across devices
- Mutual exclusivity with Contrast Fix and Custom Theme

### 🎨 Custom Theme (Premium)
- Personalize JobTread with your own color palette
- Choose primary, background, and text colors with inline previews
- Intelligent color coordination across entire interface
- Preserves task type colors with enhanced visibility
- Preserves yellow highlighting on edited budget cells
- 5px thick colored borders for clear task identification
- Themed formatter toolbar, buttons, links, and inputs
- Save up to 3 custom themes for quick switching
- Task cards blend seamlessly with custom background
- Mutual exclusivity with Contrast Fix and Dark Mode

### 📊 Budget Hierarchy Shading
- Progressive visual shading for nested budget groups (up to 5 levels)
- Level 1 (top-level groups) = Lightest shade
- Level 5 (deepest nested groups) = Darkest shade
- Line items automatically match their parent group's shading
- Adapts intelligently to Dark Mode and Custom Theme
- Preserves yellow highlighting for unsaved changes
- Smooth hover states for better visual feedback
- Real-time updates when expanding/collapsing groups
- Helps quickly identify group hierarchy and relationships at a glance

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
3. You'll see the JT Power Tools control panel with seven feature toggle switches

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
2. Job switcher sidebar opens with search focused
3. Type to filter jobs in real-time
4. Press Enter to select top result and navigate
5. Press Escape to close without selecting

#### Budget Hierarchy Shading
- Automatically active on budget pages when enabled
- No user interaction needed
- Groups are shaded progressively darker as nesting increases
- Line items automatically inherit their parent group's shade
- Works seamlessly with other appearance features
- Updates in real-time when groups are expanded or collapsed

## 🔑 Premium Features

Some features require a premium license to unlock:
- **Schedule Drag & Drop** - Drag schedule items between dates
- **Custom Theme** - Personalize JobTread with your own colors

### Premium License Activation

**⚠️ Important:** Premium features ONLY work with the [Chrome Web Store version](https://chromewebstore.google.com/detail/jt-power-tools/kfbcifdgmcendohejbiiojjkgdbjkpcn). Install from there before purchasing.

**💼 Company Licensing:** Licenses are designed for company-wide use. Purchase **one license per company** and share it with all employees in your organization. No need to buy individual licenses for each team member!

1. Install from [Chrome Web Store](https://chromewebstore.google.com/detail/jt-power-tools/kfbcifdgmcendohejbiiojjkgdbjkpcn)
2. Purchase a license from [Gumroad](https://gumroad.com/l/jtpowertools)
3. Open the extension popup
4. Navigate to the License section
5. Enter your license key
6. Click "Activate"
7. Premium features will be unlocked immediately
8. Share the license key with other employees in your company

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
│   ├── rgb-theme.js          # Custom Theme module (Premium)
│   └── budget-hierarchy.js   # Budget Hierarchy Shading module
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

### v3.2.3 (Current)
- **New Feature: Budget Hierarchy Shading**
  - Progressive visual shading for nested budget groups (up to 5 levels)
  - Level 1 (top) = Lightest, Level 5 (deepest) = Darkest
  - Line items automatically inherit parent group shading
  - Adapts intelligently to Dark Mode and Custom Theme
  - Preserves yellow highlighting for unsaved changes
  - Smooth hover states for better visual feedback
  - Real-time updates when expanding/collapsing groups
  - Helps quickly identify group hierarchy at a glance

### v3.1.0
- **New Feature: Quick Job Switcher**
  - J+S keyboard shortcut to instantly open job switcher
  - Type to search and filter jobs in real-time
  - Enter to select top result and navigate
  - Escape to cancel and close
  - Fully keyboard-driven workflow for power users
- **Drag & Drop Modularization**:
  - Refactored from 1,475 lines to modular architecture
  - Split into 6 focused modules: date-utils, weekend-utils, ui-utils, sidebar-manager, date-changer, event-handlers
  - Main file reduced to 149 lines (90% reduction)
  - Easier to maintain and extend
- **UI/UX Improvements**:
  - Renamed "Budget Formatter" to "Text Formatter" for clarity
  - Redesigned theme customization with inline color previews
  - Moved Dark Mode below Quick Job Switcher in popup
  - Added Premium badge to Schedule Drag & Drop feature
  - Simplified popup to minimal white aesthetic
- **Custom Theme Enhancements** (Premium):
  - Inline color preview boxes next to each color picker
  - Preserves yellow highlighting on edited budget cells
  - Enhanced task type color visibility with 5px thick borders
  - Task cards now use theme background with colored border
  - Subtle shadow effect for better visual depth
  - Preserves task type identification while unifying appearance
- **Major Drag & Drop Fixes**:
  - Fixed December→January year transitions (2025→2026)
  - Fixed date moves in future years (Jan 2026, Feb 2026)
  - Always includes year in date format for accuracy
  - Intelligent year inference using source date as baseline
  - Year validation when page shows different months
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
- Four core features: Schedule Drag & Drop, Contrast Fix, Text Formatter, Dark Mode
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

## 📦 Chrome Web Store

**[🌟 Install JT Power Tools from Chrome Web Store](https://chromewebstore.google.com/detail/jt-power-tools/kfbcifdgmcendohejbiiojjkgdbjkpcn)**

The extension is now live on the Chrome Web Store! For documentation related to the store listing, see the [`chrome-web-store/`](chrome-web-store/) folder:

- **Store Listing**: [CHROME_WEB_STORE_LISTING.md](chrome-web-store/CHROME_WEB_STORE_LISTING.md)
- **Privacy Policy**: [PRIVACY_POLICY.md](chrome-web-store/PRIVACY_POLICY.md)
- **Submission Guide**: [CHROME_WEB_STORE_SUBMISSION_GUIDE.md](chrome-web-store/CHROME_WEB_STORE_SUBMISSION_GUIDE.md)
- **Screenshot Guide**: [SCREENSHOT_CAPTIONS.md](chrome-web-store/SCREENSHOT_CAPTIONS.md)
- **Single Purpose**: [SINGLE_PURPOSE_STATEMENT.txt](chrome-web-store/SINGLE_PURPOSE_STATEMENT.txt)

## 🐛 Known Issues

- **Formatter**: Some complex formatting scenarios may require page refresh
- **Drag & Drop**: Only changes start date (end date adjustment coming in future version)

## 🔮 Future Enhancements (susceptible to change)

- [ ] End date adjustment for drag & drop
- [ ] Multi-select drag for multiple tasks
- [ ] click and drag task cards edges to expand and shrink days.
- [ ] Custom keyboard shortcuts
- [ ] Export/import settings
- [ ] Additional custom theme presets
- [ ] Theme sharing and import/export
- [ ] Budget changelog captured in a line item
- [ ] Record "why" schedule items shifted

## 📧 Support

For issues, questions, or feature requests:
- Open an issue on [GitHub Issues](https://github.com/King0lightai/JT-Tools/issues)
- Premium support: [Gumroad](https://lightking7.gumroad.com/l/jtpowertools)

## 🙏 Acknowledgments

Built for the JobTread community to enhance productivity and user experience.

---

**Made with ❤️ for JobTread users**
