# Changelog

All notable changes to JT Power Tools will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.5.1] - 2026-01-24 (Beta)

### Fixed

#### Quick Notes Header Icon Now Persistent
- Removed URL restrictions that prevented Quick Notes icon from appearing on certain JobTread pages
- Quick Notes header icon now visible on all JobTread pages (settings, home, account pages, etc.)
- Previously only showed on specific pages like /jobs, /schedule, /messages, etc.

#### Message Templates Position on Dashboard
- Fixed Templates dropdown and character counter appearing in a separate row below the Send button
- Templates and counter now appear inline to the left of the Send button on dashboard message form
- Improved toolbar detection to properly position elements in various message form layouts

#### Budget Changelog API Pagination
- Fixed Pave API query returning only 10 most recent backups (all from same day)
- Added `size: 100` and `sortBy` parameters based on Pave API documentation for connection fields
- Dropdown now shows backup dates from across multiple days as expected (e.g., Jan 22, Jan 6, Dec 17, etc.)

#### Budget Changelog Report Styling
- Fixed changelog report opening with broken styling (raw text, no CSS)
- Replaced Tailwind CDN with comprehensive inline CSS for reliable rendering in new tabs
- Fixed "Items Modified: undefined" by adding missing `unchangedCount` calculation to diff engine
- Report now displays with proper card layouts, color-coded sections, and visual hierarchy
- Print Report and Copy Summary buttons now work correctly in the new tab view

#### Popup Toggle Settings
- Fixed null reference errors when loading settings after popup HTML overhaul
- Added `setCheckbox` and `getCheckboxValue` helper functions for safe checkbox operations
- Added null checks for theme customization elements that may not exist in all popup states

### Added

#### Discord Community Link
- Added Discord invite link to popup footer for community support

#### Freeze Header - Documents Page Panel Fix
- Fixed ADD/EDIT ITEMS panel and COST ITEM DETAILS sidebar appearing behind frozen headers on Documents page
- Panel now correctly adjusts its sticky position to stay below frozen headers when scrolling
- Lowered frozen header z-index when edit panel is open to prevent overlap
- Added dedicated detection for the ADD/EDIT ITEMS panel on Documents pages

#### Text Formatter Enhancements
- Text formatter now appears in COST ITEM DETAILS sidebar when editing document line items
- Built custom embedded text formatter toolbar for the Alert Builder modal
- Alert modal toolbar supports bold, italic, underline, strikethrough, headings, lists, colors, links, quotes, and horizontal rules

#### Popup Layout Fix
- Fixed Custom Theme customization panel appearing below API Integration section
- Theme customization options now appear directly below the Custom Theme toggle in the Appearance category

#### Budget Changelog Sidebar Detection Fix
- Fixed Budget Changelog compare controls not appearing in Budget Backups sidebar
- Added `budgetChangelog` to default settings (was missing, preventing feature from initializing)
- Updated sidebar selector to use `data-is-drag-scroll-boundary` attribute for reliable detection
- Improved `isBudgetBackupsSidebar` detection to look for orange "BUDGET BACKUPS" header
- Enhanced UI injection to find correct insertion point after instruction text
- Compare controls now appear with proper styling inside the sidebar content area
- Fixed API configuration detection to use Grant Key from Pro Service storage when available
- Added direct Pave API request functionality for fetching budget backups without relying on JobTreadAPI service

#### Budget Changelog UI Improvements
- Redesigned compare controls layout with vertical stacking to fit narrow sidebar better
- Backup dropdowns now show only the latest backup per day (reduces clutter for frequently saved budgets)
- Comparison results now open in a new browser tab with a full detailed report
- New tab report includes: job name header, printable layout, expanded statistics, and better visual organization
- Added Print Report button to export comparison as PDF
- Copy Summary button works in new tab view
- Fallback modal display if popup is blocked

### Improved

#### Custom Theme (RGB Theme) Support
- Added RGB theme support to Alert Modal (text formatter's alert builder)
- Added RGB theme support to Message Templates modals (templates dropdown, manager, edit modal)
- All modal elements now properly inherit Custom Theme colors when RGB theme is active
- Uses CSS custom properties (--jt-theme-*) for consistent theming across extension features

---

## [3.5.0] - 2026-01-18 (Beta)

### Added

#### Message Templates Feature (formerly Signature)
- Upgraded single signature to multi-template system with named templates
- Templates dropdown button shows list of saved templates for quick insertion
- Settings button (⚙) opens Template Manager modal for CRUD operations
- Create, edit, and delete multiple named message templates
- Set any template as default (marked with ★) for quick reference
- Automatic migration from old single-signature format to new templates format
- Templates sync across devices via Chrome storage
- Template edit modal with name input, content textarea, and "set as default" option
- Ctrl+Enter keyboard shortcut to save template in modal
- Full dark mode support using neutral dark grays for all template UI elements

#### License Tier System
- Added four-tier license system: FREE, Essential ($10), Pro ($20), Power User ($30)
- FREE features work without any license to attract new users
- Essential tier unlocks Quick Notes, Smart Job Switcher, Freeze Header, PDF Markup Tools
- Pro tier unlocks Schedule & Task Checkboxes, Custom Theme, Preview Mode
- Power User tier unlocks Custom Field Filter, MCP Access (Coming Soon)
- Backwards compatibility: existing "JT Power Tools" purchasers get PRO tier

#### Custom Field Filter Feature
- Separated Custom Field Filter from Job Switcher as a standalone Power User feature
- API-powered filtering of jobs by custom field values in Job Switcher sidebar
- Requires Power User tier and API configuration
- Added `getCustomFieldValues` API endpoint to fetch unique values for text-based fields
- Filter dropdown auto-populates with available values from your jobs

#### AI Integration Panel (Power User - Coming Soon)
- Added AI Integration section in extension popup for Power User tier
- Platform selector with Claude, ChatGPT, Cursor, and Other MCP clients
- Auto-generates personalized MCP config JSON with user's license and grant keys
- One-click copy to clipboard for easy setup
- Platform-specific setup instructions for each AI client
- Connection status indicator with live server test
- Test Connection button validates credentials against MCP server
- Quick links to full documentation and server status
- Full dark mode support for the integration panel
- Claude Desktop now uses mcp-remote bridge for remote MCP server connection (Windows path-with-spaces fix)
- Claude Code (CLI) option added with direct HTTP config support
- Separated Claude Desktop and Claude Code tabs for clearer setup instructions
- Config output shows just the server entry for easy merging into existing configs

### Fixed

#### Text Formatter Budget Table Fix
- Fixed expanded toolbar not appearing for Budget table Description fields
- The `isInAddEditItemsTable` detection was incorrectly matching Budget table rows
- Added Budget page exclusion to ensure Budget table fields get the expanded floating toolbar

#### Freeze Header ADD/EDIT ITEMS Panel Fix
- Fixed ADD/EDIT ITEMS panel and COST ITEM DETAILS sidebar appearing behind frozen headers on Documents page
- When the ADD/EDIT ITEMS panel is detected, frozen headers z-index is lowered (tabs to 30, toolbar to 29)
- Adjusted panel's sticky `top` position to account for frozen headers (prevents sliding under when scrolling)
- This allows the panel to appear in its natural stacking context without breaking layout
- Added `jt-edit-panel-open` class to body when panel is open
- Panel is excluded from global sidebar marking to prevent incorrect positioning
- Added dedicated `findAndMarkEditItemsPanel()` function for reliable panel detection on Documents pages

#### Popup Layout Fix
- Fixed Custom Theme customization panel appearing below API Integration section
- Theme customization options now appear directly below the Custom Theme toggle in the Appearance category

#### Task Completion Checkbox Fix
- Fixed task completion checkbox being covered by JobTread's "Add Task" button in Week/Day view
- Moved checkbox to left side of task name to avoid z-index conflicts with native JobTread elements

#### Text Formatter Documents Page Support
- Compact embedded toolbar now appears in Documents page sidebar description fields
- Fixed URL blocker that was preventing formatter from initializing on Documents pages
- Main document editor area still uses JobTread's native formatter (no conflict)
- Fixed formatter exclusion for ADD / EDIT ITEMS table to prevent toolbar stretching across empty rows
- Detection now properly distinguishes between COST ITEM DETAILS sidebar (formatter allowed) and ADD / EDIT ITEMS table (excluded)

#### Character Counter & Signature in Document Modals
- Character counter and signature buttons now appear in document-sending modals (Send Estimate, Send Change Order, Send Invoice, etc.)
- Detects "Email Message" textarea in send modals alongside existing message dialog support
- Signature container positioned below the textarea for easy access
- Fixed formatter incorrectly appearing in "Add / Edit Items" line item table textareas
- Sidebar detection now specifically targets "COST ITEM DETAILS" panel only

#### Alert Modal Embedded Toolbar
- Added embedded/compact formatter toolbar directly inside the Alert Builder modal
- Full formatting support: Bold, Italic, Underline, Strikethrough, Headings (H1-H3), Lists (bullet/numbered), Colors (green/yellow/blue/red), Links, Quotes, and Horizontal Rules
- Prevents the floating expanded toolbar from appearing and blocking the message textarea
- Full dark mode support for the embedded toolbar
- Toolbar buttons now show active state (blue highlight) when cursor is inside formatted text
- Auto-continue lists: pressing Enter on bullet or numbered lists automatically adds next item
- Pressing Enter on empty list item removes it instead of adding another
- Modal no longer closes when clicking outside - only closes via Close, Cancel, or Add buttons

#### AI Integration Panel Bug Fixes
- Fixed Test Connection sending undefined license key (was using wrong property name)
- Fixed license key retrieval using correct property (`key` instead of `licenseKey`)

#### PDF Markup Tools Auto-Deselect
- Fixed custom PDF tools (Highlight, Eraser) staying active when clicking JobTread native tools
- Custom tools now automatically deactivate when any native JobTread tool (Move, Select, Freedraw, etc.) is clicked
- Handles dynamically added toolbar buttons for consistent behavior

### Changed

#### Feature Tier Restructuring
- Dark Mode and Text Formatter are FREE (most popular features as hooks)
- Budget Hierarchy Shading, Kanban Type Filter, Auto Collapse Groups are FREE
- Contrast Fix and Character Counter are FREE
- Smart Job Switcher, Freeze Header, PDF Markup Tools moved to Essential tier
- Renamed "Drag & Drop" feature to "Schedule & Task Checkboxes" (JobTread launched native drag-drop)

---

## [3.3.10] - 2026-01-06 (Beta)

### Added

#### New Feature: ToDo Drag & Drop
- Drag and drop To-Dos in month calendar view to change due dates
- Works on To-Dos pages (URL contains "to-dos")
- Uses the "Due" date field for To-Dos (unlike tasks which have Start/End dates)
- Seamless integration with existing drag & drop infrastructure

### Improved

#### Preview Mode Enhancements
- Fixed last line getting cut off when scrolling in preview pane
- Fixed blockquotes rendering as separate elements with gaps
- Fixed inline icons showing as placeholder characters - now renders actual SVG icons
- Simplified alert box styling to match JobTread rendering
- Improved paragraph spacing consistency

#### Freeze Header Improvements
- Fixed Time Clock and Daily Log global sidebars appearing too low on page
- Fixed Notifications sidebar positioning to stay at native header level
- Fixed Files page left sidebar sliding under frozen action bar
- Added max-height constraint to Files sidebar to prevent scroll jump at bottom of page

---

## [3.3.6] - 2025-12-XX (Beta)

### Added

#### New Feature: Auto Collapse Completed Groups
- Automatically collapses schedule groups that are 100% complete on page load
- Reduces clutter by hiding completed work while keeping active items visible
- Works on Schedule views with grouped tasks
- Groups expand normally when clicked to view completed items
- Helps focus on remaining work without manual collapsing

### Improved

#### Custom Theme Overhaul
- Complete overhaul with HSL-based color palette generation
- Rich palette with multiple background, border, and text shades
- Distinct hover/focus/active state colors (not brightness filters)
- Theme-harmonized alert colors that adapt to light/dark backgrounds
- Better visual separation between UI layers
- Fixed dropdown menus and popper-positioned elements
- Fixed scrollbars only appearing on scrollable containers
- Clean lines in Gantt chart (removed unnecessary shadows)

### Fixed
- Fixed budget hierarchy resize handles getting shaded
- Fixed Smart Job Switcher to select highlighted item on Enter when using arrow keys
- Fixed dark toolbars and file viewers being incorrectly themed
- Fixed content tiles incorrectly getting popup shadows
- Fixed native formatter detection for custom fields in labels
- Fixed Text Formatter not appearing in New Job Message popup modal
- Fixed dark mode color picker buttons having poor contrast (A letters now visible)
- Fixed sidebar/panel embedded toolbar not hiding when clicking away from textarea
- Fixed dark mode overflow dropdown not matching toolbar styling
- Fixed duplicate formatter toolbar appearing in JobTread's native ADD ALERT modal
- Removed redundant built-in toolbar from extension's Alert Builder modal (uses secondary toolbar on focus instead)
- Fixed sidebar scrollbar being cut off at the bottom when Freeze Header is active and page is scrolled

---

## [3.3.4] - 2025-01-XX (Beta)

### Added

#### New Feature: Freeze Headers
- Freeze column and row headers in table views for easier navigation
- Keep important headers visible while scrolling through large datasets
- Works seamlessly with budget tables and other data views
- Toggle on/off from the extension popup

#### New Feature: Message Character Counter
- Real-time character count display for message fields
- Helps stay within character limits when composing messages
- Unobtrusive counter that appears when typing
- Useful for daily logs and communication fields

---

## [3.3.3] - 2025-01-XX (Beta)

### Improved

#### Architecture & Stability
- **Most Stable Version Yet**: Comprehensive restructuring for enhanced reliability
- Restructured color theme and dark mode systems for better performance
- Improved code organization and modularity across all features

#### Text Formatter & Preview Mode Enhancements
- Added more robust formatting rendering and detection
- Enhanced compatibility with various textarea types and page structures
- Improved reliability of formatter toolbar appearance
- Better detection of editable fields for formatter activation

#### Color Theme & Dark Mode
- Complete restructuring of color theme implementation
- Enhanced dark mode reliability and consistency
- Improved theme switching and color application logic
- Better integration between custom themes and dark mode

### Notes
This release represents a major stability milestone for JT Power Tools. Extensive restructuring of core systems has significantly improved reliability and performance. This is the beta version demonstrating the extension's readiness for broader use.

---

## [3.3.2] - 2025-01-XX

### Improved

#### Preview Mode Enhancements
- Added inline color markup support for text highlighting
- Upgraded alert builder to JobTread-style modal dialog
- Improved alert rendering with proper styling and icons
- Fixed alert heading level from 4 to 3 hashtags for better hierarchy

#### Quick Notes Improvements
- Expanded Quick Notes button to appear on all main pages with action bars
- Better integration with JobTread's page structure

### Fixed

#### Preview Mode Fixes
- Fixed preview button staying blue when preview window closes
- Fixed preview mode bug where switching rows showed previous row content
- Improved preview button state management

#### Text Formatter Fixes
- Prevented text formatter from appearing on settings page
- Improved compatibility with different page types

#### Dark Mode Fixes
- Fixed cursor visibility in dark mode for budget textareas
- Fixed budget row highlighting to supersede hierarchy shading in dark mode
- Fixed bright spacer divs in budget rows when highlighted
- Restored blue row highlight for budget row selection in dark mode
- Removed orange text to white conversion in dark mode for better consistency

#### General Fixes
- Fixed button detection to support both div and link action buttons
- Improved overall UI stability and consistency

---

## [3.3.1] - 2025-01-17

### Added

#### New Feature: Action Items Quick Completion
- Checkboxes added to Action Items card for instant task completion
- Complete action items directly from dashboard without navigation
- Hidden iframe technology ensures seamless background completion
- Visual feedback with smooth fade-out animation when tasks are completed
- Automatic task removal from list upon successful completion
- Smart task ID extraction from both schedule and to-do URLs
- Real-time Save button detection and state monitoring

#### New Feature: Month Schedule Task Completion
- Checkboxes added to task cards in month schedule view
- Quickly mark tasks complete or incomplete directly from calendar
- Visual completion status indicator shows current task state
- Instant task status updates without opening task details
- Works seamlessly with existing drag & drop functionality

#### Help Sidebar Integration
- JT Power Tools support section added to JobTread help sidebar
- Help Sidebar Support feature now always enabled by default
- Better integration with JobTread's native help system

### Fixed

#### Action Items & Task Completion Fixes
- Fixed task completion to use full-size hidden iframe for proper toolbar rendering
- Fixed Save button detection and enabled state checking
- Improved task completion reliability with better timeout handling
- Cleaned up orphaned code that was causing JavaScript errors

#### UI & Display Fixes
- Fixed Quick Notes from running on settings pages
- Fixed sidebar hiding CSS from blocking help modals
- Fixed sticky header text elements from overlapping when scrolling
- Fixed column resize handles appearing over frozen column headers
- Fixed search bar to use shaded background on hover instead of primary color

#### Theme & Appearance Fixes
- Fixed dark mode background colors with !important flag to prevent white flash
- Added solid blue background for today's date in dark mode calendar
- Fixed text formatter and preview mode disabled for Time Clock Notes field

---

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

#### Text Formatter Improvements
- Added table formatting support with interactive table builder
  - Create tables with custom rows and columns
  - Visual table preview in formatting toolbar
  - Generates markdown-formatted tables
  - Works seamlessly with existing formatting options

#### Other Improvements
- Added feedback link to popup for easier user support
- Removed mutual exclusivity between formatter and preview mode - they now work together seamlessly
- Added custom theme support for per-job tab navigation
- Improved custom theme to use primary color for selected states

### Fixed

#### Text Formatter & Preview Mode Fixes
- Fixed text formatter not appearing in daily log edit fields with transparent textarea structure
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
- Smart Job Switcher now supports both J+S and Alt+J keyboard shortcuts

---

## [3.1.0] - 2024-09-XX

### Added
- **New Feature: Smart Job Switcher**
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
  - Moved Dark Mode below Smart Job Switcher in popup
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

[3.3.10]: https://github.com/King0lightai/JT-Power-Tools/releases/tag/v3.3.10
[3.3.6]: https://github.com/King0lightai/JT-Power-Tools/releases/tag/v3.3.6
[3.3.4]: https://github.com/King0lightai/JT-Power-Tools/releases/tag/v3.3.4
[3.3.3]: https://github.com/King0lightai/JT-Power-Tools/releases/tag/v3.3.3
[3.3.2]: https://github.com/King0lightai/JT-Power-Tools/releases/tag/v3.3.2
[3.3.1]: https://github.com/King0lightai/JT-Power-Tools/releases/tag/v3.3.1
[3.3.0]: https://github.com/King0lightai/JT-Power-Tools/releases/tag/v3.3.0
[3.2.3]: https://github.com/King0lightai/JT-Power-Tools/releases/tag/v3.2.3
[3.1.0]: https://github.com/King0lightai/JT-Power-Tools/releases/tag/v3.1.0
[3.0.0]: https://github.com/King0lightai/JT-Power-Tools/releases/tag/v3.0.0
[1.0.0]: https://github.com/King0lightai/JT-Power-Tools/releases/tag/v1.0.0
