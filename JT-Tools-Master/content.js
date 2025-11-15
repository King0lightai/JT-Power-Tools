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
  previewMode: {
    name: 'Preview Mode',
    feature: () => window.PreviewModeFeature,
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
  },
  quickJobSwitcher: {
    name: 'Quick Job Switcher',
    feature: () => window.QuickJobSwitcherFeature,
    instance: null
  },
  budgetHierarchy: {
    name: 'Budget Hierarchy Shading',
    feature: () => window.BudgetHierarchyFeature,
    instance: null
  },
  quickNotes: {
    name: 'Quick Notes',
    feature: () => window.QuickNotesFeature,
    instance: null
  }
};

// Current settings
let currentSettings = {
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
 * Load settings from storage with error handling
 * @returns {Promise<Object>} Current settings
 */
async function loadSettings() {
  try {
    // Use StorageWrapper if available for safer storage access
    if (window.StorageWrapper) {
      const result = await window.StorageWrapper.get(['jtToolsSettings'], { jtToolsSettings: currentSettings });
      currentSettings = result.jtToolsSettings || currentSettings;
    } else {
      // Fallback to direct chrome storage
      const result = await chrome.storage.sync.get(['jtToolsSettings']);
      currentSettings = result.jtToolsSettings || currentSettings;
    }

    console.log('JT-Tools: Settings loaded:', currentSettings);
    return currentSettings;
  } catch (error) {
    console.error('JT-Tools: Error loading settings:', error);
    return currentSettings;
  }
}

/**
 * Initialize a feature module safely
 * @param {string} featureKey - Feature key from featureModules
 */
function initializeFeature(featureKey) {
  const module = featureModules[featureKey];

  if (!module) {
    console.error(`JT-Tools: Unknown feature key: ${featureKey}`);
    return;
  }

  try {
    // Get the feature from window
    const FeatureClass = module.feature();

    if (!FeatureClass) {
      console.error(`JT-Tools: ${module.name} not found on window`);
      return;
    }

    // Check if feature has required interface
    if (typeof FeatureClass.init !== 'function' || typeof FeatureClass.isActive !== 'function') {
      console.error(`JT-Tools: ${module.name} missing required methods (init/isActive)`);
      return;
    }

    // Initialize if not already active
    if (!FeatureClass.isActive()) {
      // Special handling for RGB theme - pass theme colors
      if (featureKey === 'rgbTheme' && currentSettings.themeColors) {
        FeatureClass.init(currentSettings.themeColors);
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

/**
 * Cleanup a feature module safely
 * @param {string} featureKey - Feature key from featureModules
 */
function cleanupFeature(featureKey) {
  const module = featureModules[featureKey];

  if (!module) {
    console.error(`JT-Tools: Unknown feature key: ${featureKey}`);
    return;
  }

  try {
    const FeatureClass = module.feature();

    if (!FeatureClass) {
      console.warn(`JT-Tools: ${module.name} not found during cleanup`);
      return;
    }

    if (typeof FeatureClass.cleanup !== 'function') {
      console.warn(`JT-Tools: ${module.name} missing cleanup method`);
      return;
    }

    if (typeof FeatureClass.isActive === 'function' && FeatureClass.isActive()) {
      FeatureClass.cleanup();
      console.log(`JT-Tools: ${module.name} cleaned up`);
    } else {
      console.log(`JT-Tools: ${module.name} not active, skipping cleanup`);
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

/**
 * Handle settings changes from popup or background
 * @param {Object} newSettings - New settings object
 */
function handleSettingsChange(newSettings) {
  try {
    if (!newSettings || typeof newSettings !== 'object') {
      console.error('JT-Tools: Invalid settings object received');
      return;
    }

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

    // Special handling for theme colors changes
    if (newSettings.rgbTheme && newSettings.themeColors) {
      const RGBThemeFeature = window.RGBThemeFeature;
      if (RGBThemeFeature && typeof RGBThemeFeature.isActive === 'function' && RGBThemeFeature.isActive()) {
        // Check if colors actually changed
        const colorsChanged = JSON.stringify(currentSettings.themeColors) !== JSON.stringify(newSettings.themeColors);
        if (colorsChanged && typeof RGBThemeFeature.updateColors === 'function') {
          console.log('JT-Tools: Theme colors updated, applying new colors');
          RGBThemeFeature.updateColors(newSettings.themeColors);
        }
      }
    }

    // Refresh budget hierarchy shading when theme changes
    const themeChanged =
      newSettings.darkMode !== currentSettings.darkMode ||
      newSettings.rgbTheme !== currentSettings.rgbTheme ||
      (newSettings.rgbTheme && JSON.stringify(newSettings.themeColors) !== JSON.stringify(currentSettings.themeColors));

    if (themeChanged && window.BudgetHierarchyFeature) {
      if (typeof window.BudgetHierarchyFeature.isActive === 'function' && window.BudgetHierarchyFeature.isActive()) {
        console.log('JT-Tools: Theme changed, refreshing budget hierarchy shading');
        // Small delay to ensure theme is applied first
        setTimeout(() => {
          try {
            if (typeof window.BudgetHierarchyFeature.refreshShading === 'function') {
              window.BudgetHierarchyFeature.refreshShading();
            }
          } catch (error) {
            console.error('JT-Tools: Error refreshing budget hierarchy:', error);
          }
        }, 100);
      }
    }

    // Update current settings
    currentSettings = newSettings;
  } catch (error) {
    console.error('JT-Tools: Error in handleSettingsChange:', error);
  }
}

/**
 * Listen for messages from background script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    console.log('JT-Tools: Message received:', message);

    if (!message || !message.type) {
      console.warn('JT-Tools: Invalid message format');
      sendResponse({ success: false, error: 'Invalid message format' });
      return false;
    }

    switch (message.type) {
      case 'SETTINGS_CHANGED':
        if (message.settings) {
          handleSettingsChange(message.settings);
          sendResponse({ success: true });
        } else {
          console.error('JT-Tools: SETTINGS_CHANGED message missing settings');
          sendResponse({ success: false, error: 'Missing settings' });
        }
        break;

      default:
        console.warn('JT-Tools: Unknown message type:', message.type);
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('JT-Tools: Error handling message:', error);
    sendResponse({ success: false, error: 'Internal error' });
  }

  return false; // Synchronous response
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
