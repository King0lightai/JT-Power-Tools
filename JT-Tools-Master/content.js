// JT-Tools Master Suite - Content Script Orchestrator
// Manages loading and unloading of feature modules based on user settings

console.log('JT-Tools Master Suite: Content script loaded');

// Feature module registry
const featureModules = {
  dragDrop: {
    name: 'Drag & Drop',
    scriptPath: 'features/drag-drop.js',
    instance: null,
    loaded: false
  },
  contrastFix: {
    name: 'Contrast Fix',
    scriptPath: 'features/contrast-fix.js',
    instance: null,
    loaded: false
  },
  formatter: {
    name: 'Formatter',
    scriptPath: 'features/formatter.js',
    instance: null,
    loaded: false
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

// Load a feature module script
function loadFeatureScript(featureKey) {
  return new Promise((resolve, reject) => {
    const module = featureModules[featureKey];

    if (module.loaded) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(module.scriptPath);
    script.onload = () => {
      module.loaded = true;
      console.log(`JT-Tools: ${module.name} script loaded`);
      resolve();
    };
    script.onerror = (error) => {
      console.error(`JT-Tools: Error loading ${module.name} script:`, error);
      reject(error);
    };

    document.head.appendChild(script);
  });
}

// Initialize a feature
async function initializeFeature(featureKey) {
  const module = featureModules[featureKey];

  try {
    // Load script if not already loaded
    if (!module.loaded) {
      await loadFeatureScript(featureKey);
    }

    // Wait for the feature to be available on window
    await waitForFeature(featureKey);

    // Get the feature instance
    const featureName = getFeatureName(featureKey);
    const FeatureClass = window[featureName];

    if (!FeatureClass) {
      console.error(`JT-Tools: ${module.name} class not found on window`);
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
    const featureName = getFeatureName(featureKey);
    const FeatureClass = window[featureName];

    if (FeatureClass && FeatureClass.isActive()) {
      FeatureClass.cleanup();
      console.log(`JT-Tools: ${module.name} cleaned up`);
    }
  } catch (error) {
    console.error(`JT-Tools: Error cleaning up ${module.name}:`, error);
  }
}

// Wait for feature to be available on window
function waitForFeature(featureKey, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const featureName = getFeatureName(featureKey);
    const startTime = Date.now();

    const checkInterval = setInterval(() => {
      if (window[featureName]) {
        clearInterval(checkInterval);
        resolve();
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        reject(new Error(`Timeout waiting for ${featureName}`));
      }
    }, 100);
  });
}

// Get feature class name from key
function getFeatureName(featureKey) {
  const nameMap = {
    dragDrop: 'DragDropFeature',
    contrastFix: 'ContrastFixFeature',
    formatter: 'FormatterFeature'
  };
  return nameMap[featureKey];
}

// Initialize all enabled features
async function initializeAllFeatures() {
  console.log('JT-Tools: Initializing features based on settings...');

  for (const [key, enabled] of Object.entries(currentSettings)) {
    if (enabled && featureModules[key]) {
      await initializeFeature(key);
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

  // Initialize all enabled features
  await initializeAllFeatures();

  console.log('JT-Tools Master Suite: Ready!');
})();
