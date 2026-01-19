/**
 * Quick Notes Storage Module
 * Handles all storage operations for quick notes
 *
 * Dependencies: None (uses Chrome Storage API directly)
 */

const QuickNotesStorage = (() => {
  // Storage keys
  const STORAGE_KEY = 'jtToolsQuickNotes';
  const WIDTH_STORAGE_KEY = 'jtToolsQuickNotesWidth';

  // Width constraints
  const MIN_WIDTH = 320;
  const MAX_WIDTH = 1200;

  /**
   * Load notes from Chrome storage
   * @returns {Promise<Array>} Array of note objects
   */
  async function loadNotes() {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get([STORAGE_KEY], (result) => {
          if (chrome.runtime.lastError) {
            console.error('Quick Notes Storage: Error loading notes:', chrome.runtime.lastError.message);
            resolve([]);
            return;
          }
          resolve(result[STORAGE_KEY] || []);
        });
      } catch (error) {
        console.error('Quick Notes Storage: Unexpected error loading notes:', error);
        resolve([]);
      }
    });
  }

  /**
   * Save notes to Chrome storage
   * @param {Array} notes - Array of note objects to save
   * @returns {Promise<boolean>} Success status
   */
  async function saveNotes(notes) {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.set({ [STORAGE_KEY]: notes }, () => {
          if (chrome.runtime.lastError) {
            console.error('Quick Notes Storage: Error saving notes:', chrome.runtime.lastError.message);
            resolve(false);
            return;
          }
          resolve(true);
        });
      } catch (error) {
        console.error('Quick Notes Storage: Unexpected error saving notes:', error);
        resolve(false);
      }
    });
  }

  /**
   * Export notes as JSON file
   * @param {Array} notes - Array of notes to export
   * @returns {boolean} Success status
   */
  function exportNotes(notes) {
    if (!notes || notes.length === 0) {
      alert('No notes to export. Create some notes first!');
      return false;
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

    return true;
  }

  /**
   * Import notes from JSON file
   * @param {Array} existingNotes - Current notes array
   * @param {Function} onImport - Callback with imported notes and merge mode
   */
  function importNotes(existingNotes, onImport) {
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
        const shouldMerge = confirm(
          `Found ${importData.notes.length} note(s) in file.\n\n` +
          `Click OK to MERGE with existing notes (${existingNotes.length})\n` +
          `Click Cancel to REPLACE all existing notes`
        );

        if (shouldMerge) {
          // Merge: Add imported notes that don't already exist
          const existingIds = new Set(existingNotes.map(n => n.id));
          const newNotes = importData.notes.filter(n => !existingIds.has(n.id));
          const mergedNotes = [...existingNotes, ...newNotes];

          onImport(mergedNotes, 'merge', newNotes.length);
        } else {
          // Replace: Confirm destructive action
          if (confirm('Are you sure? This will DELETE all existing notes and replace them with imported notes.')) {
            onImport(importData.notes, 'replace', importData.notes.length);
          }
        }
      } catch (error) {
        console.error('Quick Notes Storage: Import error:', error);
        alert('Failed to import notes. Please make sure the file is a valid JT Power Tools notes export.');
      }
    };

    input.click();
  }

  /**
   * Save panel width to storage
   * @param {number} width - Width in pixels
   */
  function saveWidth(width) {
    const clampedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width));
    chrome.storage.sync.set({ [WIDTH_STORAGE_KEY]: clampedWidth });
  }

  /**
   * Load saved panel width from storage
   * @returns {Promise<number|null>} Saved width or null
   */
  async function loadWidth() {
    return new Promise((resolve) => {
      chrome.storage.sync.get([WIDTH_STORAGE_KEY], (result) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(result[WIDTH_STORAGE_KEY] || null);
      });
    });
  }

  /**
   * Generate unique ID for notes
   * @returns {string} Unique ID
   */
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Public API
  return {
    // Constants
    STORAGE_KEY,
    WIDTH_STORAGE_KEY,
    MIN_WIDTH,
    MAX_WIDTH,

    // Methods
    loadNotes,
    saveNotes,
    exportNotes,
    importNotes,
    saveWidth,
    loadWidth,
    generateId
  };
})();

// Make available globally
if (typeof window !== 'undefined') {
  window.QuickNotesStorage = QuickNotesStorage;
}
