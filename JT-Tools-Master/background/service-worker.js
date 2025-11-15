/**
 * JT Power Tools - Background Service Worker
 * Handles settings persistence, syncing, and tab communication
 */

// Default settings
const defaultSettings = {
  dragDrop: true,
  contrastFix: true,
  formatter: true,
  previewMode: false,
  darkMode: false,
  rgbTheme: false,
  quickJobSwitcher: true,
  budgetHierarchy: false,
  quickNotes: true,
  themeColors: {
    primary: '#3B82F6',
    background: '#F3E8FF',
    text: '#1F1B29'
  },
  savedThemes: [null, null, null]
};

/**
 * Safe Chrome storage wrapper for service worker context
 */
const safeStorage = {
  async get(keys, defaults = {}) {
    try {
      const result = await chrome.storage.sync.get(keys);
      return typeof keys === 'string'
        ? { [keys]: result[keys] ?? defaults[keys] }
        : { ...defaults, ...result };
    } catch (error) {
      console.error('JT-Tools Storage Error (get):', error);
      return defaults;
    }
  },

  async set(data) {
    try {
      await chrome.storage.sync.set(data);
      return true;
    } catch (error) {
      console.error('JT-Tools Storage Error (set):', error);
      return false;
    }
  }
};

/**
 * Initialize extension on install or update
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    console.log('JT Power Tools installed:', details.reason);

    // Set default settings on fresh install
    if (details.reason === 'install') {
      const success = await safeStorage.set({ jtToolsSettings: defaultSettings });
      if (success) {
        console.log('Default settings initialized:', defaultSettings);
      } else {
        console.error('Failed to initialize default settings');
      }
    }

    // On update, merge with existing settings and show release notes
    if (details.reason === 'update') {
      try {
        const result = await safeStorage.get(['jtToolsSettings']);
        const existingSettings = result.jtToolsSettings || {};
        const mergedSettings = { ...defaultSettings, ...existingSettings };

        const success = await safeStorage.set({ jtToolsSettings: mergedSettings });
        if (success) {
          console.log('Settings updated after extension update:', mergedSettings);
        } else {
          console.error('Failed to update settings after extension update');
        }

        // Open changelog to show what's new
        try {
          await chrome.tabs.create({
            url: 'https://king0lightai.github.io/JT-Power-Tools/changelog.html',
            active: true
          });
          console.log('Opened changelog to show release notes');
        } catch (tabError) {
          console.error('Failed to open changelog tab:', tabError);
        }
      } catch (updateError) {
        console.error('Error during extension update process:', updateError);
      }
    }
  } catch (error) {
    console.error('JT Power Tools: Unhandled error in onInstalled listener:', error);
  }
});

/**
 * Listen for messages from popup or content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    console.log('Background received message:', message);

    if (!message || !message.type) {
      console.warn('Invalid message received:', message);
      sendResponse({ success: false, error: 'Invalid message format' });
      return false;
    }

    switch (message.type) {
      case 'SETTINGS_UPDATED':
        // Handle settings update asynchronously
        handleSettingsUpdate(message.settings)
          .then(() => {
            sendResponse({ success: true });
          })
          .catch(error => {
            console.error('Failed to handle settings update:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true; // Keep channel open for async response

      case 'GET_SETTINGS':
        // Get settings asynchronously
        getSettings()
          .then(settings => {
            sendResponse({ success: true, settings });
          })
          .catch(error => {
            console.error('Failed to get settings:', error);
            sendResponse({ success: false, error: error.message, settings: defaultSettings });
          });
        return true; // Keep channel open for async response

      default:
        console.warn('Unknown message type:', message.type);
        sendResponse({ success: false, error: 'Unknown message type' });
        return false;
    }
  } catch (error) {
    console.error('JT Power Tools: Unhandled error in message listener:', error);
    sendResponse({ success: false, error: 'Internal error processing message' });
    return false;
  }
});

/**
 * Handle settings update
 * @param {Object} settings - New settings to save
 */
async function handleSettingsUpdate(settings) {
  try {
    if (!settings || typeof settings !== 'object') {
      throw new Error('Invalid settings object provided');
    }

    console.log('Settings updated:', settings);

    // Store in Chrome storage
    const success = await safeStorage.set({ jtToolsSettings: settings });
    if (!success) {
      throw new Error('Failed to save settings to storage');
    }

    // Notify all JobTread tabs about the settings change
    try {
      const tabs = await chrome.tabs.query({ url: 'https://*.jobtread.com/*' });

      // Use Promise.allSettled to handle all tab notifications
      const notifications = tabs.map(tab =>
        chrome.tabs.sendMessage(tab.id, {
          type: 'SETTINGS_CHANGED',
          settings: settings
        }).catch(err => {
          // Tab might not have content script loaded yet, that's okay
          console.log('Could not notify tab:', tab.id, err.message);
          return null;
        })
      );

      await Promise.allSettled(notifications);
      console.log('Notified', tabs.length, 'tabs about settings change');
    } catch (tabError) {
      console.error('Error querying or notifying tabs:', tabError);
      // Don't throw - settings were saved successfully even if notifications failed
    }
  } catch (error) {
    console.error('JT Power Tools: Error in handleSettingsUpdate:', error);
    throw error; // Re-throw to let caller handle
  }
}

/**
 * Get current settings with fallback to defaults
 * @returns {Promise<Object>} Current settings
 */
async function getSettings() {
  try {
    const result = await safeStorage.get(['jtToolsSettings']);
    const settings = result.jtToolsSettings;

    if (!settings || typeof settings !== 'object') {
      console.warn('Invalid or missing settings, using defaults');
      return defaultSettings;
    }

    // Merge with defaults to ensure all keys exist
    return { ...defaultSettings, ...settings };
  } catch (error) {
    console.error('JT Power Tools: Error in getSettings:', error);
    return defaultSettings;
  }
}

console.log('JT Power Tools background service worker loaded');
