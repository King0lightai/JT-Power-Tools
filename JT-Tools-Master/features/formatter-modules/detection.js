// Formatter Detection Module
// Handles field detection and format state detection

const FormatterDetection = (() => {
  /**
   * Check if a textarea is inside the ADD / EDIT ITEMS table overlay
   * This table slides in from the right and should NOT have the formatter
   * NOTE: The ADD/EDIT ITEMS table only appears on Documents pages, NOT on Budget pages
   * Budget table uses similar structure but SHOULD have the formatter
   * @param {HTMLTextAreaElement} textarea - The textarea element to check
   * @returns {boolean} True if inside the ADD / EDIT ITEMS table
   */
  function isInAddEditItemsTable(textarea) {
    if (!textarea) return false;

    // CRITICAL: Budget page has similar table structure but SHOULD have the formatter
    // The ADD/EDIT ITEMS table only appears on Documents pages when editing line items
    // Do NOT exclude Budget table fields
    if (window.location.pathname.endsWith('/budget')) {
      return false;
    }

    // Check if textarea is inside a row with BOTH "flex" AND "min-w-max" classes
    // This is the specific table row structure used by the ADD / EDIT ITEMS table
    // The row also has multiple column cells with specific width styles
    const tableRow = textarea.closest('.flex.min-w-max');
    if (tableRow) {
      // Verify this is actually a table row by checking for multiple styled columns
      // Table rows have child divs with inline width styles like "width: 350px"
      const styledColumns = tableRow.querySelectorAll(':scope > div[style*="width"]');
      if (styledColumns.length >= 3) {
        // This is definitely a table row with multiple columns
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a textarea is inside the COST ITEM DETAILS sidebar panel
   * This is the ONLY place on Documents pages where we want the formatter
   * @param {HTMLTextAreaElement} textarea - The textarea element to check
   * @returns {boolean} True if inside the COST ITEM DETAILS sidebar
   */
  function isInCostItemDetailsSidebar(textarea) {
    if (!textarea) return false;

    // FIRST: Exclude if inside the ADD / EDIT ITEMS table
    // This check must come first because both panels can be on the right side
    if (isInAddEditItemsTable(textarea)) {
      return false;
    }

    // Now check if inside COST ITEM DETAILS sidebar
    let container = textarea.parentElement;
    while (container && container !== document.body) {
      const textContent = container.textContent || '';
      if (textContent.includes('COST ITEM DETAILS')) {
        return true;
      }
      container = container.parentElement;
    }

    return false;
  }

  /**
   * Check if the current page is a document-type page (documents, invoices, estimates, etc.)
   * These pages have JobTread's native formatter in the main area, so we only show our
   * formatter in sidebars on these pages.
   * @returns {boolean} True if on a document-type page
   */
  function isDocumentTypePage() {
    const path = window.location.pathname;
    // Document-type pages include: documents, invoices, estimates, proposals, contracts, purchase-orders
    return path.includes('/documents/') ||
           path.includes('/invoices/') ||
           path.includes('/estimates/') ||
           path.includes('/proposals/') ||
           path.includes('/contracts/') ||
           path.includes('/purchase-orders/');
  }

  /**
   * Check if a textarea is inside a sidebar/panel
   * Used to allow formatter in sidebars on pages where main area has native formatter
   * @param {HTMLTextAreaElement} textarea - The textarea element to check
   * @returns {boolean} True if inside a sidebar
   */
  function isInSidebar(textarea) {
    if (!textarea) return false;

    // Exclude modals/popups - they use centered auto-margin layout
    const modalContainer = textarea.closest('.m-auto');
    if (modalContainer) {
      return false;
    }

    // On document-type pages (documents, invoices, estimates, etc.),
    // ONLY the COST ITEM DETAILS sidebar should have formatter
    // This is the most reliable way to exclude all table/grid textareas
    if (isDocumentTypePage()) {
      return isInCostItemDetailsSidebar(textarea);
    }

    // For non-document-type pages, use the general sidebar detection
    // Check for common sidebar/panel patterns
    const sidebar = textarea.closest('[class*="sidebar"], [class*="panel"], [class*="drawer"]');
    if (sidebar) return true;

    // Check if inside a fixed/absolute positioned container on the RIGHT side of screen
    // But ensure it's actually narrow like a sidebar (not the main content area)
    let parent = textarea.parentElement;
    while (parent && parent !== document.body) {
      const style = window.getComputedStyle(parent);
      if (style.position === 'fixed' || style.position === 'absolute') {
        const rect = parent.getBoundingClientRect();
        // Sidebars are typically narrow (< 450px), tall, and positioned on the right
        const isOnRight = rect.left > window.innerWidth * 0.6;
        if (rect.width < 450 && rect.height > 200 && isOnRight) {
          return true;
        }
      }
      parent = parent.parentElement;
    }

    return false;
  }

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

    // Check if textarea is inside JobTread's native ADD ALERT modal
    // The modal has a header with "ADD ALERT" or "EDIT ALERT" text and its own formatter
    const modalContainer = textarea.closest('.m-auto.shadow-lg');
    if (modalContainer) {
      // Look for ADD ALERT / EDIT ALERT header
      const header = modalContainer.querySelector('h2, .font-bold');
      if (header && (header.textContent.includes('ADD ALERT') || header.textContent.includes('EDIT ALERT'))) {
        return true; // Native alert modal has its own formatter
      }

      // Also check for any native formatter toolbar inside the modal
      const nativeToolbar = modalContainer.querySelector('.flex.gap-1 button, .sticky button');
      if (nativeToolbar) {
        const toolbarContainer = nativeToolbar.closest('.flex.gap-1, .sticky');
        if (toolbarContainer) {
          const buttons = toolbarContainer.querySelectorAll('button');
          if (buttons.length >= 3) {
            return true; // Has native formatter buttons
          }
        }
      }
    }

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

    // Exclude textareas explicitly marked to skip formatter (check both ways)
    if (textarea.dataset.jtNoFormatter === 'true' ||
        textarea.hasAttribute('data-jt-no-formatter')) {
      return false;
    }

    // Exclude textareas inside our own Alert modal (it has built-in toolbar)
    // This check MUST come before other checks to ensure alert modal is always excluded
    if (textarea.closest('.jt-alert-modal') ||
        textarea.closest('.jt-alert-modal-overlay') ||
        textarea.classList.contains('jt-alert-message')) {
      return false;
    }

    // CRITICAL: Always exclude textareas inside the ADD / EDIT ITEMS table
    // This check runs on ALL pages, not just documents pages
    if (isInAddEditItemsTable(textarea)) {
      return false;
    }

    // On document-type pages (documents, invoices, estimates, etc.),
    // only allow formatter in the COST ITEM DETAILS sidebar
    // JobTread has native formatter in the main document area
    if (isDocumentTypePage()) {
      // Allow sidebar fields on document-type pages - they get the compact embedded toolbar
      if (!isInSidebar(textarea)) {
        return false;
      }
    }

    // First, check if field already has JobTread's native formatter
    // This MUST be checked before any placeholder checks to avoid duplicates
    if (hasNativeFormatter(textarea)) {
      return false; // Skip fields that already have native formatter
    }

    // Get placeholder for field checks
    const placeholder = textarea.getAttribute('placeholder');

    // Include message fields - users can format and preview messages
    // BUT only if not inside a modal that has its own native formatter
    if (placeholder === 'Message') {
      // Double-check: exclude if inside any modal with native formatter toolbar
      const modalContainer = textarea.closest('.m-auto.shadow-lg');
      if (modalContainer) {
        // Check for native formatter buttons in the modal
        const nativeButtons = modalContainer.querySelectorAll('.rounded-sm button, .flex.gap-1 button');
        if (nativeButtons.length >= 3) {
          return false; // Modal has native formatter, skip
        }
      }
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
      if (start !== end) {
        // For a selection, check if it's:
        // 1. Exactly wrapped by markers (for toggle off): *[hello]*
        // 2. Fully contained within markers: *[hel]lo* or *he[ll]o*
        const isExactlyWrapped = (pair.open === relStart - 1 && pair.close === relEnd);
        const isContainedWithin = (relStart > pair.open && relEnd <= pair.close);
        if (isExactlyWrapped || isContainedWithin) {
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
    isInAddEditItemsTable,
    detectActiveFormats
  };
})();

// Export to window
if (typeof window !== 'undefined') {
  window.FormatterDetection = FormatterDetection;
}
