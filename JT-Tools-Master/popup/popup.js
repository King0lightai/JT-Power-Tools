// Default settings
const defaultSettings = {
  dragDrop: true,
  contrastFix: true,
  formatter: true,
  darkMode: false,
  rgbTheme: false,
  rgbColors: {
    primary: { r: 59, g: 130, b: 246 },
    background: { r: 249, g: 250, b: 251 },
    text: { r: 17, g: 24, b: 39 }
  }
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

    // Load RGB colors
    const colors = settings.rgbColors || defaultSettings.rgbColors;
    loadRGBColors(colors);

    // Show/hide RGB customization panel based on rgbTheme state
    const rgbCustomization = document.getElementById('rgbCustomization');
    rgbCustomization.style.display = (hasLicense && settings.rgbTheme) ? 'block' : 'none';

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

    // Show/hide RGB customization panel
    const rgbCustomization = document.getElementById('rgbCustomization');
    rgbCustomization.style.display = settings.rgbTheme ? 'block' : 'none';

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
  const currentColors = (result.jtToolsSettings && result.jtToolsSettings.rgbColors) || defaultSettings.rgbColors;

  return {
    dragDrop: document.getElementById('dragDrop').checked,
    contrastFix: document.getElementById('contrastFix').checked,
    formatter: document.getElementById('formatter').checked,
    darkMode: document.getElementById('darkMode').checked,
    rgbTheme: document.getElementById('rgbTheme').checked,
    rgbColors: currentColors
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

// Load RGB colors into sliders
function loadRGBColors(colors) {
  // Primary color
  document.getElementById('primaryR').value = colors.primary.r;
  document.getElementById('primaryG').value = colors.primary.g;
  document.getElementById('primaryB').value = colors.primary.b;
  document.getElementById('primaryR-value').textContent = colors.primary.r;
  document.getElementById('primaryG-value').textContent = colors.primary.g;
  document.getElementById('primaryB-value').textContent = colors.primary.b;

  // Background color
  document.getElementById('backgroundR').value = colors.background.r;
  document.getElementById('backgroundG').value = colors.background.g;
  document.getElementById('backgroundB').value = colors.background.b;
  document.getElementById('backgroundR-value').textContent = colors.background.r;
  document.getElementById('backgroundG-value').textContent = colors.background.g;
  document.getElementById('backgroundB-value').textContent = colors.background.b;

  // Text color
  document.getElementById('textR').value = colors.text.r;
  document.getElementById('textG').value = colors.text.g;
  document.getElementById('textB').value = colors.text.b;
  document.getElementById('textR-value').textContent = colors.text.r;
  document.getElementById('textG-value').textContent = colors.text.g;
  document.getElementById('textB-value').textContent = colors.text.b;

  // Update previews
  updateColorPreviews();
}

// Get current RGB colors from sliders
function getCurrentRGBColors() {
  return {
    primary: {
      r: parseInt(document.getElementById('primaryR').value),
      g: parseInt(document.getElementById('primaryG').value),
      b: parseInt(document.getElementById('primaryB').value)
    },
    background: {
      r: parseInt(document.getElementById('backgroundR').value),
      g: parseInt(document.getElementById('backgroundG').value),
      b: parseInt(document.getElementById('backgroundB').value)
    },
    text: {
      r: parseInt(document.getElementById('textR').value),
      g: parseInt(document.getElementById('textG').value),
      b: parseInt(document.getElementById('textB').value)
    }
  };
}

// Update color preview boxes
function updateColorPreviews() {
  const colors = getCurrentRGBColors();

  const primaryPreview = document.getElementById('primaryPreview');
  const backgroundPreview = document.getElementById('backgroundPreview');
  const textPreview = document.getElementById('textPreview');

  primaryPreview.style.backgroundColor = `rgb(${colors.primary.r}, ${colors.primary.g}, ${colors.primary.b})`;
  backgroundPreview.style.backgroundColor = `rgb(${colors.background.r}, ${colors.background.g}, ${colors.background.b})`;
  textPreview.style.backgroundColor = `rgb(${colors.text.r}, ${colors.text.g}, ${colors.text.b})`;
}

// Reset colors to defaults
async function resetColors() {
  loadRGBColors(defaultSettings.rgbColors);
  showStatus('Colors reset to defaults', 'success');
}

// Apply colors
async function applyColors() {
  try {
    const colors = getCurrentRGBColors();
    const result = await chrome.storage.sync.get(['jtToolsSettings']);
    const settings = result.jtToolsSettings || defaultSettings;

    settings.rgbColors = colors;

    await chrome.storage.sync.set({ jtToolsSettings: settings });
    console.log('RGB colors saved:', colors);

    // Notify background script of settings change
    chrome.runtime.sendMessage({
      type: 'SETTINGS_UPDATED',
      settings: settings
    });

    showStatus('Colors applied!', 'success');
  } catch (error) {
    console.error('Error applying colors:', error);
    showStatus('Error applying colors', 'error');
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

  // Listen for RGB slider changes
  const rgbSliders = document.querySelectorAll('.rgb-slider');
  rgbSliders.forEach(slider => {
    slider.addEventListener('input', (e) => {
      // Update the value display
      const valueSpan = document.getElementById(`${e.target.id}-value`);
      valueSpan.textContent = e.target.value;

      // Update color previews
      updateColorPreviews();
    });
  });

  // Listen for reset colors button
  document.getElementById('resetColorsBtn').addEventListener('click', resetColors);

  // Listen for apply colors button
  document.getElementById('applyColorsBtn').addEventListener('click', applyColors);

  // Listen for refresh button
  document.getElementById('refreshBtn').addEventListener('click', refreshCurrentTab);
});
