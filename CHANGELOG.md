# Changelog

All notable changes to JT Power Tools will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

#### Service Worker API Proxy
- **Fixed SSRF vulnerability in API proxy**: The `JOBTREAD_API_REQUEST` message handler now validates sender origin (must be from the extension or a JobTread tab) and enforces a URL allowlist (only `api.jobtread.com` and `app.jobtread.com`). Previously, the proxy could be used to fetch arbitrary URLs.

#### Preview Mode
- **Fixed XSS in markdown preview renderer**: Raw text is now HTML-escaped before inline formatting is applied, preventing injection of malicious HTML tags. Link URLs are sanitized via `Sanitizer.sanitizeURL()` to block `javascript:` and `data:` URI schemes. Table and alert HTML blocks are preserved using placeholder tokens during escaping.

#### Quick Notes
- **Fixed `javascript:` URL injection in markdown links**: Both `processInlineFormatting()` and `parseMarkdown()` now sanitize link URLs through `Sanitizer.sanitizeURL()` to block dangerous URI schemes.

#### Budget Changelog
- **Fixed XSS via unsanitized error messages**: Server-returned error strings are now escaped before injection into `innerHTML`.
- **Fixed unsanitized API data in backup selector**: Usernames, IDs, URLs, and dates from the API are now escaped with `escapeHtml()` before being interpolated into HTML option elements.

### Fixed

#### Memory Leaks
- **Fixed `setInterval` leak in Auto Collapse Groups**: URL-check interval and `popstate` listener are now stored at module level and cleared in `cleanup()`, preventing orphaned timers after feature disable.
- **Fixed `setInterval` leak in Freeze Header**: URL-check interval is now tracked and cleared in `cleanup()`.
- **Fixed `setInterval` leak in Kanban Type Filter**: URL-check interval moved from local const to module-level variable with explicit `clearInterval` in `cleanup()`.

### Improved

#### Code Deduplication
- **Consolidated `escapeHtml` into shared `Sanitizer.escapeHTML`**: Six files (availability-filter, budget-changelog-modules/ui, character-counter, custom-field-filter, preview-mode, quick-notes-modules/markdown) now delegate to `Sanitizer.escapeHTML()` instead of maintaining independent copies.
- **Consolidated `adjustColorBrightness` into shared `ColorUtils.adjustBrightnessPercent`**: Added percentage-based brightness adjustment to `color-utils.js`. Preview Mode and Quick Notes now delegate to the shared utility instead of defining their own copies.
- **Removed dead `isFormatterField` function from Preview Mode**: Function was defined but never called; removed to reduce code size.
- **Replaced inline `defaultSettings` in popup.js with shared `JTDefaults`**: Popup now loads `utils/defaults.js` and uses `JTDefaults.getDefaultSettings()`, eliminating a stale copy that was missing newer feature flags (`customFieldFilter`, `budgetChangelog`).
- **Auto-device registration on login**: Logging into a JT Power Tools account on a new device now automatically registers the device with the Pro Worker and restores the JobTread API connection. Users no longer need to manually re-enter their grant key or click "Test" in the API tab.

### Added

#### Preview Mode
- **Pinned mode**: New pin button in the preview header toggles between docked and pinned modes
  - **Persistent panel**: Pinned panel stays open even when you leave the textarea, requires manual close via X button
  - **Draggable**: Drag the panel by its header bar to reposition anywhere on screen, with viewport bounds clamping
  - **Resizable**: Drag right edge, bottom edge, or corner handle to resize (280-800px wide, 150-600px tall)
  - **Content follows focus**: When pinned, the preview automatically updates to show whichever textarea you click into — no need to close and reopen
  - **Position/size memory**: Pinned panel position and dimensions are saved and restored across sessions

## [3.6.51] - 2026-02-23 (Hotfix)

### Fixed

#### Freeze Header
- **Fixed global sidebars dropping down on some devices**: On devices where the header height resolves to a sub-pixel value (e.g. 47.9688px instead of 48px), global sidebars like Notifications and Daily Logs were incorrectly pushed below the frozen tabs/toolbar. Fixed by allowing content-detected global sidebars inside `data-is-drag-scroll-boundary` containers, using `var(--jt-header-height)` instead of hardcoded 48px for global sidebar positioning, and widening the inline style exclusion range to 45-52px.

#### Text Formatter
- **Fixed overflow dropdown items oversized compared to compact toolbar**: The overflow dropdown items were 32px while the rest of the compact toolbar uses 22px. Shrunk dropdown items to match with consistent font-size (11px), padding, SVG sizing (12px), and container dimensions.

## [3.6.5] - 2026-02-21

### Added

#### Freeze Header
- **Job context indicator**: When scrolled past the job header, the current job name/number now appears in the top header bar (between the logo and search) so users always know which job they're viewing. Clicking the label opens the Job Switcher. Uses zero additional screen space. Supports dark mode and custom themes.

#### Custom Field Filter Enhancements
- **Multi-select filtering**: Select multiple values for a custom field with OR logic — jobs matching ANY selected value are shown. Replaces the single-value dropdown with a checkbox dropdown component featuring Select All / Clear All controls and a selected count badge.
- **Saved Filters**: Save and load named filter presets via the status dropdown. Saved filters appear as selectable options alongside All Jobs / Open Jobs / Closed Jobs. Selecting a saved filter auto-populates the field and values then applies the filter. Save (floppy icon) and delete (trash icon) buttons appear contextually next to the values dropdown. Shared across all users in the same company. Requires login to a JT Power Tools account.
- **Saved Filters API**: New `/sync/saved-filters` endpoints on the license proxy Worker with D1 database migration for company-scoped filter persistence.

### Removed
- **Quick Notes floating button**: Removed the floating blue button fallback that appeared when the header bar wasn't found. Quick Notes now only appears via the header icon.
- **Task completion retry logic**: Removed the exponential-backoff retry mechanism for checkbox injection since the MutationObserver already handles re-initialization when new DOM nodes appear.

### Fixed

#### Quick Notes
- **Fixed extension running on jobtread.com marketing site**: Content scripts were matching `*.jobtread.com` which caused the extension (including the Quick Notes floating button) to run on the marketing site. Restricted content scripts to `app.jobtread.com` only.

#### Freeze Header
- **Fixed global sidebars dropping down with blank space above**: Full-height sidebars like Notifications and Job Switcher were being pushed below the frozen tabs/toolbar instead of staying at their native position just below the main header. Added Job Switcher content detection to the global sidebar marker, broadened the inline style exclusion range (48-52px), and increased CSS specificity on the `.jt-global-sidebar` rule to reliably override the generic sticky panel positioning.

#### Text Formatter
- **Fixed toolbar appearing on document signature/metadata fields**: The formatter toolbar was incorrectly showing on signature lines, "Prepared By", "From", "To", "Terms", "Footer", and other document metadata fields on invoices, estimates, proposals, contracts, and purchase orders. Added a label heading blocklist to exclude these document-specific fields regardless of URL path.
- **Fixed toolbar appearing on file description fields**: The formatter toolbar was showing on file description textareas in file view/edit popups. The `placeholder="Description"` check was returning `true` before the modal exclusion could run. Moved the modal check inside the Description block so file description fields in any modal are excluded while budget Description fields (which are inline, never in modals) continue to work.
- **Fixed floating toolbar not vanishing when switching fields on budget page**: When clicking from a budget Description textarea (which shows the expanded floating toolbar) to another field like a custom field or Name column, the floating toolbar would remain on screen and reposition over the new field instead of disappearing. Moved the floating toolbar cleanup to run unconditionally when any non-budget-Description field receives focus, rather than only when an embedded toolbar was successfully created.

#### Custom Field Filter (Job Switcher)
- **Fixed saved filters disappearing when saving**: The Job Switcher's keyboard shortcut handler was capturing Enter and Escape key events in the capture phase before the custom field filter's save input could process them. Pressing Enter to confirm a filter name would instead trigger "select top job and close sidebar", navigating away and discarding the save. Added input detection to skip Job Switcher keyboard handling when a custom field filter input is focused, and added `stopPropagation` to the filter's save/cancel handlers.
- **Fixed multi-value custom field filter not returning results**: The Worker API expected a singular `filter.value` property but the client was sending `filter.values` (array) for multi-select support, resulting in undefined filter values and no matching jobs. Updated the Worker to normalize both formats, use the Pave `in` operator for multi-value filtering, and generate correct cache keys from value arrays.
- **Added server-side custom field limits and type exclusion**: The Worker now enforces a maximum of 25 custom fields per query and excludes `multipleText` type fields from the response, matching the client-side filtering for consistent behavior.

#### Task Completion Checkboxes
- **Fixed checkboxes not appearing in grouped Kanban views**: When Kanban is grouped by Job, Type, or other fields, task cards lose the `cursor-grab` class that our selector depended on. Added a fallback selector matching the grouped card class pattern with validation to ensure only actual task cards receive checkboxes.
- **Improved Kanban checkbox reliability**: Made card detection more robust with fallback selectors for header buttons and task name containers. Extracted reusable `findTaskNameDiv()` helper for consistent task name detection across all code paths. Fixed retry logic selector mismatch that only checked `cursor-[grab]` but not `cursor-grab` Tailwind class variant. Increased retry attempts from 3 to 5 for slower-loading pages.

## [3.6.4] - 2026-02-15

### Added
- **Reverse Thread Order** (Essential): New feature that reverses message threads so newest messages appear at the top with the reply form and editor moved above the conversation for immediate access. Works across all message thread locations in JobTread — jobs, documents, daily logs, sidebars, and single-message threads. Uses pure CSS visual reordering to keep React stable.

## [3.6.3] - 2026-02-13

### Improved

#### Custom Theme Presets
- **Quick Themes**: Added 10 preloaded theme presets to the Theme tab as clickable color circles above the saved themes section. Clicking a preset instantly loads and applies the theme.
  - **Light row**: Ocean, Forest, Sunset, Berry, Slate
  - **Dark row**: Midnight, Ember, Neon, Plum, Charcoal

#### Text Formatter Toolbar
- **Compact toolbar everywhere**: Reduced the embedded toolbar size to match the compact modal version (22px buttons, 11px font, 12px SVG icons) for a cleaner, less intrusive look across all contexts
- **Sticky scroll in all contexts**: Extended the sticky scroll behavior (toolbar follows textarea during scroll) to all embedded toolbar locations — modals, job overview columns, and custom fields — not just sidebars
- **Message field toolbar repositioned**: Moved the formatter toolbar from below the message textarea to above it, embedded between the TO line and the message area for easier access while composing

### Fixed

#### Text Formatter on More Pages
- **Re-enabled Text Formatter on Files, Customer, and Vendor pages**: The formatter was previously excluded from these pages. Now that toolbar positioning has been fixed (modal and sidebar overlap issues resolved), the formatter is available on all content pages. Only `/settings`, `/plans`, and `/catalog` remain excluded.
- **Fixed Text Formatter missing on Message fields in document-type pages**: On documents, invoices, estimates, proposals, contracts, and purchase order pages, the formatter was blocked for all non-sidebar fields. Message compose areas are now allowed through the document-type page filter.

#### Text Formatter Toolbar Fix
- **Fixed toolbar covering bottom buttons in edit job popup**: The embedded formatter toolbars were adding too much height in modal popups (e.g., Update Job), pushing the bottom button bar (Delete / Cancel / Update) out of view. Added compact modal-specific toolbar styles — smaller buttons (22px), tighter padding, and minimal margins — so toolbars remain visible and functional without interfering with the modal layout.
- **Fixed sticky toolbar overlapping page headers in sidebars**: When scrolling a sidebar (e.g., UPDATE TASK panel), the formatter toolbar's sticky/fixed positioning would float up into page-level headers (action bar with + Task/+ To-Do, or the Documents/Files/Reports tab bar). Fixed by detecting the sidebar's sticky header boundary and reverting the toolbar to its natural flow position when the textarea scrolls completely above the header area, preventing any overlap with page navigation elements.
- **Fixed formatter toolbar appearing below character counter on page load**: On message fields, a race condition between the formatter and character counter MutationObservers could cause the toolbar to render below the counter and template buttons instead of directly below the textarea. Fixed by anchoring toolbar insertion to the native action bar (Send button row) rather than relying on `nextSibling` ordering.
- **Fixed floating toolbar appearing on custom fields in budget table**: Custom fields like "Internal Notes" on the budget page were incorrectly showing the floating expanded toolbar (meant only for Description fields). A fallthrough bug in `showToolbar()` caused non-Description budget fields to bypass the embedded toolbar check and fall into the floating toolbar code path. Added explicit return to prevent fallthrough.
- **Fixed sidebar toolbar positioning and scroll behavior**: Replaced `position: fixed` with `position: sticky` for sidebar toolbar positioning. Fixed positioning took the toolbar out of the sidebar's stacking context, causing it to render on top of the sidebar header (z-50 vs z-10) and creating phantom hover states on toolbar buttons when the cursor was over the textarea. Sticky positioning keeps the toolbar in the sidebar's flow, naturally slides behind the header, and eliminates all z-index and hover issues.
- **Fixed toolbar staying in floating position after clicking away**: Embedded toolbars in sidebars would remain stuck in `position: fixed` after the textarea lost focus, because `hideToolbar()` only reset floating toolbars. Now resets embedded toolbars back to `position: relative` on blur, and keeps toolbar visible when focus moves to the preview panel.

#### Schedule Task Checkboxes Fixes
- **Added retry logic for slow-loading pages**: Schedule Task Checkboxes now retry initialization up to 3 times with exponential backoff if task cards aren't detected immediately. This fixes issues on slower connections or devices where the Kanban/Calendar view loads after the initial check.
- **Added debounce to MutationObserver**: Prevents multiple rapid reinitializations when DOM changes quickly (e.g., during Kanban drag operations), improving performance and reliability.

#### Dark Mode Checkbox Fix
- **Fixed checkbox circle appearing white in dark mode and custom themes**: JobTread updated their checkbox SVG to use `fill-blue-50` for the circle interior, which rendered as bright white in dark mode and custom themes. Added `fill-blue-50` overrides in both dark mode CSS and custom RGB theme to match the respective background colors.

#### Action Items Completion Fix
- **Fixed Action Items checkbox failing to complete tasks**: The extension's content scripts (including task completion checkboxes) were running inside the hidden iframe used for action item completion, injecting elements that interfered with sidebar and Progress checkbox detection. Added `#jt-completion-iframe` URL marker so `content.js` skips all feature initialization inside the iframe. Also simplified the iframe completion logic to use the Progress checkbox directly (removed checklist detection that was prone to false positives from injected elements).

---

## [3.6.2] - 2026-02-12

### Added

#### Takeoff Print Tool (PDF Markup Tools)
- **New feature: Takeoff Print Tool** integrated into PDF Markup Tools for printing construction takeoff drawings to PDF
  - **Integrated Print button**: Embedded directly into JobTread's native takeoff toolbar (next to Rotate, Ruler, Scale Plan)
  - **Plan comparison view support**: Single print button in comparison mode prints the full visible composite (both overlaid image layers with red/blue filters). Users can toggle layers before printing to control what's included.
  - **Dynamic page sizing**: Automatically measures the drawing and sets the print page size to fit the content exactly (no more hardcoded Tabloid). Based on [FitToPage.js](https://github.com/sulimanbenhalim/fit-to-page) (MIT)
  - **Auto orientation detection**: Automatically selects landscape or portrait based on the drawing's aspect ratio
  - **Clean export**: Hides all JobTread UI when printing, showing only the takeoff drawing
  - **Full theme support**: Works with light mode, dark mode, and custom RGB themes
  - Print button appears automatically whenever the takeoff toolbar is present (SPA-navigation aware)

### Improved

#### Takeoff Print Tool
- **Auto orientation + fit-to-page printing**: Drawing auto-detects landscape vs portrait from its aspect ratio and scales to fill whatever paper size the user selects (Tabloid, Letter, etc.). No longer hardcoded to Tabloid 11x17".
- **Proper SVG measurement**: Uses SVG `viewBox` attributes for accurate intrinsic dimensions instead of `scrollWidth`/`scrollHeight` which could return the wrong container size.
- **Clean print layout**: Drawing is cloned into a dedicated print wrapper instead of using `visibility: hidden`. This prevents the drawing from being trapped inside JobTread's nested flex/absolute containers that distorted print layout.

#### Eraser Tool
- **Improved eraser reliability**: Eraser now simulates a Backspace keypress after selecting an annotation instead of searching for the trash icon button in the DOM. This is more reliable since JobTread natively handles Backspace to delete selected annotations.

### Fixed

#### PDF Markup Tools Fixes
- **Fixed Print button not appearing in takeoff toolbar**: The Print button was gated behind a URL check (`/files/`, `/takeoff/`, `/plans/`) that didn't account for SPA navigation. Since JobTread is a single-page app, navigating to a takeoff page after initial load never triggered the injection. Removed the URL gate and added `injectTakeoffButtons()` to the main MutationObserver so the Print button is injected whenever the takeoff toolbar appears in the DOM, regardless of navigation timing.
- **Fixed "Cannot find takeoff drawing area" in plan comparison view**: The comparison view renders plans as `<img>` elements (not SVGs), so the print container detection failed. Updated `detectTakeoffContainer()` to also find image-based comparison containers, `measurePrintSize()` to read `naturalWidth`/`naturalHeight` from images, and `printDrawingOnly()` to clone comparison images with their CSS filter overlays (red/blue color effects) and `mix-blend-mode` compositing intact. Single print button in comparison mode captures the full visible composite.

#### Account & Login Fixes
- **Fixed account login/register forms hidden without license key**: The account section (Sign In / Create Account) was completely hidden when no license key was entered. Users on a new device couldn't sign in to sync their data without first entering a license key. The account forms are now always visible regardless of license status — the server handles license validation on login.

---

## [3.6.1] - 2026-02-10

### Fixed

#### Sync & Data Persistence Fixes
- **Fixed license key not syncing on new device login**: When logging into the extension on a new device, the license key was not being fetched from the server, causing premium features to be unavailable. The server now returns the license key on login, and the client automatically verifies and stores it.
- **Fixed grant key not syncing on new device login**: Grant keys for Power Users are now properly returned from the server on login and stored locally for MCP/AI integrations.
- **Fixed deleted notes/templates reappearing on new devices**: Deleted notes and templates were not being synced to the server, causing them to reappear when logging in on a new device. Now tracks deleted item IDs and sends them during sync so the server can soft-delete them.
- **Fixed personal notes folders not syncing**: The `syncNotes()` function was not including the `folder` property in the sync payload, causing folders to be lost after server sync. Folders now persist correctly across devices.
- **Fixed team notes folder column missing**: Added database migration to add `folder` column to `team_notes` table, fixing "table has no column named folder" errors when saving team notes to folders.

---

## [3.6.0] - 2026-02-08

### Added

#### Files Drag to Folder (Pro)
- **New feature: Files Drag to Folder** allows dragging files directly onto folder buttons to organize them
  - Supports both list view and grid view on the JobTread Files page
  - Visual drop zone highlighting on folder buttons during drag
  - Handles grid view's extra steps (Select Files / Edit File) automatically
  - Simulates the native folder assignment workflow behind the scenes
  - Dark mode compatible

#### Fat Gantt - Thicker Dependency Lines
- **New feature: Fat Gantt**: Makes Gantt chart dependency lines thicker (3.5px vs 1.5px) and easier to click
  - Increased stroke width from 1.5px to 3.5px for better visibility
  - Applies to all dependency line colors: blue (default), red (selected), and gray (completed/inactive)
  - Rounded line caps and joins for smoother appearance
  - Slightly enlarged arrow markers for visual balance
  - Dark mode compatible with brighter colors for visibility
  - Toggleable in Settings under "Schedule & Calendar" category
  - Enabled by default (free feature)

#### Quick Notes Panel Improvements
- **Push page content**: Quick Notes panel now pushes JobTread page content to the left instead of overlaying it, allowing you to still see and interact with JobTread while a note is open
- **Collapsible sidebar**: Added a collapse button (<<) in the sidebar header to hide the notes list while keeping the editor visible. Collapsed state is remembered across sessions.
- **Minimum editor width**: Editor enforces a minimum width of 452px to ensure toolbar buttons (including undo/redo) are always visible
- **Custom theme compatibility**: Added complete custom RGB theme support for collapsed sidebar state and all new UI elements (borders, backgrounds, button containers)

#### Account & License UI
- **Sign in link**: Added "Already have an account? Sign in" link to the account setup prompt for users who already have an account on another device

#### Popup UI Improvements
- **Updated feature count badge**: Feature count now shows 18 (up from 14) to reflect all available features
- **Device compatibility icons**: Added mobile phone icon to Fat Gantt feature. Added tablet icon to Freeze Header, Availability Filter, and PDF Markup Tools to indicate these work on wider screens (tablet/desktop)

#### Team Notes Enhancements
- **Folder support for team notes**: Team notes now persist folder assignments to the server, enabling folder organization that syncs across team members
- **Pin notes in folders**: Notes can now be pinned to appear at the top of their folder. Click the pin icon next to any note to pin/unpin. Pinned notes display with a cyan left border accent.
- **Polling sync for team notes**: Team notes now automatically sync every 15 seconds when the panel is open, allowing near real-time collaboration without page refresh
- **Drag to reorder folders**: Folders can now be reordered by dragging the grip handle on folder headers. Custom folder order is saved per tab (My Notes vs Team Notes)
- **Drag notes between folders**: Notes can now be moved between folders by dragging them onto a folder header. The folder header highlights when hovering with a dragged note.
- **Delete folders**: Folders (except General) can now be deleted by hovering over the folder header and clicking the × button. Notes in deleted folders are automatically moved to General.
- **Drag notes to reorder**: Notes can now be reordered within a folder or moved to a different position in another folder by dragging them onto other notes. A blue indicator shows where the note will be placed.

#### Quick Notes - Pure WYSIWYG Editor & Folder Organization
- **Pure WYSIWYG Editor**: Quick Notes now uses a clean rendered-only editor
  - SVG icon toolbar with bold, italic, underline, strikethrough, lists, checkboxes, links, code, undo/redo
  - Formatting is rendered directly - no markdown syntax visible to users
  - Keyboard shortcuts: Ctrl+B (bold), Ctrl+I (italic), Ctrl+U (underline), Ctrl+K (link), Ctrl+Z (undo), Ctrl+Y (redo)
  - Full undo/redo support with history tracking
  - Proper spell checking (uses browser's native spellcheck)
  - Interactive checkboxes that toggle on click
  - Notes still stored as markdown for backward compatibility
  - Removed EasyMDE library (~110KB saved)
- **Numbered list support**: Added numbered/ordered list formatting
  - Click numbered list button or convert existing content
  - Supports indentation levels
  - Proper markdown conversion (1. item, 2. item, etc.)
- **Folder organization for notes**: Notes can now be organized into collapsible folders
  - Each folder shows a note count badge
  - Click folder header to expand/collapse
  - Quick [+] button on folder header to create note directly in that folder
  - Folder dropdown selector in editor header (select existing or create new)
  - "+ New Folder..." option in dropdown to create new folders
  - Separate folders for My Notes vs Team Notes tabs
  - Collapsed folder state persists across sessions
  - Existing notes are automatically migrated to "General" folder
- **Dark mode support**: Full WYSIWYG editor and folder styling for dark theme
- **Custom theme support**: Editor and folders respect custom RGB theme

#### User Accounts System (P0 Core)
- **Account-based authentication**: Users can now create accounts with email/password to sync data across devices
- **New AccountService** (`services/account-service.js`): Handles JWT authentication, session management, and data sync
- **Server-side auth endpoints**: Added to Cloudflare Worker:
  - `/auth/setup-token` - Generate registration token after license validation
  - `/auth/register` - Create account with email/password
  - `/auth/login` - Authenticate and receive JWT tokens
  - `/auth/refresh` - Refresh access tokens
  - `/auth/logout` - Invalidate session
  - `/auth/update-grant-key` - Update grant key for Power Users
  - `/auth/forgot-password` - Request password reset email
  - `/auth/reset-password` - Complete password reset with token
- **New database schema**: Added D1 tables for accounts, sessions, notes sync, templates sync, and settings sync
- **Popup UI updates**:
  - Login form for existing account holders
  - Registration form for new users after license validation
  - Logged-in state showing user email and sync status
  - Setup prompt after license validation to encourage account creation
  - **Forgot Password flow**: Request password reset via email
  - **Reset Password form**: Set new password from email link
- **Email integration**: Password reset emails sent via Resend API
- **Security features**:
  - PBKDF2 password hashing with 100k iterations
  - AES-256-GCM encryption for grant keys
  - JWT tokens with short-lived access (15 min) and long-lived refresh (30 days)
  - Secure token storage in `chrome.storage.local`
  - Password reset tokens expire after 1 hour (single-use)
  - All sessions invalidated after password reset
- **Backward compatible**: Existing device-auth users can continue without creating an account

#### Quick Notes Cloud Sync
- **Automatic sync**: Notes automatically sync to cloud when you're logged in
- **Last-write-wins conflict resolution**: When the same note is edited on multiple devices, the most recent edit wins
- **Bidirectional sync**: Push local changes and pull remote changes in a single operation
- **Background sync**: Changes sync automatically after a short delay (3 seconds after last edit)
- **On-demand sync**: Sync triggers when you switch tabs back to JobTread
- **Local-first architecture**: Notes always save locally first, then sync to server
- **Preserves existing notes**: All your existing notes in browser storage are preserved and merged with cloud
- **Server-side endpoints**: Added `/sync/notes`, `/sync/notes/pull`, `/sync/notes/push` endpoints
- **Soft delete support**: Deleted notes sync across devices properly

#### Message Templates Cloud Sync
- **Automatic sync**: Templates from Character Counter automatically sync when logged in
- **Same sync architecture as Quick Notes**: Last-write-wins, bidirectional, background sync
- **Default template syncs**: The default template selection syncs across devices
- **Server-side endpoints**: Added `/sync/templates`, `/sync/templates/pull`, `/sync/templates/push` endpoints
- **Local-first**: Templates save locally first, then sync to cloud
- **Free feature**: Template sync works for all users with an account (doesn't require premium)

#### Team Notes (Shared Notes)
- **New "Team Notes" tab**: Quick Notes now has tabs for "My Notes" (personal) and "Team Notes" (shared)
- **Organization-wide sharing**: Team notes are visible and editable by all users under the same license
- **Real-time attribution**: Each team note shows who created it and who last updated it
- **Server-first sync**: Team notes are stored on the server and refresh when switching tabs or returning to JobTread
- **Debounced saves**: Team note edits are saved automatically after 1 second of inactivity
- **Login prompt**: Team Notes tab shows a helpful sign-in prompt for users not logged in
- **Loading states**: Visual spinner while team notes are loading from server
- **Server-side endpoints**: Added `/sync/team-notes`, `/sync/team-notes/push`, `/sync/team-notes/delete`
- **Database migration**: New `team_notes` table with org scoping and soft delete support
- **Full dark mode support**: Tabs and attribution styled for dark theme

#### MCP Setup Improvements (Power Users)
- **Credentials Display**: MCP tab now shows your License Key and Grant Key status
- **Grant Key Management**: Update your Grant Key directly from the MCP tab when it expires
- **Multi-Platform Config Generator**: Platform selector tabs generate ready-to-use configs for:
  - **Claude Code**: Direct SSE config with headers
  - **Claude Desktop**: mcp-remote wrapper config (npx command)
  - **ChatGPT**: URL and Bearer token format for UI setup
  - **Gemini**: HTTP endpoint config format
- **Platform-specific notes**: Helpful hints and requirements for each platform
- **Enhanced UX**: Clear status indicators and error messages for credential configuration

#### Availability Filter (Pro Feature)
- New filter for the Schedule Availability view to show/hide assignees by role or category
- **Hierarchical filter structure**:
  - **INTERNAL category**: Expandable dropdown with individual roles (e.g., "01 Field", "02 Project Supervisor")
  - **VENDOR category**: Expandable dropdown with individual vendor company names (uses company name, not contact name)
  - **Other categories**: Expandable dropdown with assignee names
  - Click category to toggle all children; click individual items for granular control
  - Partial state indicator (dashed border) shows when some but not all children are selected
  - Role/assignee count badges show selection status (e.g., "3/12")
- Automatically detects roles, vendors, and categories from your organization's assignee structure
- **Saved Views**: Save and load filter configurations via dropdown in header
  - Save current filter state with custom name
  - Load saved views to quickly restore filter configurations
  - Delete saved views when no longer needed
  - Persists across sessions using browser storage
- **Smooth collapse animation**: Filtered-out rows collapse smoothly instead of abruptly disappearing
- **Visual highlight**: Visible (filtered) rows get a subtle blue left border for easy identification
- Filter selections persist across sessions
- Quick actions: "Show All" and "Hide All" buttons
- **Collapsible filter panel**: Entire header bar clickable to expand/collapse; starts collapsed by default
- Full dark mode support (using proper dark grey palette)
- Full RGB/Custom Theme support (uses CSS custom properties)
- Located in Schedule & Calendar category in popup settings

### Improved

#### Dark Mode Colors
- Updated Availability Filter dark mode styling to use proper dark grey colors (#2c2c2c, #252525, #333333) instead of dark blues
- Added Dark Mode Color Palette guide to CLAUDE.md for consistent dark mode styling across all features

#### Custom Theme Support
- Added RGB/Custom Theme support to Availability Filter for consistent theming with user-selected color palettes

#### MCP Documentation
- Added setup guides for MCP server integration:
  - Claude Code setup guide
  - Cursor setup guide
  - ChatGPT setup guide
  - Generic MCP client guide with API documentation
- Fixed MCP guide links in popup to point to correct URLs

### Fixed

#### Quick Notes Editor Fixes
- **Fixed folder showing "[object PointerEvent]"**: The "New Note" button was incorrectly passing the click event object as the folder parameter, causing folders to display as "[object PointerEvent]" instead of "General"
- **Fixed toolbar buttons not working**: Added `mousedown` event handler to prevent toolbar buttons from stealing focus, which was causing formatting commands to fail because the text selection was lost
- **Fixed Quick Notes toolbar affecting Text Formatter**: Quick Notes formatting button state updates now scope queries to its own toolbar, preventing it from accidentally highlighting the Text Formatter toolbar buttons when both features are active on the same page
- **Added Enter key support for lists**: Pressing Enter while in a bullet, numbered, or checkbox item now creates a new list item of the same type on the next line. Numbered lists are automatically renumbered.
- **Fixed checkbox deletion**: Empty checkboxes can now be deleted with Backspace or Delete keys. Empty bullet and numbered list items can also be removed with Backspace.
- **Fixed invalid folder names**: Added automatic cleanup of invalid folder names (like "[object Object]" or "[object PointerEvent]") that may have been created due to the earlier bug. These are now automatically reset to "General" on load.
- **Fixed redo not working**: Redo was broken because undo/redo operations were incorrectly triggering history saves, which cleared the redo stack. Now undo/redo operations are handled separately and don't corrupt the history.
- **Fixed markdown formatting order**: Reordered regex patterns to process strikethrough and underline before bold/italic, preventing incorrect parsing of formatting markers.
- **Improved toolbar button responsiveness**: Formatting buttons (Bold, Italic, etc.) now immediately show active/inactive state after clicking, using `document.queryCommandState()` for accurate detection even when cursor is positioned without text selection.
- **Fixed undo/redo buttons not working**: Switched to browser's native undo/redo commands (`document.execCommand('undo'/'redo')`) which properly track all user edits made during the session.
- **Enhanced active button styling**: Made active formatting buttons more visually prominent with stronger cyan background (`#cffafe`) and a subtle glow effect (`box-shadow`).
- **Fixed formatting in list items**: Formatting buttons (Bold, Italic, etc.) now work correctly inside bullet points, numbered lists, and checkboxes. The selection is preserved and restored before applying formatting commands.
- **Fixed "wall" issue between formatted and unformatted text**: Backspace can now properly cross the boundary between bold/italic/underline text and normal text. Empty formatting elements are automatically cleaned up, preventing invisible barriers that blocked cursor movement.
- **Added Ctrl+click to open links**: Links in Quick Notes can now be opened by Ctrl+clicking (or Cmd+click on Mac) while editing.
- **Added table support**: New table button in toolbar allows inserting markdown tables with customizable rows/columns. Tables are editable directly in the WYSIWYG editor and properly convert to/from markdown format.
- **Removed code button**: Removed the inline code formatting button from the toolbar to simplify the interface.
- **Improved extension context handling**: Quick Notes now gracefully handles extension context invalidation (e.g., after reloading the extension) instead of throwing errors.
- **Fixed resize handle showing on sidebar-only view**: The resize handle is now only visible and functional when a note is open in the editor. Previously it was active even when viewing the sidebar list, causing users to drag an empty area.
- **Added table row/column management**: Right-click on any table cell to add/remove rows and columns via context menu. Options include Add Row Above/Below, Add Column Left/Right, Delete Row, Delete Column, and Delete Table.
- **Added folder colors**: Folders can now be assigned custom colors for visual organization. Click the circle icon next to a folder name to choose from 18 color options. Colored folders display a left border accent and filled color indicator.

---

## [3.5.4] - 2026-02-03 (Beta)

### Added

#### Kanban Task Checkboxes
- Added completion checkboxes to Kanban task cards (To-Dos and Schedule views)
- Click checkbox to toggle task completion without opening the full task details
- Works seamlessly with existing calendar view task checkboxes
- Opens sidebar in background to toggle progress, then automatically closes
- Visual feedback with loading state and completion notifications

### Improved

#### Text Formatter Consistency
- **Budget table**: Floating expanded toolbar now ONLY appears for budget table Description fields
- **All other fields**: Now use embedded compact toolbar (including custom fields on budget page, sidebar fields, messages, etc.)
- **Budget table custom fields**: Internal Notes, custom text fields, and other non-Description fields in the budget table now correctly get NO toolbar (neither embedded nor floating)
- **Filtered budget view**: Floating toolbar is now hidden when cost items are filtered (use the Cost Item Details sidebar to edit descriptions when filtering)
- Embedded toolbars now appear on page load, not just on focus
- Removed redundant `isBudgetCustomField()` logic that was incorrectly giving floating toolbar to non-table fields

#### Mobile Support Foundation
- Increased mobile support functionality for future versions of the extension
- Quick Notes side panel now takes full screen width on mobile devices (max-width: 768px)
- Added back button to navigate from note editor back to notes list on mobile
- Panel layout switches from side-by-side to stacked (vertical) on mobile
- Quick Job Switcher now auto-disables on mobile viewports (≤768px) - keyboard-driven feature doesn't work well on mobile
- Fixed Auto Collapse Completed Groups to work on both desktop and mobile Schedule/Gantt views
- Freeze Header now works on mobile viewports when navigation bar is visible

### Fixed

#### Freeze Header Sidebar Cutoff (Known Issue - Not Yet Fixed)
- **Issue**: When freeze header is active and user is at the top of the page, opening a sidebar (Update Task, Task Details) causes the bottom portion to be cut off
- **Root cause**: JobTread dynamically sets `max-height` and `top` on sidebar elements via JavaScript as the user scrolls
- **Workaround**: User can scroll down slightly on the main page to bring the full sidebar into view

#### Message Templates Dropdown Positioning
- Fixed templates dropdown appearing off-screen in sidebar message forms
- Dropdown now uses fixed positioning and calculates optimal placement
- Opens above or below the button depending on available viewport space

---

## [3.5.1] - 2026-01-24 (Beta)

### Fixed

#### Quick Notes Header Icon Now Persistent
- Removed URL restrictions that prevented Quick Notes icon from appearing on certain JobTread pages
- Quick Notes header icon now visible on all JobTread pages (settings, home, account pages, etc.)
- Previously only showed on specific pages like /jobs, /schedule, /messages, etc.

#### Message Templates & Character Counter Positioning
- Templates dropdown now appears inline to the left of the Send button on dashboard and sidebar message forms
- Character counter now appears below the toolbar (under upload buttons) to avoid crowding the Send button
- Split positioning: Templates stay by Send button, counter goes below on its own row

### Improved

#### Message Templates Button Styling
- Redesigned Templates and Settings buttons to match JobTread's native button styling (upload/copy/gif buttons)
- Added Phosphor-style SVG icons: document icon for Templates, gear icon for Settings
- Removed text labels and dropdown arrows for a cleaner icon-only appearance
- Removed gray background wrapper from buttons and character counter for cleaner appearance
- Full compatibility with Dark Mode and Custom Theme (RGB Theme)
- Buttons now appear as a connected button group matching JobTread's design language

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

[3.6.3]: https://github.com/King0lightai/JT-Power-Tools/releases/tag/v3.6.3
[3.6.2]: https://github.com/King0lightai/JT-Power-Tools/releases/tag/v3.6.2
[3.6.1]: https://github.com/King0lightai/JT-Power-Tools/releases/tag/v3.6.1
[3.6.0]: https://github.com/King0lightai/JT-Power-Tools/releases/tag/v3.6.0
[3.5.4]: https://github.com/King0lightai/JT-Power-Tools/releases/tag/v3.5.4
[3.5.1]: https://github.com/King0lightai/JT-Power-Tools/releases/tag/v3.5.1
[3.5.0]: https://github.com/King0lightai/JT-Power-Tools/releases/tag/v3.5.0
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
