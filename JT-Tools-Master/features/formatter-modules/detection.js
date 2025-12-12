// Formatter Detection Module
// Handles field detection and format state detection

const FormatterDetection = (() => {
  /**
   * Check if field already has JobTread's native formatter
   * @param {HTMLTextAreaElement} textarea - The textarea element to check
   * @returns {boolean} True if native formatter exists
   */
  function hasNativeFormatter(textarea) {
    if (!textarea) return false;

    // Look for JobTread's native formatter toolbar in parent containers
    // Their toolbar has: sticky z-[1] p-1 flex gap-1 bg-white shadow-line-bottom
    // The toolbar is typically a sibling to the textarea's parent container
    // Structure: <div class="rounded-sm border"> contains both toolbar and textarea container

    // Find the textarea's immediate container (the relative div)
    const relativeContainer = textarea.closest('div.relative');
    if (!relativeContainer) return false;

    // Check if this textarea is inside a label - if so, it's a custom field without native formatter
    if (textarea.closest('label')) {
      return false;
    }

    // The native formatter structure has the toolbar and textarea container as siblings
    // inside a "rounded-sm border" container
    const borderContainer = relativeContainer.parentElement;
    if (!borderContainer) return false;

    // Check if there's a sticky toolbar as a direct child of the same parent
    const toolbar = borderContainer.querySelector(':scope > .sticky.shadow-line-bottom');
    if (toolbar) {
      // Verify it's actually a formatter toolbar by checking for button elements
      const buttons = toolbar.querySelectorAll('div[role="button"]');
      if (buttons.length > 3) { // JobTread's formatter has multiple buttons
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a textarea should have the formatter
   * @param {HTMLTextAreaElement} textarea - The textarea element to check
   * @returns {boolean} True if formatter should be applied
   */
  function isFormatterField(textarea) {
    if (!textarea || textarea.tagName !== 'TEXTAREA') return false;

    // Exclude textareas inside our own Alert modal (it has built-in toolbar)
    if (textarea.closest('.jt-alert-modal') ||
        textarea.closest('.jt-alert-modal-overlay') ||
        textarea.classList.contains('jt-alert-message')) {
      return false;
    }

    // First, check if field already has JobTread's native formatter
    if (hasNativeFormatter(textarea)) {
      return false; // Skip fields that already have native formatter
    }

    // Get placeholder for field checks
    const placeholder = textarea.getAttribute('placeholder');

    // Include message fields - users can format and preview messages
    if (placeholder === 'Message') {
      return true;
    }

    // Exclude subtask/checklist fields
    if (placeholder === 'Add an item...' || placeholder === 'Add an item') {
      return false;
    }

    // Check if textarea is inside a checklist/subtask container
    const checklistContainer = textarea.closest('div');
    if (checklistContainer) {
      // Look for a Checklist heading in the ancestor elements
      let ancestor = checklistContainer;
      for (let i = 0; i < 10 && ancestor; i++) {
        const heading = ancestor.querySelector(':scope > div > .font-bold');
        if (heading && heading.textContent.trim() === 'Checklist') {
          return false; // This is a subtask field
        }
        ancestor = ancestor.parentElement;
      }
    }

    // Check if it's a Budget Description field
    if (placeholder === 'Description') {
      return true;
    }

    // Check if it's ANY Daily Log field, Todo, or Task description
    // (textarea inside label with bold heading)
    const label = textarea.closest('label');
    if (label) {
      const heading = label.querySelector('div.font-bold');
      // If there's a bold heading in the label, this is a Daily Log/Todo/Task field
      if (heading && heading.textContent.trim().length > 0) {
        return true;
      }
    }

    // Check if it's a Daily Log EDIT field (textarea with transparent color and formatting overlay)
    // These fields have: style="color: transparent;" and a sibling div with pointer-events-none
    const hasTransparentColor = textarea.style.color === 'transparent';
    if (hasTransparentColor) {
      // Exclude if this is in a checklist area (small padding p-1 indicates subtask)
      if (textarea.classList.contains('p-1') && !textarea.classList.contains('p-2')) {
        return false;
      }

      const parent = textarea.parentElement;
      if (parent) {
        // Look for a sibling div with pointer-events-none (the formatting overlay)
        const siblings = parent.querySelectorAll('div');
        for (const sibling of siblings) {
          const styles = window.getComputedStyle(sibling);
          if (styles.pointerEvents === 'none' && sibling !== textarea) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Detect active formats at current cursor position or selection
   * @param {HTMLTextAreaElement} field - The textarea field
   * @returns {Object} Object with active format flags
   */
  function detectActiveFormats(field) {
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const text = field.value;

    const activeFormats = {
      bold: false,
      italic: false,
      underline: false,
      strikethrough: false,
      color: null,
      'justify-center': false,
      'justify-right': false
    };

    // For selections, check if entire selection is wrapped
    if (start !== end) {
      const selection = text.substring(start, end);

      // Check multiple levels of nested formatting
      let checkStart = start;
      let checkEnd = end;

      // Keep checking outward for format markers
      while (checkStart > 0 && checkEnd < text.length) {
        const charBefore = text[checkStart - 1];
        const charAfter = text[checkEnd];
        let foundFormat = false;

        // Check each format type at this level
        if (charBefore === '*' && charAfter === '*') {
          activeFormats.bold = true;
          foundFormat = true;
        }
        if (charBefore === '^' && charAfter === '^') {
          activeFormats.italic = true;
          foundFormat = true;
        }
        if (charBefore === '_' && charAfter === '_') {
          activeFormats.underline = true;
          foundFormat = true;
        }
        if (charBefore === '~' && charAfter === '~') {
          activeFormats.strikethrough = true;
          foundFormat = true;
        }

        // Move outward to check next level
        if (foundFormat) {
          checkStart--;
          checkEnd++;
        } else {
          // No format markers at this level, stop checking
          break;
        }
      }

      // Check for color (look for color tag anywhere before selection on the line)
      const selLineStart = text.lastIndexOf('\n', start - 1) + 1;
      const beforeSelection = text.substring(selLineStart, start);
      // Find the LAST color tag before the selection (in case there are multiple)
      const colorMatches = beforeSelection.match(/\[!color:(\w+)\]/g);
      if (colorMatches && colorMatches.length > 0) {
        const lastColorMatch = colorMatches[colorMatches.length - 1];
        const colorName = lastColorMatch.match(/\[!color:(\w+)\]/)[1];
        activeFormats.color = colorName;
      }
    } else {
      // For cursor position, check what we're inside of
      // Check multiple levels of nesting by repeatedly expanding outward
      let checkStart = start;
      let checkEnd = start;

      // Keep expanding to find all nested format boundaries
      while (checkStart > 0 || checkEnd < text.length) {
        // Expand to next format boundary
        while (checkStart > 0 && !'*^_~\n'.includes(text[checkStart - 1])) {
          checkStart--;
        }
        while (checkEnd < text.length && !'*^_~\n'.includes(text[checkEnd])) {
          checkEnd++;
        }

        // Check if we're between format markers at this level
        if (checkStart > 0 && checkEnd < text.length) {
          const charBefore = text[checkStart - 1];
          const charAfter = text[checkEnd];

          if (charBefore === '*' && charAfter === '*') {
            activeFormats.bold = true;
          }
          if (charBefore === '^' && charAfter === '^') {
            activeFormats.italic = true;
          }
          if (charBefore === '_' && charAfter === '_') {
            activeFormats.underline = true;
          }
          if (charBefore === '~' && charAfter === '~') {
            activeFormats.strikethrough = true;
          }

          // Move outward to check next level of nesting
          checkStart--;
          checkEnd++;
        } else {
          // No more format markers to check
          break;
        }
      }

      // Check for color (look for color tag anywhere before cursor on the line)
      const curLineStart = text.lastIndexOf('\n', start - 1) + 1;
      const beforeCursor = text.substring(curLineStart, start);
      // Find the LAST color tag before the cursor (in case there are multiple)
      const colorMatches = beforeCursor.match(/\[!color:(\w+)\]/g);
      if (colorMatches && colorMatches.length > 0) {
        const lastColorMatch = colorMatches[colorMatches.length - 1];
        const colorName = lastColorMatch.match(/\[!color:(\w+)\]/)[1];
        activeFormats.color = colorName;
      }
    }

    // Check line-level formats (justify)
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = text.indexOf('\n', start);
    const currentLine = text.substring(lineStart, lineEnd === -1 ? text.length : lineEnd);

    if (currentLine.trim().startsWith('-:-')) {
      activeFormats['justify-center'] = true;
    } else if (currentLine.trim().startsWith('--:')) {
      activeFormats['justify-right'] = true;
    }

    return activeFormats;
  }

  // Public API
  return {
    hasNativeFormatter,
    isFormatterField,
    detectActiveFormats
  };
})();

// Export to window
if (typeof window !== 'undefined') {
  window.FormatterDetection = FormatterDetection;
}
