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

// Initialize extension on install
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('JT Power Tools installed:', details.reason);

  // Set default settings on fresh install
  if (details.reason === 'install') {
    await chrome.storage.sync.set({ jtToolsSettings: defaultSettings });
    console.log('Default settings initialized:', defaultSettings);
  }

  // On update, merge with existing settings
  if (details.reason === 'update') {
    const result = await chrome.storage.sync.get(['jtToolsSettings']);
    const existingSettings = result.jtToolsSettings || {};
    const mergedSettings = { ...defaultSettings, ...existingSettings };
    await chrome.storage.sync.set({ jtToolsSettings: mergedSettings });
    console.log('Settings updated after extension update:', mergedSettings);
  }
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);

  switch (message.type) {
    case 'SETTINGS_UPDATED':
      handleSettingsUpdate(message.settings);
      sendResponse({ success: true });
      break;

    case 'GET_SETTINGS':
      getSettings().then(settings => {
        sendResponse({ settings });
      });
      return true; // Keep channel open for async response

    default:
      console.warn('Unknown message type:', message.type);
      sendResponse({ success: false, error: 'Unknown message type' });
  }
});

// Handle settings update
async function handleSettingsUpdate(settings) {
  console.log('Settings updated:', settings);

  // Store in Chrome storage
  await chrome.storage.sync.set({ jtToolsSettings: settings });

  // Notify all JobTread tabs about the settings change
  const tabs = await chrome.tabs.query({ url: 'https://*.jobtread.com/*' });

  tabs.forEach(tab => {
    chrome.tabs.sendMessage(tab.id, {
      type: 'SETTINGS_CHANGED',
      settings: settings
    }).catch(err => {
      // Tab might not have content script loaded yet, that's okay
      console.log('Could not notify tab:', tab.id, err.message);
    });
  });
}

// Get current settings
async function getSettings() {
  const result = await chrome.storage.sync.get(['jtToolsSettings']);
  return result.jtToolsSettings || defaultSettings;
}

console.log('JT Power Tools background service worker loaded');
