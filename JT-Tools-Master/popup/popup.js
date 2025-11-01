// Default settings
const defaultSettings = {
  dragDrop: true,
  contrastFix: true,
  formatter: true,
  darkMode: false,
  rgbTheme: false,
  themeColor: '#3B82F6' // Default blue
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

    // Load theme color
    const themeColor = settings.themeColor || defaultSettings.themeColor;
    loadThemeColor(themeColor);

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
      return;
    }

    // Show/hide theme customization panel
    const themeCustomization = document.getElementById('themeCustomization');
    themeCustomization.style.display = settings.rgbTheme ? 'block' : 'none';

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
  const currentColor = (result.jtToolsSettings && result.jtToolsSettings.themeColor) || defaultSettings.themeColor;

  return {
    dragDrop: document.getElementById('dragDrop').checked,
    contrastFix: document.getElementById('contrastFix').checked,
    formatter: document.getElementById('formatter').checked,
    darkMode: document.getElementById('darkMode').checked,
    rgbTheme: document.getElementById('rgbTheme').checked,
    themeColor: currentColor
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

// Load theme color
function loadThemeColor(color) {
  document.getElementById('themeColorPicker').value = color;
  document.getElementById('colorValueText').textContent = color.toUpperCase();
  updateThemePreview(color);
}

// Generate palette (same logic as rgb-theme.js)
function generatePalette(baseColor) {
  const rgb = hexToRgb(baseColor);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  const makeColor = (hue, sat, light) => `hsl(${hue}, ${sat}%, ${light}%)`;
  const baseSat = Math.max(hsl.s, 40); // Ensure minimum 40% saturation

  return {
    bg_gray_50: makeColor(hsl.h, baseSat * 0.75, 85),
    text_gray_900: makeColor(hsl.h, baseSat * 0.8, 15),
    primary: baseColor,
  };
}

// Update theme preview samples with actual palette colors
function updateThemePreview(color) {
  const palette = generatePalette(color);

  // Primary - show the actual chosen color
  document.getElementById('previewPrimary').style.backgroundColor = palette.primary;
  document.getElementById('previewPrimary').style.borderColor = palette.primary;
  document.getElementById('previewPrimary').style.color = 'white';

  // Background - show the actual background color that will be used
  document.getElementById('previewBackground').style.backgroundColor = palette.bg_gray_50;
  document.getElementById('previewBackground').style.color = palette.text_gray_900;
  document.getElementById('previewBackground').style.borderColor = palette.bg_gray_50;

  // Text - show the actual text color that will be used
  document.getElementById('previewText').style.backgroundColor = 'white';
  document.getElementById('previewText').style.color = palette.text_gray_900;
  document.getElementById('previewText').style.borderColor = '#e5e7eb';
}

// Reset color to default
async function resetColor() {
  loadThemeColor(defaultSettings.themeColor);
  showStatus('Color reset to default', 'success');
}

// Apply theme color
async function applyColor() {
  try {
    const color = document.getElementById('themeColorPicker').value;
    const result = await chrome.storage.sync.get(['jtToolsSettings']);
    const settings = result.jtToolsSettings || defaultSettings;

    settings.themeColor = color;

    await chrome.storage.sync.set({ jtToolsSettings: settings });
    console.log('Theme color saved:', color);

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
      const settings = await getCurrentSettings();
      await saveSettings(settings);
    });
  });

  // Listen for color picker changes
  const colorPicker = document.getElementById('themeColorPicker');
  colorPicker.addEventListener('input', (e) => {
    const color = e.target.value;
    document.getElementById('colorValueText').textContent = color.toUpperCase();
    updateThemePreview(color);
  });

  // Listen for reset color button
  document.getElementById('resetColorBtn').addEventListener('click', resetColor);

  // Listen for apply color button
  document.getElementById('applyColorBtn').addEventListener('click', applyColor);

  // Listen for refresh button
  document.getElementById('refreshBtn').addEventListener('click', refreshCurrentTab);
});
