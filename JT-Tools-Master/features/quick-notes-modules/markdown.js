/**
 * Quick Notes Markdown Module
 * Handles markdown parsing and HTML conversion
 *
 * Dependencies: None
 */

const QuickNotesMarkdown = (() => {
  /**
   * Escape HTML special characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped HTML
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Process inline formatting (bold, italic, underline, strikethrough, code, links)
   * @param {string} text - Text with markdown
   * @returns {string} HTML with inline formatting
   */
  function processInlineFormatting(text) {
    if (!text) return '';

    let html = escapeHtml(text);

    // Parse links [text](url)
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Parse inline code `code`
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');

    // Parse bold **text** or *text*
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<strong>$1</strong>');

    // Parse italic _text_
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');

    // Parse strikethrough ~~text~~
    html = html.replace(/~~(.+?)~~/g, '<s>$1</s>');

    // Parse underline __text__
    html = html.replace(/__(.+?)__/g, '<u>$1</u>');

    return html;
  }

  /**
   * Parse markdown to HTML for contenteditable editor (WYSIWYG)
   * @param {string} text - Markdown text
   * @returns {string} HTML for editor
   */
  function parseMarkdownForEditor(text) {
    if (!text) return '<div><br></div>';

    const lines = text.split('\n');
    const htmlLines = lines.map(line => {
      // Checkbox lists
      if (line.match(/^- \[x\]/i)) {
        const content = line.replace(/^- \[x\]\s*/i, '');
        return `<div class="jt-note-checkbox checked" contenteditable="false"><input type="checkbox" checked><span contenteditable="true">${processInlineFormatting(content)}</span></div>`;
      }
      if (line.match(/^- \[ \]/)) {
        const content = line.replace(/^- \[ \]\s*/, '');
        return `<div class="jt-note-checkbox" contenteditable="false"><input type="checkbox"><span contenteditable="true">${processInlineFormatting(content)}</span></div>`;
      }
      // Bullet lists with indentation support
      if (line.match(/^(\s*)- /)) {
        const match = line.match(/^(\s*)- (.*)$/);
        const indent = Math.floor(match[1].length / 2); // 2 spaces = 1 indent level
        const content = match[2];
        const indentAttr = indent > 0 ? ` data-indent="${indent}"` : '';
        return `<div class="jt-note-bullet"${indentAttr}>• ${processInlineFormatting(content)}</div>`;
      }
      // Regular text with inline formatting
      return `<div>${processInlineFormatting(line) || '<br>'}</div>`;
    });

    return htmlLines.join('');
  }

  /**
   * Parse markdown to HTML (for preview in sidebar)
   * @param {string} text - Markdown text
   * @returns {string} HTML preview
   */
  function parseMarkdown(text) {
    if (!text) return '';

    // Escape HTML first
    let html = escapeHtml(text);

    // Parse links [text](url)
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Parse inline code `code`
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');

    // Parse bold **text** or *text*
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<strong>$1</strong>');

    // Parse italic _text_
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');

    // Parse strikethrough ~~text~~
    html = html.replace(/~~(.+?)~~/g, '<s>$1</s>');

    // Parse underline __text__
    html = html.replace(/__(.+?)__/g, '<u>$1</u>');

    // Parse line by line for lists and checkboxes
    const lines = html.split('\n');
    const parsedLines = lines.map(line => {
      // Checkbox lists
      if (line.match(/^- \[x\]/i)) {
        return line.replace(/^- \[x\]\s*/i, '<div class="jt-note-checkbox checked"><input type="checkbox" checked disabled><span>') + '</span></div>';
      }
      if (line.match(/^- \[ \]/)) {
        return line.replace(/^- \[ \]\s*/, '<div class="jt-note-checkbox"><input type="checkbox" disabled><span>') + '</span></div>';
      }
      // Bullet lists
      if (line.match(/^- /)) {
        return line.replace(/^- /, '<div class="jt-note-bullet">• ') + '</div>';
      }
      return line;
    });

    return parsedLines.join('\n');
  }

  /**
   * Extract inline markdown from formatted HTML element
   * @param {HTMLElement} element - Element to extract from
   * @returns {string} Markdown text
   */
  function extractInlineMarkdown(element) {
    let text = '';
    const children = element.childNodes;

    for (let node of children) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase();
        const content = node.textContent;

        if (tag === 'strong' || tag === 'b') {
          text += `**${content}**`;
        } else if (tag === 'em' || tag === 'i') {
          text += `_${content}_`;
        } else if (tag === 'u') {
          text += `__${content}__`;
        } else if (tag === 's' || tag === 'del' || tag === 'strike') {
          text += `~~${content}~~`;
        } else if (tag === 'code') {
          text += `\`${content}\``;
        } else if (tag === 'a') {
          const href = node.getAttribute('href') || '#';
          text += `[${content}](${href})`;
        } else if (tag === 'br') {
          // Skip br tags
        } else {
          text += extractInlineMarkdown(node);
        }
      }
    }

    return text.replace(/^•\s*/, '');
  }

  /**
   * Convert contenteditable HTML back to markdown
   * @param {HTMLElement} element - Contenteditable element
   * @returns {string} Markdown text
   */
  function htmlToMarkdown(element) {
    let markdown = '';
    const children = element.childNodes;

    for (let node of children) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase();

        if (node.classList.contains('jt-note-checkbox')) {
          const checkbox = node.querySelector('input[type="checkbox"]');
          const span = node.querySelector('span');
          const checked = checkbox && checkbox.checked;
          const text = span ? extractInlineMarkdown(span) : '';
          markdown += `- [${checked ? 'x' : ' '}] ${text}\n`;
        } else if (node.classList.contains('jt-note-bullet')) {
          const text = node.textContent.replace(/^•\s*/, '');
          const indent = parseInt(node.getAttribute('data-indent') || '0');
          const indentSpaces = '  '.repeat(indent); // 2 spaces per indent level
          markdown += `${indentSpaces}- ${extractInlineMarkdown(node)}\n`;
        } else if (tag === 'div') {
          const content = extractInlineMarkdown(node);
          if (content) markdown += content + '\n';
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        if (text.trim()) markdown += text;
      }
    }

    return markdown.trim();
  }

  // Public API
  return {
    escapeHtml,
    processInlineFormatting,
    parseMarkdownForEditor,
    parseMarkdown,
    extractInlineMarkdown,
    htmlToMarkdown
  };
})();

// Make available globally
if (typeof window !== 'undefined') {
  window.QuickNotesMarkdown = QuickNotesMarkdown;
}
