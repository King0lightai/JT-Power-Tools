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
  let sidebarCollapsed = false;
  const STORAGE_KEY = 'jtToolsQuickNotes';
  const COLLAPSED_STATE_KEY = 'jtToolsQuickNotesSidebarCollapsed';

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

    notesList.innerHTML = filteredNotes.map(note => `
      <div class="jt-note-item ${currentNoteId === note.id ? 'active' : ''}" data-note-id="${note.id}">
        <div class="jt-note-item-header">
          <div class="jt-note-item-title">${escapeHtml(note.title)}</div>
          <button class="jt-note-delete" data-note-id="${note.id}" title="Delete note">×</button>
        </div>
        <div class="jt-note-item-preview">${escapeHtml(note.content.slice(0, 100))}</div>
        <div class="jt-note-item-date">${formatDate(note.updatedAt)}</div>
      </div>
    `).join('');

    // Add click handlers
    notesList.querySelectorAll('.jt-note-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('jt-note-delete')) {
          currentNoteId = item.dataset.noteId;
          renderNotesList();
          renderNoteEditor();
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
          <button class="jt-notes-expand-button" title="Expand sidebar">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
              <path d="M9 18l6-6-6-6"></path>
            </svg>
          </button>
          <div class="jt-notes-sidebar-title">Quick Notes</div>
          <button class="jt-notes-close-button" title="Close (Esc)"></button>
        </div>
        <div class="jt-notes-editor-empty">
          <div class="jt-notes-editor-empty-icon">📝</div>
          <div class="jt-notes-editor-empty-text">Select a note to view or create a new one</div>
        </div>
      `;

      // Add button handlers
      const expandButton = editorContainer.querySelector('.jt-notes-expand-button');
      expandButton.addEventListener('click', toggleSidebar);

      const closeButton = editorContainer.querySelector('.jt-notes-close-button');
      closeButton.addEventListener('click', togglePanel);
      return;
    }

    editorContainer.innerHTML = `
      <div class="jt-notes-editor-header">
        <button class="jt-notes-expand-button" title="Expand sidebar">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
            <path d="M9 18l6-6-6-6"></path>
          </svg>
        </button>
        <input
          type="text"
          class="jt-notes-title-input"
          value="${escapeHtml(currentNote.title)}"
          placeholder="Note title..."
        />
        <button class="jt-notes-close-button" title="Close (Esc)"></button>
      </div>
      <textarea
        class="jt-notes-content-input"
        placeholder="Start typing your note..."
      >${escapeHtml(currentNote.content)}</textarea>
      <div class="jt-notes-editor-footer">
        <span class="jt-notes-word-count">${countWords(currentNote.content)} words</span>
        <span class="jt-notes-updated">Updated ${formatDate(currentNote.updatedAt)}</span>
      </div>
    `;

    // Add input handlers with debouncing
    const titleInput = editorContainer.querySelector('.jt-notes-title-input');
    const contentInput = editorContainer.querySelector('.jt-notes-content-input');
    const expandButton = editorContainer.querySelector('.jt-notes-expand-button');
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

    expandButton.addEventListener('click', toggleSidebar);
    closeButton.addEventListener('click', togglePanel);

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

  // Escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Load sidebar collapsed state from localStorage
  function loadSidebarState() {
    const saved = localStorage.getItem(COLLAPSED_STATE_KEY);
    sidebarCollapsed = saved === 'true';
  }

  // Save sidebar collapsed state to localStorage
  function saveSidebarState() {
    localStorage.setItem(COLLAPSED_STATE_KEY, sidebarCollapsed.toString());
  }

  // Toggle sidebar collapse
  function toggleSidebar() {
    sidebarCollapsed = !sidebarCollapsed;
    saveSidebarState();

    if (sidebarCollapsed) {
      notesPanel.classList.add('sidebar-collapsed');
    } else {
      notesPanel.classList.remove('sidebar-collapsed');
    }
  }

  // Toggle panel visibility
  function togglePanel() {
    if (!notesPanel) return;

    const isVisible = notesPanel.classList.contains('visible');
    if (isVisible) {
      notesPanel.classList.remove('visible');
      if (notesButton) {
        notesButton.classList.remove('jt-notes-button-active');
      }
    } else {
      notesPanel.classList.add('visible');
      // Apply collapsed state
      if (sidebarCollapsed) {
        notesPanel.classList.add('sidebar-collapsed');
      }
      if (notesButton) {
        notesButton.classList.add('jt-notes-button-active');
      }
      // Focus search if panel is opening and sidebar is visible
      if (!sidebarCollapsed) {
        const searchInput = notesPanel.querySelector('.jt-notes-search-input');
        if (searchInput && !currentNoteId) {
          setTimeout(() => searchInput.focus(), 100);
        }
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
          <button class="jt-notes-collapse-toggle" title="Collapse sidebar">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
              <path d="M15 18l-6-6 6-6"></path>
            </svg>
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

    const collapseButton = notesPanel.querySelector('.jt-notes-collapse-toggle');
    collapseButton.addEventListener('click', toggleSidebar);

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

  // Initialize feature
  async function init() {
    if (isActive) return;

    // Load CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('styles/quick-notes.css');
    link.id = 'jt-quick-notes-styles';
    document.head.appendChild(link);

    // Load notes and state from storage
    await loadNotes();
    loadSidebarState();

    // Create UI elements
    setupButtonObserver();
    createNotesPanel();

    // Render initial state
    renderNotesList();
    renderNoteEditor();

    // Add keyboard listener
    document.addEventListener('keydown', handleKeyboard);

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

    // Reset state
    notes = [];
    currentNoteId = null;
    searchTerm = '';
    sidebarCollapsed = false;
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
