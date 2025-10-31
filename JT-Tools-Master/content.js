// JT-Tools Master Suite - Content Script Orchestrator
// Manages loading and unloading of feature modules based on user settings

console.log('JT-Tools Master Suite: Content script loaded');

// Feature module registry
const featureModules = {
  dragDrop: {
    name: 'Drag & Drop',
    feature: () => window.DragDropFeature,
    instance: null
  },
  contrastFix: {
    name: 'Contrast Fix',
    feature: () => window.ContrastFixFeature,
    instance: null
  },
  formatter: {
    name: 'Formatter',
    feature: () => window.FormatterFeature,
    instance: null
  }
};

// Current settings
let currentSettings = {
  dragDrop: true,
  contrastFix: true,
  formatter: true
};

// Load settings from storage
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get(['jtToolsSettings']);
    currentSettings = result.jtToolsSettings || currentSettings;
    console.log('JT-Tools: Settings loaded:', currentSettings);
    return currentSettings;
  } catch (error) {
    console.error('JT-Tools: Error loading settings:', error);
    return currentSettings;
  }
}

// Initialize a feature
function initializeFeature(featureKey) {
  const module = featureModules[featureKey];

  try {
    // Get the feature from window
    const FeatureClass = module.feature();

    if (!FeatureClass) {
      console.error(`JT-Tools: ${module.name} not found on window`);
      return;
    }

    // Initialize if not already active
    if (!FeatureClass.isActive()) {
      FeatureClass.init();
      module.instance = FeatureClass;
      console.log(`JT-Tools: ${module.name} initialized`);
    } else {
      console.log(`JT-Tools: ${module.name} already active`);
    }
  } catch (error) {
    console.error(`JT-Tools: Error initializing ${module.name}:`, error);
  }
}

// Cleanup a feature
function cleanupFeature(featureKey) {
  const module = featureModules[featureKey];

  try {
    const FeatureClass = module.feature();

    if (FeatureClass && FeatureClass.isActive()) {
      FeatureClass.cleanup();
      console.log(`JT-Tools: ${module.name} cleaned up`);
    }
  } catch (error) {
    console.error(`JT-Tools: Error cleaning up ${module.name}:`, error);
  }
}

// Initialize all enabled features
function initializeAllFeatures() {
  console.log('JT-Tools: Initializing features based on settings...');

  for (const [key, enabled] of Object.entries(currentSettings)) {
    if (enabled && featureModules[key]) {
      initializeFeature(key);
    }
  }

  console.log('JT-Tools: All enabled features initialized');
}

// Handle settings changes
function handleSettingsChange(newSettings) {
  console.log('JT-Tools: Settings changed:', newSettings);

  // Compare old and new settings
  for (const [key, enabled] of Object.entries(newSettings)) {
    const wasEnabled = currentSettings[key];

    if (enabled && !wasEnabled) {
      // Feature was enabled
      console.log(`JT-Tools: Enabling ${featureModules[key].name}`);
      initializeFeature(key);
    } else if (!enabled && wasEnabled) {
      // Feature was disabled
      console.log(`JT-Tools: Disabling ${featureModules[key].name}`);
      cleanupFeature(key);
    }
  }

  // Update current settings
  currentSettings = newSettings;
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('JT-Tools: Message received:', message);

  switch (message.type) {
    case 'SETTINGS_CHANGED':
      handleSettingsChange(message.settings);
      sendResponse({ success: true });
      break;

    default:
      console.warn('JT-Tools: Unknown message type:', message.type);
      sendResponse({ success: false, error: 'Unknown message type' });
  }
});

// Initialize on page load
(async function() {
  console.log('JT-Tools: Starting initialization...');

  // Load settings
  await loadSettings();

  // Wait a moment for all scripts to be ready
  setTimeout(() => {
    // Initialize all enabled features
    initializeAllFeatures();
    console.log('JT-Tools Master Suite: Ready!');
  }, 100);
})();
