// Default settings
const defaultSettings = {
  dragDrop: true,
  contrastFix: true,
  formatter: true,
  darkMode: false,
  rgbTheme: false,
  quickJobSwitcher: true,
  themeColors: {
    primary: '#3B82F6',     // Default blue
    background: '#F3E8FF',  // Light purple
    text: '#1F1B29'         // Dark purple
  },
  savedThemes: [
    null, // Slot 1
    null, // Slot 2
    null  // Slot 3
  ]
};

// Check and update license status on load
async function checkLicenseStatus() {
  const licenseData = await LicenseService.getLicenseData();
  const licenseStatus = document.getElementById('licenseStatus');
  const statusText = licenseStatus.querySelector('.status-text');
  const dragDropFeature = document.getElementById('dragDropFeature');
  const dragDropCheckbox = document.getElementById('dragDrop');
  const rgbThemeFeature = document.getElementById('rgbThemeFeature');
  const rgbThemeCheckbox = document.getElementById('rgbTheme');

  if (licenseData && licenseData.valid) {
    // Valid license
    licenseStatus.className = 'license-status active';
    statusText.textContent = `✓ Premium Active (${licenseData.purchaseEmail})`;
    dragDropFeature.classList.remove('locked');
    dragDropCheckbox.disabled = false;
    rgbThemeFeature.classList.remove('locked');
    rgbThemeCheckbox.disabled = false;
    return true; // Has license
  } else {
    // No license or invalid
    licenseStatus.className = 'license-status inactive';
    statusText.textContent = '✗ Premium Not Active';
    dragDropFeature.classList.add('locked');
    dragDropCheckbox.disabled = true;
    rgbThemeFeature.classList.add('locked');
    rgbThemeCheckbox.disabled = true;
    // Don't change checked state here - let loadSettings handle it
    return false; // No license
  }
}

// Verify license key
async function verifyLicenseKey() {
  const licenseInput = document.getElementById('licenseKey');
  const verifyBtn = document.getElementById('verifyBtn');
  const licenseKey = licenseInput.value.trim();

  if (!licenseKey) {
    showStatus('Please enter a license key', 'error');
    return;
  }

  // Disable button during verification
  verifyBtn.disabled = true;
  verifyBtn.textContent = 'Verifying...';

  try {
    const result = await LicenseService.verifyLicense(licenseKey);

    if (result.success) {
      showStatus('License activated successfully!', 'success');
      licenseInput.value = '';

      // Update UI
      await checkLicenseStatus();
      await loadSettings();
    } else {
      showStatus(result.error || 'Invalid license key', 'error');
    }
  } catch (error) {
    console.error('Error verifying license:', error);
    showStatus('Error verifying license', 'error');
  } finally {
    verifyBtn.disabled = false;
    verifyBtn.textContent = 'Verify';
  }
}

// Load saved settings and update UI
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get(['jtToolsSettings']);
    const settings = result.jtToolsSettings || defaultSettings;

    // Check if user has premium license
    const hasLicense = await LicenseService.hasValidLicense();

    // Update checkboxes
    document.getElementById('dragDrop').checked = hasLicense && settings.dragDrop;
    document.getElementById('contrastFix').checked = settings.contrastFix;
    document.getElementById('formatter').checked = settings.formatter;
    document.getElementById('darkMode').checked = settings.darkMode;
    document.getElementById('rgbTheme').checked = hasLicense && settings.rgbTheme;
    document.getElementById('quickJobSwitcher').checked = settings.quickJobSwitcher !== undefined ? settings.quickJobSwitcher : true;

    // Load theme colors
    const themeColors = settings.themeColors || defaultSettings.themeColors;
    loadThemeColors(themeColors);

    // Load saved themes
    const savedThemes = settings.savedThemes || defaultSettings.savedThemes;
    loadSavedThemes(savedThemes);

    // Show/hide theme customization panel based on rgbTheme state
    const themeCustomization = document.getElementById('themeCustomization');
    themeCustomization.style.display = (hasLicense && settings.rgbTheme) ? 'block' : 'none';

    console.log('Settings loaded:', settings);
  } catch (error) {
    console.error('Error loading settings:', error);
    showStatus('Error loading settings', 'error');
  }
}

// Save settings
async function saveSettings(settings) {
  try {
    const hasLicense = await LicenseService.hasValidLicense();

    // Check if user is trying to enable drag-drop without license
    if (settings.dragDrop && !hasLicense) {
      showStatus('Drag & Drop requires a premium license', 'error');
      document.getElementById('dragDrop').checked = false;
      settings.dragDrop = false;
      return;
    }

    // Check if user is trying to enable RGB theme without license
    if (settings.rgbTheme && !hasLicense) {
      showStatus('RGB Custom Theme requires a premium license', 'error');
      document.getElementById('rgbTheme').checked = false;
      settings.rgbTheme = false;
      // Hide panel since RGB theme can't be enabled
      const themeCustomization = document.getElementById('themeCustomization');
      themeCustomization.style.display = 'none';
      return;
    }

    // Show/hide theme customization panel (requires both license and toggle)
    const themeCustomization = document.getElementById('themeCustomization');
    const shouldShowPanel = hasLicense && settings.rgbTheme;
    themeCustomization.style.display = shouldShowPanel ? 'block' : 'none';
    console.log('saveSettings: Theme panel visibility:', shouldShowPanel ? 'visible' : 'hidden');

    await chrome.storage.sync.set({ jtToolsSettings: settings });
    console.log('Settings saved:', settings);

    // Notify background script of settings change
    chrome.runtime.sendMessage({
      type: 'SETTINGS_UPDATED',
      settings: settings
    });

    showStatus('Settings saved!', 'success');
  } catch (error) {
    console.error('Error saving settings:', error);
    showStatus('Error saving settings', 'error');
  }
}

// Get current settings from checkboxes
async function getCurrentSettings() {
  const result = await chrome.storage.sync.get(['jtToolsSettings']);
  const currentColors = (result.jtToolsSettings && result.jtToolsSettings.themeColors) || defaultSettings.themeColors;
  const savedThemes = (result.jtToolsSettings && result.jtToolsSettings.savedThemes) || defaultSettings.savedThemes;

  return {
    dragDrop: document.getElementById('dragDrop').checked,
    contrastFix: document.getElementById('contrastFix').checked,
    formatter: document.getElementById('formatter').checked,
    darkMode: document.getElementById('darkMode').checked,
    rgbTheme: document.getElementById('rgbTheme').checked,
    quickJobSwitcher: document.getElementById('quickJobSwitcher').checked,
    themeColors: currentColors,
    savedThemes: savedThemes
  };
}

// Show status message
function showStatus(message, type = 'success') {
  const statusEl = document.getElementById('statusMessage');
  statusEl.textContent = message;
  statusEl.className = `status-message ${type}`;

  // Clear after 3 seconds
  setTimeout(() => {
    statusEl.textContent = '';
    statusEl.className = 'status-message';
  }, 3000);
}

// Refresh current tab
async function refreshCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      showStatus('No active tab found', 'error');
      return;
    }

    // Check if it's a JobTread tab
    if (!tab.url || !tab.url.includes('jobtread.com')) {
      showStatus('Please navigate to JobTread', 'error');
      return;
    }

    // Reload the tab
    await chrome.tabs.reload(tab.id);
    showStatus('Tab refreshed!', 'success');

    // Close popup after short delay
    setTimeout(() => {
      window.close();
    }, 1000);
  } catch (error) {
    console.error('Error refreshing tab:', error);
    showStatus('Error refreshing tab', 'error');
  }
}

// Convert hex to RGB for preview generation
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 59, g: 130, b: 246 };
}

// Convert RGB to HSL
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

// Load theme colors into pickers
function loadThemeColors(colors) {
  document.getElementById('primaryColorPicker').value = colors.primary;
  document.getElementById('backgroundColorPicker').value = colors.background;
  document.getElementById('textColorPicker').value = colors.text;

  document.getElementById('primaryColorValue').textContent = colors.primary.toUpperCase();
  document.getElementById('backgroundColorValue').textContent = colors.background.toUpperCase();
  document.getElementById('textColorValue').textContent = colors.text.toUpperCase();

  updateThemePreview();
}

// Get current theme colors from pickers
function getCurrentThemeColors() {
  return {
    primary: document.getElementById('primaryColorPicker').value,
    background: document.getElementById('backgroundColorPicker').value,
    text: document.getElementById('textColorPicker').value
  };
}

// Update theme preview samples
function updateThemePreview() {
  const colors = getCurrentThemeColors();

  // Primary
  document.getElementById('previewPrimary').style.backgroundColor = colors.primary;
  document.getElementById('previewPrimary').style.borderColor = colors.primary;
  document.getElementById('previewPrimary').style.color = 'white';

  // Background
  document.getElementById('previewBackground').style.backgroundColor = colors.background;
  document.getElementById('previewBackground').style.color = colors.text;
  document.getElementById('previewBackground').style.borderColor = colors.background;

  // Text
  document.getElementById('previewText').style.backgroundColor = 'white';
  document.getElementById('previewText').style.color = colors.text;
  document.getElementById('previewText').style.borderColor = '#e5e7eb';
}

// Apply current theme
async function applyTheme() {
  try {
    const colors = getCurrentThemeColors();
    const result = await chrome.storage.sync.get(['jtToolsSettings']);
    const settings = result.jtToolsSettings || defaultSettings;

    settings.themeColors = colors;

    await chrome.storage.sync.set({ jtToolsSettings: settings });
    console.log('Theme colors saved:', colors);

    // Notify background script of settings change
    chrome.runtime.sendMessage({
      type: 'SETTINGS_UPDATED',
      settings: settings
    });

    showStatus('Theme applied!', 'success');
  } catch (error) {
    console.error('Error applying theme:', error);
    showStatus('Error applying theme', 'error');
  }
}

// Load saved themes into slots
function loadSavedThemes(savedThemes) {
  savedThemes.forEach((theme, index) => {
    if (theme) {
      // Theme exists - show load button
      document.getElementById(`themeName${index}`).value = theme.name || `Theme ${index + 1}`;
      document.getElementById(`slot${index}Primary`).style.backgroundColor = theme.colors.primary;
      document.getElementById(`slot${index}Background`).style.backgroundColor = theme.colors.background;
      document.getElementById(`slot${index}Text`).style.backgroundColor = theme.colors.text;

      document.querySelector(`[data-slot="${index}"].load-theme-btn`).style.display = 'inline-block';
    } else {
      // No theme saved
      document.getElementById(`themeName${index}`).value = '';
      document.getElementById(`themeName${index}`).placeholder = `Theme ${index + 1}`;
      document.getElementById(`slot${index}Primary`).style.backgroundColor = '#f3f4f6';
      document.getElementById(`slot${index}Background`).style.backgroundColor = '#f3f4f6';
      document.getElementById(`slot${index}Text`).style.backgroundColor = '#f3f4f6';

      document.querySelector(`[data-slot="${index}"].load-theme-btn`).style.display = 'none';
    }
  });
}

// Save theme to slot
async function saveThemeToSlot(slotIndex) {
  try {
    const result = await chrome.storage.sync.get(['jtToolsSettings']);
    const settings = result.jtToolsSettings || defaultSettings;

    const themeName = document.getElementById(`themeName${slotIndex}`).value || `Theme ${slotIndex + 1}`;
    const colors = getCurrentThemeColors();

    if (!settings.savedThemes) {
      settings.savedThemes = [null, null, null];
    }

    settings.savedThemes[slotIndex] = {
      name: themeName,
      colors: colors
    };

    await chrome.storage.sync.set({ jtToolsSettings: settings });
    console.log(`Theme saved to slot ${slotIndex}:`, settings.savedThemes[slotIndex]);

    // Update the slot display
    loadSavedThemes(settings.savedThemes);

    showStatus(`Theme saved to slot ${slotIndex + 1}!`, 'success');
  } catch (error) {
    console.error('Error saving theme:', error);
    showStatus('Error saving theme', 'error');
  }
}

// Load theme from slot
async function loadThemeFromSlot(slotIndex) {
  try {
    const result = await chrome.storage.sync.get(['jtToolsSettings']);
    const settings = result.jtToolsSettings || defaultSettings;

    if (settings.savedThemes && settings.savedThemes[slotIndex]) {
      const theme = settings.savedThemes[slotIndex];
      loadThemeColors(theme.colors);
      showStatus(`Loaded "${theme.name}"`, 'success');
    }
  } catch (error) {
    console.error('Error loading theme:', error);
    showStatus('Error loading theme', 'error');
  }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  console.log('JT Power Tools popup loaded');

  // Check license status first (just UI, don't modify settings)
  const hasLicense = await checkLicenseStatus();

  // Load current settings and update UI
  await loadSettings();

  // If no license, ensure premium features stay disabled
  if (!hasLicense) {
    const settings = await chrome.storage.sync.get(['jtToolsSettings']);
    if (settings.jtToolsSettings && (settings.jtToolsSettings.dragDrop || settings.jtToolsSettings.rgbTheme)) {
      // User had premium features enabled but license expired/removed
      const updatedSettings = {
        ...settings.jtToolsSettings,
        dragDrop: false,
        rgbTheme: false
      };
      await chrome.storage.sync.set({ jtToolsSettings: updatedSettings });
    }
  }

  // Listen for license verification
  document.getElementById('verifyBtn').addEventListener('click', verifyLicenseKey);

  // Allow Enter key in license input
  document.getElementById('licenseKey').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      verifyLicenseKey();
    }
  });

  // Listen for checkbox changes
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', async () => {
      console.log('Checkbox changed:', checkbox.id, checkbox.checked);

      // Handle mutual exclusivity for appearance modes
      if (checkbox.checked) {
        if (checkbox.id === 'contrastFix') {
          // Contrast Fix enabled - disable Dark Mode and RGB Theme
          document.getElementById('darkMode').checked = false;
          document.getElementById('rgbTheme').checked = false;
        } else if (checkbox.id === 'darkMode') {
          // Dark Mode enabled - disable Contrast Fix and RGB Theme
          document.getElementById('contrastFix').checked = false;
          document.getElementById('rgbTheme').checked = false;
        } else if (checkbox.id === 'rgbTheme') {
          // RGB Theme enabled - disable Contrast Fix and Dark Mode
          document.getElementById('contrastFix').checked = false;
          document.getElementById('darkMode').checked = false;
        }
      }

      // Get settings and update theme panel visibility immediately
      const settings = await getCurrentSettings();

      // Update theme panel visibility right away (before saveSettings validation)
      const themeCustomization = document.getElementById('themeCustomization');
      const hasLicense = await LicenseService.hasValidLicense();
      const shouldShowPanel = hasLicense && settings.rgbTheme;
      themeCustomization.style.display = shouldShowPanel ? 'block' : 'none';
      console.log('Theme panel visibility:', shouldShowPanel ? 'visible' : 'hidden');

      await saveSettings(settings);
    });
  });

  // Listen for color picker changes
  const colorPickers = [
    { picker: 'primaryColorPicker', value: 'primaryColorValue' },
    { picker: 'backgroundColorPicker', value: 'backgroundColorValue' },
    { picker: 'textColorPicker', value: 'textColorValue' }
  ];

  colorPickers.forEach(({ picker, value }) => {
    document.getElementById(picker).addEventListener('input', (e) => {
      document.getElementById(value).textContent = e.target.value.toUpperCase();
      updateThemePreview();
    });
  });

  // Listen for apply theme button
  document.getElementById('applyThemeBtn').addEventListener('click', applyTheme);

  // Listen for save theme buttons
  document.querySelectorAll('.save-theme-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const slotIndex = parseInt(e.target.dataset.slot);
      saveThemeToSlot(slotIndex);
    });
  });

  // Listen for load theme buttons
  document.querySelectorAll('.load-theme-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const slotIndex = parseInt(e.target.dataset.slot);
      loadThemeFromSlot(slotIndex);
    });
  });

  // Listen for refresh button
  document.getElementById('refreshBtn').addEventListener('click', refreshCurrentTab);
});
