# Claude AI Assistant Guide for JT Power Tools

This document provides comprehensive guidance for AI assistants (Claude) working on the JT Power Tools Chrome extension project.

## Project Overview

**JT Power Tools** is a Chrome extension (Manifest V3) that enhances the JobTread construction management platform (app.jobtread.com) with productivity features and UI improvements.

### Key Information
- **Version**: 3.3.8 (Beta)
- **Platform**: Chrome Extension (Manifest V3)
- **Target**: JobTread web application (app.jobtread.com)
- **License Model**: Free + Premium features via Gumroad
- **Repository**: https://github.com/King0lightai/JT-Power-Tools
- **Chrome Web Store**: [Live](https://chromewebstore.google.com/detail/jt-power-tools/kfbcifdgmcendohejbiiojjkgdbjkpcn)

### Core Features (14 Total)

**Premium Features (3):**
1. **Schedule Drag & Drop** - Drag schedule items between dates with multi-year support, weekend override (Shift), end date modification (Alt)
2. **Preview Mode** - Live markdown preview with floating panel for budget descriptions and daily logs
3. **Custom Theme** - Personalized color palettes with HSL-based generation, up to 3 saved themes

**Free Features (11):**
4. **Contrast Fix** - Automatic text color adjustment for WCAG-compliant readability
5. **Text Formatter** - Rich text formatting toolbar with bold, italic, headings, tables, links, alerts, and keyboard shortcuts
6. **Quick Job Switcher** - Keyboard-driven job search (J+S or Alt+J) with real-time filtering
7. **Quick Notes** - Persistent notepad with markdown support, WYSIWYG editor, and cross-device sync
8. **Dark Mode** - Complete dark theme for JobTread interface with current date highlighting
9. **Budget Hierarchy Shading** - Progressive visual shading for nested budget groups (up to 5 levels)
10. **Freeze Header** - Sticky column/row headers during table scrolling
11. **Character Counter** - Real-time character count in message fields
12. **Kanban Type Filter** - Auto-hide empty columns in Kanban view
13. **Auto Collapse Groups** - Automatically collapse 100% complete budget groups on load
14. **Help Sidebar Support** - Integrates extension support into JobTread help system

## Project Architecture

### Directory Structure

```
JT-Power-Tools/
├── JT-Tools-Master/              # Main extension directory (846KB)
│   ├── manifest.json             # Chrome extension manifest (V3)
│   ├── content.js                # Main orchestrator script (13.3KB)
│   ├── background/
│   │   └── service-worker.js     # Background service worker
│   ├── popup/
│   │   ├── popup.html            # Settings UI (13.2KB)
│   │   ├── popup.js              # Settings logic (24.5KB)
│   │   └── popup.css             # Settings styling (15.5KB)
│   ├── features/                 # Feature modules (307KB total)
│   │   ├── drag-drop.js          # Schedule drag & drop (Premium)
│   │   ├── contrast-fix.js       # Text color adjustment
│   │   ├── formatter.js          # Rich text formatting (15.5KB)
│   │   ├── preview-mode.js       # Markdown preview (Premium, 35.8KB)
│   │   ├── job-switcher.js       # Quick job search (11.9KB)
│   │   ├── quick-notes.js        # Persistent notepad (58.7KB)
│   │   ├── dark-mode.js          # Dark theme
│   │   ├── rgb-theme.js          # Custom themes (Premium, 36.4KB)
│   │   ├── budget-hierarchy.js   # Nested budget shading (21.3KB)
│   │   ├── freeze-header.js      # Sticky headers (47.7KB)
│   │   ├── character-counter.js  # Message char counter (14.6KB)
│   │   ├── kanban-type-filter.js # Hide empty Kanban columns (11.2KB)
│   │   ├── auto-collapse-groups.js # Auto-collapse completed (10.6KB)
│   │   └── drag-drop-modules/    # Drag & Drop sub-modules
│   │       ├── view-detector.js
│   │       ├── date-utils.js
│   │       ├── weekend-utils.js
│   │       ├── ui-utils.js
│   │       ├── sidebar-manager.js
│   │       ├── date-changer.js
│   │       ├── event-handlers.js
│   │       ├── infinite-scroll.js
│   │       ├── task-completion.js
│   │       └── action-items-completion.js
│   ├── formatter-modules/        # Text Formatter sub-modules
│   │   ├── detection.js          # Field detection
│   │   ├── formats.js            # Formatting operations (22.8KB)
│   │   ├── toolbar.js            # Toolbar UI (29.8KB)
│   │   └── alert-modal.js        # Alert builder modal (17.3KB)
│   ├── quick-notes-modules/      # Quick Notes sub-modules
│   │   ├── storage.js            # Storage operations
│   │   ├── markdown.js           # Markdown rendering
│   │   └── editor.js             # WYSIWYG editor (13.1KB)
│   ├── rgb-theme-modules/        # Theme sub-modules
│   │   └── palette.js            # Color palette generation
│   ├── utils/                    # Shared utilities (8 modules)
│   │   ├── color-utils.js        # Color manipulation
│   │   ├── debounce.js           # Event throttling
│   │   ├── defaults.js           # Default settings
│   │   ├── dom-helpers.js        # Safe DOM operations
│   │   ├── error-handler.js      # Error logging & handling
│   │   ├── logger.js             # Logging utilities
│   │   ├── sanitizer.js          # Input sanitization & XSS prevention
│   │   └── storage-wrapper.js    # Safe Chrome storage API
│   ├── styles/                   # CSS files (86KB total)
│   │   ├── formatter-toolbar.css (20.5KB)
│   │   ├── preview-mode.css      (26.5KB)
│   │   ├── quick-notes.css       (21.7KB)
│   │   └── dark-mode.css         (18.6KB)
│   └── icons/                    # Extension icons (light/dark variants)
├── server/                       # License validation proxy server
│   ├── cloudflare-worker-license-proxy.js
│   ├── express-license-proxy.js
│   ├── package.json
│   ├── DEPLOYMENT.md
│   └── .env.example
├── chrome-web-store/             # Chrome Web Store documentation
│   ├── CHROME_WEB_STORE_LISTING.md
│   ├── PRIVACY_POLICY.md
│   └── SINGLE_PURPOSE_STATEMENT.txt
├── docs/                         # Documentation website (Jekyll)
│   ├── index.html
│   ├── changelog.html
│   ├── privacy.html
│   └── guides/
├── README.md                     # User-facing documentation (25KB)
├── CHANGELOG.md                  # Version history (13.9KB)
├── IMPROVEMENTS.md               # Debugging & refactoring summary
├── SECURITY_FIXES.md             # Security vulnerability fixes
├── LICENSE                       # MIT License
└── claude.md                     # AI assistant guide (this file)
```

**Codebase Statistics:**
- **44 JavaScript files** totaling ~11,700 lines of code
- **5 CSS files** totaling 86KB
- **Main extension directory**: 846KB

### Key Design Patterns

#### 1. Modular Feature System
Each feature is a self-contained module with:
- `init()` - Initialize the feature
- `cleanup()` - Clean up event listeners and DOM modifications
- `isActive()` - Check if feature is currently active

Example structure:
```javascript
const FeatureName = (() => {
  let isActive = false;

  function init() {
    isActive = true;
    // Setup code here
  }

  function cleanup() {
    isActive = false;
    // Cleanup code here
  }

  return {
    init,
    cleanup,
    isActive: () => isActive
  };
})();

window.FeatureName = FeatureName;
```

#### 2. Settings Management
- Settings stored in Chrome Storage API (`chrome.storage.sync`)
- Centralized in `background/service-worker.js`
- Feature states persisted across sessions and devices
- Hot-toggle support where possible (no page reload needed)

#### 3. Content Script Orchestration
- `content.js` serves as the main orchestrator
- Dynamically loads/unloads features based on settings
- Listens for settings changes via Chrome messaging
- Manages feature lifecycle (init/cleanup)

#### 4. Premium Feature Handling
- Premium features require license validation
- License validation done via Gumroad API
- Features check license status before initialization
- Premium features: Drag & Drop, Preview Mode, Custom Theme

## Development Guidelines

### Adding a New Feature

Follow these steps to add a new feature:

#### Step 1: Create Feature Module

Create `JT-Tools-Master/features/new-feature.js`:

```javascript
/**
 * New Feature
 * Description of what this feature does
 */
const NewFeature = (() => {
  let isActive = false;
  let observers = [];
  let eventListeners = [];

  function init() {
    if (isActive) return;
    isActive = true;
    console.log('NewFeature: Initializing...');

    // Your feature implementation here
    setupFeature();

    console.log('NewFeature: Initialized');
  }

  function setupFeature() {
    // Setup DOM observers, event listeners, etc.
  }

  function cleanup() {
    if (!isActive) return;
    console.log('NewFeature: Cleaning up...');

    // Remove event listeners
    eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    eventListeners = [];

    // Disconnect observers
    observers.forEach(observer => observer.disconnect());
    observers = [];

    // Remove injected styles/elements

    isActive = false;
    console.log('NewFeature: Cleaned up');
  }

  return {
    init,
    cleanup,
    isActive: () => isActive
  };
})();

window.NewFeature = NewFeature;
```

#### Step 2: Register in content.js

Add to `featureModules` object:

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

#### Step 3: Add to manifest.json

Add script to content_scripts if needed:

```json
{
  "content_scripts": [
    {
      "js": [
        // ... existing scripts
        "features/new-feature.js",
        "content.js"
      ]
    }
  ]
}
```

#### Step 4: Add to popup UI

Add toggle in `popup/popup.html`:

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

For premium features, add a badge:

```html
<h3>New Feature <span class="premium-badge">Premium</span></h3>
```

#### Step 5: Update Default Settings

Add default setting in `background/service-worker.js`:

```javascript
const defaultSettings = {
  // ... existing settings
  newFeature: false
};
```

### Feature-Specific CSS

If your feature needs CSS:

1. Create `JT-Tools-Master/styles/new-feature.css`
2. Add to `web_accessible_resources` in manifest.json
3. Inject in your feature module:

```javascript
function injectStyles() {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('styles/new-feature.css');
  link.id = 'new-feature-styles';
  document.head.appendChild(link);
}

function removeStyles() {
  const link = document.getElementById('new-feature-styles');
  if (link) link.remove();
}
```

### Best Practices

#### 1. Console Logging
Use prefixed console logs for debugging:
```javascript
console.log('FeatureName: Message here');
console.error('FeatureName: Error message');
```

#### 2. Event Listeners
Always track and clean up event listeners:
```javascript
const eventListeners = [];

function addListener(element, event, handler) {
  element.addEventListener(event, handler);
  eventListeners.push({ element, event, handler });
}

function cleanup() {
  eventListeners.forEach(({ element, event, handler }) => {
    element.removeEventListener(event, handler);
  });
  eventListeners = [];
}
```

#### 3. MutationObservers
Always disconnect observers in cleanup:
```javascript
const observers = [];

function setupObserver() {
  const observer = new MutationObserver(callback);
  observer.observe(target, config);
  observers.push(observer);
}

function cleanup() {
  observers.forEach(observer => observer.disconnect());
  observers = [];
}
```

#### 4. DOM Manipulation
- Use `waitForElement()` helper for async element detection
- Check for element existence before manipulation
- Clean up injected elements in cleanup()

#### 5. React Compatibility
JobTread uses React, so:
- Use `dispatchEvent()` with React synthetic events
- Trigger both 'input' and 'change' events
- Set `event.simulated = true` for custom events

Example:
```javascript
function triggerReactChange(element, value) {
  element.value = value;

  const inputEvent = new Event('input', { bubbles: true });
  inputEvent.simulated = true;
  element.dispatchEvent(inputEvent);

  const changeEvent = new Event('change', { bubbles: true });
  changeEvent.simulated = true;
  element.dispatchEvent(changeEvent);
}
```

#### 6. Feature Independence
- Features should work independently
- Avoid tight coupling between features
- Use message passing if inter-feature communication needed

#### 7. Performance
- Use event delegation where possible
- Throttle/debounce expensive operations
- Lazy load resources when needed
- Minimize DOM queries

### Security Considerations

The project includes a comprehensive `utils/` directory with security utilities. See `SECURITY_FIXES.md` for detailed security improvements.

#### 1. Input Sanitization (utils/sanitizer.js)
Use the sanitizer utilities for all user input:
```javascript
// Color validation - strict hex format only
Sanitizer.sanitizeHexColor(color)  // Returns #RRGGBB or null

// CSS value sanitization
Sanitizer.sanitizeCSSValue(value)  // Strips dangerous characters

// HTML escaping for XSS prevention
Sanitizer.escapeHtml(text)         // Escapes &, <, >, ", '

// URL sanitization - blocks javascript: and data: URIs
Sanitizer.sanitizeUrl(url)         // Returns safe URL or empty string

// License key format validation
Sanitizer.sanitizeLicenseKey(key)  // Validates format
```

#### 2. Safe DOM Operations (utils/dom-helpers.js)
Always use DOM helpers for safe element manipulation:
```javascript
// Safe element creation with null checks
DomHelpers.createElement(tag, attributes, children)

// Safe element removal
DomHelpers.removeElement(element)

// Safe text content setting (avoids innerHTML)
DomHelpers.setTextContent(element, text)

// Timeout-based element waiting
DomHelpers.waitForElement(selector, timeout)
```

#### 3. Memory Leak Prevention
- Use WeakMap for controller references to avoid memory leaks
- Store event listeners and properly clean them up in cleanup()
- Use AbortController for cancelable operations
- Always disconnect MutationObservers when feature is disabled

#### 4. Content Security Policy
- Follow Chrome extension CSP guidelines
- No inline scripts or eval()
- Use chrome.runtime.getURL() for resources

#### 5. Data Storage (utils/storage-wrapper.js)
Use the storage wrapper for consistent Chrome storage API access:
```javascript
// Safe storage operations with error handling
StorageWrapper.get(keys)    // Returns promise
StorageWrapper.set(items)   // Returns promise
StorageWrapper.remove(keys) // Returns promise
```

#### 6. Server-Side License Validation
- License validation uses secure proxy server (Express or Cloudflare Workers)
- Product ID kept secret on server side
- Rate limiting prevents abuse
- Client never directly accesses Gumroad API

#### 7. Manifest Permissions
- Minimal permissions: `storage`, `activeTab`
- Host permissions limited to specific domains only
- No overreaching permissions requested

### Testing

#### Manual Testing Process

1. **Load Extension**
   ```bash
   # Open Chrome
   chrome://extensions
   # Enable Developer mode
   # Click "Load unpacked"
   # Select JT-Tools-Master folder
   ```

2. **Test Feature Toggle**
   - Open extension popup
   - Toggle feature on/off
   - Verify feature activates/deactivates
   - Check console for logs

3. **Test on JobTread**
   - Navigate to app.jobtread.com
   - Test feature functionality
   - Check for console errors
   - Test edge cases

4. **Test Cleanup**
   - Enable feature
   - Disable feature
   - Verify complete cleanup (no memory leaks, no orphaned listeners)

#### Testing Checklist

- [ ] Feature initializes correctly
- [ ] Feature cleanup is complete
- [ ] No console errors
- [ ] Works across page navigation
- [ ] Persists settings across browser restart
- [ ] Compatible with other features
- [ ] No memory leaks
- [ ] Works in incognito mode (if applicable)
- [ ] Handles edge cases gracefully

### Debugging

#### Chrome DevTools
```javascript
// Check feature status
window.FeatureName.isActive()

// Check loaded features
console.log(Object.keys(window).filter(k => k.includes('Feature')))

// Check settings
chrome.storage.sync.get(null, (data) => console.log(data))
```

#### Common Issues

1. **Feature not loading**
   - Check manifest.json includes script
   - Check console for errors
   - Verify feature registered in content.js

2. **Settings not saving**
   - Check Chrome storage permissions
   - Verify service worker is running
   - Check for storage quota issues

3. **Feature conflicts**
   - Check for CSS specificity issues
   - Verify event listener cleanup
   - Check for global variable collisions

## CHANGELOG Update Requirements

**CRITICAL**: Every code change, feature addition, bug fix, or improvement MUST be documented in the CHANGELOG.md file.

### CHANGELOG Format

The CHANGELOG follows [Keep a Changelog](https://keepachangelog.com/) format with these sections:

- **Added**: New features or functionality
- **Changed**: Changes to existing functionality
- **Deprecated**: Features that will be removed in upcoming releases
- **Removed**: Features that have been removed
- **Fixed**: Bug fixes
- **Security**: Security vulnerability fixes
- **Improved**: Enhancements to existing features

### CHANGELOG Update Process

#### When to Update CHANGELOG

Update CHANGELOG for:
- ✅ New features (even small ones)
- ✅ Bug fixes
- ✅ Performance improvements
- ✅ UI/UX changes
- ✅ Code refactoring that affects behavior
- ✅ Security fixes
- ✅ Dependency updates that affect functionality
- ✅ Breaking changes
- ✅ Deprecations

Do NOT update for:
- ❌ Code comments only
- ❌ README/documentation updates (unless they reflect new functionality)
- ❌ Internal refactoring with no user impact
- ❌ Test additions (unless they reveal bugs)
- ❌ Minor typo fixes in comments

#### How to Update CHANGELOG

1. **Find the Unreleased Section**
   - Add changes under `## [Unreleased]` at the top
   - If no Unreleased section exists, create it:
     ```markdown
     ## [Unreleased]

     ### Added

     ### Changed

     ### Fixed
     ```

2. **Choose the Correct Section**
   - Use **Added** for new features
   - Use **Fixed** for bug fixes
   - Use **Improved** for enhancements
   - Use **Changed** for breaking changes or significant modifications
   - Use **Security** for security fixes

3. **Write Clear Descriptions**
   - Start with a verb (Added, Fixed, Improved, etc.)
   - Be specific and concise
   - Include the feature/module name
   - Explain user impact, not implementation details

   **Good Examples:**
   ```markdown
   ### Fixed
   - Fixed text formatter not appearing in daily log edit fields
   - Fixed preview button not showing on first focus
   - Fixed custom theme breaking budget table borders
   ```

   **Bad Examples:**
   ```markdown
   ### Fixed
   - Fixed bug (too vague)
   - Updated the querySelector in formatter.js line 245 (implementation detail)
   - Various improvements (not specific)
   ```

4. **Group Related Changes**
   - Group multiple related fixes under a single bullet with sub-items:
     ```markdown
     ### Fixed
     #### Text Formatter & Preview Mode Fixes
     - Fixed text formatter not appearing in daily log edit fields
     - Fixed preview button not showing on first focus
     - Improved preview button visibility and content readability
     ```

5. **Include Context for Breaking Changes**
   ```markdown
   ### Changed
   - Renamed "Premium Formatter" to "Preview Mode" for better clarity
     **Breaking**: Update any references to `premiumFormatter` to `previewMode`
   ```

#### CHANGELOG Example Entry

```markdown
## [Unreleased]

### Added
- Added keyboard shortcut (Ctrl+Shift+N) to Quick Notes for faster access
- Added table formatting support to Text Formatter
  - Interactive table builder with row/column controls
  - Visual table preview in formatting toolbar
  - Generates markdown-formatted tables

### Fixed
- Fixed Quick Notes panel not closing with Escape key
- Fixed Custom Theme not applying to newly created elements

### Improved
- Improved Quick Notes search to highlight matching text
- Enhanced performance of Budget Hierarchy Shading on large budgets
```

#### Releasing a New Version

When creating a release:

1. **Move Unreleased to Version**
   ```markdown
   ## [3.4.0] - 2025-01-15

   ### Added
   - [Move items from Unreleased]

   ### Fixed
   - [Move items from Unreleased]
   ```

2. **Create New Unreleased Section**
   ```markdown
   ## [Unreleased]

   (Empty - ready for next changes)
   ```

3. **Add Version Link at Bottom**
   ```markdown
   [3.4.0]: https://github.com/King0lightai/JT-Power-Tools/releases/tag/v3.4.0
   ```

4. **Update Version References**
   - Update manifest.json version
   - Update README.md version badge
   - Update package.json if exists

### CHANGELOG Enforcement

**Before any commit:**
1. Review your changes
2. Update CHANGELOG.md appropriately
3. Commit CHANGELOG.md with your changes

**Commit message format:**
```
<type>: <description>

- Change 1
- Change 2

Updated CHANGELOG.md
```

**Example commit:**
```
feat: Add export functionality to Quick Notes

- Add export to Markdown button
- Add export to PDF button
- Add export modal with format selection

Updated CHANGELOG.md under [Unreleased] -> Added
```

## Common Tasks

### Task: Fix a Bug

1. **Identify the Issue**
   - Read error messages/stack traces
   - Identify affected feature module
   - Reproduce the bug

2. **Locate Code**
   - Find the relevant feature file in `features/`
   - Check related modules if needed

3. **Fix the Bug**
   - Make minimal changes to fix issue
   - Maintain code style consistency
   - Add defensive checks if needed

4. **Test the Fix**
   - Reload extension in Chrome
   - Reproduce original issue
   - Verify fix works
   - Test edge cases

5. **Update CHANGELOG**
   ```markdown
   ### Fixed
   - Fixed [specific bug description] in [feature name]
   ```

6. **Commit Changes**
   ```bash
   git add .
   git commit -m "fix: [bug description]

   - Fixed [details]
   - Added [defensive checks/improvements]

   Updated CHANGELOG.md"
   ```

### Task: Add Enhancement to Existing Feature

1. **Understand Current Implementation**
   - Read existing feature code
   - Understand initialization and cleanup
   - Note any dependencies

2. **Implement Enhancement**
   - Maintain existing code patterns
   - Preserve backward compatibility
   - Update cleanup if adding new listeners/observers

3. **Test Thoroughly**
   - Test new functionality
   - Test existing functionality still works
   - Test feature toggle on/off

4. **Update CHANGELOG**
   ```markdown
   ### Improved
   - Enhanced [feature name] to [description of improvement]
     - [Sub-item 1]
     - [Sub-item 2]
   ```

5. **Update Documentation**
   - Update README.md if user-facing change
   - Update comments in code
   - Update this claude.md if needed

### Task: Refactor Code

1. **Plan Refactoring**
   - Identify what needs refactoring
   - Plan new structure
   - Ensure no behavior changes

2. **Refactor in Steps**
   - Make incremental changes
   - Test after each step
   - Keep commits focused

3. **Verify No Regressions**
   - Test all affected features
   - Check for console errors
   - Test feature toggles

4. **Update CHANGELOG** (only if behavior changes)
   ```markdown
   ### Changed
   - Refactored [module name] for better maintainability
     - [If any user-facing impact, note it here]
   ```

### Task: Update Dependencies

1. **Check Current Versions**
   - Review package.json (if exists)
   - Check manifest.json for API versions

2. **Update Dependencies**
   - Update version numbers
   - Check for breaking changes
   - Update code if needed

3. **Test Thoroughly**
   - Test all features
   - Check for deprecation warnings
   - Verify no breaking changes

4. **Update CHANGELOG**
   ```markdown
   ### Changed
   - Updated [dependency name] to version [X.X.X]
     - [Note any relevant changes or improvements]
   ```

## Code Style Guidelines

### JavaScript Style

- Use ES6+ features (const/let, arrow functions, destructuring)
- Use semicolons
- Use single quotes for strings
- Use camelCase for variables and functions
- Use PascalCase for module names
- Use UPPER_CASE for constants
- 2-space indentation

Example:
```javascript
const FEATURE_NAME = 'ExampleFeature';
const defaultSettings = {
  enabled: false,
  color: '#ff0000'
};

function handleClick(event) {
  const { target } = event;
  if (!target.classList.contains('active')) {
    updateElement(target);
  }
}
```

### CSS Style

- Use kebab-case for class names
- Prefix feature-specific classes
- Use CSS variables for colors
- Group related properties
- Comment complex rules

Example:
```css
/* Feature Name - Main Container */
.feature-name-container {
  /* Layout */
  display: flex;
  position: relative;

  /* Spacing */
  padding: 10px;
  margin: 0 auto;

  /* Colors */
  background: var(--bg-color);
  color: var(--text-color);

  /* Typography */
  font-size: 14px;
  font-weight: 500;
}
```

### HTML Style

- Use semantic HTML elements
- Use data attributes for JS hooks
- Keep structure flat when possible
- Add ARIA attributes for accessibility

Example:
```html
<div class="feature-container" data-feature="example">
  <button class="feature-btn" aria-label="Activate feature">
    Activate
  </button>
</div>
```

## Premium Features

### License Validation

Premium features require license validation:

```javascript
async function checkLicense() {
  try {
    const { licenseKey } = await chrome.storage.sync.get('licenseKey');
    if (!licenseKey) return false;

    // Validate with background service worker
    const response = await chrome.runtime.sendMessage({
      action: 'validateLicense',
      licenseKey
    });

    return response.valid;
  } catch (error) {
    console.error('License check failed:', error);
    return false;
  }
}
```

### Premium Feature Pattern

```javascript
const PremiumFeature = (() => {
  let isActive = false;
  let isLicensed = false;

  async function init() {
    // Check license first
    isLicensed = await checkLicense();
    if (!isLicensed) {
      console.log('PremiumFeature: No valid license');
      showUpgradePrompt();
      return;
    }

    isActive = true;
    // Continue with initialization
  }

  function showUpgradePrompt() {
    // Show UI prompting user to upgrade
  }

  return { init, cleanup, isActive: () => isActive };
})();
```

## Git Workflow

### Branch Strategy

- `main` - Stable production code
- `claude/*` - Feature branches created by Claude AI
- Feature branches should be named descriptively

### Commit Message Format

```
<type>: <short description>

<detailed description>
- Change 1
- Change 2
- Change 3

Updated CHANGELOG.md
```

Types:
- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code refactoring
- `style` - Code style changes (formatting)
- `docs` - Documentation only
- `test` - Test additions or changes
- `chore` - Maintenance tasks

### Before Pushing

1. ✅ Test all changes locally
2. ✅ Update CHANGELOG.md
3. ✅ Update README.md if needed
4. ✅ Check for console errors
5. ✅ Verify no breaking changes
6. ✅ Update version if releasing

## Resources

### Documentation Files
- `/README.md` - User documentation and feature list
- `/CHANGELOG.md` - Version history and changes
- `/chrome-web-store/PRIVACY_POLICY.md` - Privacy policy
- `/chrome-web-store/CHROME_WEB_STORE_LISTING.md` - Store listing details
- `/docs/guides/` - Additional guides

### External Resources
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/storage/)
- [Keep a Changelog](https://keepachangelog.com/)
- [Semantic Versioning](https://semver.org/)

### JobTread Platform
- Target URL: `https://app.jobtread.com/*`
- Uses React framework
- Dynamic content loading
- Single-page application (SPA)

## Troubleshooting

### Extension Not Loading
1. Check manifest.json syntax
2. Verify all file paths are correct
3. Check Chrome console for errors
4. Try removing and re-adding extension

### Feature Not Working
1. Check if feature is enabled in settings
2. Check console for error messages
3. Verify script loaded: `window.FeatureName`
4. Check if premium license is required and valid
5. Verify correct page URL/path

### Settings Not Persisting
1. Check storage permissions in manifest
2. Verify service worker is active
3. Clear extension storage and retry
4. Check for storage quota issues

### Style Not Applying
1. Verify CSS file in web_accessible_resources
2. Check if style element injected
3. Check CSS specificity
4. Verify no CSP violations

## Recent Development Focus

### Active Development Areas (as of v3.3.8)

The following areas have been the focus of recent development work:

1. **Text Formatter Toolbar Positioning**
   - Toolbar docking to sticky headers in budget tables
   - Viewport-sticky behavior for consistent positioning
   - Alert builder modal integration
   - Sticky header detection improvements

2. **Preview Mode Refinements**
   - Dark theme contrast and positioning fixes
   - Floating panel viewport positioning
   - Real-time rendering updates

3. **Freeze Header Feature**
   - Sticky column/row headers for tables
   - Integration with formatter toolbar
   - Preventing overlapping with scrollable content

4. **Security Improvements**
   - Input sanitization utilities (sanitizer.js)
   - Safe DOM operations (dom-helpers.js)
   - Memory leak prevention with WeakMap
   - Server-side license validation

### Known Areas for Future Work

- Performance optimization for large budget tables
- Additional keyboard shortcuts
- Enhanced accessibility features
- Mobile/responsive improvements

## Contact & Support

- **Repository**: https://github.com/King0lightai/JT-Power-Tools
- **Issues**: https://github.com/King0lightai/JT-Power-Tools/issues
- **Chrome Web Store**: https://chromewebstore.google.com/detail/jt-power-tools/kfbcifdgmcendohejbiiojjkgdbjkpcn
- **Premium Support**: https://lightking7.gumroad.com/l/jtpowertools

---

## Summary for Claude AI

When working on this project:

### Critical Requirements
1. **ALWAYS update CHANGELOG.md** for any functional changes
2. Follow the modular feature pattern for consistency
3. Test thoroughly before committing
4. Maintain backward compatibility
5. Handle cleanup properly (no memory leaks)

### Code Quality Guidelines
6. Use prefixed console logs for debugging (e.g., `Formatter:`, `DragDrop:`)
7. Respect React event handling in JobTread
8. Check for premium license when needed
9. Keep code style consistent with existing patterns
10. Document complex logic with comments

### Security Requirements
11. **Use `utils/sanitizer.js`** for all user input validation
12. **Use `utils/dom-helpers.js`** for safe DOM operations
13. **Use `utils/storage-wrapper.js`** for Chrome storage operations
14. Never use innerHTML with user-provided content
15. Validate colors, URLs, and CSS values before use

### Architecture Guidelines
16. Complex features should be split into sub-modules (see `formatter-modules/`, `drag-drop-modules/`)
17. Use WeakMap for storing element-specific data to prevent memory leaks
18. Always provide cleanup() functions that fully reverse init() effects
19. Use AbortController for cancelable async operations

**Remember**: Every change should make the user's experience better while maintaining stability, security, and performance.

---

*Last updated: Version 3.3.8*
