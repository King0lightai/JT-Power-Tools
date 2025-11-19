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

    const container = textarea.closest('div');
    if (!container) return false;

    // Strategy 1: Check if the parent container has a sibling with the toolbar
    if (container.parentElement) {
      const parentContainer = container.parentElement;

      // Look for sticky toolbar as a sibling to the field container
      const siblings = parentContainer.querySelectorAll('.sticky.shadow-line-bottom');
      for (const toolbar of siblings) {
        // Verify it's actually a formatter toolbar by checking for button elements
        const buttons = toolbar.querySelectorAll('div[role="button"]');
        if (buttons.length > 3) { // JobTread's formatter has multiple buttons
          return true;
        }
      }
    }

    // Strategy 2: Check parent containers (in case structure varies)
    let current = container;
    for (let i = 0; i < 5; i++) { // Check up to 5 levels up
      if (!current) break;

      // Look for the sticky toolbar as a child of ancestor
      const toolbar = current.querySelector('.sticky.shadow-line-bottom');
      if (toolbar) {
        // Verify it's actually a formatter toolbar by checking for button elements
        const buttons = toolbar.querySelectorAll('div[role="button"]');
        if (buttons.length > 3) { // JobTread's formatter has multiple buttons
          return true;
        }
      }

      current = current.parentElement;
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

    // First, check if field already has JobTread's native formatter
    if (hasNativeFormatter(textarea)) {
      return false; // Skip fields that already have native formatter
    }

    // ONLY apply formatter to Budget Description fields
    if (textarea.getAttribute('placeholder') === 'Description') {
      return true;
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
      const before = text.substring(0, start);
      const after = text.substring(end);

      // Check inline formats
      if (before.endsWith('*') && after.startsWith('*')) {
        activeFormats.bold = true;
      }
      if (before.endsWith('^') && after.startsWith('^')) {
        activeFormats.italic = true;
      }
      if (before.endsWith('_') && after.startsWith('_')) {
        activeFormats.underline = true;
      }
      if (before.endsWith('~') && after.startsWith('~')) {
        activeFormats.strikethrough = true;
      }

      // Check for color (look for color tag at start of line)
      const selLineStart = before.lastIndexOf('\n') + 1;
      const beforeSelection = text.substring(selLineStart, start);
      const colorMatch = beforeSelection.match(/^\[!color:(\w+)\]/);
      if (colorMatch) {
        activeFormats.color = colorMatch[1];
      }
    } else {
      // For cursor position, check what we're inside of
      let checkStart = start;
      let checkEnd = start;

      // Expand to find format boundaries
      while (checkStart > 0 && !'*^_~\n'.includes(text[checkStart - 1])) {
        checkStart--;
      }
      while (checkEnd < text.length && !'*^_~\n'.includes(text[checkEnd])) {
        checkEnd++;
      }

      // Check if we're between format markers
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
      }

      // Check for color at line start (check full line, not just up to cursor)
      const curLineStart = text.lastIndexOf('\n', start - 1) + 1;
      const curLineEnd = text.indexOf('\n', start);
      const fullLineText = text.substring(curLineStart, curLineEnd === -1 ? text.length : curLineEnd);
      const colorMatch = fullLineText.match(/^\[!color:(\w+)\]/);
      if (colorMatch) {
        activeFormats.color = colorMatch[1];
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
