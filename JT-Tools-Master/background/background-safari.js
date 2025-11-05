// Safari-compatible background script
// Uses browser.* API (available via browser-polyfill.js)

// Default settings
const defaultSettings = {
  dragDrop: true,
  contrastFix: true,
  formatter: true,
  jobSwitcher: true,
  darkMode: false,
  rgbTheme: false
};

// Get the browser API (works in both Chrome and Safari via polyfill)
const api = typeof browser !== 'undefined' ? browser : chrome;

// Initialize extension on install
api.runtime.onInstalled.addListener(async (details) => {
  console.log('JT Power Tools installed:', details.reason);

  try {
    // Set default settings on fresh install
    if (details.reason === 'install') {
      await api.storage.sync.set({ jtToolsSettings: defaultSettings });
      console.log('Default settings initialized:', defaultSettings);
    }

    // On update, merge with existing settings
    if (details.reason === 'update') {
      const result = await api.storage.sync.get(['jtToolsSettings']);
      const existingSettings = result.jtToolsSettings || {};
      const mergedSettings = { ...defaultSettings, ...existingSettings };
      await api.storage.sync.set({ jtToolsSettings: mergedSettings });
      console.log('Settings updated after extension update:', mergedSettings);
    }
  } catch (error) {
    console.error('Error initializing settings:', error);
  }
});

// Listen for messages from popup or content scripts
api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);

  switch (message.type) {
    case 'SETTINGS_UPDATED':
      handleSettingsUpdate(message.settings)
        .then(() => sendResponse({ success: true }))
        .catch(error => {
          console.error('Error handling settings update:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep channel open for async response

    case 'GET_SETTINGS':
      getSettings()
        .then(settings => {
          sendResponse({ settings });
        })
        .catch(error => {
          console.error('Error getting settings:', error);
          sendResponse({ settings: defaultSettings });
        });
      return true; // Keep channel open for async response

    default:
      console.warn('Unknown message type:', message.type);
      sendResponse({ success: false, error: 'Unknown message type' });
  }

  return true; // Keep message channel open
});

// Handle settings update
async function handleSettingsUpdate(settings) {
  console.log('Settings updated:', settings);

  try {
    // Store in browser storage
    await api.storage.sync.set({ jtToolsSettings: settings });

    // Notify all JobTread tabs about the settings change
    const tabs = await api.tabs.query({ url: 'https://*.jobtread.com/*' });

    // Send message to each tab
    for (const tab of tabs) {
      try {
        await api.tabs.sendMessage(tab.id, {
          type: 'SETTINGS_CHANGED',
          settings: settings
        });
      } catch (err) {
        // Tab might not have content script loaded yet, that's okay
        console.log('Could not notify tab:', tab.id, err.message);
      }
    }
  } catch (error) {
    console.error('Error in handleSettingsUpdate:', error);
    throw error;
  }
}

// Get current settings
async function getSettings() {
  try {
    const result = await api.storage.sync.get(['jtToolsSettings']);
    return result.jtToolsSettings || defaultSettings;
  } catch (error) {
    console.error('Error getting settings:', error);
    return defaultSettings;
  }
}

console.log('JT Power Tools background script loaded (Safari-compatible)');
