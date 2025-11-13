# Changelog

All notable changes to JT Power Tools will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.3.0] - 2024-11-13

### Added

#### New Feature: Quick Notes
- Persistent notepad accessible from any JobTread page
- Keyboard shortcut (Ctrl+Shift+N) to toggle notes panel
- Create, edit, search, and organize multiple notes
- Rich markdown formatting support (bold, italic, lists, checkboxes)
- WYSIWYG editor with formatting toolbar
- Resizable sidebar panel for comfortable note-taking
- Notes sync across devices via Chrome storage
- Word count and last updated timestamps
- Integrates seamlessly with JobTread header buttons

#### New Premium Feature: Preview Mode
- Live preview of formatted text with floating preview panel
- Click preview button (eye icon) on textareas to see rendered formatting
- Converts markdown to beautifully styled HTML
- Works on budget descriptions and daily log fields
- Real-time updates as you type
- Intelligent positioning to avoid viewport edges
- Click outside preview to close

#### Improvements
- Added feedback link to popup for easier user support
- Removed mutual exclusivity between formatter and preview mode - they now work together seamlessly
- Added custom theme support for per-job tab navigation
- Improved custom theme to use primary color for selected states

### Fixed

#### Text Formatter & Preview Mode Fixes
- Fixed preview button not showing on first focus
- Improved preview button visibility and content readability
- Skip text formatter and preview mode on /files path for better compatibility
- Exclude formatter and preview mode from vendors, customers, and time entries pages

#### Custom Theme Fixes
- Fixed custom theme to preserve orange text color for better readability
- Fixed custom theme by pre-calculating lightened colors for consistent appearance
- Fixed budget table borders and preview button visibility with custom themes
- Fixed theming for Preview Mode and Quick Notes to respect user color preferences

#### Dark Mode Fixes
- Reverted orange text color override in dark mode to maintain JobTread's native styling

### Changed
- Renamed "Premium Formatter" to "Preview Mode" for better clarity
- Enhanced formatter and preview mode to work together instead of being mutually exclusive

---

## [3.2.3] - 2024-10-XX

### Added
- **New Feature: Budget Hierarchy Shading**
  - Progressive visual shading for nested budget groups (up to 5 levels)
  - Level 1 (top) = Lightest, Level 5 (deepest) = Darkest
  - Line items automatically inherit parent group shading
  - Adapts intelligently to Dark Mode and Custom Theme
  - Preserves yellow highlighting for unsaved changes
  - Smooth hover states for better visual feedback
  - Real-time updates when expanding/collapsing groups
  - Helps quickly identify group hierarchy at a glance

### Improved
- Improved budget hierarchy shading using HSL color space for better visual consistency
- Added primary color tooltips for text formatter buttons
- Custom theme now applies to selected box borders for consistent theming
- Theme-aware styling for JobTread header logo
- Collapsible customize button for cleaner custom theme interface

### Fixed
- Fixed budget hierarchy URL detection to work with all budget page variations
- Added dark mode support for text formatter toolbar

### Changed
- Quick Job Switcher now supports both J+S and Alt+J keyboard shortcuts

---

## [3.1.0] - 2024-09-XX

### Added
- **New Feature: Quick Job Switcher**
  - J+S keyboard shortcut to instantly open job switcher
  - Type to search and filter jobs in real-time
  - Enter to select top result and navigate
  - Escape to cancel and close
  - Fully keyboard-driven workflow for power users

### Improved
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

### Fixed
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

---

## [3.0.0] - 2024-08-XX

### Added
- Added Custom Theme feature (Premium)
- RGB color sliders for personalized themes
- Mutual exclusivity between appearance modes
- Integrated contrast fix into custom theme
- Enhanced popup UI with collapsible sections

---

## [1.0.0] - 2024-07-XX

### Added
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

---

## Legend

- **Added**: New features or functionality
- **Changed**: Changes to existing functionality
- **Deprecated**: Features that will be removed in upcoming releases
- **Removed**: Features that have been removed
- **Fixed**: Bug fixes
- **Security**: Security vulnerability fixes
- **Improved**: Enhancements to existing features

---

[3.3.0]: https://github.com/King0lightai/JT-Power-Tools/releases/tag/v3.3.0
[3.2.3]: https://github.com/King0lightai/JT-Power-Tools/releases/tag/v3.2.3
[3.1.0]: https://github.com/King0lightai/JT-Power-Tools/releases/tag/v3.1.0
[3.0.0]: https://github.com/King0lightai/JT-Power-Tools/releases/tag/v3.0.0
[1.0.0]: https://github.com/King0lightai/JT-Power-Tools/releases/tag/v1.0.0
