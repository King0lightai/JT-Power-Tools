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

  // Generate unique ID
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Load notes from storage
  async function loadNotes() {
    return new Promise((resolve) => {
      chrome.storage.sync.get([STORAGE_KEY], (result) => {
        notes = result[STORAGE_KEY] || [];
        resolve(notes);
      });
    });
  }

  // Save notes to storage
  async function saveNotes() {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ [STORAGE_KEY]: notes }, () => {
        resolve();
      });
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
    notesPanel.classList.add('editor-open');
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
          notesPanel.classList.add('editor-open');
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
      closeButton.addEventListener('click', closeEditor);
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
      <textarea
        class="jt-notes-content-input"
        placeholder="Start typing your note...&#10;&#10;Formatting:&#10;**bold** or *bold*&#10;_italic_&#10;- bullet item&#10;- [ ] unchecked&#10;- [x] checked"
      >${escapeHtml(currentNote.content)}</textarea>
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
      debouncedSave('content', e.target.value);
    });

    closeButton.addEventListener('click', closeEditor);

    // Add formatting button handlers
    const formatButtons = editorContainer.querySelectorAll('.jt-notes-format-btn');
    formatButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const formatType = btn.dataset.format;
        formatText(contentInput, formatType);
      });
    });

    // Add keyboard shortcuts for formatting
    contentInput.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + B for bold
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        formatText(contentInput, 'bold');
      }
      // Ctrl/Cmd + I for italic
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        formatText(contentInput, 'italic');
      }
    });

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

  // Parse markdown to HTML
  function parseMarkdown(text) {
    if (!text) return '';

    // Escape HTML first
    let html = escapeHtml(text);

    // Parse bold **text** or *text*
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<strong>$1</strong>');

    // Parse italic _text_
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');

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

  // Format text based on selection
  function formatText(textarea, formatType) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const beforeText = textarea.value.substring(0, start);
    const afterText = textarea.value.substring(end);

    let newText = '';
    let cursorOffset = 0;

    switch (formatType) {
      case 'bold':
        if (selectedText) {
          newText = `${beforeText}**${selectedText}**${afterText}`;
          cursorOffset = start + 2 + selectedText.length + 2;
        } else {
          newText = `${beforeText}****${afterText}`;
          cursorOffset = start + 2;
        }
        break;

      case 'italic':
        if (selectedText) {
          newText = `${beforeText}_${selectedText}_${afterText}`;
          cursorOffset = start + 1 + selectedText.length + 1;
        } else {
          newText = `${beforeText}__${afterText}`;
          cursorOffset = start + 1;
        }
        break;

      case 'bullet':
        const bulletLine = selectedText || 'List item';
        newText = `${beforeText}- ${bulletLine}${afterText}`;
        cursorOffset = start + 2 + bulletLine.length;
        break;

      case 'checkbox':
        const checkboxLine = selectedText || 'Todo item';
        newText = `${beforeText}- [ ] ${checkboxLine}${afterText}`;
        cursorOffset = start + 6 + checkboxLine.length;
        break;
    }

    textarea.value = newText;
    textarea.setSelectionRange(cursorOffset, cursorOffset);
    textarea.focus();

    // Trigger input event to save changes
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
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

  // Close editor (keeps sidebar open)
  function closeEditor() {
    notesPanel.classList.remove('editor-open');
    currentNoteId = null;
    renderNotesList();
  }

  // Toggle panel visibility
  function togglePanel() {
    if (!notesPanel) return;

    const isVisible = notesPanel.classList.contains('visible');
    if (isVisible) {
      // Close everything
      notesPanel.classList.remove('visible');
      notesPanel.classList.remove('editor-open');
      if (notesButton) {
        notesButton.classList.remove('jt-notes-button-active');
      }
    } else {
      // Open just the sidebar initially
      notesPanel.classList.add('visible');
      if (notesButton) {
        notesButton.classList.add('jt-notes-button-active');
      }
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
    notesButton.className = 'inline-block align-bottom relative cursor-pointer select-none truncate py-2 px-4 shadow-xs active:shadow-inner text-gray-600 bg-white hover:bg-gray-50 first:rounded-l-sm last:rounded-r-sm border-y border-l last:border-r text-center shrink-0 jt-quick-notes-btn';
    notesButton.setAttribute('role', 'button');
    notesButton.setAttribute('tabindex', '0');
    notesButton.setAttribute('title', 'Quick Notes (Ctrl+Shift+N)');

    notesButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="inline-block overflow-visible h-[1em] w-[1em] align-[-0.125em]" viewBox="0 0 24 24">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg> Quick Notes
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

    // Insert at the beginning of the container (to the left of existing buttons)
    if (container.firstChild) {
      container.insertBefore(notesButton, container.firstChild);
    } else {
      container.appendChild(notesButton);
    }
  }

  // Find and inject button into action buttons container
  function injectQuickNotesButton() {
    // Look for the action buttons container
    const container = document.querySelector('div.absolute.inset-0.flex.justify-end');

    if (container && !container.querySelector('.jt-quick-notes-btn')) {
      createQuickNotesButton(container);
    }
  }

  // Set up observer to watch for action buttons container
  function setupButtonObserver() {
    // Initial injection attempt
    injectQuickNotesButton();

    // Watch for DOM changes to re-inject button if needed
    buttonObserver = new MutationObserver(() => {
      injectQuickNotesButton();
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
      <div class="jt-notes-sidebar">
        <div class="jt-notes-sidebar-header">
          <h3 class="jt-notes-sidebar-title">Quick Notes</h3>
          <button class="jt-notes-new-button" title="New note">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="inline-block overflow-visible h-[1em] w-[1em] align-[-0.125em]" viewBox="0 0 24 24">
              <path d="M5 12h14M12 5v14"></path>
            </svg> New
          </button>
        </div>
        <div class="jt-notes-search-container">
          <input
            type="text"
            class="jt-notes-search-input"
            placeholder="Search notes..."
          />
        </div>
        <div class="jt-notes-list"></div>
      </div>
      <div class="jt-notes-editor"></div>
    `;

    // Add event handlers
    const newButton = notesPanel.querySelector('.jt-notes-new-button');
    newButton.addEventListener('click', createNote);

    const searchInput = notesPanel.querySelector('.jt-notes-search-input');
    searchInput.addEventListener('input', (e) => {
      searchTerm = e.target.value;
      renderNotesList();
    });

    document.body.appendChild(notesPanel);
  }

  // Keyboard shortcuts
  function handleKeyboard(e) {
    // Ctrl/Cmd + Shift + N to toggle panel
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
      e.preventDefault();
      togglePanel();
    }

    // Escape to close panel
    if (e.key === 'Escape' && notesPanel && notesPanel.classList.contains('visible')) {
      e.preventDefault();
      togglePanel();
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
