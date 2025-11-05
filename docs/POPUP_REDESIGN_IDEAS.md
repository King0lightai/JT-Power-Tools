# Popup UI Redesign Proposals

## Problem Statement
With 9+ features (and growing), the single-list popup becomes cluttered and overwhelming. Users need a more organized, scannable interface to manage features.

## Current Structure
- Single vertical list of 6+ feature toggles
- Custom Theme expands into its own panel
- No categorization or grouping

---

## Proposed Solutions

### Option 1: Tabbed Categories (By Feature Type)

Organize features into logical categories with tabs at the top.

**Tabs:**
- **Schedule** - Calendar and schedule-specific features
- **Productivity** - Tools that boost workflow efficiency
- **Appearance** - Visual themes and styling

**Tab: Schedule**
- Schedule Drag & Drop (Premium)
- Task Duration Adjustment (Premium)
- Infinite Calendar Scroll (Premium)

**Tab: Productivity**
- Text Formatter
- Quick Job Switcher

**Tab: Appearance**
- Contrast Fix
- Dark Mode
- Custom Theme (Premium)
  - Expands to color pickers when enabled
- Budget Hierarchy Shading

**Pros:**
- Clear separation by feature domain
- Familiar tab pattern
- Scalable for future features
- Keeps related features together

**Cons:**
- Requires extra click to switch tabs
- Some features might fit in multiple categories

---

### Option 2: Collapsible Sections (Accordion Style)

Keep single-page scrollable view but organize into collapsible sections.

**Sections:**
1. **🗓️ Schedule & Calendar** (collapsed by default)
   - Schedule Drag & Drop (Premium)
   - Task Duration Adjustment (Premium)
   - Infinite Calendar Scroll (Premium)

2. **⚡ Productivity Tools** (collapsed by default)
   - Text Formatter
   - Quick Job Switcher

3. **🎨 Appearance & Themes** (collapsed by default)
   - Contrast Fix
   - Dark Mode
   - Custom Theme (Premium)
   - Budget Hierarchy Shading

**Pros:**
- No tab switching - all on one page
- Users can expand multiple sections at once
- Visual hierarchy with section headers
- Quick overview when all collapsed

**Cons:**
- Requires expanding/collapsing sections
- Can still get long if all expanded

---

### Option 3: Context-Based Organization (By JobTread Page)

Organize by where features are used in JobTread.

**Categories:**
1. **Schedule View Features**
   - Schedule Drag & Drop (Premium)
   - Task Duration Adjustment (Premium)
   - Infinite Calendar Scroll (Premium)

2. **Budget View Features**
   - Budget Hierarchy Shading
   - Text Formatter

3. **Global Features** (work everywhere)
   - Quick Job Switcher
   - Contrast Fix
   - Dark Mode
   - Custom Theme (Premium)

**Pros:**
- Users know exactly where each feature works
- Helps users discover relevant features for current page
- Clear expectations

**Cons:**
- Some features work in multiple places (Text Formatter)
- Less intuitive categorization for new users

---

### Option 4: Two-Column Layout

Split features into two columns for more compact view.

**Left Column:**
- Schedule Drag & Drop (Premium)
- Task Duration Adjustment (Premium)
- Infinite Calendar Scroll (Premium)
- Text Formatter
- Quick Job Switcher

**Right Column:**
- Contrast Fix
- Dark Mode
- Custom Theme (Premium)
- Budget Hierarchy Shading

**Pros:**
- More features visible at once
- Compact, efficient use of space
- No extra clicks for tabs/sections

**Cons:**
- Narrower columns = cramped text
- No logical grouping
- Hard to scale for mobile/small screens
- Custom theme panel would still need to expand full-width

---

### Option 5: Hybrid: Tabs + Collapsible Sections

Combine tabs for major categories with collapsible sub-sections where needed.

**Tabs:**
- **Features** (main features tab)
- **Appearance** (dedicated tab for themes)
- **License** (stays separate)

**Features Tab:**
```
🗓️ Schedule & Calendar ▼
  ☐ Schedule Drag & Drop (Premium)
  ☐ Task Duration Adjustment (Premium)
  ☐ Infinite Calendar Scroll (Premium)

⚡ Productivity ▼
  ☐ Text Formatter
  ☐ Quick Job Switcher

📊 Budget Tools ▼
  ☐ Budget Hierarchy Shading
```

**Appearance Tab:**
```
☐ Contrast Fix
☐ Dark Mode
☐ Custom Theme (Premium)
  [Color pickers expand here]
```

**Pros:**
- Best of both worlds
- Cleanest organization
- Scalable for many features
- Keeps complex theme UI separate

**Cons:**
- Most complex to implement
- Multiple interaction patterns

---

## Recommended Approach

**Recommendation: Option 2 (Collapsible Sections)**

Why this option works best:
1. **Simplest to implement** - No routing, just show/hide logic
2. **Single page** - Users see all sections at once when scanning
3. **Familiar pattern** - Accordion UI is well-understood
4. **Scalable** - Easy to add new sections or features
5. **Flexible** - Users can expand multiple sections if needed
6. **No navigation friction** - Unlike tabs, no context switching

### Implementation Details

**HTML Structure:**
```html
<div class="features-section">

  <!-- Schedule & Calendar Section -->
  <div class="feature-category">
    <div class="category-header" data-category="schedule">
      <span class="category-icon">🗓️</span>
      <span class="category-title">Schedule & Calendar</span>
      <span class="category-count">3</span>
      <span class="category-toggle">▼</span>
    </div>
    <div class="category-features" data-category-content="schedule">
      <div class="feature-item premium">...</div>
      <div class="feature-item premium">...</div>
      <div class="feature-item premium">...</div>
    </div>
  </div>

  <!-- Productivity Section -->
  <div class="feature-category">
    <div class="category-header" data-category="productivity">
      <span class="category-icon">⚡</span>
      <span class="category-title">Productivity Tools</span>
      <span class="category-count">2</span>
      <span class="category-toggle">▼</span>
    </div>
    <div class="category-features" data-category-content="productivity">
      <div class="feature-item">...</div>
      <div class="feature-item">...</div>
    </div>
  </div>

  <!-- Appearance Section -->
  <div class="feature-category">
    <div class="category-header" data-category="appearance">
      <span class="category-icon">🎨</span>
      <span class="category-title">Appearance & Themes</span>
      <span class="category-count">4</span>
      <span class="category-toggle">▼</span>
    </div>
    <div class="category-features" data-category-content="appearance">
      <div class="feature-item">...</div>
      <div class="feature-item">...</div>
      <div class="feature-item premium">...</div>
      <div class="feature-item">...</div>
    </div>
  </div>

</div>
```

**CSS Styling:**
```css
.feature-category {
  border-bottom: 1px solid #e8e8e8;
}

.category-header {
  display: flex;
  align-items: center;
  padding: 14px 20px;
  cursor: pointer;
  background: #fafafa;
  transition: background 0.1s ease;
}

.category-header:hover {
  background: #f5f5f5;
}

.category-icon {
  font-size: 16px;
  margin-right: 10px;
}

.category-title {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  color: #1a1a1a;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.category-count {
  font-size: 10px;
  color: #999;
  background: #ffffff;
  padding: 2px 6px;
  border-radius: 10px;
  margin-right: 8px;
}

.category-toggle {
  font-size: 10px;
  color: #666;
  transition: transform 0.2s ease;
}

.category-header.collapsed .category-toggle {
  transform: rotate(-90deg);
}

.category-features {
  max-height: 1000px;
  overflow: hidden;
  transition: max-height 0.3s ease;
}

.category-features.collapsed {
  max-height: 0;
}

/* Feature items inside categories */
.category-features .feature-item {
  border-bottom: 1px solid #f5f5f5;
  background: #ffffff;
}

.category-features .feature-item:last-child {
  border-bottom: none;
}
```

**JavaScript Logic:**
```javascript
// Initialize all sections as expanded
document.querySelectorAll('.category-header').forEach(header => {
  header.addEventListener('click', () => {
    const category = header.dataset.category;
    const content = document.querySelector(`[data-category-content="${category}"]`);

    // Toggle collapsed state
    header.classList.toggle('collapsed');
    content.classList.toggle('collapsed');

    // Save state to chrome.storage
    chrome.storage.local.set({
      [`category_${category}_collapsed`]: header.classList.contains('collapsed')
    });
  });

  // Restore state from storage
  const category = header.dataset.category;
  chrome.storage.local.get(`category_${category}_collapsed`, (result) => {
    if (result[`category_${category}_collapsed`]) {
      header.classList.add('collapsed');
      document.querySelector(`[data-category-content="${category}"]`).classList.add('collapsed');
    }
  });
});
```

---

## Visual Mockup (Option 2 - Recommended)

```
┌─────────────────────────────────────┐
│  JT Power Tools              v3.2.0 │
├─────────────────────────────────────┤
│                                     │
│  🗓️ SCHEDULE & CALENDAR      3   ▼  │
│  ┌───────────────────────────────┐ │
│  │ Schedule Drag & Drop  Premium │ │
│  │ Change dates in month view  ◉ │ │
│  ├───────────────────────────────┤ │
│  │ Task Duration Adjustment      │ │
│  │ Drag edges to resize days  ○  │ │
│  ├───────────────────────────────┤ │
│  │ Infinite Calendar Scroll      │ │
│  │ Auto-load next/prev months ○  │ │
│  └───────────────────────────────┘ │
│                                     │
│  ⚡ PRODUCTIVITY TOOLS        2   ▼  │
│  ┌───────────────────────────────┐ │
│  │ Text Formatter                │ │
│  │ Rich text toolbar          ◉  │ │
│  ├───────────────────────────────┤ │
│  │ Quick Job Switcher            │ │
│  │ Alt+J to search jobs       ◉  │ │
│  └───────────────────────────────┘ │
│                                     │
│  🎨 APPEARANCE & THEMES      4   ▼  │
│  ┌───────────────────────────────┐ │
│  │ Contrast Fix                  │ │
│  │ Better text readability    ○  │ │
│  ├───────────────────────────────┤ │
│  │ Dark Mode                     │ │
│  │ Dark theme for interface   ○  │ │
│  ├───────────────────────────────┤ │
│  │ Custom Theme          Premium │ │
│  │ Personalize colors         ○  │ │
│  ├───────────────────────────────┤ │
│  │ Budget Hierarchy Shading      │ │
│  │ Visual nesting depth       ○  │ │
│  └───────────────────────────────┘ │
│                                     │
├─────────────────────────────────────┤
│      [ Refresh Current Tab ]        │
│                                     │
│  PREMIUM LICENSE                    │
│  ┌───────────────────────────────┐ │
│  │ ✓ License Active              │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

## Migration Plan

1. Update `popup.html` with new collapsible structure
2. Add category CSS to `popup.css`
3. Update `popup.js` with collapse/expand logic
4. Migrate existing toggles into appropriate categories
5. Test all features still work after reorganization
6. Update version to v3.2.0 (UI redesign)

---

## Future Considerations

As features grow, we can:
- Add search/filter for features
- Show only enabled features in collapsed view
- Add "Enable All" / "Disable All" per category
- Highlight categories with enabled features
- Add category-specific settings/options

---

## Status
**Status**: Proposed - awaiting user approval

**Created**: 2025-11-05
