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

    // Get the current line for line-level format detection
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = text.indexOf('\n', start);
    const currentLine = text.substring(lineStart, lineEnd === -1 ? text.length : lineEnd);

    // Check line-level formats (justify)
    if (currentLine.trim().startsWith('-:-')) {
      activeFormats['justify-center'] = true;
    } else if (currentLine.trim().startsWith('--:')) {
      activeFormats['justify-right'] = true;
    }

    // Check for color on the current line
    const colorMatch = currentLine.match(/^\[!color:(\w+)\]/);
    if (colorMatch) {
      activeFormats.color = colorMatch[1];
    }

    // For inline formats (bold, italic, underline, strikethrough),
    // we need to check if the cursor/selection is inside format markers
    const markerMap = {
      '*': 'bold',
      '^': 'italic',
      '_': 'underline',
      '~': 'strikethrough'
    };

    // Check each format type
    for (const [marker, formatName] of Object.entries(markerMap)) {
      if (isInsideFormat(text, start, end, marker)) {
        activeFormats[formatName] = true;
      }
    }

    return activeFormats;
  }

  /**
   * Check if cursor/selection is inside a specific format
   * @param {string} text - Full text content
   * @param {number} start - Selection start
   * @param {number} end - Selection end
   * @param {string} marker - Format marker character
   * @returns {boolean} True if inside the format
   */
  function isInsideFormat(text, start, end, marker) {
    // Get the current line boundaries (formats don't span lines)
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = text.indexOf('\n', end);
    const lineEndPos = lineEnd === -1 ? text.length : lineEnd;
    const lineText = text.substring(lineStart, lineEndPos);

    // Adjust positions to be relative to line
    const relStart = start - lineStart;
    const relEnd = end - lineStart;

    // Find all marker pairs on this line
    const pairs = findMarkerPairs(lineText, marker);

    // Check if cursor/selection is inside any pair
    for (const pair of pairs) {
      // For a selection, check if it's fully wrapped by the markers
      if (start !== end) {
        // Selection is wrapped if markers are immediately outside the selection
        if (pair.open === relStart - 1 && pair.close === relEnd) {
          return true;
        }
      } else {
        // Cursor is inside if between open and close markers (exclusive of markers)
        if (relStart > pair.open && relStart <= pair.close) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Find all paired markers on a line
   * @param {string} line - Line text
   * @param {string} marker - Marker character
   * @returns {Array} Array of {open, close} positions
   */
  function findMarkerPairs(line, marker) {
    const pairs = [];
    let i = 0;

    while (i < line.length) {
      if (line[i] === marker) {
        // Found opening marker, look for closing marker
        const openPos = i;
        let closePos = -1;

        for (let j = i + 1; j < line.length; j++) {
          if (line[j] === marker) {
            closePos = j;
            break;
          }
        }

        if (closePos !== -1) {
          pairs.push({ open: openPos, close: closePos });
          i = closePos + 1;
        } else {
          i++;
        }
      } else {
        i++;
      }
    }

    return pairs;
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
