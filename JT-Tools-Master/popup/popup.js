// Default settings
const defaultSettings = {
  dragDrop: true,
  contrastFix: true,
  formatter: true
};

// Check and update license status on load
async function checkLicenseStatus() {
  const licenseData = await LicenseService.getLicenseData();
  const licenseStatus = document.getElementById('licenseStatus');
  const statusText = licenseStatus.querySelector('.status-text');
  const dragDropFeature = document.getElementById('dragDropFeature');
  const dragDropCheckbox = document.getElementById('dragDrop');

  if (licenseData && licenseData.valid) {
    // Valid license
    licenseStatus.className = 'license-status active';
    statusText.textContent = `✓ Premium Active (${licenseData.purchaseEmail})`;
    dragDropFeature.classList.remove('locked');
    dragDropCheckbox.disabled = false;
  } else {
    // No license or invalid
    licenseStatus.className = 'license-status inactive';
    statusText.textContent = '✗ Premium Not Active';
    dragDropFeature.classList.add('locked');
    dragDropCheckbox.disabled = true;
    dragDropCheckbox.checked = false;

    // Force save settings with drag-drop disabled
    const settings = getCurrentSettings();
    settings.dragDrop = false;
    await chrome.storage.sync.set({ jtToolsSettings: settings });
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

    console.log('Settings loaded:', settings);
  } catch (error) {
    console.error('Error loading settings:', error);
    showStatus('Error loading settings', 'error');
  }
}

// Save settings
async function saveSettings(settings) {
  try {
    // Check if user is trying to enable drag-drop without license
    if (settings.dragDrop) {
      const hasLicense = await LicenseService.hasValidLicense();
      if (!hasLicense) {
        showStatus('Drag & Drop requires a premium license', 'error');
        document.getElementById('dragDrop').checked = false;
        settings.dragDrop = false;
        return;
      }
    }

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
function getCurrentSettings() {
  return {
    dragDrop: document.getElementById('dragDrop').checked,
    contrastFix: document.getElementById('contrastFix').checked,
    formatter: document.getElementById('formatter').checked
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

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  console.log('JT-Tools popup loaded');

  // Check license status first
  await checkLicenseStatus();

  // Load current settings
  await loadSettings();

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
      const settings = getCurrentSettings();
      await saveSettings(settings);
    });
  });

  // Listen for refresh button
  document.getElementById('refreshBtn').addEventListener('click', refreshCurrentTab);
});
