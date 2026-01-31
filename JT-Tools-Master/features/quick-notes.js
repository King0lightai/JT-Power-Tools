/**
 * Quick Notes Feature
 * Provides a persistent notepad accessible from any Jobtread page
 *
 * Dependencies:
 * - features/quick-notes-modules/storage.js (QuickNotesStorage)
 * - features/quick-notes-modules/markdown.js (QuickNotesMarkdown)
 * - features/quick-notes-modules/editor.js (QuickNotesEditor)
 */

const QuickNotesFeature = (() => {
  // State variables
  let isActive = false;
  let notesPanel = null;
  let notesButton = null;
  let buttonObserver = null;
  let periodicCheckInterval = null;
  let notes = [];
  let currentNoteId = null;
  let searchTerm = '';
  let isResizing = false;

  // Store resize event handlers for cleanup
  let resizeHandlers = {
    mouseMove: null,
    mouseUp: null
  };

  // Module references (loaded after DOM ready)
  const getStorage = () => window.QuickNotesStorage || {};
  const getMarkdown = () => window.QuickNotesMarkdown || {};
  const getEditor = () => window.QuickNotesEditor || {};

  // Constants from storage module (with fallbacks)
  const MIN_WIDTH = 320;
  const MAX_WIDTH = 1200;

  // Helper to load notes using storage module
  async function loadNotes() {
    const storage = getStorage();
    if (storage.loadNotes) {
      notes = await storage.loadNotes();
      return notes;
    }
    return [];
  }

  // Helper to save notes using storage module
  async function saveNotes() {
    const storage = getStorage();
    if (storage.saveNotes) {
      return await storage.saveNotes(notes);
    }
    return false;
  }

  // Create a new note
  function createNote() {
    const storage = getStorage();
    const note = {
      id: storage.generateId ? storage.generateId() : Date.now().toString(36),
      title: 'Untitled Note',
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    notes.unshift(note);
    currentNoteId = note.id;
    saveNotes();
    renderNotesList();
    renderNoteEditor();
    // Open editor when creating new note
    openEditor();
  }

  // Delete a note
  function deleteNote(noteId) {
    if (confirm('Are you sure you want to delete this note?')) {
      notes = notes.filter(n => n.id !== noteId);
      if (currentNoteId === noteId) {
        currentNoteId = notes.length > 0 ? notes[0].id : null;
      }
      saveNotes();
      renderNotesList();
      renderNoteEditor();
    }
  }

  // Export notes as JSON file (uses storage module)
  function exportNotes() {
    const storage = getStorage();
    if (storage.exportNotes) {
      storage.exportNotes(notes);
    }
  }

  // Import notes from JSON file (uses storage module)
  function importNotes() {
    const storage = getStorage();
    if (storage.importNotes) {
      storage.importNotes(notes, async (importedNotes, mode, count) => {
        notes = importedNotes;
        await saveNotes();
        await loadNotes();

        if (mode === 'merge') {
          alert(`Successfully imported ${count} new note(s)!\n${notes.length} total notes.`);
        } else {
          alert(`Successfully replaced notes!\n${notes.length} note(s) imported.`);
        }

        // Reset current note and re-render
        currentNoteId = notes.length > 0 ? notes[0].id : null;
        renderNotesList();
        renderNoteEditor();
      });
    }
  }

  // Update note content
  function updateNote(noteId, updates) {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      Object.assign(note, updates, { updatedAt: Date.now() });
      saveNotes();
      renderNotesList();
    }
  }

  // Format date
  function formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        return minutes === 0 ? 'Just now' : `${minutes}m ago`;
      }
      return `${hours}h ago`;
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  // Render notes list
  function renderNotesList() {
    const notesList = notesPanel.querySelector('.jt-notes-list');
    if (!notesList) return;

    const markdown = getMarkdown();

    const filteredNotes = notes.filter(note => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return note.title.toLowerCase().includes(search) ||
             note.content.toLowerCase().includes(search);
    });

    if (filteredNotes.length === 0) {
      notesList.innerHTML = `
        <div class="jt-notes-empty">
          ${searchTerm ? 'No notes match your search' : 'No notes yet. Click "New Note" to get started!'}
        </div>
      `;
      return;
    }

    notesList.innerHTML = filteredNotes.map(note => {
      const previewContent = note.content.slice(0, 150);
      const parsedPreview = (markdown.parseMarkdown ? markdown.parseMarkdown(previewContent) : previewContent)
        .replace(/<div[^>]*>/g, ' ')
        .replace(/<\/div>/g, ' ')
        .replace(/\n/g, ' ')
        .trim();

      const escapedTitle = markdown.escapeHtml ? markdown.escapeHtml(note.title) : note.title;

      return `
        <div class="jt-note-item ${currentNoteId === note.id ? 'active' : ''}" data-note-id="${note.id}">
          <div class="jt-note-item-header">
            <div class="jt-note-item-title">${escapedTitle}</div>
            <button class="jt-note-delete" data-note-id="${note.id}" title="Delete note">×</button>
          </div>
          <div class="jt-note-item-preview">${parsedPreview}</div>
          <div class="jt-note-item-date">${formatDate(note.updatedAt)}</div>
        </div>
      `;
    }).join('');

    // Add click handlers
    notesList.querySelectorAll('.jt-note-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('jt-note-delete')) {
          currentNoteId = item.dataset.noteId;
          renderNotesList();
          renderNoteEditor();
          // Open editor when clicking a note
          openEditor();
        }
      });
    });

    notesList.querySelectorAll('.jt-note-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteNote(btn.dataset.noteId);
      });
    });
  }

  // Render note editor
  function renderNoteEditor() {
    const editorContainer = notesPanel.querySelector('.jt-notes-editor');
    if (!editorContainer) return;

    const markdown = getMarkdown();
    const editor = getEditor();
    const currentNote = notes.find(n => n.id === currentNoteId);

    if (!currentNote) {
      editorContainer.innerHTML = `
        <div class="jt-notes-editor-header">
          <div class="jt-notes-sidebar-title">Quick Notes</div>
          <button class="jt-notes-close-button" title="Close (Esc)"></button>
        </div>
        <div class="jt-notes-editor-empty">
          <div class="jt-notes-editor-empty-icon">📝</div>
          <div class="jt-notes-editor-empty-text">Select a note to view or create a new one</div>
        </div>
      `;

      // Add button handlers
      const closeButton = editorContainer.querySelector('.jt-notes-close-button');
      closeButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeEditor();
      });
      return;
    }

    const escapedTitle = markdown.escapeHtml ? markdown.escapeHtml(currentNote.title) : currentNote.title;
    const parsedContent = markdown.parseMarkdownForEditor ? markdown.parseMarkdownForEditor(currentNote.content) : currentNote.content;
    const wordCount = editor.countWords ? editor.countWords(currentNote.content) : 0;

    editorContainer.innerHTML = `
      <div class="jt-notes-editor-header">
        <input
          type="text"
          class="jt-notes-title-input"
          value="${escapedTitle}"
          placeholder="Note title..."
        />
        <button class="jt-notes-close-button" title="Close (Esc)"></button>
      </div>
      <div class="jt-notes-toolbar">
        <button class="jt-notes-format-btn" data-format="bold" title="Bold (Ctrl+B)">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="16" height="16">
            <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6zM6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
          </svg>
        </button>
        <button class="jt-notes-format-btn" data-format="italic" title="Italic (Ctrl+I)">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="16" height="16">
            <line x1="19" x2="10" y1="4" y2="4"></line>
            <line x1="14" x2="5" y1="20" y2="20"></line>
            <line x1="15" x2="9" y1="4" y2="20"></line>
          </svg>
        </button>
        <button class="jt-notes-format-btn" data-format="underline" title="Underline (Ctrl+U)">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="16" height="16">
            <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"></path>
            <line x1="4" x2="20" y1="21" y2="21"></line>
          </svg>
        </button>
        <button class="jt-notes-format-btn" data-format="strikethrough" title="Strikethrough (Ctrl+Shift+X)">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="16" height="16">
            <path d="M16 4H9a3 3 0 0 0-2.83 4M14 12a4 4 0 0 1 0 8H6"></path>
            <line x1="4" x2="20" y1="12" y2="12"></line>
          </svg>
        </button>
        <span class="jt-notes-toolbar-divider"></span>
        <button class="jt-notes-format-btn" data-format="link" title="Insert link (Ctrl+K)">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="16" height="16">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
          </svg>
        </button>
        <span class="jt-notes-toolbar-divider"></span>
        <button class="jt-notes-format-btn" data-format="bullet" title="Bullet list">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="16" height="16">
            <line x1="8" x2="21" y1="6" y2="6"></line>
            <line x1="8" x2="21" y1="12" y2="12"></line>
            <line x1="8" x2="21" y1="18" y2="18"></line>
            <line x1="3" x2="3.01" y1="6" y2="6"></line>
            <line x1="3" x2="3.01" y1="12" y2="12"></line>
            <line x1="3" x2="3.01" y1="18" y2="18"></line>
          </svg>
        </button>
        <button class="jt-notes-format-btn" data-format="checkbox" title="Checkbox list">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="16" height="16">
            <path d="M9 11l3 3L22 4"></path>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
          </svg>
        </button>
      </div>
      <div
        class="jt-notes-content-input"
        contenteditable="true"
        data-placeholder="Start typing your note... Rich text formatting supported"
      >${parsedContent}</div>
      <div class="jt-notes-editor-footer">
        <span class="jt-notes-word-count">${wordCount} words</span>
        <span class="jt-notes-updated">Updated ${formatDate(currentNote.updatedAt)}</span>
      </div>
    `;

    // Add input handlers with debouncing
    const titleInput = editorContainer.querySelector('.jt-notes-title-input');
    const contentInput = editorContainer.querySelector('.jt-notes-content-input');
    const closeButton = editorContainer.querySelector('.jt-notes-close-button');
    let saveTimeout;

    const debouncedSave = (field, value) => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        updateNote(currentNoteId, { [field]: value });
        if (field === 'content') {
          const wordCountEl = editorContainer.querySelector('.jt-notes-word-count');
          if (wordCountEl) {
            const count = editor.countWords ? editor.countWords(value) : 0;
            wordCountEl.textContent = `${count} words`;
          }
        }
      }, 500);
    };

    titleInput.addEventListener('input', (e) => {
      debouncedSave('title', e.target.value || 'Untitled Note');
    });

    contentInput.addEventListener('input', (e) => {
      const markdownContent = markdown.htmlToMarkdown ? markdown.htmlToMarkdown(contentInput) : '';
      debouncedSave('content', markdownContent);
      if (editor.updateFormattingButtons) {
        editor.updateFormattingButtons(contentInput);
      }
    });

    // Update button states on selection change
    const updateButtons = () => {
      if (editor.updateFormattingButtons) {
        editor.updateFormattingButtons(contentInput);
      }
    };
    contentInput.addEventListener('mouseup', updateButtons);
    contentInput.addEventListener('keyup', updateButtons);

    // Improved paste handling to preserve basic formatting
    contentInput.addEventListener('paste', (e) => {
      e.preventDefault();

      // Get pasted data
      const clipboardData = e.clipboardData || window.clipboardData;
      let pastedHTML = clipboardData.getData('text/html');
      const pastedText = clipboardData.getData('text/plain');

      if (pastedHTML && editor.cleanPastedHtml) {
        const fragment = editor.cleanPastedHtml(pastedHTML);
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          range.insertNode(fragment);

          // Move cursor to end of pasted content
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      } else {
        // Paste as plain text if no HTML
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          range.insertNode(document.createTextNode(pastedText));
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }

      // Trigger input event to save
      contentInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Handle checkbox toggle
    contentInput.addEventListener('click', (e) => {
      if (e.target.type === 'checkbox') {
        e.target.closest('.jt-note-checkbox').classList.toggle('checked', e.target.checked);
        const markdown = htmlToMarkdown(contentInput);
        debouncedSave('content', markdown);
      }
    });

    closeButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeEditor();
    });

    // Add formatting button handlers (using editor module)
    const formatButtons = editorContainer.querySelectorAll('.jt-notes-format-btn');
    formatButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const formatType = btn.dataset.format;
        if (editor.applyFormatting) {
          editor.applyFormatting(contentInput, formatType, (content) => {
            updateNote(currentNoteId, { content });
          });
        }
      });
    });

    // Helper for keyboard shortcuts to apply formatting
    const applyFormat = (formatType) => {
      if (editor.applyFormatting) {
        editor.applyFormatting(contentInput, formatType, (content) => {
          updateNote(currentNoteId, { content });
        });
      }
    };

    // Add keyboard shortcuts for formatting and list management
    contentInput.addEventListener('keydown', (e) => {
      // Tab to indent bullet points
      if (e.key === 'Tab' && !e.shiftKey) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          let currentElement = range.startContainer;

          // Find parent element
          while (currentElement && currentElement.nodeType !== Node.ELEMENT_NODE) {
            currentElement = currentElement.parentNode;
          }

          // Check if we're in a bullet
          const bulletParent = currentElement?.closest('.jt-note-bullet');
          if (bulletParent) {
            e.preventDefault();
            const currentIndent = parseInt(bulletParent.getAttribute('data-indent') || '0');
            if (currentIndent < 5) {
              bulletParent.setAttribute('data-indent', (currentIndent + 1).toString());
              // Trigger input event to save
              contentInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            return;
          }
        }
      }

      // Shift+Tab to unindent bullet points
      if (e.key === 'Tab' && e.shiftKey) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          let currentElement = range.startContainer;

          // Find parent element
          while (currentElement && currentElement.nodeType !== Node.ELEMENT_NODE) {
            currentElement = currentElement.parentNode;
          }

          // Check if we're in a bullet
          const bulletParent = currentElement?.closest('.jt-note-bullet');
          if (bulletParent) {
            e.preventDefault();
            const currentIndent = parseInt(bulletParent.getAttribute('data-indent') || '0');
            if (currentIndent > 0) {
              bulletParent.setAttribute('data-indent', (currentIndent - 1).toString());
              // Trigger input event to save
              contentInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            return;
          }
        }
      }

      // Ctrl/Cmd + B for bold
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        applyFormat('bold');
      }
      // Ctrl/Cmd + I for italic
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        applyFormat('italic');
      }
      // Ctrl/Cmd + U for underline
      if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        applyFormat('underline');
      }
      // Ctrl/Cmd + Shift + X for strikethrough
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        applyFormat('strikethrough');
      }
      // Ctrl/Cmd + K for link
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        applyFormat('link');
      }
      // Ctrl/Cmd + Z for undo
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        applyFormat('undo');
      }
      // Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z for redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        applyFormat('redo');
      }

      // Enter key: create new bullet/checkbox
      if (e.key === 'Enter') {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          let currentElement = range.startContainer;

          // Find parent element
          while (currentElement && currentElement.nodeType !== Node.ELEMENT_NODE) {
            currentElement = currentElement.parentNode;
          }

          // Check if we're in a checkbox
          if (currentElement && currentElement.closest('.jt-note-checkbox')) {
            e.preventDefault();
            const checkboxParent = currentElement.closest('.jt-note-checkbox');
            const span = checkboxParent.querySelector('span');

            // Check if current checkbox is empty
            const isEmpty = !span || span.textContent.trim() === '' || span.innerHTML === '<br>' || span.innerHTML === '';

            if (isEmpty) {
              // Exit checkbox mode: remove empty checkbox and create regular div
              const nextElement = checkboxParent.nextSibling;
              checkboxParent.remove();

              // Create a regular div
              const newDiv = document.createElement('div');
              newDiv.innerHTML = '<br>';

              // Insert at the position where the checkbox was
              if (nextElement) {
                contentInput.insertBefore(newDiv, nextElement);
              } else {
                contentInput.appendChild(newDiv);
              }

              // Focus the new div
              setTimeout(() => {
                const newRange = document.createRange();
                newRange.selectNodeContents(newDiv);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
              }, 0);

              // Trigger input event to save
              contentInput.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
              // Create new checkbox
              const newCheckbox = document.createElement('div');
              newCheckbox.className = 'jt-note-checkbox';
              newCheckbox.setAttribute('contenteditable', 'false');

              const checkbox = document.createElement('input');
              checkbox.type = 'checkbox';

              const newSpan = document.createElement('span');
              newSpan.setAttribute('contenteditable', 'true');
              newSpan.textContent = ''; // Empty text node instead of BR

              newCheckbox.appendChild(checkbox);
              newCheckbox.appendChild(newSpan);

              // Insert after current checkbox
              checkboxParent.parentNode.insertBefore(newCheckbox, checkboxParent.nextSibling);

              // Focus the new checkbox's span with proper cursor placement
              setTimeout(() => {
                newSpan.focus();
                const newRange = document.createRange();
                newRange.selectNodeContents(newSpan);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
              }, 0);
            }
          }
          // Check if we're in a bullet
          else if (currentElement && currentElement.closest('.jt-note-bullet')) {
            e.preventDefault();
            const bulletParent = currentElement.closest('.jt-note-bullet');

            // Check if current bullet is empty (only has the bullet character)
            const text = bulletParent.textContent.replace(/^•\s*/, '').trim();
            const isEmpty = text === '';

            if (isEmpty) {
              // Exit bullet mode: remove empty bullet and create regular div
              const nextElement = bulletParent.nextSibling;
              bulletParent.remove();

              // Create a regular div
              const newDiv = document.createElement('div');
              newDiv.innerHTML = '<br>';

              // Insert at the position where the bullet was
              if (nextElement) {
                contentInput.insertBefore(newDiv, nextElement);
              } else {
                contentInput.appendChild(newDiv);
              }

              // Focus the new div
              setTimeout(() => {
                const newRange = document.createRange();
                newRange.selectNodeContents(newDiv);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
              }, 0);

              // Trigger input event to save
              contentInput.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
              // Create new bullet with same indentation as parent
              const newBullet = document.createElement('div');
              newBullet.className = 'jt-note-bullet';
              // Copy indentation from parent bullet
              const parentIndent = bulletParent.getAttribute('data-indent');
              if (parentIndent) {
                newBullet.setAttribute('data-indent', parentIndent);
              }
              newBullet.textContent = '• ';

              // Insert after current bullet
              bulletParent.parentNode.insertBefore(newBullet, bulletParent.nextSibling);

              // Focus at the end of the bullet text (after "• ")
              const newRange = document.createRange();
              const textNode = newBullet.firstChild;
              if (textNode) {
                newRange.setStart(textNode, textNode.length);
                newRange.setEnd(textNode, textNode.length);
                selection.removeAllRanges();
                selection.addRange(newRange);
              }
            }
          }
        }
      }

      // Backspace: delete empty checkboxes/bullets
      if (e.key === 'Backspace') {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          let currentElement = range.startContainer;

          // Find parent element
          while (currentElement && currentElement.nodeType !== Node.ELEMENT_NODE) {
            currentElement = currentElement.parentNode;
          }

          // Check if we're in a checkbox span
          if (currentElement && currentElement.closest('.jt-note-checkbox')) {
            const checkboxParent = currentElement.closest('.jt-note-checkbox');
            const span = checkboxParent.querySelector('span');

            // If span is empty or only has <br>, delete the entire checkbox
            if (span && (span.textContent.trim() === '' || span.innerHTML === '<br>' || span.innerHTML === '')) {
              // Check if cursor is at start or span is empty
              if (range.startOffset === 0 || span.textContent.length === 0) {
                e.preventDefault();

                // Focus previous element or create a new div
                const prevElement = checkboxParent.previousSibling;
                checkboxParent.remove();

                if (prevElement) {
                  const newRange = document.createRange();

                  // If previous element is a checkbox, focus its span
                  if (prevElement.classList && prevElement.classList.contains('jt-note-checkbox')) {
                    const prevSpan = prevElement.querySelector('span');
                    if (prevSpan) {
                      newRange.selectNodeContents(prevSpan);
                      newRange.collapse(false);
                    }
                  }
                  // If previous element is a bullet or regular div, focus at end
                  else {
                    newRange.selectNodeContents(prevElement);
                    newRange.collapse(false);
                  }

                  selection.removeAllRanges();
                  selection.addRange(newRange);
                } else {
                  // Create a new empty div if no previous element
                  const newDiv = document.createElement('div');
                  newDiv.innerHTML = '<br>';
                  contentInput.insertBefore(newDiv, contentInput.firstChild);

                  const newRange = document.createRange();
                  newRange.selectNodeContents(newDiv);
                  newRange.collapse(true);
                  selection.removeAllRanges();
                  selection.addRange(newRange);
                }

                // Trigger input event to save
                contentInput.dispatchEvent(new Event('input', { bubbles: true }));
              }
            }
          }
          // Check if we're in a bullet
          else if (currentElement && currentElement.closest('.jt-note-bullet')) {
            const bulletParent = currentElement.closest('.jt-note-bullet');
            const text = bulletParent.textContent.replace(/^•\s*/, '').trim();

            // If bullet is empty, delete it
            if (text === '') {
              // Check if cursor is at start (after the bullet)
              if (range.startOffset === 0 || bulletParent.textContent.trim() === '•') {
                e.preventDefault();

                // Focus previous element or create a new div
                const prevElement = bulletParent.previousSibling;
                bulletParent.remove();

                if (prevElement) {
                  const newRange = document.createRange();

                  // If previous element is a checkbox, focus its span
                  if (prevElement.classList && prevElement.classList.contains('jt-note-checkbox')) {
                    const prevSpan = prevElement.querySelector('span');
                    if (prevSpan) {
                      newRange.selectNodeContents(prevSpan);
                      newRange.collapse(false);
                    }
                  }
                  // If previous element is a bullet or regular div, focus at end
                  else {
                    newRange.selectNodeContents(prevElement);
                    newRange.collapse(false);
                  }

                  selection.removeAllRanges();
                  selection.addRange(newRange);
                } else {
                  // Create a new empty div if no previous element
                  const newDiv = document.createElement('div');
                  newDiv.innerHTML = '<br>';
                  contentInput.insertBefore(newDiv, contentInput.firstChild);

                  const newRange = document.createRange();
                  newRange.selectNodeContents(newDiv);
                  newRange.collapse(true);
                  selection.removeAllRanges();
                  selection.addRange(newRange);
                }

                // Trigger input event to save
                contentInput.dispatchEvent(new Event('input', { bubbles: true }));
              }
            }
          }
        }
      }
    });

    // Initialize undo/redo history for this note (using editor module)
    if (editor.resetHistory) {
      editor.resetHistory(currentNote.content);
    }

    // Update formatting buttons on initial load (using editor module)
    setTimeout(() => {
      if (editor.updateFormattingButtons) {
        editor.updateFormattingButtons(contentInput);
      }
    }, 100);

    // Focus on content if title is already set
    if (currentNote.title !== 'Untitled Note') {
      contentInput.focus();
    } else {
      titleInput.focus();
      titleInput.select();
    }
  }

  // ============================================================
  // NOTE: The following functions have been moved to modules:
  // - countWords, saveToHistory, undo, redo, updateFormattingButtons,
  //   applyFormatting → quick-notes-modules/editor.js
  // - parseMarkdownForEditor, processInlineFormatting, htmlToMarkdown,
  //   extractInlineMarkdown, parseMarkdown, escapeHtml → quick-notes-modules/markdown.js
  // ============================================================

  // Detect and apply theme
  function detectAndApplyTheme() {
    if (!notesPanel) return;

    // Get current settings
    chrome.storage.sync.get(['jtToolsSettings'], (result) => {
      const settings = result.jtToolsSettings || {};

      // Remove existing theme classes
      notesPanel.classList.remove('dark-theme', 'custom-theme');

      // Check if dark mode is enabled
      if (settings.darkMode) {
        notesPanel.classList.add('dark-theme');
        return;
      }

      // Check if custom RGB theme is enabled
      if (settings.rgbTheme && settings.themeColors) {
        notesPanel.classList.add('custom-theme');
        const { primary, background, text } = settings.themeColors;

        // Calculate lighter background for inputs
        const lighterBg = adjustColorBrightness(background, 10);
        const borderColor = adjustColorBrightness(background, -20);

        // Set CSS variables
        notesPanel.style.setProperty('--jt-notes-bg', background);
        notesPanel.style.setProperty('--jt-notes-text', text);
        notesPanel.style.setProperty('--jt-notes-primary', primary);
        notesPanel.style.setProperty('--jt-notes-input-bg', lighterBg);
        notesPanel.style.setProperty('--jt-notes-border', borderColor);
      }
    });
  }

  // Adjust color brightness (simple HSL adjustment)
  function adjustColorBrightness(hex, percent) {
    // Convert hex to RGB
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    // Adjust brightness
    const adjust = (color) => {
      const adjusted = color + (color * percent / 100);
      return Math.min(255, Math.max(0, Math.round(adjusted)));
    };

    const newR = adjust(r);
    const newG = adjust(g);
    const newB = adjust(b);

    // Convert back to hex
    return '#' + [newR, newG, newB]
      .map(x => x.toString(16).padStart(2, '0'))
      .join('');
  }

  // Open editor - expands panel to show editor
  function openEditor() {
    notesPanel.classList.add('editor-open');
    // Load and apply saved width when opening editor
    loadSavedWidth();
  }

  // Close editor - collapses back to sidebar only
  function closeEditor() {
    notesPanel.classList.remove('editor-open');
    notesPanel.classList.remove('resizing');
    // Reset width to sidebar width (280px)
    notesPanel.style.width = '';
    currentNoteId = null;
    renderNotesList();
    renderNoteEditor();
  }

  // Toggle panel visibility
  function togglePanel() {
    if (!notesPanel) return;

    const isVisible = notesPanel.classList.contains('visible');
    if (isVisible) {
      // Close everything - remove all classes that make it visible
      notesPanel.classList.remove('visible');
      notesPanel.classList.remove('editor-open');
      notesPanel.classList.remove('resizing');
      // Reset width to default (280px from CSS)
      notesPanel.style.width = '';
      currentNoteId = null;
      if (notesButton) {
        notesButton.classList.remove('jt-notes-button-active');
      }
      // Force hide with explicit check
      setTimeout(() => {
        if (notesPanel && notesPanel.classList.contains('visible')) {
          notesPanel.classList.remove('visible');
        }
      }, 10);
    } else {
      // Open just the sidebar initially (280px default width)
      notesPanel.classList.add('visible');
      // Ensure width is reset to 280px when opening sidebar only
      notesPanel.style.width = '';
      if (notesButton) {
        notesButton.classList.add('jt-notes-button-active');
      }
      renderNotesList();
      renderNoteEditor();
      // Focus search when opening
      const searchInput = notesPanel.querySelector('.jt-notes-search-input');
      if (searchInput) {
        setTimeout(() => searchInput.focus(), 100);
      }
    }
  }

  // Find the Time Clock button in a container by its distinctive SVG elements
  function findTimeClockButton(container) {
    const buttons = container.querySelectorAll('div[role="button"]');
    for (const btn of buttons) {
      const svg = btn.querySelector('svg');
      if (svg) {
        // Check for clock circle (cx="12" cy="12" r="10")
        const circle = svg.querySelector('circle[cx="12"][cy="12"][r="10"]');
        if (circle) {
          return btn;
        }
        // Also check path for clock hands "M12 6v6l4 2"
        const paths = svg.querySelectorAll('path');
        for (const path of paths) {
          const d = path.getAttribute('d') || '';
          if (d.includes('M12 6v6l4 2')) {
            return btn;
          }
        }
      }
    }
    return null;
  }

  // Create Quick Notes button for the header bar (icon-only style)
  function createQuickNotesHeaderButton(container, beforeElement) {
    // Remove existing button if present
    if (notesButton && notesButton.parentNode) {
      notesButton.remove();
    }

    notesButton = document.createElement('div');
    // Match header icon button styling exactly like JobTread's Time Clock button
    notesButton.className = 'relative cursor-pointer flex items-center hover:bg-gray-100 focus:bg-gray-100 px-1 h-10 rounded-sm group active:bg-gray-200 jt-quick-notes-btn';
    notesButton.setAttribute('role', 'button');
    notesButton.setAttribute('tabindex', '0');
    notesButton.setAttribute('title', 'Quick Notes');

    // Icon-only version (matches header icons exactly - using same classes as Time Clock)
    // Note: SVG must be on single line without whitespace to match JT's native icons
    notesButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" class="inline-block overflow-visible h-[1em] w-[1em] align-[-0.125em] text-3xl" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;

    // Add click handler
    notesButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      togglePanel();
    });

    // Add keyboard handler for accessibility
    notesButton.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        togglePanel();
      }
    });

    // Insert BEFORE the Time Clock button (to the left of it)
    container.insertBefore(notesButton, beforeElement);
  }

  // Create Quick Notes button that integrates with Jobtread action buttons
  function createQuickNotesButton(container) {
    // Remove existing button if present
    if (notesButton && notesButton.parentNode) {
      notesButton.remove();
    }

    notesButton = document.createElement('div');
    // Match the exact classes from JobTread's action buttons
    notesButton.className = 'inline-block align-bottom relative cursor-pointer select-none truncate py-2 px-4 shadow-xs active:shadow-inner text-gray-600 bg-white hover:bg-gray-50 first:rounded-l-sm last:rounded-r-sm border-y border-l last:border-r text-center shrink-0 jt-quick-notes-btn';
    notesButton.setAttribute('role', 'button');
    notesButton.setAttribute('tabindex', '0');
    notesButton.setAttribute('index', '99'); // High index to ensure it's treated as an action button
    notesButton.setAttribute('title', 'Quick Notes (Alt+N)');

    notesButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="inline-block overflow-visible h-[1em] w-[1em] align-[-0.125em]" viewBox="0 0 24 24">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg> Quick Notes
    `;

    // Add click handler
    notesButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      togglePanel();
    });

    // Add keyboard handler for accessibility
    notesButton.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        togglePanel();
      }
    });

    // Insert at the beginning of the container (leftmost position in action bar)
    if (container.firstChild) {
      container.insertBefore(notesButton, container.firstChild);
    } else {
      container.appendChild(notesButton);
    }
  }

  // Check if current page should have the quick notes button
  // Note: Since the icon is now persistent in the header, we show it on all JobTread pages
  function shouldShowButton() {
    // Always show the Quick Notes button in the header
    return true;
  }

  // Find and inject button into action buttons container
  function injectQuickNotesButton() {
    // Check if button already exists anywhere
    if (notesButton && document.body.contains(notesButton)) {
      return true;
    }

    // Priority 1: Try to inject into header bar (left of Time Clock)
    // Header bar is always visible on all pages, no page restrictions needed
    const headerIconBar = document.querySelector('div.shrink-0.flex.items-center.pr-1');
    if (headerIconBar && !headerIconBar.querySelector('.jt-quick-notes-btn')) {
      const timeClockBtn = findTimeClockButton(headerIconBar);
      if (timeClockBtn) {
        createQuickNotesHeaderButton(headerIconBar, timeClockBtn);
        return true;
      } else if (headerIconBar.firstChild) {
        // Fallback: insert as first child of icon bar if Time Clock not found
        createQuickNotesHeaderButton(headerIconBar, headerIconBar.firstChild);
        return true;
      }
    }

    // Header bar not found - don't show Quick Notes button
    return false;
  }

  // Create a floating Quick Notes button as fallback
  function createFloatingButton() {
    if (notesButton && notesButton.parentNode) {
      notesButton.remove();
    }

    notesButton = document.createElement('button');
    notesButton.className = 'jt-quick-notes-floating-btn';
    notesButton.setAttribute('title', 'Quick Notes (Alt+N)');
    notesButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="24" height="24">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
    `;

    // Add click handler
    notesButton.addEventListener('click', togglePanel);

    // Add keyboard handler for accessibility
    notesButton.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        togglePanel();
      }
    });

    document.body.appendChild(notesButton);
  }

  // Set up observer to watch for action buttons container
  function setupButtonObserver() {
    // Initial injection attempt
    let injected = injectQuickNotesButton();

    // Retry injection every 500ms for up to 5 seconds if not successful
    if (!injected) {
      let attempts = 0;
      const maxAttempts = 10; // 10 * 500ms = 5 seconds
      const retryInterval = setInterval(() => {
        attempts++;

        injected = injectQuickNotesButton();

        if (injected || attempts >= maxAttempts) {
          clearInterval(retryInterval);
          if (!injected) {
            createFloatingButton();
          }
        }
      }, 500);
    }

    // Periodic check to ensure button stays injected across page navigations
    // Check every 2 seconds if button is still present and action bar exists
    // Store interval ID for cleanup
    periodicCheckInterval = setInterval(() => {
      if (isActive) {
        // Check if we're on a page that should have the button
        if (!shouldShowButton()) {
          // Remove button if it exists but shouldn't be shown on this page
          if (notesButton && document.body.contains(notesButton)) {
            notesButton.remove();
          }
          return;
        }

        const actionBars = document.querySelectorAll('div.absolute.inset-0.flex.justify-end');
        let foundButtonInActionBar = false;

        for (const bar of actionBars) {
          if (bar.offsetParent !== null) {
            const hasButton = bar.querySelector('.jt-quick-notes-btn');
            if (hasButton) {
              foundButtonInActionBar = true;
              break;
            }
          }
        }

        // If we found an action bar but no button, try to inject
        if (!foundButtonInActionBar && actionBars.length > 0) {
          const visibleActionBar = Array.from(actionBars).find(bar => bar.offsetParent !== null);
          if (visibleActionBar) {
            injectQuickNotesButton();
          }
        }
      }
    }, 2000); // Check every 2 seconds

    // Watch for DOM changes to re-inject button if needed
    // Need to watch for:
    // 1. Button being removed (page navigation)
    // 2. Action bar content changing (different page = different buttons)
    // 3. Action bar itself being recreated
    // 4. URL changes (SPA navigation)
    buttonObserver = new MutationObserver((mutations) => {
      // Check if we're on a page that should have the button
      if (!shouldShowButton()) {
        // Remove button if it exists but shouldn't be shown on this page
        if (notesButton && document.body.contains(notesButton)) {
          notesButton.remove();
        }
        return;
      }

      // Check if our button still exists in the DOM
      if (!notesButton || !document.body.contains(notesButton)) {
        injectQuickNotesButton();
        return;
      }

      // Check if action bar was modified (content changed)
      // This handles when the page changes and action bar gets new buttons
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          // Check if any added/removed nodes are in an action bar
          const actionBars = document.querySelectorAll('div.absolute.inset-0.flex.justify-end');
          for (const bar of actionBars) {
            // If action bar exists but doesn't have our button, inject it
            if (bar.offsetParent !== null && !bar.querySelector('.jt-quick-notes-btn')) {
              const divButtons = bar.querySelectorAll('div[role="button"]').length;
              const linkButtons = bar.querySelectorAll('a.inline-block.cursor-pointer.shrink-0').length;
              const totalButtons = divButtons + linkButtons;

              if (totalButtons > 0) {
                injectQuickNotesButton();
                return;
              }
            }
          }
        }
      }
    });

    buttonObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Create notes panel
  function createNotesPanel() {
    notesPanel = document.createElement('div');
    notesPanel.className = 'jt-quick-notes-panel';
    notesPanel.innerHTML = `
      <div class="jt-notes-resize-handle" title="Drag to resize"></div>
      <div class="jt-notes-sidebar">
        <div class="jt-notes-sidebar-header">
          <h3 class="jt-notes-sidebar-title">Quick Notes</h3>
          <button class="jt-notes-sidebar-close-button" title="Close (Esc)">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="16" height="16">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="jt-notes-search-container">
          <input
            type="text"
            class="jt-notes-search-input"
            placeholder="Search notes..."
          />
          <button class="jt-notes-new-button" title="New note (Alt+N)">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="16" height="16">
              <path d="M5 12h14M12 5v14"></path>
            </svg>
            New Note
          </button>
        </div>
        <div class="jt-notes-actions-container">
          <button class="jt-notes-action-button" id="exportNotesBtn" title="Export notes as JSON file for backup">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="14" height="14">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Export
          </button>
          <button class="jt-notes-action-button" id="importNotesBtn" title="Import notes from a JSON file">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="14" height="14">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            Import
          </button>
        </div>
        <div class="jt-notes-list"></div>
      </div>
      <div class="jt-notes-editor"></div>
    `;

    // Add event handlers
    const sidebarCloseButton = notesPanel.querySelector('.jt-notes-sidebar-close-button');
    sidebarCloseButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      togglePanel();
    });

    const newButton = notesPanel.querySelector('.jt-notes-new-button');
    newButton.addEventListener('click', createNote);

    const exportButton = notesPanel.querySelector('#exportNotesBtn');
    exportButton.addEventListener('click', exportNotes);

    const importButton = notesPanel.querySelector('#importNotesBtn');
    importButton.addEventListener('click', importNotes);

    const searchInput = notesPanel.querySelector('.jt-notes-search-input');
    searchInput.addEventListener('input', (e) => {
      searchTerm = e.target.value;
      renderNotesList();
    });

    // Add resize functionality
    setupResizeHandle();

    document.body.appendChild(notesPanel);
  }

  // Setup resize handle functionality
  function setupResizeHandle() {
    const resizeHandle = notesPanel.querySelector('.jt-notes-resize-handle');
    if (!resizeHandle) return;

    let startX = 0;
    let startWidth = 0;

    const handleMouseDown = (e) => {
      isResizing = true;
      startX = e.clientX;
      startWidth = notesPanel.offsetWidth;

      // Add resizing class for cursor
      document.body.style.cursor = 'ew-resize';
      notesPanel.classList.add('resizing');

      e.preventDefault();
    };

    const handleMouseMove = (e) => {
      if (!isResizing) return;

      // Calculate new width (subtract because we're dragging from the left)
      const deltaX = startX - e.clientX;
      let newWidth = startWidth + deltaX;

      // Apply constraints
      newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));

      // Also constrain to viewport width
      const maxViewportWidth = window.innerWidth * 0.9;
      newWidth = Math.min(newWidth, maxViewportWidth);

      notesPanel.style.width = `${newWidth}px`;
    };

    const handleMouseUp = () => {
      if (!isResizing) return;

      isResizing = false;
      document.body.style.cursor = '';
      notesPanel.classList.remove('resizing');

      // Save the new width
      saveWidth(notesPanel.offsetWidth);
    };

    // Store handlers for cleanup
    resizeHandlers.mouseMove = handleMouseMove;
    resizeHandlers.mouseUp = handleMouseUp;

    resizeHandle.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  // Save panel width to localStorage
  function saveWidth(width) {
    localStorage.setItem(WIDTH_STORAGE_KEY, width.toString());
  }

  // Load saved width from localStorage
  function loadSavedWidth() {
    const savedWidth = localStorage.getItem(WIDTH_STORAGE_KEY);
    if (savedWidth) {
      const width = parseInt(savedWidth, 10);
      if (!isNaN(width) && width >= MIN_WIDTH && width <= MAX_WIDTH) {
        notesPanel.style.width = `${width}px`;
      }
    }
  }

  // Keyboard shortcuts
  let lastKeyTime = 0;
  let lastKey = '';
  const SHORTCUT_TIMEOUT = 500; // milliseconds

  function handleKeyboard(e) {
    // Q + N shortcut (press Q then N within 500ms)
    const currentTime = Date.now();
    const key = e.key.toLowerCase();

    // Don't trigger if user is typing in an input field
    const isInputField = e.target.matches('input, textarea, [contenteditable="true"]');

    if (!isInputField && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (key === 'q') {
        lastKey = 'q';
        lastKeyTime = currentTime;
      } else if (key === 'n' && lastKey === 'q' && (currentTime - lastKeyTime) < SHORTCUT_TIMEOUT) {
        e.preventDefault();
        togglePanel();
        lastKey = '';
        lastKeyTime = 0;
      }
    }

    // Escape to close editor or panel
    if (e.key === 'Escape' && notesPanel && notesPanel.classList.contains('visible')) {
      e.preventDefault();
      // If editor is open, close it (return to sidebar)
      if (notesPanel.classList.contains('editor-open')) {
        closeEditor();
      } else {
        // If only sidebar is open, close entire panel
        togglePanel();
      }
    }
  }

  // Handle settings changes from other tabs
  function handleSettingsChange(message) {
    if (message.type === 'SETTINGS_CHANGED') {
      // Re-detect and apply theme when settings change
      detectAndApplyTheme();
    }
  }

  // Initialize feature
  async function init() {
    if (isActive) return;

    // Quick Notes is now available on all JobTread pages
    // The header icon is persistent across all pages

    // Load CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('styles/quick-notes.css');
    link.id = 'jt-quick-notes-styles';
    document.head.appendChild(link);

    // Load notes from storage
    await loadNotes();

    // Create UI elements
    setupButtonObserver();
    createNotesPanel();

    // Apply theme
    detectAndApplyTheme();

    // Render initial state
    renderNotesList();
    renderNoteEditor();

    // Add keyboard listener
    document.addEventListener('keydown', handleKeyboard);

    // Listen for settings changes
    chrome.runtime.onMessage.addListener(handleSettingsChange);

    isActive = true;
    console.log('QuickNotes: Activated');
  }

  // Cleanup feature
  function cleanup() {
    if (!isActive) return;

    // Clear periodic check interval (fix memory leak)
    if (periodicCheckInterval) {
      clearInterval(periodicCheckInterval);
      periodicCheckInterval = null;
    }

    // Disconnect observer
    if (buttonObserver) {
      buttonObserver.disconnect();
      buttonObserver = null;
    }

    // Remove UI elements
    if (notesButton) {
      notesButton.remove();
      notesButton = null;
    }
    if (notesPanel) {
      notesPanel.remove();
      notesPanel = null;
    }

    // Remove CSS
    const styles = document.getElementById('jt-quick-notes-styles');
    if (styles) styles.remove();

    // Remove keyboard listener
    document.removeEventListener('keydown', handleKeyboard);

    // Remove resize event listeners (fix memory leak)
    if (resizeHandlers.mouseMove) {
      document.removeEventListener('mousemove', resizeHandlers.mouseMove);
      resizeHandlers.mouseMove = null;
    }
    if (resizeHandlers.mouseUp) {
      document.removeEventListener('mouseup', resizeHandlers.mouseUp);
      resizeHandlers.mouseUp = null;
    }

    // Remove settings change listener
    chrome.runtime.onMessage.removeListener(handleSettingsChange);

    // Reset state
    notes = [];
    currentNoteId = null;
    searchTerm = '';
    isActive = false;

    console.log('QuickNotes: Deactivated');
  }

  return {
    init,
    cleanup,
    isActive: () => isActive
  };
})();

// Export to window
window.QuickNotesFeature = QuickNotesFeature;
