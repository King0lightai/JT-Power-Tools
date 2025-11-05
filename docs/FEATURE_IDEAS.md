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

## Schedule Drag & Drop Enhancements

### 1. Task Duration Adjustment (Edge Dragging)

#### Problem Statement
Currently, users can drag entire task cards to change start dates, but there's no visual way to adjust the duration (number of days) of a task directly in the month view.

#### Proposed Solution
Add a clickable edge button/handle on the right side of task cards in the month view that allows users to:
- **Drag right**: Expand the task to span more days (increase duration)
- **Drag left**: Reduce the task to span fewer days (decrease duration)

#### Key Features
- Visual handle/indicator on right edge of task cards
- Drag interaction updates task duration dynamically
- Leverage existing date detection logic from current drag-drop implementation
- Works seamlessly with existing start date drag-drop functionality
- Visual feedback during drag (e.g., preview of new end date)

#### Implementation Approach

**Integration with existing `drag-drop.js`**:
- Add edge handle detection to existing event handlers
- Reuse date calculation logic from `drag-drop-modules/date-utils.js`
- Extend `drag-drop-modules/event-handlers.js` for edge drag events
- Update task end date instead of start date

**Visual Design**:
```css
/* Edge handle styling */
.task-card-resize-handle {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: ew-resize;
  background: rgba(255, 255, 255, 0.3);
  opacity: 0;
  transition: opacity 0.2s;
}

.task-card:hover .task-card-resize-handle {
  opacity: 1;
}
```

**Logic Flow**:
1. User hovers over task card → edge handle becomes visible
2. User clicks and drags edge handle right/left
3. Calculate target date cell based on mouse position
4. Calculate new duration (days between start and target)
5. Update task end date via JobTread's API/form
6. Visual feedback shows expanding/contracting task span

#### Benefits
- Intuitive duration adjustment without opening task details
- Maintains consistency with existing drag-drop UX
- Reduces clicks for common task management operations
- Visual representation matches the change being made

#### Status
**Status**: Feature idea documented

**Created**: 2025-11-05

---

### 2. Infinite Calendar Scroll

#### Problem Statement
In JobTread's month view, users can scroll down to see the next 3 months, but then must manually click navigation buttons to continue viewing future/past months. This creates friction when planning across many months.

#### Proposed Solution
Implement infinite scroll for the calendar month view:
- **Scroll down** to bottom → automatically click "next month" button → load next month
- **Scroll up** to top → automatically click "previous month" button → load previous month
- Creates seamless infinite scrolling experience through calendar

#### Key Features
- Automatic month navigation when reaching scroll boundaries
- Bidirectional (both forward and backward in time)
- Smooth transition without jarring jumps
- Preserves existing manual navigation options
- Works alongside existing drag-drop functionality

#### Implementation Approach

**Detection Strategy**:
```javascript
// Pseudo-code for scroll detection
function handleScroll() {
  const container = document.querySelector('[calendar-container-selector]');
  const scrollTop = container.scrollTop;
  const scrollHeight = container.scrollHeight;
  const clientHeight = container.clientHeight;

  // Near bottom - load next month
  if (scrollHeight - scrollTop - clientHeight < 100) {
    clickNextMonthButton();
  }

  // Near top - load previous month
  if (scrollTop < 100) {
    clickPreviousMonthButton();
  }
}
```

**Technical Considerations**:
- Debounce scroll events to prevent rapid button clicking
- Maintain scroll position after month transition
- Handle asynchronous month loading (wait for DOM updates)
- Identify correct next/previous month buttons
- Prevent infinite loops if content doesn't fill viewport

**Integration Points**:
- New module: `drag-drop-modules/infinite-scroll.js`
- Coordinate with existing drag-drop observers
- Share utilities from `drag-drop-modules/ui-utils.js`

**User Experience**:
1. User scrolls down through visible months
2. Approaching bottom (e.g., 100px threshold)
3. Extension automatically clicks "next month" button
4. New month loads and appears at bottom
5. Scroll position maintained for smooth continuation
6. Reverse behavior when scrolling up

#### Benefits
- Eliminates manual navigation friction
- Better for long-term planning across many months
- Familiar pattern (similar to social media infinite scroll)
- Maintains all existing functionality
- Optional enhancement (can be toggled on/off)

#### Challenges to Consider
- JobTread's month loading may be async - need to wait for completion
- Scroll position management during transitions
- Performance with many months loaded
- May need to implement "unload" logic for months far from viewport

#### Status
**Status**: Feature idea documented

**Created**: 2025-11-05

---

## Other Feature Ideas

(Add additional feature ideas below as they come up)
