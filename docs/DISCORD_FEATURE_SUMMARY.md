# 🚀 JT Power Tools - Upcoming Features Preview

Hey everyone! Excited to share what's coming to JT Power Tools. Here's a sneak peek at the features we're exploring based on your feedback and needs.

---

## 🎨 **Budget Group Hierarchy Shading**

**The Problem:** Budget items can nest up to 5 levels deep, but everything looks the same - makes it hard to see the structure at a glance.

**The Solution:** Each nesting level gets its own shade automatically!
- Level 1 (top): Lightest shade
- Level 2: Slightly darker
- Level 3: Medium shade
- Level 4: Deeper shade
- Level 5 (deepest): Darkest shade

Works with Light Mode, Dark Mode, AND Custom Themes - the shading adapts automatically so you always have clear visual hierarchy.

**Status:** Waiting on HTML samples from JobTread to implement

---

## 📅 **Schedule Drag & Drop Enhancements**

### 1. Task Duration Adjustment (Edge Dragging)

**What it does:** Drag the right edge of task cards to make them longer or shorter!
- Drag **right** → task spans more days
- Drag **left** → task spans fewer days

Think of it like resizing a window - grab the edge and stretch/shrink the task duration visually.

**Why it's cool:** No more opening task details just to adjust how many days something takes. Do it right in the calendar view!

### 2. Infinite Calendar Scroll

**What it does:** Never click "next month" again!
- Scroll down to the bottom → automatically loads next month
- Scroll up to the top → automatically loads previous month
- Seamless infinite scrolling through your calendar

**Why it's cool:** Planning across multiple months becomes effortless. Just keep scrolling!

**Status:** Both features ready for implementation

---

## 🎛️ **Popup UI Redesign**

**The Problem:** With 9+ features, the popup is getting crowded and hard to scan.

**The Solution:** Organize features into collapsible sections!

```
🗓️ SCHEDULE & CALENDAR (3)
  ▼ Click to expand/collapse
  - Schedule Drag & Drop (Premium)
  - Task Duration Adjustment (Premium)
  - Infinite Calendar Scroll (Premium)

⚡ PRODUCTIVITY TOOLS (2)
  ▼ Click to expand/collapse
  - Text Formatter
  - Quick Job Switcher

🎨 APPEARANCE & THEMES (4)
  ▼ Click to expand/collapse
  - Contrast Fix
  - Dark Mode
  - Custom Theme (Premium)
  - Budget Hierarchy Shading
```

- Clean, organized categories
- See feature counts at a glance
- Expand only what you need
- Remembers your preferences
- Easy to add new features without clutter

**Status:** Design complete, ready to implement

---

## 💎 **Premium Features (Coming Soon)**

### 1. Budget Change Tracker

**What it does:** Complete audit log of every budget change
- WHO changed it
- WHAT they changed
- WHEN they changed it
- WHY they changed it (optional note)
- Old value → New value

Click an icon next to any edited cell to see its full history. Export the changelog for clients or accounting.

**Why go premium for this:**
- Accountability for teams
- Prevents disputes ("Who changed this?")
- Audit compliance
- Essential for professional contractors
- Protects your business

**Technical note:** JobTread's DOM dynamically removes/adds items when expanding/collapsing groups - makes this complex but solvable.

### 2. Floating Scratchpad Notes ⭐ **FAVORITE**

**What it does:** Floating, draggable notepad that lives on your screen
- Press button → notepad appears
- Drag it anywhere on screen
- Type anything: calculations, reminders, client notes
- Stays open while you navigate JobTread
- Auto-saves as you type
- Different notes for different jobs

**Use Cases:**
- Quick math: "12 rooms × $450 = $5,400"
- Client call notes: "John prefers oak, wants 20% discount"
- Reminders: "Check supplier delivery date"
- Vendor contacts: "ABC Supply: 555-1234"
- Todo items: "Don't forget to add tax line"

**Why this is awesome:**
- No more switching to external notepad apps
- No more losing sticky notes
- No more interrupting your flow
- Everything captured instantly, right where you're working

**Why go premium for this:**
- Massive productivity boost
- Professional workflow tool
- Works everywhere in JobTread
- Lightweight and fast

---

## 🗓️ **Implementation Roadmap**

**Current Version:** v3.1.0

**Phase 1 - UI Polish (v3.2.0)**
- Popup UI redesign with collapsible sections
- Better organization and scalability

**Phase 2 - Schedule Enhancements (v3.3.0)**
- Task Duration Adjustment (drag edges)
- Infinite Calendar Scroll

**Phase 3 - Visual Hierarchy (v3.4.0)**
- Budget Group Hierarchy Shading
- Once we get HTML samples from JobTread

**Phase 4 - Premium Power Tools (v4.0.0)**
- Floating Scratchpad Notes (easier to build, ship first)
- Budget Change Tracker (more complex, ship second)

---

## 💬 **We Want Your Feedback!**

Which features are you most excited about? Any suggestions or changes? Let us know in Discord!

**Most Requested:**
1. 🔥 Floating Scratchpad Notes - "This is exactly what I need!"
2. 🔥 Budget Change Tracker - "Finally, accountability for budget edits"
3. 🔥 Infinite Calendar Scroll - "No more clicking through months"

**Questions for the Community:**
- Would you pay for Floating Scratchpad Notes as a premium feature?
- What else would you put in your floating notepad?
- Any other premium feature ideas that don't require heavy data collection?

---

## 🙏 **Thank You**

Your support and feedback make JT Power Tools better every day. These features exist because you told us what you need. Keep the ideas coming!

**Stay tuned for updates!** 🚀

---

*Generated: 2025-11-05*
*Current Version: v3.1.0*
*Repository: [King0lightai/JT-Power-Tools](https://github.com/King0lightai/JT-Power-Tools)*
