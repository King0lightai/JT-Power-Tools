# JobTread Schedule Drag & Drop Extension

## Overview

This experimental extension adds drag-and-drop functionality to JobTread's schedule view, allowing you to drag schedule items between dates.

## Current Status: FULLY AUTOMATED & SEAMLESS! 🎉

✨ **This extension FULLY automates date-changing with ZERO visual disruption!**

The sidebar opens and closes completely invisibly - you'll only see a success notification!

### What Works (Fully Automated & Invisible!)

- ✅ Makes schedule items draggable
- ✅ Makes date cells accept drops
- ✅ Shows visual feedback (drop zones highlight in blue)
- ✅ **Sidebar opens and closes INVISIBLY** - no jarring shifts!
- ✅ **Types date directly** - fast and reliable
- ✅ **Handles relative dates** (Today, Tomorrow, Yesterday)
- ✅ **Multi-month support** - correctly detects Oct vs Nov vs Dec
- ✅ **Seamless UX** - only see the success notification
- ✅ Works across months (Nov → Dec)

### What You Do

- 🖱️ Just drag and drop - that's it!
- The extension handles everything else automatically

## How to Use

1. **Install the Extension:**
   - Go to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `Extension2` folder

2. **Navigate to JobTread:**
   - Go to your JobTread schedule/calendar view
   - You should see schedule items with a grab cursor

3. **Drag and Drop - That's It!**
   - Click and hold on a schedule item
   - Drag it to another date cell (it will highlight in blue)
   - Drop the item
   - **Watch the seamless magic happen:**
     - 🔮 **Sidebar opens invisibly** (hidden from view!)
     - ⌨️ **Date is typed automatically** (e.g., "Nov 7")
     - ✅ Change events triggered
     - 🚪 **Sidebar closes silently**
     - ✨ **Success notification appears** - that's all you see!
     - **No visual jarring or shifting!**

4. **Done!**
   - The date has been changed automatically
   - The sidebar has closed automatically
   - Continue working on your schedule!

**What used to take 5+ clicks now takes just one drag-and-drop!**

## Troubleshooting

If the automation doesn't work:

1. **Check the console** (F12 → Console tab):
   - The extension logs detailed information about each step
   - Look for "Formatted date: Nov 7" to see what's being typed
   - Check "Found visible input field" to confirm input detection
   - Look for "Date typed successfully!" for confirmation

2. **Common issues:**
   - **"Could not find input field"**: The date field may not have opened
   - **Date doesn't change**: Try refreshing the page and reloading the extension
   - **Wrong month**: Check the console for "Formatted date" output

3. **Timing adjustments:**
   - Sidebar open wait: 500ms (line 178)
   - Input field detection: 400ms (line 260)
   - Sidebar close delay: 800ms (line 253)

## Current Limitations & Future Improvements

### Recent Fixes

- ✅ **Relative dates**: Now handles "Today", "Tomorrow", "Yesterday"
- ✅ **Multi-month calendars**: Correctly detects month for specific cell (not just first month)
- ✅ **Cross-month dragging**: Works! Drag from Nov to Dec seamlessly

### Known Limitations

- ⚠️ Only changes the **Start date** (End date would require additional logic)
- ⚠️ Assumes JobTread accepts "Mon Day" format (e.g., "Nov 7")

### Potential Future Improvements

1. **Cross-month dragging:**
   - Detect month/year from target cell
   - Navigate calendar to correct month before selecting date
   - Handle year changes

2. **Smart End date adjustment:**
   - Automatically adjust End date based on task duration
   - Maintain the same number of days when moving tasks

3. **Multi-select drag:**
   - Drag multiple tasks at once
   - Batch update dates

4. **Undo functionality:**
   - Track changes and allow quick undo
   - Show history of recent moves

5. **Enhanced visual feedback:**
   - Show task dependencies when dragging
   - Highlight conflicts or overlaps
   - Preview date ranges during drag

## Installation

```bash
# Load the extension in Chrome/Edge
1. Navigate to chrome://extensions
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the Extension2 folder
```

## Testing Approach

To explore the API integration:

1. Open Chrome DevTools (F12)
2. Go to the Network tab
3. Filter by "Fetch/XHR"
4. Manually change a schedule item's date in JobTread
5. Look for the API call that updates the date
6. Note the endpoint, method, and payload
7. Update the extension to replicate this call

## License

[Your License]

## Contributing

This is an experimental project. Feel free to explore and enhance the API integration!
