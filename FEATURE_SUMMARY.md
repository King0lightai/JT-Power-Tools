# JT Power Tools - Feature Summary

## Overview

**JT Power Tools** transforms JobTread from good to incredible. Rich text formatting, dark mode, keyboard shortcuts, and workflow automation—all designed by contractors, for contractors.

**All licenses are company-wide. One purchase covers your entire team.**

- **Platform:** Chrome Extension (Manifest V3)
- **Target:** JobTread web app (`app.jobtread.com`)
- **Chrome Web Store:** [Install Here](https://chromewebstore.google.com/detail/jt-power-tools/kfbcifdgmcendohejbiiojjkgdbjkpcn)

---

## Pricing Tiers

### FREE (No License Required)

| Feature | Description |
|---------|-------------|
| **Dark Mode** | Complete dark theme for reduced eye strain |
| **Text Formatter** | Rich text toolbar for descriptions & notes |
| **Month View Contrast Fix** | Auto-adjusts text colors for readability on colored backgrounds |
| **Character Counter** | Real-time character count in message fields |
| **Message Signature** | Auto-append signatures to messages |
| **Budget Hierarchy Shading** | Visual depth indicators for nested budget groups (up to 5 levels) |
| **Kanban Type Filter** | Auto-hide empty columns when grouping by type |
| **Auto Collapse Groups** | Automatically collapse 100% complete budget sections |

---

### ESSENTIAL

*Everything in FREE, plus:*

| Feature | Description |
|---------|-------------|
| **Quick Notes** | Persistent notepad with cross-device sync via Chrome |
| **Smart Job Switcher** | Keyboard shortcut (`J+S` or `Alt+J`) for instant job navigation |
| **Freeze Header** | Sticky column/row headers when scrolling tables |
| **PDF Markup Tools** | Stamps & eraser for PDF annotations |

---

### PRO

*Everything in Essential, plus:*

| Feature | Description |
|---------|-------------|
| **Schedule Task Checkboxes** | Check off schedule items directly from the schedule view |
| **Custom Color Themes** | Personalize JobTread with custom colors (save up to 3 themes) |
| **Preview Mode** | Live markdown rendering for text fields with floating preview panel |

---

### POWER USER

*Everything in Pro, plus:*

| Feature | Description |
|---------|-------------|
| **Custom Field Filter** | Filter Job Switcher results by custom field values |
| **MCP Server Access** | AI integration capabilities (Coming Soon) |
| **Priority Support** | Fast-track issue resolution |

---

## Feature Details

### Productivity Tools

| Feature | Tier | Keyboard Shortcut | Description |
|---------|------|-------------------|-------------|
| **Smart Job Switcher** | Essential+ | `J+S` or `Alt+J` | Instantly search and navigate to any job with real-time filtering |
| **Quick Notes** | Essential+ | `Ctrl+Shift+N` | Persistent notepad accessible from any page with markdown support |
| **Text Formatter** | Free | `Ctrl+B/I/U` | Rich text toolbar with bold, italic, headings, tables, links, alerts |
| **Character Counter** | Free | Automatic | Shows real-time character count in message fields |
| **Message Signature** | Free | Automatic | Auto-appends your signature to outgoing messages |
| **Schedule Task Checkboxes** | Pro+ | Click to toggle | Mark schedule items complete directly from the schedule |

### Visual Enhancements

| Feature | Tier | Description |
|---------|------|-------------|
| **Dark Mode** | Free | Complete dark theme for the entire JobTread interface |
| **Month View Contrast Fix** | Free | WCAG-compliant text color adjustment on colored schedule items |
| **Budget Hierarchy Shading** | Free | Progressive shading for nested budget groups (5 levels) |
| **Custom Color Themes** | Pro+ | HSL-based color palette generation with 3 save slots |
| **Freeze Header** | Essential+ | Sticky headers while scrolling large budget/cost tables |

### Workflow Optimization

| Feature | Tier | Description |
|---------|------|-------------|
| **Kanban Type Filter** | Free | Automatically hides empty columns in Kanban view |
| **Auto Collapse Groups** | Free | Collapses 100% complete budget groups on page load |
| **PDF Markup Tools** | Essential+ | Add stamps and use eraser on PDF documents |
| **Custom Field Filter** | Power User | Filter Job Switcher by any custom field value |
| **Preview Mode** | Pro+ | Live preview of formatted text in floating panel |

---

## Feature Deep Dives

### Smart Job Switcher

The power-user's best friend for navigating large job lists.

**How to use:**
1. Press `J+S` (tap J then S quickly) or `Alt+J` from any JobTread page
2. Start typing to filter jobs by name or number
3. Press `Enter` to navigate to the top result
4. Press `Escape` to close

**Capabilities:**
- Real-time search filtering
- Resizable sidebar (width remembered across sessions)
- Job status filtering (Open/Closed/All)
- Custom Field filtering (Power User tier)

---

### Text Formatter

Microsoft Word-style formatting toolbar for JobTread text fields.

**Formatting Options:**

| Category | Options |
|----------|---------|
| Text Styles | Bold, Italic, Underline, Strikethrough |
| Headings | H1, H2, H3 |
| Lists | Bullet points, Numbered lists |
| Alignment | Left, Center, Right |
| Advanced | Tables, Links, Blockquotes, Code blocks |
| Alerts | Info, Warning, Success, Error callout boxes |

**Keyboard Shortcuts:**
- `Ctrl/Cmd + B` - Bold
- `Ctrl/Cmd + I` - Italic
- `Ctrl/Cmd + U` - Underline

---

### Quick Notes

Personal notepad that persists across all JobTread pages.

**How to use:**
1. Press `Ctrl+Shift+N` or click "Quick Notes" in the header
2. Click "New Note" to create a note
3. Type with markdown formatting support
4. Search across all notes with the search bar

**Capabilities:**
- Unlimited notes
- Rich markdown formatting with WYSIWYG editor
- Full-text search
- Cross-device sync via Chrome
- Resizable sidebar panel

---

### Custom Color Themes

Personalize JobTread with your own color palette.

**How to use:**
1. Open extension popup
2. Navigate to Custom Theme section
3. Choose primary, background, and accent colors
4. Save to one of 3 theme slots
5. Switch between saved themes anytime

**Features:**
- HSL-based palette generation for consistent theming
- Live preview as you adjust colors
- 3 save slots for different themes

---

### Freeze Header

Keep table headers visible while scrolling through large datasets.

**Supported areas:**
- Budget tables
- Cost tracking tables
- Any scrollable JobTread table

**Behavior:**
- Column headers stay fixed during vertical scroll
- Row headers stay fixed during horizontal scroll
- Seamless integration with existing interactions

---

## Technical Specifications

| Specification | Details |
|---------------|---------|
| **Platform** | Chrome Extension (Manifest V3) |
| **Target** | JobTread web app (`app.jobtread.com`) |
| **Size** | ~850KB |
| **Permissions** | `storage`, `activeTab`, host permission for JobTread only |
| **Backend** | Cloudflare Workers + D1 Database (for premium API features) |
| **API Usage** | Read-only JobTread Pave API queries |

---

## Installation

### From Chrome Web Store (Recommended)

1. Visit [Chrome Web Store listing](https://chromewebstore.google.com/detail/jt-power-tools/kfbcifdgmcendohejbiiojjkgdbjkpcn)
2. Click "Add to Chrome"
3. Navigate to JobTread (`app.jobtread.com`)
4. Click the extension icon to configure features

### Activate Premium Features

1. Purchase a license at [Gumroad](https://lightking7.gumroad.com/l/jtpowertools)
2. Open the extension popup
3. Scroll to the "Premium License" section
4. Enter your license key and click "Verify"
5. Premium features unlock immediately

---

## Support & Resources

| Resource | Link |
|----------|------|
| Documentation | [jtpowertools.com](https://king0lightai.github.io/JT-Power-Tools/) |
| Feature Guides | [Installation Guide](https://king0lightai.github.io/JT-Power-Tools/guides/installation.html) |
| Report Issues | [GitHub Issues](https://github.com/King0lightai/JT-Power-Tools/issues) |
| Changelog | [Version History](https://king0lightai.github.io/JT-Power-Tools/changelog.html) |
| Purchase License | [Gumroad](https://lightking7.gumroad.com/l/jtpowertools) |

---

## Company-Wide Licensing

All JT Power Tools licenses are **company-wide**:

- One purchase covers your entire JobTread organization
- Team members verify access with their own JobTread Grant Key
- "Proof of Org" security ensures only legitimate team members can use the license
- No per-seat fees or user limits

---

*Built for the JobTread community by contractors who use it every day.*
