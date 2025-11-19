/**
 * Quick Notes Feature
 * Provides a persistent notepad accessible from any Jobtread page
 */

const QuickNotesFeature = (() => {
  let isActive = false;
  let notesPanel = null;
  let notesButton = null;
  let buttonObserver = null;
  let notes = [];
  let currentNoteId = null;
  let searchTerm = '';
  const STORAGE_KEY = 'jtToolsQuickNotes';
  const WIDTH_STORAGE_KEY = 'jtToolsQuickNotesWidth';
  const MIN_WIDTH = 320;
  const MAX_WIDTH = 1200;
  let isResizing = false;

  // Store resize event handlers for cleanup (fix memory leak)
  let resizeHandlers = {
    mouseMove: null,
    mouseUp: null
  };

  // Undo/redo history management
  let undoHistory = [];
  let redoHistory = [];
  let lastSavedContent = '';
  let historyTimeout = null;

  // Generate unique ID
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Load notes from storage
  async function loadNotes() {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get([STORAGE_KEY], (result) => {
          if (chrome.runtime.lastError) {
            console.error('Quick Notes: Error loading notes:', chrome.runtime.lastError.message);
            notes = [];
            resolve([]);
            return;
          }
          notes = result[STORAGE_KEY] || [];
          resolve(notes);
        });
      } catch (error) {
        console.error('Quick Notes: Unexpected error loading notes:', error);
        notes = [];
        resolve([]);
      }
    });
  }

  // Save notes to storage
  async function saveNotes() {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.set({ [STORAGE_KEY]: notes }, () => {
          if (chrome.runtime.lastError) {
            console.error('Quick Notes: Error saving notes:', chrome.runtime.lastError.message);
            resolve(false);
            return;
          }
          resolve(true);
        });
      } catch (error) {
        console.error('Quick Notes: Unexpected error saving notes:', error);
        resolve(false);
      }
    });
  }

  // Create a new note
  function createNote() {
    const note = {
      id: generateId(),
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

  // Export notes as JSON file
  function exportNotes() {
    if (notes.length === 0) {
      alert('No notes to export. Create some notes first!');
      return;
    }

    const exportData = {
      version: '1.0',
      exportedAt: Date.now(),
      exportedAtFormatted: new Date().toLocaleString(),
      notesCount: notes.length,
      notes: notes
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;

    // Create filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 10);
    link.download = `jt-power-tools-notes-${timestamp}.json`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log(`Exported ${notes.length} notes`);
  }

  // Import notes from JSON file
  function importNotes() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const importData = JSON.parse(text);

        // Validate import data
        if (!importData.notes || !Array.isArray(importData.notes)) {
          alert('Invalid notes file. Please select a valid JT Power Tools notes export.');
          return;
        }

        // Ask user if they want to merge or replace
        const action = confirm(
          `Found ${importData.notes.length} note(s) in file.\n\n` +
          `Click OK to MERGE with existing notes (${notes.length})\n` +
          `Click Cancel to REPLACE all existing notes`
        );

        if (action) {
          // Merge: Add imported notes that don't already exist
          const existingIds = new Set(notes.map(n => n.id));
          const newNotes = importData.notes.filter(n => !existingIds.has(n.id));

          notes = [...notes, ...newNotes];
          await saveNotes();

          // Reload notes from storage to ensure consistency
          await loadNotes();

          alert(`Successfully imported ${newNotes.length} new note(s)!\n${notes.length} total notes.`);
        } else {
          // Replace: Replace all notes with imported ones
          if (confirm('Are you sure? This will DELETE all existing notes and replace them with imported notes.')) {
            notes = importData.notes;
            await saveNotes();

            // Reload notes from storage to ensure consistency
            await loadNotes();

            alert(`Successfully replaced notes!\n${notes.length} note(s) imported.`);
          } else {
            // User cancelled the replace operation
            return;
          }
        }

        // Reset current note and re-render
        currentNoteId = notes.length > 0 ? notes[0].id : null;
        renderNotesList();
        renderNoteEditor();

        console.log(`Imported notes: ${importData.notes.length} from file, ${notes.length} total`);
      } catch (error) {
        console.error('Import error:', error);
        alert('Failed to import notes. Please make sure the file is a valid JT Power Tools notes export.');
      }
    };

    input.click();
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
      const parsedPreview = parseMarkdown(previewContent)
        .replace(/<div[^>]*>/g, ' ')
        .replace(/<\/div>/g, ' ')
        .replace(/\n/g, ' ')
        .trim();

      return `
        <div class="jt-note-item ${currentNoteId === note.id ? 'active' : ''}" data-note-id="${note.id}">
          <div class="jt-note-item-header">
            <div class="jt-note-item-title">${escapeHtml(note.title)}</div>
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

    editorContainer.innerHTML = `
      <div class="jt-notes-editor-header">
        <input
          type="text"
          class="jt-notes-title-input"
          value="${escapeHtml(currentNote.title)}"
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
      >${parseMarkdownForEditor(currentNote.content)}</div>
      <div class="jt-notes-editor-footer">
        <span class="jt-notes-word-count">${countWords(currentNote.content)} words</span>
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
          const wordCount = editorContainer.querySelector('.jt-notes-word-count');
          if (wordCount) {
            wordCount.textContent = `${countWords(value)} words`;
          }
        }
      }, 500);
    };

    titleInput.addEventListener('input', (e) => {
      debouncedSave('title', e.target.value || 'Untitled Note');
    });

    contentInput.addEventListener('input', (e) => {
      const markdown = htmlToMarkdown(contentInput);
      debouncedSave('content', markdown);
      updateFormattingButtons(contentInput);
    });

    // Update button states on selection change
    contentInput.addEventListener('mouseup', () => updateFormattingButtons(contentInput));
    contentInput.addEventListener('keyup', () => updateFormattingButtons(contentInput));

    // Improved paste handling to preserve basic formatting
    contentInput.addEventListener('paste', (e) => {
      e.preventDefault();

      // Get pasted data
      const clipboardData = e.clipboardData || window.clipboardData;
      let pastedHTML = clipboardData.getData('text/html');
      const pastedText = clipboardData.getData('text/plain');

      if (pastedHTML) {
        // Create a temporary div to parse HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = pastedHTML;

        // Clean up the HTML - keep only allowed tags
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
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();

          // Insert cleaned content
          const fragment = document.createDocumentFragment();
          while (cleanedContent.firstChild) {
            fragment.appendChild(cleanedContent.firstChild);
          }
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

    // Add formatting button handlers
    const formatButtons = editorContainer.querySelectorAll('.jt-notes-format-btn');
    formatButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const formatType = btn.dataset.format;
        applyFormatting(contentInput, formatType);
      });
    });

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
        applyFormatting(contentInput, 'bold');
      }
      // Ctrl/Cmd + I for italic
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        applyFormatting(contentInput, 'italic');
      }
      // Ctrl/Cmd + U for underline
      if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        applyFormatting(contentInput, 'underline');
      }
      // Ctrl/Cmd + Shift + X for strikethrough
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        applyFormatting(contentInput, 'strikethrough');
      }
      // Ctrl/Cmd + K for link
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        applyFormatting(contentInput, 'link');
      }
      // Ctrl/Cmd + Z for undo
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        applyFormatting(contentInput, 'undo');
      }
      // Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z for redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        applyFormatting(contentInput, 'redo');
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

            // Create new checkbox
            const newCheckbox = document.createElement('div');
            newCheckbox.className = 'jt-note-checkbox';
            newCheckbox.setAttribute('contenteditable', 'false');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';

            const span = document.createElement('span');
            span.setAttribute('contenteditable', 'true');
            span.textContent = ''; // Empty text node instead of BR

            newCheckbox.appendChild(checkbox);
            newCheckbox.appendChild(span);

            // Insert after current checkbox
            checkboxParent.parentNode.insertBefore(newCheckbox, checkboxParent.nextSibling);

            // Focus the new checkbox's span with proper cursor placement
            setTimeout(() => {
              span.focus();
              const newRange = document.createRange();
              newRange.selectNodeContents(span);
              newRange.collapse(true);
              selection.removeAllRanges();
              selection.addRange(newRange);
            }, 0);
          }
          // Check if we're in a bullet
          else if (currentElement && currentElement.closest('.jt-note-bullet')) {
            e.preventDefault();
            const bulletParent = currentElement.closest('.jt-note-bullet');

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

    // Initialize undo/redo history for this note
    undoHistory = [];
    redoHistory = [];
    lastSavedContent = currentNote.content;

    // Update formatting buttons on initial load
    setTimeout(() => updateFormattingButtons(contentInput), 100);

    // Focus on content if title is already set
    if (currentNote.title !== 'Untitled Note') {
      contentInput.focus();
    } else {
      titleInput.focus();
      titleInput.select();
    }
  }

  // Count words
  function countWords(text) {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }

  // Add content to undo history
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

  // Undo last change
  function undo(contentInput) {
    if (undoHistory.length > 0) {
      const previousContent = undoHistory.pop();
      redoHistory.push(lastSavedContent);
      lastSavedContent = previousContent;

      // Restore content
      contentInput.innerHTML = parseMarkdownForEditor(previousContent);

      // Update the note
      const markdown = htmlToMarkdown(contentInput);
      updateNote(currentNoteId, { content: markdown });

      // Update UI state
      updateFormattingButtons(contentInput);
      return true;
    }
    return false;
  }

  // Redo last undone change
  function redo(contentInput) {
    if (redoHistory.length > 0) {
      const nextContent = redoHistory.pop();
      undoHistory.push(lastSavedContent);
      lastSavedContent = nextContent;

      // Restore content
      contentInput.innerHTML = parseMarkdownForEditor(nextContent);

      // Update the note
      const markdown = htmlToMarkdown(contentInput);
      updateNote(currentNoteId, { content: markdown });

      // Update UI state
      updateFormattingButtons(contentInput);
      return true;
    }
    return false;
  }

  // Update formatting button states based on selection
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

  // Parse markdown to HTML for contenteditable editor (WYSIWYG)
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

  // Process inline formatting (bold, italic, underline, strikethrough, code, links)
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

  // Convert contenteditable HTML back to markdown
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

  // Extract inline markdown from formatted HTML
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

  // Parse markdown to HTML (for preview in sidebar)
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

  // Escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Apply formatting to contenteditable (WYSIWYG)
  function applyFormatting(element, formatType) {
    element.focus();

    // Save to history before making changes
    const currentContent = htmlToMarkdown(element);
    clearTimeout(historyTimeout);
    historyTimeout = setTimeout(() => {
      saveToHistory(currentContent);
    }, 500);

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

      case 'link': {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
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
            // Create new link
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
        break;
      }

      case 'undo':
        undo(element);
        return; // Don't trigger input event

      case 'redo':
        redo(element);
        return; // Don't trigger input event

      case 'bullet':
        // Insert a bullet list item
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
        break;

      case 'checkbox':
        // Insert a checkbox item
        const checkboxDiv = document.createElement('div');
        checkboxDiv.className = 'jt-note-checkbox';
        checkboxDiv.setAttribute('contenteditable', 'false');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';

        const span = document.createElement('span');
        span.setAttribute('contenteditable', 'true');
        span.textContent = ''; // Empty text node for cursor visibility

        checkboxDiv.appendChild(checkbox);
        checkboxDiv.appendChild(span);

        const selection2 = window.getSelection();
        if (selection2.rangeCount > 0) {
          const range = selection2.getRangeAt(0);
          range.deleteContents();
          range.insertNode(checkboxDiv);

          // Place cursor inside the span with proper focus
          setTimeout(() => {
            span.focus();
            const newRange = document.createRange();
            newRange.selectNodeContents(span);
            newRange.collapse(true);
            selection2.removeAllRanges();
            selection2.addRange(newRange);
          }, 0);
        }
        break;
    }

    // Trigger input event to save changes
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

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
      console.log('Quick Notes: Button inserted at beginning of action bar');
    } else {
      container.appendChild(notesButton);
      console.log('Quick Notes: Button appended to action bar');
    }
  }

  // Check if current page should have the quick notes button
  function shouldShowButton() {
    const path = window.location.pathname;

    // Never show on settings page
    if (path.includes('/settings')) {
      return false;
    }

    // Only show on daily-logs and time pages
    const allowedPages = ['/daily-logs', '/time'];
    return allowedPages.some(page => path.includes(page));
  }

  // Find and inject button into action buttons container
  function injectQuickNotesButton() {
    // Check if we're on a page that should have the button
    if (!shouldShowButton()) {
      console.log('Quick Notes: Current page does not support quick notes button');
      return false;
    }

    // Check if button already exists anywhere
    if (notesButton && document.body.contains(notesButton)) {
      console.log('Quick Notes: Button already exists in DOM');
      return true;
    }

    // Try multiple selectors to find the action buttons container
    const selectors = [
      // Primary target: exact match for the action bar structure
      'div.absolute.inset-0.flex.justify-end',
      // Backup selectors with similar patterns
      'div.flex.justify-end.items-center',
      'div.flex.items-center.justify-end',
      // More flexible patterns
      'div[class*="absolute"][class*="inset-0"][class*="flex"][class*="justify-end"]',
      'div.flex.justify-end',
    ];

    let container = null;
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);

      // Find the first visible container with div[role="button"] children
      for (const el of elements) {
        const isVisible = el.offsetParent !== null && el.offsetWidth > 0 && el.offsetHeight > 0;
        if (!isVisible) continue;

        // Check for div elements with role="button" (matching JobTread's pattern)
        const divButtons = el.querySelectorAll('div[role="button"]');
        if (divButtons.length > 0) {
          // Verify these buttons have the action button styling
          const hasActionButtons = Array.from(divButtons).some(btn =>
            btn.className.includes('inline-block') &&
            btn.className.includes('cursor-pointer') &&
            btn.className.includes('shrink-0')
          );

          if (hasActionButtons) {
            container = el;
            console.log('Quick Notes: Found action bar with selector:', selector);
            console.log('Quick Notes: Container classes:', el.className);
            console.log('Quick Notes: Found', divButtons.length, 'action buttons');
            break;
          }
        }
      }
      if (container) break;
    }

    // If still no container, try broader search
    if (!container) {
      console.log('Quick Notes: Trying broader search for action bar...');
      const allFlexContainers = document.querySelectorAll('div.flex.justify-end');

      for (const el of allFlexContainers) {
        const isVisible = el.offsetParent !== null && el.offsetWidth > 100;
        const divButtons = el.querySelectorAll('div[role="button"]');

        if (isVisible && divButtons.length >= 2) {
          container = el;
          console.log('Quick Notes: Found fallback container:', el.className);
          console.log('Quick Notes: Has', divButtons.length, 'buttons');
          break;
        }
      }
    }

    if (container && !container.querySelector('.jt-quick-notes-btn')) {
      console.log('Quick Notes: Injecting button into action bar');
      createQuickNotesButton(container);
      return true; // Success
    } else if (!container) {
      console.warn('Quick Notes: Could not find action bar container');
      console.warn('Quick Notes: Checked selectors:', selectors);
      return false; // Failed
    }

    console.log('Quick Notes: Button already in container');
    return true; // Already injected
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
    console.log('Quick Notes: Created floating button as fallback');
  }

  // Set up observer to watch for action buttons container
  function setupButtonObserver() {
    console.log('Quick Notes: Setting up button observer');

    // Initial injection attempt
    let injected = injectQuickNotesButton();

    // Retry injection every 500ms for up to 5 seconds if not successful
    if (!injected) {
      let attempts = 0;
      const maxAttempts = 10; // 10 * 500ms = 5 seconds
      const retryInterval = setInterval(() => {
        attempts++;
        console.log(`Quick Notes: Retry injection attempt ${attempts}/${maxAttempts}`);

        injected = injectQuickNotesButton();

        if (injected || attempts >= maxAttempts) {
          clearInterval(retryInterval);
          if (injected) {
            console.log('Quick Notes: Button successfully injected into action bar');
          } else {
            console.warn('Quick Notes: Failed to inject button after', attempts, 'attempts');
            console.warn('Quick Notes: Creating floating button as last resort');
            createFloatingButton();
          }
        }
      }, 500);
    } else {
      console.log('Quick Notes: Button successfully injected on first attempt');
    }

    // Periodic check to ensure button stays injected across page navigations
    // Check every 2 seconds if button is still present and action bar exists
    setInterval(() => {
      if (isActive) {
        // Check if we're on a page that should have the button
        if (!shouldShowButton()) {
          // Remove button if it exists but shouldn't be shown on this page
          if (notesButton && document.body.contains(notesButton)) {
            console.log('Quick Notes: Removing button - not on allowed page');
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
            console.log('Quick Notes: Periodic check - button missing, re-injecting');
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
          console.log('Quick Notes: Removing button - not on allowed page');
          notesButton.remove();
        }
        return;
      }

      // Check if our button still exists in the DOM
      if (!notesButton || !document.body.contains(notesButton)) {
        console.log('Quick Notes: Button removed from DOM, re-injecting');
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
              const hasDivButtons = bar.querySelectorAll('div[role="button"]').length > 0;
              if (hasDivButtons) {
                console.log('Quick Notes: Action bar found without button, injecting');
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
  function handleKeyboard(e) {
    // Alt + N to toggle panel
    if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      togglePanel();
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

    // Only initialize on allowed pages (daily-logs and time)
    // Note: The button injection logic also checks this, but we check here
    // to avoid loading resources unnecessarily on other pages
    const path = window.location.pathname;
    const allowedPages = ['/daily-logs', '/time'];
    const isAllowedPage = allowedPages.some(page => path.includes(page));

    if (!isAllowedPage) {
      console.log('Quick Notes: Skipping - not on allowed page (daily-logs or time)');
      console.log('Quick Notes: Current path:', path);
      return;
    }

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
    console.log('Quick Notes feature activated');
  }

  // Cleanup feature
  function cleanup() {
    if (!isActive) return;

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

    console.log('Quick Notes feature deactivated');
  }

  return {
    init,
    cleanup,
    isActive: () => isActive
  };
})();

// Export to window
window.QuickNotesFeature = QuickNotesFeature;
