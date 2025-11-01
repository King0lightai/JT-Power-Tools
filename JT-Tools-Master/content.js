// JT Power Tools - Content Script Orchestrator
// Manages loading and unloading of feature modules based on user settings

console.log('JT Power Tools: Content script loaded');

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
  },
  darkMode: {
    name: 'Dark Mode',
    feature: () => window.DarkModeFeature,
    instance: null
  },
  rgbTheme: {
    name: 'RGB Custom Theme',
    feature: () => window.RGBThemeFeature,
    instance: null
  }
};

// Current settings
let currentSettings = {
  dragDrop: true,
  contrastFix: true,
  formatter: true,
  darkMode: false,
  rgbTheme: false,
  themeColor: '#3B82F6' // Default blue
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
      // Special handling for RGB theme - pass theme color
      if (featureKey === 'rgbTheme' && currentSettings.themeColor) {
        FeatureClass.init(currentSettings.themeColor);
      } else {
        FeatureClass.init();
      }
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
    // Skip non-feature settings like rgbColors
    if (!featureModules[key]) continue;

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

  // Special handling for theme color changes
  if (newSettings.rgbTheme && newSettings.themeColor) {
    const RGBThemeFeature = window.RGBThemeFeature;
    if (RGBThemeFeature && RGBThemeFeature.isActive()) {
      // Check if color actually changed
      const colorChanged = currentSettings.themeColor !== newSettings.themeColor;
      if (colorChanged) {
        console.log('JT-Tools: Theme color updated, applying new color');
        RGBThemeFeature.updateColor(newSettings.themeColor);
      }
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

// Wait for all features to be available on window
async function waitForFeatures(maxAttempts = 100, delayMs = 150) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const allAvailable = Object.values(featureModules).every(module => {
      const feature = module.feature();
      return feature !== null && feature !== undefined;
    });

    if (allAvailable) {
      console.log(`JT-Tools: All features loaded (attempt ${attempt + 1})`);
      return true;
    }

    // Only log every 10 attempts to reduce console spam
    if (attempt % 10 === 0 || attempt < 5) {
      console.log(`JT-Tools: Waiting for features... (attempt ${attempt + 1}/${maxAttempts})`);

      // Log which features are missing
      Object.entries(featureModules).forEach(([key, module]) => {
        const feature = module.feature();
        if (!feature) {
          console.log(`  - ${module.name} not yet available`);
        }
      });
    }

    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  console.error('JT-Tools: Timeout waiting for all features to load');

  // Log which features failed to load
  Object.entries(featureModules).forEach(([key, module]) => {
    const feature = module.feature();
    if (!feature) {
      console.error(`  - ${module.name} FAILED to load`);
    }
  });

  return false;
}

// Initialize on page load
(async function() {
  console.log('JT-Tools: Starting initialization...');

  // Load settings
  await loadSettings();

  // Wait for all feature scripts to be ready
  const featuresReady = await waitForFeatures();

  if (featuresReady) {
    // Initialize all enabled features
    initializeAllFeatures();
    console.log('JT Power Tools: Ready!');
  } else {
    console.error('JT Power Tools: Failed to initialize - features not loaded');
  }
})();
