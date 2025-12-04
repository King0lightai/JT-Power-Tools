/**
 * Quick Notes Editor Module
 * Handles WYSIWYG editing, formatting, and undo/redo
 *
 * Dependencies: quick-notes-modules/markdown.js (QuickNotesMarkdown)
 */

const QuickNotesEditor = (() => {
  // Undo/redo state
  let undoHistory = [];
  let redoHistory = [];
  let lastSavedContent = '';
  let historyTimeout = null;

  // Reference to markdown module
  const getMarkdown = () => window.QuickNotesMarkdown || {};

  /**
   * Reset history state for a new note
   * @param {string} initialContent - Initial content of the note
   */
  function resetHistory(initialContent = '') {
    undoHistory = [];
    redoHistory = [];
    lastSavedContent = initialContent;
    if (historyTimeout) {
      clearTimeout(historyTimeout);
      historyTimeout = null;
    }
  }

  /**
   * Add content to undo history
   * @param {string} content - Current content
   */
  function saveToHistory(content) {
    if (content !== lastSavedContent) {
      undoHistory.push(lastSavedContent);
      // Limit history to 50 entries
      if (undoHistory.length > 50) {
        undoHistory.shift();
      }
      redoHistory = []; // Clear redo history on new change
      lastSavedContent = content;
    }
  }

  /**
   * Undo last change
   * @param {HTMLElement} contentInput - Contenteditable element
   * @param {Function} onUpdate - Callback when content changes
   * @returns {boolean} Whether undo was performed
   */
  function undo(contentInput, onUpdate) {
    if (undoHistory.length > 0) {
      const previousContent = undoHistory.pop();
      redoHistory.push(lastSavedContent);
      lastSavedContent = previousContent;

      // Restore content
      const { parseMarkdownForEditor } = getMarkdown();
      if (parseMarkdownForEditor) {
        contentInput.innerHTML = parseMarkdownForEditor(previousContent);
      }

      // Notify about the change
      if (onUpdate) {
        onUpdate(previousContent);
      }

      return true;
    }
    return false;
  }

  /**
   * Redo last undone change
   * @param {HTMLElement} contentInput - Contenteditable element
   * @param {Function} onUpdate - Callback when content changes
   * @returns {boolean} Whether redo was performed
   */
  function redo(contentInput, onUpdate) {
    if (redoHistory.length > 0) {
      const nextContent = redoHistory.pop();
      undoHistory.push(lastSavedContent);
      lastSavedContent = nextContent;

      // Restore content
      const { parseMarkdownForEditor } = getMarkdown();
      if (parseMarkdownForEditor) {
        contentInput.innerHTML = parseMarkdownForEditor(nextContent);
      }

      // Notify about the change
      if (onUpdate) {
        onUpdate(nextContent);
      }

      return true;
    }
    return false;
  }

  /**
   * Update formatting button states based on selection
   * @param {HTMLElement} contentInput - Contenteditable element
   */
  function updateFormattingButtons(contentInput) {
    if (!contentInput) return;

    const formatButtons = document.querySelectorAll('.jt-notes-format-btn');
    formatButtons.forEach(btn => btn.classList.remove('active'));

    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    let node = selection.anchorNode;
    if (!node) return;

    // Traverse up the DOM tree to check for formatting
    while (node && node !== contentInput) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName?.toLowerCase();

        if (tagName === 'strong' || tagName === 'b') {
          const boldBtn = document.querySelector('[data-format="bold"]');
          if (boldBtn) boldBtn.classList.add('active');
        }
        if (tagName === 'em' || tagName === 'i') {
          const italicBtn = document.querySelector('[data-format="italic"]');
          if (italicBtn) italicBtn.classList.add('active');
        }
        if (tagName === 'u') {
          const underlineBtn = document.querySelector('[data-format="underline"]');
          if (underlineBtn) underlineBtn.classList.add('active');
        }
        if (tagName === 's' || tagName === 'del' || tagName === 'strike') {
          const strikeBtn = document.querySelector('[data-format="strikethrough"]');
          if (strikeBtn) strikeBtn.classList.add('active');
        }
        if (tagName === 'a') {
          const linkBtn = document.querySelector('[data-format="link"]');
          if (linkBtn) linkBtn.classList.add('active');
        }
      }
      node = node.parentNode;
    }
  }

  /**
   * Apply formatting to contenteditable (WYSIWYG)
   *
   * @param {HTMLElement} element - The contenteditable element
   * @param {string} formatType - The type of formatting to apply
   * @param {Function} onUpdate - Callback when content changes
   */
  function applyFormatting(element, formatType, onUpdate) {
    element.focus();

    const { htmlToMarkdown } = getMarkdown();

    // Save to history before making changes
    if (htmlToMarkdown) {
      const currentContent = htmlToMarkdown(element);
      clearTimeout(historyTimeout);
      historyTimeout = setTimeout(() => {
        saveToHistory(currentContent);
      }, 500);
    }

    // NOTE: execCommand is deprecated but still widely supported for contenteditable.
    switch (formatType) {
      case 'bold':
        document.execCommand('bold', false, null);
        break;

      case 'italic':
        document.execCommand('italic', false, null);
        break;

      case 'underline':
        document.execCommand('underline', false, null);
        break;

      case 'strikethrough':
        document.execCommand('strikeThrough', false, null);
        break;

      case 'link':
        handleLinkFormatting(element);
        break;

      case 'undo':
        undo(element, onUpdate);
        return; // Don't trigger input event

      case 'redo':
        redo(element, onUpdate);
        return; // Don't trigger input event

      case 'bullet':
        insertBulletItem(element);
        break;

      case 'checkbox':
        insertCheckboxItem(element);
        break;
    }

    // Trigger input event to save changes
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /**
   * Handle link formatting
   * @param {HTMLElement} element - Contenteditable element
   */
  function handleLinkFormatting(element) {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const selectedText = range.toString();

    // Check if we're already in a link
    let linkElement = null;
    let node = selection.anchorNode;
    while (node && node !== element) {
      if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'A') {
        linkElement = node;
        break;
      }
      node = node.parentNode;
    }

    if (linkElement) {
      // Edit existing link
      const currentUrl = linkElement.getAttribute('href') || '';
      const newUrl = prompt('Edit link URL:', currentUrl);

      if (newUrl !== null) {
        if (newUrl.trim() === '') {
          // Remove link
          const parent = linkElement.parentNode;
          while (linkElement.firstChild) {
            parent.insertBefore(linkElement.firstChild, linkElement);
          }
          parent.removeChild(linkElement);
        } else {
          // Update link
          linkElement.setAttribute('href', newUrl);
        }
      }
    } else if (selectedText) {
      // Create new link with selected text
      const url = prompt('Enter link URL:', 'https://');

      if (url && url.trim() !== '' && url !== 'https://') {
        const linkEl = document.createElement('a');
        linkEl.href = url;
        linkEl.target = '_blank';
        linkEl.rel = 'noopener noreferrer';
        linkEl.textContent = selectedText;

        range.deleteContents();
        range.insertNode(linkEl);

        // Move cursor after the link
        range.setStartAfter(linkEl);
        range.setEndAfter(linkEl);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } else {
      // No selection, prompt for both text and URL
      const linkText = prompt('Enter link text:');
      if (linkText && linkText.trim() !== '') {
        const url = prompt('Enter link URL:', 'https://');
        if (url && url.trim() !== '' && url !== 'https://') {
          const linkEl = document.createElement('a');
          linkEl.href = url;
          linkEl.target = '_blank';
          linkEl.rel = 'noopener noreferrer';
          linkEl.textContent = linkText;

          range.insertNode(linkEl);

          // Move cursor after the link
          range.setStartAfter(linkEl);
          range.setEndAfter(linkEl);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    }
  }

  /**
   * Insert a bullet list item
   * @param {HTMLElement} element - Contenteditable element
   */
  function insertBulletItem(element) {
    const bulletDiv = document.createElement('div');
    bulletDiv.className = 'jt-note-bullet';
    bulletDiv.textContent = '• ';

    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(bulletDiv);

      // Place cursor at the end of the bullet text (after "• ")
      const newRange = document.createRange();
      const textNode = bulletDiv.firstChild;
      if (textNode) {
        newRange.setStart(textNode, textNode.length);
        newRange.setEnd(textNode, textNode.length);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    }
  }

  /**
   * Insert a checkbox item
   * @param {HTMLElement} element - Contenteditable element
   */
  function insertCheckboxItem(element) {
    const checkboxDiv = document.createElement('div');
    checkboxDiv.className = 'jt-note-checkbox';
    checkboxDiv.setAttribute('contenteditable', 'false');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';

    const span = document.createElement('span');
    span.setAttribute('contenteditable', 'true');
    span.textContent = '';

    checkboxDiv.appendChild(checkbox);
    checkboxDiv.appendChild(span);

    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(checkboxDiv);

      // Place cursor inside the span with proper focus
      setTimeout(() => {
        span.focus();
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }, 0);
    }
  }

  /**
   * Clean pasted HTML content
   * @param {string} html - Raw pasted HTML
   * @returns {DocumentFragment} Cleaned content
   */
  function cleanPastedHtml(html) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    const allowedTags = ['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'code', 'a', 'br'];

    const cleanHTML = (element) => {
      const clone = element.cloneNode(false);
      for (const child of element.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          clone.appendChild(child.cloneNode(true));
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const tagName = child.tagName.toLowerCase();
          if (allowedTags.includes(tagName)) {
            const cleanChild = cleanHTML(child);
            // Preserve href for links
            if (tagName === 'a' && child.hasAttribute('href')) {
              cleanChild.setAttribute('href', child.getAttribute('href'));
              cleanChild.setAttribute('target', '_blank');
              cleanChild.setAttribute('rel', 'noopener noreferrer');
            }
            clone.appendChild(cleanChild);
          } else {
            // Skip the tag but keep its children
            for (const grandChild of child.childNodes) {
              const processedChild = grandChild.nodeType === Node.ELEMENT_NODE
                ? cleanHTML(grandChild)
                : grandChild.cloneNode(true);
              clone.appendChild(processedChild);
            }
          }
        }
      }
      return clone;
    };

    const cleanedContent = cleanHTML(tempDiv);
    const fragment = document.createDocumentFragment();
    while (cleanedContent.firstChild) {
      fragment.appendChild(cleanedContent.firstChild);
    }
    return fragment;
  }

  /**
   * Count words in text
   * @param {string} text - Text to count
   * @returns {number} Word count
   */
  function countWords(text) {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }

  // Public API
  return {
    // History management
    resetHistory,
    saveToHistory,
    undo,
    redo,

    // Formatting
    updateFormattingButtons,
    applyFormatting,

    // Utilities
    cleanPastedHtml,
    countWords
  };
})();

// Make available globally
if (typeof window !== 'undefined') {
  window.QuickNotesEditor = QuickNotesEditor;
}
