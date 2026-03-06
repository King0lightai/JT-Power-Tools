# JT Power Tools

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Install-brightgreen?logo=googlechrome)](https://chromewebstore.google.com/detail/jt-power-tools/kfbcifdgmcendohejbiiojjkgdbjkpcn)
[![Version](https://img.shields.io/badge/version-V3.6-blue)](https://chromewebstore.google.com/detail/jt-power-tools/kfbcifdgmcendohejbiiojjkgdbjkpcn)
[![Changelog](https://img.shields.io/badge/changelog-view-orange)](https://king0lightai.github.io/JT-Power-Tools/changelog.html)

An all-in-one Chrome extension toolkit for JobTread with toggleable features and a sleek control panel.

**[Install from Chrome Web Store](https://chromewebstore.google.com/detail/jt-power-tools/kfbcifdgmcendohejbiiojjkgdbjkpcn)**

## Features

### FREE (No License Required)

| Feature | Description |
|---------|-------------|
| **Text Formatter** | Rich text toolbar for budgets, logs & tasks |
| **Message Counter & Templates** | Create, save and paste signatures and messages |
| **Contrast Fix** | WCAG-compliant text readability in schedule views |
| **Dark Mode** | Dark theme for the JobTread interface |
| **Budget Hierarchy Shading** | Visual shading for nested budget groups |
| **Kanban Type Filter** | Auto-hide empty type columns in Kanban view |
| **Auto Collapse Completed Groups** | Collapse 100% complete groups on page load |
| **Fat Gantt** | Thicker dependency lines for easier clicking |

### Essential ($10/mo per company)

Everything in FREE, plus:

| Feature | Description |
|---------|-------------|
| **Quick Job Switcher** | Keyboard-driven job search (J+S or Alt+J) |
| **Quick Notes** | Persistent notepad accessible from any page (Q+N) |
| **Freeze Header** | Keep job tabs visible while scrolling |
| **PDF Markup Tools** | Stamp selector and eraser tools for PDFs |
| **Reverse Thread Order** | Newest messages and reply form at the top |

### Pro ($20/mo per company)

Everything in Essential, plus:

| Feature | Description |
|---------|-------------|
| **Schedule Task Checkboxes** | Mark task cards complete from calendar and action items |
| **Custom Theme** | Personalize with your own color palette and save up to 3 themes |
| **Preview Mode** | Live rendered preview of formatted text |
| **Availability Filter** | Filter assignees by role or category in availability view |

### Power User ($30/mo per company)

Everything in Pro, plus:

| Feature | Description |
|---------|-------------|
| **Custom Field Filter** | Filter jobs by custom fields in Quick Job Switcher |
| **Budget Changelog** | Compare budget backups and see what changed |
| **MCP Server Access** | Connect AI assistants (Claude, ChatGPT, Cursor, Gemini) to JobTread data |

## Project Structure

```
JT-Tools-Master/
├── manifest.json                # Extension manifest (Manifest V3)
├── content.js                   # Main orchestrator script
├── popup/
│   ├── popup.html               # Settings UI
│   ├── popup.js                 # Settings logic
│   └── popup.css                # Settings styling
├── background/
│   ├── service-worker.js        # Background service worker
│   └── background.js            # Background utilities
├── features/
│   ├── formatter.js             # Text Formatter
│   ├── formatter-modules/       # Formatter sub-modules (toolbar, formats, detection, alert-modal)
│   ├── character-counter.js     # Message Counter & Templates
│   ├── contrast-fix.js          # Contrast Fix
│   ├── dark-mode.js             # Dark Mode
│   ├── budget-hierarchy.js      # Budget Hierarchy Shading
│   ├── kanban-type-filter.js    # Kanban Type Filter
│   ├── auto-collapse-groups.js  # Auto Collapse Completed Groups
│   ├── gantt-lines.js           # Fat Gantt
│   ├── job-switcher.js          # Quick Job Switcher
│   ├── quick-notes.js           # Quick Notes
│   ├── quick-notes-modules/     # Quick Notes sub-modules (editor, storage, markdown)
│   ├── freeze-header.js         # Freeze Header
│   ├── pdf-markup-tools.js      # PDF Markup Tools
│   ├── reverse-thread-order.js  # Reverse Thread Order
│   ├── drag-drop.js             # Schedule Task Checkboxes
│   ├── drag-drop-modules/       # Drag & Drop sub-modules
│   ├── rgb-theme.js             # Custom Theme
│   ├── rgb-theme-modules/       # Theme sub-modules (palette)
│   ├── preview-mode.js          # Preview Mode
│   ├── availability-filter.js   # Availability Filter
│   ├── custom-field-filter.js   # Custom Field Filter
│   ├── budget-changelog.js      # Budget Changelog
│   ├── budget-changelog-modules/# Changelog sub-modules (csv-parser, diff-engine, ui)
│   └── help-sidebar-support.js  # Help Sidebar Integration (always on)
├── services/
│   ├── license.js               # License validation
│   ├── account-service.js       # Account management
│   ├── jobtread-api.js          # JobTread API client
│   └── jobtread-pro-service.js  # Pro feature services
├── utils/
│   ├── defaults.js              # Default settings
│   ├── storage-wrapper.js       # Chrome storage abstraction
│   ├── color-utils.js           # Color manipulation helpers
│   ├── dom-helpers.js           # DOM utility functions
│   ├── debounce.js              # Debounce utility
│   ├── sanitizer.js             # Input sanitization
│   ├── error-handler.js         # Error handling
│   ├── logger.js                # Logging utility
│   └── browser-polyfill.js      # Cross-browser compatibility
├── styles/
│   ├── formatter-toolbar.css    # Formatter toolbar styles
│   ├── preview-mode.css         # Preview Mode styles
│   ├── quick-notes.css          # Quick Notes styles
│   ├── dark-mode.css            # Dark Mode styles
│   ├── gantt-lines.css          # Fat Gantt styles
│   └── availability-filter.css  # Availability Filter styles
├── config/
│   └── worker-config.js         # Worker configuration
└── icons/                       # Extension icons (16, 48, 128 in light/dark)
```

## Support

- Issues & feature requests: [GitHub Issues](https://github.com/King0lightai/JT-Tools/issues)
- License & upgrades: [Gumroad](https://lightking7.gumroad.com/l/jtpowertools)
- Changelog: [View changelog](https://king0lightai.github.io/JT-Power-Tools/changelog.html)

## License

MIT License - See [LICENSE](LICENSE) file for details.
