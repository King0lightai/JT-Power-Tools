# Feature Ideas for JT Power Tools

## Budget Group Hierarchy Shading

### Problem Statement
JobTread allows budget items to be nested up to 5 groups deep. When all group cells use the same color, it becomes difficult to navigate and understand the hierarchy at a glance.

### Proposed Solution
Implement progressive shading for each nesting level to provide clear visual hierarchy:

- **Level 1** (Top level): Lightest/darkest shade
- **Level 2**: Slightly darker/lighter shade
- **Level 3**: Medium shade
- **Level 4**: Deeper shade
- **Level 5** (Deepest): Most prominent shade

### Requirements
1. Should work with both Dark Mode and Custom Theme features
2. Each nesting level should have a dedicated, consistent shade
3. Shading should adapt to the current theme (dark mode vs light mode vs custom colors)
4. Progressive shading should make it easy to identify depth at a glance

### Implementation Approach
Once HTML samples are provided, implement as a new feature module:

**File**: `features/budget-hierarchy.js`

**Key Functionality**:
- Detect nesting level of budget group cells
- Apply appropriate shade based on level (1-5)
- Generate shade variations that work with:
  - Light mode (default)
  - Dark mode
  - Custom theme colors
- Use CSS custom properties for theme integration
- Observe DOM changes to maintain shading on dynamic updates

**Integration Points**:
- Should coordinate with `dark-mode.js` to detect current mode
- Should coordinate with `rgb-theme.js` to adapt to custom colors
- May need to extend existing theme CSS generation

### CSS Strategy
```css
/* Example approach - will refine based on HTML structure */
.budget-group-level-1 { background: var(--budget-shade-1) !important; }
.budget-group-level-2 { background: var(--budget-shade-2) !important; }
.budget-group-level-3 { background: var(--budget-shade-3) !important; }
.budget-group-level-4 { background: var(--budget-shade-4) !important; }
.budget-group-level-5 { background: var(--budget-shade-5) !important; }
```

### Theme Adaptation
Generate shade variations programmatically:
- **Light Mode**: Base color → progressively darker shades
- **Dark Mode**: Base color → progressively lighter/darker shades
- **Custom Theme**: User's background color → generate 5 progressive shades

### Next Steps
1. ✅ Document feature idea
2. ⏳ Await HTML samples from user
3. ⏳ Analyze HTML structure and identify group nesting indicators
4. ⏳ Create `budget-hierarchy.js` feature module
5. ⏳ Integrate with existing theme system
6. ⏳ Add toggle control in popup UI
7. ⏳ Test with all theme modes

### Status
**Status**: Awaiting HTML samples

**Created**: 2025-11-05

---

## Other Feature Ideas

(Add additional feature ideas below as they come up)
