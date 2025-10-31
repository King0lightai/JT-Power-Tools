// Default settings
const defaultSettings = {
  dragDrop: true,
  contrastFix: true,
  formatter: true
};

// Load saved settings and update UI
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get(['jtToolsSettings']);
    const settings = result.jtToolsSettings || defaultSettings;

    // Update checkboxes
    document.getElementById('dragDrop').checked = settings.dragDrop;
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

  // Load current settings
  await loadSettings();

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
