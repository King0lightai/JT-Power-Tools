// Tab navigation management
function initTabNavigation() {
  const tabItems = document.querySelectorAll('.tab-item');
  const tabContents = document.querySelectorAll('.tab-content');

  tabItems.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;

      // Update tab buttons
      tabItems.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Update tab content
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `tab-${targetTab}`) {
          content.classList.add('active');
        }
      });
    });
  });
}

// Popup theme management
const POPUP_THEME_KEY = 'jtPopupTheme';

/**
 * Initialize popup theme based on saved preference
 */
async function initPopupTheme() {
  try {
    const result = await chrome.storage.local.get([POPUP_THEME_KEY]);
    const isDark = result[POPUP_THEME_KEY] === 'dark';
    applyPopupTheme(isDark);
  } catch (error) {
    console.error('Error loading popup theme:', error);
  }
}

/**
 * Apply popup theme and update header icon
 * @param {boolean} isDark - Whether to use dark theme
 */
function applyPopupTheme(isDark) {
  const body = document.body;
  const headerIcon = document.getElementById('headerIcon');

  if (isDark) {
    body.classList.add('dark-theme');
    headerIcon.src = '../icons/icon48-dark.png';
  } else {
    body.classList.remove('dark-theme');
    headerIcon.src = '../icons/icon48-light.png';
  }

  // Update toolbar icon via service worker
  console.log('Sending UPDATE_TOOLBAR_ICON message, isDark:', isDark);
  chrome.runtime.sendMessage({
    type: 'UPDATE_TOOLBAR_ICON',
    isDark: isDark
  }).then((response) => {
    console.log('Toolbar icon update response:', response);
  }).catch((error) => {
    console.error('Failed to update toolbar icon:', error);
  });
}

/**
 * Toggle popup theme
 */
async function togglePopupTheme() {
  const isDark = !document.body.classList.contains('dark-theme');
  applyPopupTheme(isDark);

  // Save preference
  try {
    await chrome.storage.local.set({ [POPUP_THEME_KEY]: isDark ? 'dark' : 'light' });
  } catch (error) {
    console.error('Error saving popup theme:', error);
  }
}

// Default settings
const defaultSettings = {
  dragDrop: true,
  contrastFix: true,
  formatter: true,
  previewMode: false,
  darkMode: false,
  rgbTheme: false,
  smartJobSwitcher: true,
  budgetHierarchy: false,
  quickNotes: true,
  helpSidebarSupport: true,
  freezeHeader: false,
  characterCounter: false,
  kanbanTypeFilter: false,
  autoCollapseGroups: false,
  pdfMarkupTools: true,
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

// Check and update API status on load
async function checkApiStatus() {
  const apiStatus = document.getElementById('apiStatus');
  const statusText = apiStatus.querySelector('.status-text');
  const apiKeyInput = document.getElementById('apiKey');
  const orgIdInput = document.getElementById('orgId');
  const customFieldFilterToggle = document.getElementById('customFieldFilter');
  const customFieldFilterFeature = document.getElementById('customFieldFilterFeature');
  const budgetChangelogToggle = document.getElementById('budgetChangelog');
  const budgetChangelogFeature = document.getElementById('budgetChangelogFeature');

  // Check if Pro Service is configured (uses Worker)
  const isProConfigured = await JobTreadProService.isConfigured();

  if (isProConfigured) {
    const orgInfo = await JobTreadProService.getOrgInfo();
    apiStatus.className = 'api-status active';
    statusText.textContent = `API configured (${orgInfo.orgName || 'Connected'})`;
    apiKeyInput.placeholder = '••••••••••••';
    orgIdInput.placeholder = orgInfo.orgId || 'Org ID';
    orgIdInput.value = '';

    // Enable Custom Field Filter toggle
    customFieldFilterToggle.disabled = false;
    if (customFieldFilterFeature) {
      customFieldFilterFeature.classList.remove('disabled');
      customFieldFilterFeature.title = '';
    }
    // Enable Budget Changelog toggle
    if (budgetChangelogToggle) budgetChangelogToggle.disabled = false;
    if (budgetChangelogFeature) {
      budgetChangelogFeature.classList.remove('disabled');
      budgetChangelogFeature.title = '';
    }
  } else {
    // Fall back to check old direct API configuration
    const isDirectConfigured = await JobTreadAPI.isFullyConfigured();

    if (isDirectConfigured) {
      const storedOrgId = await JobTreadAPI.getOrgId();
      apiStatus.className = 'api-status active';
      statusText.textContent = 'API configured (Direct)';
      apiKeyInput.placeholder = '••••••••••••';
      orgIdInput.placeholder = storedOrgId || 'Org ID';

      // Enable Custom Field Filter toggle
      customFieldFilterToggle.disabled = false;
      if (customFieldFilterFeature) {
        customFieldFilterFeature.classList.remove('disabled');
        customFieldFilterFeature.title = '';
      }
      // Enable Budget Changelog toggle
      if (budgetChangelogToggle) budgetChangelogToggle.disabled = false;
      if (budgetChangelogFeature) {
        budgetChangelogFeature.classList.remove('disabled');
        budgetChangelogFeature.title = '';
      }
    } else {
      apiStatus.className = 'api-status inactive';

      // Check if license is activated to provide better messaging
      const licenseData = await LicenseService.getLicenseData();
      if (licenseData && licenseData.valid) {
        // Has license but no API configured - guide them to setup
        statusText.textContent = '🚀 Setup API access for your team';
      } else {
        statusText.textContent = 'API not configured';
      }

      apiKeyInput.placeholder = 'Grant Key';
      orgIdInput.placeholder = 'Org ID (auto)';

      // Disable Custom Field Filter toggle and uncheck it
      customFieldFilterToggle.disabled = true;
      customFieldFilterToggle.checked = false;
      if (customFieldFilterFeature) {
        customFieldFilterFeature.classList.add('disabled');
        customFieldFilterFeature.title = 'Connect your JobTread API first (enter Grant Key below)';
      }
      // Disable Budget Changelog toggle and uncheck it
      if (budgetChangelogToggle) {
        budgetChangelogToggle.disabled = true;
        budgetChangelogToggle.checked = false;
      }
      if (budgetChangelogFeature) {
        budgetChangelogFeature.classList.add('disabled');
        budgetChangelogFeature.title = 'Connect your JobTread API first (enter Grant Key below)';
      }
    }
  }
}

// Test and save API credentials
async function testApiKey() {
  const apiKeyInput = document.getElementById('apiKey');
  const orgIdInput = document.getElementById('orgId');
  const testBtn = document.getElementById('testApiBtn');

  const grantKey = apiKeyInput.value.trim();

  // Validate Grant Key is provided
  if (!grantKey) {
    showStatus('Grant Key is required', 'error');
    return;
  }

  // Check if user has activated Gumroad license
  const licenseData = await LicenseService.getLicenseData();
  if (!licenseData || !licenseData.valid) {
    showStatus('Please activate your Gumroad license first in the Premium License section below', 'error');
    return;
  }

  // Disable button during test
  testBtn.disabled = true;
  testBtn.textContent = 'Connecting...';

  try {
    // Use Pro Service to verify org access through Worker
    console.log('Testing API via Cloudflare Worker...');
    const result = await JobTreadProService.verifyOrgAccess(grantKey);

    if (result.success) {
      const orgName = result.organizationName || 'Unknown';
      showStatus(`✓ Connected to ${orgName}!`, 'success');
      apiKeyInput.value = '';
      orgIdInput.value = '';

      await checkApiStatus();

      // Try to fetch custom fields to verify full connectivity
      console.log('JobTreadProService: Fetching custom fields...');
      try {
        const fieldsResult = await JobTreadProService.getCustomFields();
        if (fieldsResult.fields) {
          console.log('JobTreadProService: Successfully fetched', fieldsResult.fields.length, 'custom fields');
        }
      } catch (cfError) {
        console.log('JobTreadProService: Custom fields fetch warning:', cfError.message);
      }
    } else {
      // Handle specific error codes
      if (result.code === 'ORG_MISMATCH') {
        showStatus(`❌ ${result.message || 'This license is registered to a different organization'}`, 'error');
      } else if (result.code === 'INVALID_GRANT_KEY') {
        showStatus('❌ Invalid Grant Key. Please check your key and try again.', 'error');
      } else {
        showStatus(result.message || result.error || 'Connection failed', 'error');
      }

      console.error('API connection failed:', result);
    }
  } catch (error) {
    console.error('Error testing API:', error);

    // Check if it's a Worker configuration error
    if (error.message.includes('Worker not configured') || error.message.includes('WORKER_URL')) {
      showStatus('⚠️  Worker not configured. Please update worker-config.js', 'error');
    } else if (error.message.includes('No Gumroad license')) {
      showStatus('Please activate your Gumroad license first', 'error');
    } else {
      showStatus('Error connecting to Worker API', 'error');
    }
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = 'Test';
  }
}

// Check and update license status on load
// Now uses tier-based feature gating with FREE features for all users
async function checkLicenseStatus() {
  const licenseData = await LicenseService.getLicenseData();
  const tier = await LicenseService.getTier();
  const licenseStatus = document.getElementById('licenseStatus');
  const statusText = licenseStatus.querySelector('.status-text');

  // PRO tier features (require Pro or Power User)
  const dragDropFeature = document.getElementById('dragDropFeature');
  const dragDropCheckbox = document.getElementById('dragDrop');
  const rgbThemeFeature = document.getElementById('rgbThemeFeature');
  const rgbThemeCheckbox = document.getElementById('rgbTheme');
  const previewModeFeature = document.getElementById('previewModeFeature');
  const previewModeCheckbox = document.getElementById('previewMode');

  // ESSENTIAL tier features (require Essential, Pro, or Power User)
  const quickNotesFeature = document.getElementById('quickNotesFeature');
  const quickNotesCheckbox = document.getElementById('quickNotes');
  const smartJobSwitcherFeature = document.getElementById('smartJobSwitcherFeature');
  const smartJobSwitcherCheckbox = document.getElementById('smartJobSwitcher');
  const freezeHeaderFeature = document.getElementById('freezeHeaderFeature');
  const freezeHeaderCheckbox = document.getElementById('freezeHeader');
  const pdfMarkupToolsFeature = document.getElementById('pdfMarkupToolsFeature');
  const pdfMarkupToolsCheckbox = document.getElementById('pdfMarkupTools');

  // POWER USER tier features and UI elements
  const apiCategory = document.getElementById('apiCategory');
  const apiConfigPanel = document.getElementById('apiConfigPanel');
  const customFieldFilterFeature = document.getElementById('customFieldFilterFeature');
  const customFieldFilterCheckbox = document.getElementById('customFieldFilter');
  const budgetChangelogFeature = document.getElementById('budgetChangelogFeature');
  const budgetChangelogCheckbox = document.getElementById('budgetChangelog');

  if (licenseData && licenseData.valid && tier) {
    // Valid license - show tier name
    const tierDisplayName = LicenseService.getTierDisplayName(tier);
    licenseStatus.className = 'license-status active';
    statusText.textContent = `✓ ${tierDisplayName} Active`;

    // Check tier access for PRO features (Pro and Power User only)
    const hasProFeatures = LicenseService.tierHasFeature(tier, 'dragDrop');
    // Check for Power User tier (for API/MCP features)
    const hasPowerUserFeatures = LicenseService.tierHasFeature(tier, 'customFieldFilter');

    if (hasProFeatures) {
      // Pro or Power User tier - enable PRO features
      dragDropFeature?.classList.remove('locked');
      if (dragDropCheckbox) dragDropCheckbox.disabled = false;
      rgbThemeFeature?.classList.remove('locked');
      if (rgbThemeCheckbox) rgbThemeCheckbox.disabled = false;
      previewModeFeature?.classList.remove('locked');
      if (previewModeCheckbox) previewModeCheckbox.disabled = false;
    } else {
      // Essential tier - lock PRO features
      dragDropFeature?.classList.add('locked');
      if (dragDropCheckbox) dragDropCheckbox.disabled = true;
      rgbThemeFeature?.classList.add('locked');
      if (rgbThemeCheckbox) rgbThemeCheckbox.disabled = true;
      previewModeFeature?.classList.add('locked');
      if (previewModeCheckbox) previewModeCheckbox.disabled = true;

      // Add upgrade hint for Essential users
      statusText.textContent = `✓ ${tierDisplayName} Active - Upgrade to Pro for more features`;
    }

    // POWER USER features and API section visibility
    if (hasPowerUserFeatures) {
      // Show API category and grant key panel for Power Users
      apiCategory?.classList.remove('hidden');
      if (apiConfigPanel) apiConfigPanel.style.display = 'block';
      customFieldFilterFeature?.classList.remove('locked');
      if (customFieldFilterCheckbox) customFieldFilterCheckbox.disabled = false;
      budgetChangelogFeature?.classList.remove('locked');
      if (budgetChangelogCheckbox) budgetChangelogCheckbox.disabled = false;
    } else {
      // Hide API category and lock features for non-Power Users
      apiCategory?.classList.add('hidden');
      if (apiConfigPanel) apiConfigPanel.style.display = 'none';
      customFieldFilterFeature?.classList.add('locked');
      if (customFieldFilterCheckbox) customFieldFilterCheckbox.disabled = true;
      budgetChangelogFeature?.classList.add('locked');
      if (budgetChangelogCheckbox) budgetChangelogCheckbox.disabled = true;
    }

    // ESSENTIAL features are available to all license holders
    quickNotesFeature?.classList.remove('locked');
    if (quickNotesCheckbox) quickNotesCheckbox.disabled = false;
    smartJobSwitcherFeature?.classList.remove('locked');
    if (smartJobSwitcherCheckbox) smartJobSwitcherCheckbox.disabled = false;
    freezeHeaderFeature?.classList.remove('locked');
    if (freezeHeaderCheckbox) freezeHeaderCheckbox.disabled = false;
    pdfMarkupToolsFeature?.classList.remove('locked');
    if (pdfMarkupToolsCheckbox) pdfMarkupToolsCheckbox.disabled = false;

    return { hasLicense: true, tier: tier };
  } else {
    // No license or invalid - FREE features still work!
    licenseStatus.className = 'license-status inactive';
    statusText.textContent = 'Free Mode - Upgrade for more features';

    // Lock PRO features
    dragDropFeature?.classList.add('locked');
    if (dragDropCheckbox) dragDropCheckbox.disabled = true;
    rgbThemeFeature?.classList.add('locked');
    if (rgbThemeCheckbox) rgbThemeCheckbox.disabled = true;
    previewModeFeature?.classList.add('locked');
    if (previewModeCheckbox) previewModeCheckbox.disabled = true;

    // Lock ESSENTIAL features (require license)
    quickNotesFeature?.classList.add('locked');
    if (quickNotesCheckbox) quickNotesCheckbox.disabled = true;
    smartJobSwitcherFeature?.classList.add('locked');
    if (smartJobSwitcherCheckbox) smartJobSwitcherCheckbox.disabled = true;
    freezeHeaderFeature?.classList.add('locked');
    if (freezeHeaderCheckbox) freezeHeaderCheckbox.disabled = true;
    pdfMarkupToolsFeature?.classList.add('locked');
    if (pdfMarkupToolsCheckbox) pdfMarkupToolsCheckbox.disabled = true;

    // Hide API category and grant key for free users
    apiCategory?.classList.add('hidden');
    if (apiConfigPanel) apiConfigPanel.style.display = 'none';
    customFieldFilterFeature?.classList.add('locked');
    if (customFieldFilterCheckbox) customFieldFilterCheckbox.disabled = true;
    budgetChangelogFeature?.classList.add('locked');
    if (budgetChangelogCheckbox) budgetChangelogCheckbox.disabled = true;

    // FREE features remain unlocked (formatter, darkMode, contrastFix,
    // characterCounter, budgetHierarchy, kanbanTypeFilter, autoCollapseGroups)

    return { hasLicense: false, tier: null };
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
      // Show tier in success message
      const tier = result.data?.tier;
      const tierName = tier ? LicenseService.getTierDisplayName(tier) : 'Pro';
      showStatus(`${tierName} license activated!`, 'success');
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

    // Check user's tier for feature access
    const tier = await LicenseService.getTier();
    const hasLicense = tier !== null;
    const hasProFeatures = tier && LicenseService.tierHasFeature(tier, 'dragDrop');
    const hasEssentialFeatures = tier && LicenseService.tierHasFeature(tier, 'quickNotes');

    // FREE features - work for everyone (no license required)
    document.getElementById('formatter').checked = settings.formatter;
    document.getElementById('darkMode').checked = settings.darkMode;
    document.getElementById('contrastFix').checked = settings.contrastFix;
    document.getElementById('characterCounter').checked = settings.characterCounter !== undefined ? settings.characterCounter : false;
    document.getElementById('budgetHierarchy').checked = settings.budgetHierarchy !== undefined ? settings.budgetHierarchy : false;
    document.getElementById('kanbanTypeFilter').checked = settings.kanbanTypeFilter !== undefined ? settings.kanbanTypeFilter : false;
    document.getElementById('autoCollapseGroups').checked = settings.autoCollapseGroups !== undefined ? settings.autoCollapseGroups : false;

    // ESSENTIAL features - require any license (Essential, Pro, Power User)
    document.getElementById('quickNotes').checked = hasEssentialFeatures && (settings.quickNotes !== undefined ? settings.quickNotes : true);
    document.getElementById('smartJobSwitcher').checked = hasEssentialFeatures && (settings.smartJobSwitcher !== undefined ? settings.smartJobSwitcher : true);
    document.getElementById('freezeHeader').checked = hasEssentialFeatures && (settings.freezeHeader !== undefined ? settings.freezeHeader : false);
    document.getElementById('pdfMarkupTools').checked = hasEssentialFeatures && (settings.pdfMarkupTools !== undefined ? settings.pdfMarkupTools : true);

    // PRO features - require Pro or Power User tier
    document.getElementById('dragDrop').checked = hasProFeatures && settings.dragDrop;
    document.getElementById('previewMode').checked = hasProFeatures && settings.previewMode;
    document.getElementById('rgbTheme').checked = hasProFeatures && settings.rgbTheme;

    // POWER USER features - require Power User tier (API-powered)
    document.getElementById('customFieldFilter').checked = settings.customFieldFilter !== undefined ? settings.customFieldFilter : false;
    document.getElementById('budgetChangelog').checked = settings.budgetChangelog !== undefined ? settings.budgetChangelog : false;

    // Load theme colors
    const themeColors = settings.themeColors || defaultSettings.themeColors;
    loadThemeColors(themeColors);

    // Load saved themes
    const savedThemes = settings.savedThemes || defaultSettings.savedThemes;
    loadSavedThemes(savedThemes);

    // Show/hide customize button based on rgbTheme state
    const customizeBtn = document.getElementById('customizeThemeBtn');
    customizeBtn.style.display = (hasProFeatures && settings.rgbTheme) ? 'inline-flex' : 'none';

    // Always hide the customization panel initially
    const themeCustomization = document.getElementById('themeCustomization');
    themeCustomization.style.display = 'none';
    customizeBtn.classList.remove('expanded');

    console.log('Settings loaded:', settings, 'tier:', tier, 'hasLicense:', hasLicense);
  } catch (error) {
    console.error('Error loading settings:', error);
    showStatus('Error loading settings', 'error');
  }
}

// Save settings
async function saveSettings(settings) {
  try {
    // Use tier-based feature checking
    const tier = await LicenseService.getTier();
    const hasLicense = tier !== null;
    const hasProFeatures = tier && LicenseService.tierHasFeature(tier, 'dragDrop');
    const hasEssentialFeatures = tier && LicenseService.tierHasFeature(tier, 'quickNotes');

    // PRO tier feature checks
    // Check if user is trying to enable Schedule & Task Checkboxes without Pro tier
    if (settings.dragDrop && !hasProFeatures) {
      const message = tier ? 'Schedule & Task Checkboxes requires Pro or Power User tier' : 'Schedule & Task Checkboxes requires a license';
      showStatus(message, 'error');
      document.getElementById('dragDrop').checked = false;
      settings.dragDrop = false;
      return;
    }

    // Check if user is trying to enable Preview Mode without Pro tier
    if (settings.previewMode && !hasProFeatures) {
      const message = tier ? 'Preview Mode requires Pro or Power User tier' : 'Preview Mode requires a license';
      showStatus(message, 'error');
      document.getElementById('previewMode').checked = false;
      settings.previewMode = false;
      return;
    }

    // Check if user is trying to enable Custom Theme without Pro tier
    if (settings.rgbTheme && !hasProFeatures) {
      const message = tier ? 'Custom Theme requires Pro or Power User tier' : 'Custom Theme requires a license';
      showStatus(message, 'error');
      document.getElementById('rgbTheme').checked = false;
      settings.rgbTheme = false;
      // Hide customize button and panel since RGB theme can't be enabled
      const customizeBtn = document.getElementById('customizeThemeBtn');
      const themeCustomization = document.getElementById('themeCustomization');
      customizeBtn.style.display = 'none';
      themeCustomization.style.display = 'none';
      return;
    }

    // ESSENTIAL tier feature checks
    // Check if user is trying to enable Quick Notes without license
    if (settings.quickNotes && !hasEssentialFeatures) {
      showStatus('Quick Notes requires a license (Essential tier or higher)', 'error');
      document.getElementById('quickNotes').checked = false;
      settings.quickNotes = false;
      return;
    }

    // Check if user is trying to enable Smart Job Switcher without license
    if (settings.smartJobSwitcher && !hasEssentialFeatures) {
      showStatus('Smart Job Switcher requires a license (Essential tier or higher)', 'error');
      document.getElementById('smartJobSwitcher').checked = false;
      settings.smartJobSwitcher = false;
      return;
    }

    // Check if user is trying to enable Freeze Header without license
    if (settings.freezeHeader && !hasEssentialFeatures) {
      showStatus('Freeze Header requires a license (Essential tier or higher)', 'error');
      document.getElementById('freezeHeader').checked = false;
      settings.freezeHeader = false;
      return;
    }

    // Check if user is trying to enable PDF Markup Tools without license
    if (settings.pdfMarkupTools && !hasEssentialFeatures) {
      showStatus('PDF Markup Tools requires a license (Essential tier or higher)', 'error');
      document.getElementById('pdfMarkupTools').checked = false;
      settings.pdfMarkupTools = false;
      return;
    }

    // Show/hide customize button based on rgbTheme toggle
    const customizeBtn = document.getElementById('customizeThemeBtn');
    const themeCustomization = document.getElementById('themeCustomization');
    const shouldShowButton = hasProFeatures && settings.rgbTheme;
    customizeBtn.style.display = shouldShowButton ? 'inline-flex' : 'none';

    // Hide panel when toggle is turned off
    if (!shouldShowButton) {
      themeCustomization.style.display = 'none';
      customizeBtn.classList.remove('expanded');
    }

    console.log('saveSettings: Customize button visibility:', shouldShowButton ? 'visible' : 'hidden', 'tier:', tier);

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
    previewMode: document.getElementById('previewMode').checked,
    darkMode: document.getElementById('darkMode').checked,
    rgbTheme: document.getElementById('rgbTheme').checked,
    smartJobSwitcher: document.getElementById('smartJobSwitcher').checked,
    budgetHierarchy: document.getElementById('budgetHierarchy').checked,
    quickNotes: document.getElementById('quickNotes').checked,
    helpSidebarSupport: true, // Always enabled, not user-toggleable
    freezeHeader: document.getElementById('freezeHeader').checked,
    characterCounter: document.getElementById('characterCounter').checked,
    kanbanTypeFilter: document.getElementById('kanbanTypeFilter').checked,
    autoCollapseGroups: document.getElementById('autoCollapseGroups').checked,
    customFieldFilter: document.getElementById('customFieldFilter').checked,
    budgetChangelog: document.getElementById('budgetChangelog').checked,
    pdfMarkupTools: document.getElementById('pdfMarkupTools').checked,
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
// Initialize collapsible category functionality
function initializeCategories() {
  // Get all category headers
  const categoryHeaders = document.querySelectorAll('.category-header');

  categoryHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const category = header.dataset.category;
      const content = document.querySelector(`[data-category-content="${category}"]`);

      // Toggle collapsed state
      header.classList.toggle('collapsed');
      content.classList.toggle('collapsed');

      // Save state to chrome.storage.local
      chrome.storage.local.set({
        [`category_${category}_collapsed`]: header.classList.contains('collapsed')
      });
    });

    // Restore state from storage - expand if previously expanded
    const category = header.dataset.category;
    chrome.storage.local.get(`category_${category}_collapsed`, (result) => {
      // If user previously expanded it (collapsed = false), expand it
      if (result[`category_${category}_collapsed`] === false) {
        header.classList.remove('collapsed');
        const content = document.querySelector(`[data-category-content="${category}"]`);
        if (content) {
          content.classList.remove('collapsed');
        }
      }
      // Otherwise, keep default collapsed state (no action needed)
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('JT Power Tools popup loaded');

  // Initialize popup theme first (before any other UI updates)
  await initPopupTheme();

  // Setup theme toggle button
  document.getElementById('popupThemeToggle').addEventListener('click', togglePopupTheme);

  // Setup tab navigation
  initTabNavigation();

  // Check license status first (just UI, don't modify settings)
  const licenseStatus = await checkLicenseStatus();
  const { hasLicense, tier } = licenseStatus;

  // Check API status
  await checkApiStatus();

  // Load current settings and update UI
  await loadSettings();

  // Initialize collapsible categories
  initializeCategories();

  // Determine if user has access to different tiers
  const hasProFeatures = hasLicense && tier && LicenseService.tierHasFeature(tier, 'dragDrop');
  const hasEssentialFeatures = hasLicense && tier && LicenseService.tierHasFeature(tier, 'quickNotes');

  // If no license, ensure licensed features stay disabled
  const currentSettings = await chrome.storage.sync.get(['jtToolsSettings']);
  if (currentSettings.jtToolsSettings) {
    let needsUpdate = false;
    const updatedSettings = { ...currentSettings.jtToolsSettings };

    // PRO features require Pro or Power User tier
    if (!hasProFeatures) {
      if (updatedSettings.dragDrop || updatedSettings.rgbTheme || updatedSettings.previewMode) {
        console.log('Disabling PRO features - tier:', tier);
        updatedSettings.dragDrop = false;
        updatedSettings.rgbTheme = false;
        updatedSettings.previewMode = false;
        needsUpdate = true;
      }
    }

    // ESSENTIAL features require Essential, Pro, or Power User tier
    if (!hasEssentialFeatures) {
      if (updatedSettings.quickNotes || updatedSettings.smartJobSwitcher ||
          updatedSettings.freezeHeader || updatedSettings.pdfMarkupTools) {
        console.log('Disabling ESSENTIAL features - tier:', tier);
        updatedSettings.quickNotes = false;
        updatedSettings.smartJobSwitcher = false;
        updatedSettings.freezeHeader = false;
        updatedSettings.pdfMarkupTools = false;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      await chrome.storage.sync.set({ jtToolsSettings: updatedSettings });
    }
  }

  // Listen for API key test
  document.getElementById('testApiBtn').addEventListener('click', testApiKey);

  // Allow Enter key in API inputs
  document.getElementById('apiKey').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      testApiKey();
    }
  });
  document.getElementById('orgId').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      testApiKey();
    }
  });

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

      // Get current settings from checkboxes
      const settings = await getCurrentSettings();

      // Save settings (this will handle theme panel visibility)
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

  // Listen for customize button to toggle theme customization panel
  document.getElementById('customizeThemeBtn').addEventListener('click', () => {
    const themeCustomization = document.getElementById('themeCustomization');
    const customizeBtn = document.getElementById('customizeThemeBtn');
    const isVisible = themeCustomization.style.display === 'block';

    if (isVisible) {
      themeCustomization.style.display = 'none';
      customizeBtn.classList.remove('expanded');
    } else {
      themeCustomization.style.display = 'block';
      customizeBtn.classList.add('expanded');
    }
  });

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

  // Initialize AI Integration section
  await initAiIntegration();
});

// ===================================
// AI Integration Section
// ===================================

// MCP Server URL - uses workers.dev (same account as main worker)
const MCP_SERVER_URL = 'https://jobtread-mcp-server.king0light-ai.workers.dev';

const AI_PLATFORMS = {
  claude: {
    name: 'Claude Desktop',
    icon: '🟣',
    instructions: `<ol>
      <li>Install mcp-remote: <code>npm install -g mcp-remote</code></li>
      <li>Open Claude Desktop → <strong>Settings → Developer</strong></li>
      <li>Click <strong>Edit Config</strong></li>
      <li>Add the entry below inside your <code>mcpServers</code> object</li>
      <li>Save and restart Claude Desktop</li>
    </ol>
    <p style="margin-top:8px;font-size:11px;color:#888;">
      <strong>Note:</strong> Replace <code>YOUR_NPM_PATH</code> with your npm global path
    </p>`,
    filePath: 'Config: <code>claude_desktop_config.json</code>',
    configType: 'mcp-remote'
  },
  claudeCode: {
    name: 'Claude Code (CLI)',
    icon: '🟣',
    instructions: `<ol>
      <li>Open your Claude Code settings file</li>
      <li>Add the entry below inside your <code>mcpServers</code> object</li>
      <li>Save and restart Claude Code</li>
    </ol>
    <p style="margin-top:8px;font-size:11px;color:#888;">
      Claude Code supports HTTP directly - no mcp-remote needed
    </p>`,
    filePath: 'Config: <code>~/.claude/settings.json</code>',
    configType: 'http'
  },
  chatgpt: {
    name: 'ChatGPT',
    icon: '🟢',
    instructions: `<ol>
      <li>Open ChatGPT settings</li>
      <li>Go to <strong>Features → MCP Servers</strong></li>
      <li>Click <strong>Add Server</strong></li>
      <li>Use SSE endpoint with your credentials</li>
    </ol>`,
    filePath: `Endpoint: <code>${MCP_SERVER_URL}/sse</code>`,
    configType: 'sse'
  },
  cursor: {
    name: 'Cursor IDE',
    icon: '🔵',
    instructions: `<ol>
      <li>Open Cursor settings (<code>Cmd/Ctrl + ,</code>)</li>
      <li>Search for <strong>MCP</strong></li>
      <li>Add new MCP server with config below</li>
      <li>Restart Cursor</li>
    </ol>`,
    filePath: 'Config file: <code>~/.cursor/mcp.json</code>',
    configType: 'http'
  },
  other: {
    name: 'Other MCP Clients',
    icon: '⚪',
    instructions: `<ol>
      <li>Use <strong>HTTP endpoint</strong> for request/response clients</li>
      <li>Use <strong>SSE endpoint</strong> for streaming clients</li>
      <li>Auth format: <code>Bearer LICENSE:GRANT_KEY</code></li>
    </ol>`,
    filePath: `HTTP: <code>/message</code> | SSE: <code>/sse</code>`,
    configType: 'both'
  }
};

/**
 * Initialize AI Integration section
 */
async function initAiIntegration() {
  const aiSection = document.getElementById('aiIntegrationSection');
  if (!aiSection) return;

  // Check if user has Power User tier
  const tier = await LicenseService.getTier();
  const hasPowerUser = tier && LicenseService.tierHasFeature(tier, 'customFieldFilter');

  if (!hasPowerUser) {
    aiSection.style.display = 'none';
    return;
  }

  // Show the section for Power Users
  aiSection.style.display = 'block';

  // Setup platform tab switching
  setupPlatformTabs();

  // Setup copy button
  setupCopyButton();

  // Setup test connection button
  setupTestConnection();

  // Load initial config for default platform (Claude)
  updateConfigDisplay('claude');

  // Check connection status
  await checkAiConnectionStatus();
}

/**
 * Setup platform tab switching
 */
function setupPlatformTabs() {
  const tabs = document.querySelectorAll('.platform-tab');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active from all tabs
      tabs.forEach(t => t.classList.remove('active'));

      // Add active to clicked tab
      tab.classList.add('active');

      // Update config display
      const platform = tab.dataset.platform;
      updateConfigDisplay(platform);
    });
  });
}

/**
 * Update config display based on selected platform
 */
async function updateConfigDisplay(platform) {
  const platformConfig = AI_PLATFORMS[platform];
  if (!platformConfig) return;

  // Update instructions
  const instructionsEl = document.getElementById('configInstructions');
  instructionsEl.innerHTML = platformConfig.instructions;

  // Update file path hint
  const filePathEl = document.getElementById('configFilePath');
  filePathEl.innerHTML = platformConfig.filePath;

  // Generate and display config JSON
  const configCode = document.getElementById('configCode');
  const config = await generateConfigJson(platform);
  configCode.textContent = config;
}

/**
 * Generate MCP config JSON with user's credentials
 */
async function generateConfigJson(platform) {
  // Get user's license key and grant key
  const licenseData = await LicenseService.getLicenseData();
  const licenseKey = licenseData?.key || 'YOUR_LICENSE_KEY';

  // Get grant key from Pro Service (stored in local storage as jtpro_grant_key)
  let grantKey = 'YOUR_GRANT_KEY';
  try {
    const isConfigured = await JobTreadProService.isConfigured();
    if (isConfigured) {
      const stored = await chrome.storage.local.get(['jtpro_grant_key']);
      if (stored.jtpro_grant_key) {
        grantKey = stored.jtpro_grant_key;
      }
    }
  } catch (e) {
    console.log('Could not retrieve grant key:', e);
  }

  const authToken = `${licenseKey}:${grantKey}`;
  const platformConfig = AI_PLATFORMS[platform];

  if (platform === 'other') {
    // Show both endpoints for "Other" clients
    return JSON.stringify({
      "mcpServers": {
        "jobtread": {
          "comment": "Use HTTP for request/response, SSE for streaming",
          "http_url": `${MCP_SERVER_URL}/message`,
          "sse_url": `${MCP_SERVER_URL}/sse`,
          "headers": {
            "Authorization": `Bearer ${authToken}`
          }
        }
      }
    }, null, 2);
  }

  if (platformConfig.configType === 'sse') {
    // SSE config for ChatGPT
    return JSON.stringify({
      "mcpServers": {
        "jobtread": {
          "type": "sse",
          "url": `${MCP_SERVER_URL}/sse`,
          "headers": {
            "Authorization": `Bearer ${authToken}`
          }
        }
      }
    }, null, 2);
  }

  // Claude Desktop - uses mcp-remote bridge for remote servers
  // Claude Desktop only supports local stdio servers, so we need mcp-remote as a bridge
  if (platform === 'claude') {
    const serverConfig = {
      "command": "node",
      "args": [
        "YOUR_NPM_PATH/node_modules/mcp-remote/dist/proxy.js",
        `${MCP_SERVER_URL}/sse`,
        "--header",
        `Authorization: Bearer ${authToken}`
      ]
    };
    // Add helpful comment about finding npm path
    const configStr = JSON.stringify(serverConfig, null, 2);
    const helpComment = `// Find YOUR_NPM_PATH by running: npm root -g
// Windows: Usually C:/Users/USERNAME/AppData/Roaming/npm
// Mac/Linux: Usually /usr/local/lib or ~/.npm-global

`;
    return helpComment + `"jobtread": ${configStr}`;
  }

  // Claude Code (CLI) - supports HTTP directly
  if (platform === 'claudeCode') {
    const serverConfig = {
      "type": "http",
      "url": `${MCP_SERVER_URL}/message`,
      "headers": {
        "Authorization": `Bearer ${authToken}`
      }
    };
    return `"jobtread": ${JSON.stringify(serverConfig, null, 2)}`;
  }

  // HTTP config for Cursor, etc.
  return JSON.stringify({
    "mcpServers": {
      "jobtread": {
        "type": "http",
        "url": `${MCP_SERVER_URL}/message`,
        "headers": {
          "Authorization": `Bearer ${authToken}`
        }
      }
    }
  }, null, 2);
}

/**
 * Setup copy to clipboard button
 */
function setupCopyButton() {
  const copyBtn = document.getElementById('copyConfigBtn');
  if (!copyBtn) return;

  copyBtn.addEventListener('click', async () => {
    const configCode = document.getElementById('configCode');
    const configText = configCode.textContent;

    try {
      await navigator.clipboard.writeText(configText);

      // Show copied state
      copyBtn.classList.add('copied');
      const copyText = copyBtn.querySelector('.copy-text');
      const copyIcon = copyBtn.querySelector('.copy-icon');
      copyText.textContent = 'Copied!';
      copyIcon.textContent = '✓';

      // Reset after 2 seconds
      setTimeout(() => {
        copyBtn.classList.remove('copied');
        copyText.textContent = 'Copy';
        copyIcon.textContent = '📋';
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      showStatus('Failed to copy to clipboard', 'error');
    }
  });
}

/**
 * Setup test connection button
 */
function setupTestConnection() {
  const testBtn = document.getElementById('testAiConnectionBtn');
  if (!testBtn) return;

  testBtn.addEventListener('click', async () => {
    testBtn.classList.add('testing');
    testBtn.textContent = 'Testing...';

    try {
      await testMcpConnection();
    } finally {
      testBtn.classList.remove('testing');
      testBtn.textContent = 'Test Connection';
    }
  });
}

/**
 * Test MCP server connection
 */
async function testMcpConnection() {
  const statusIndicator = document.getElementById('aiStatusIndicator');
  const statusText = statusIndicator.querySelector('.status-text');

  try {
    // Test the health endpoint
    const response = await fetch(`${MCP_SERVER_URL}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();

      if (data.status === 'ok') {
        // Server is healthy, now test auth
        await testMcpAuth(statusIndicator, statusText);
      } else {
        setConnectionStatus(statusIndicator, statusText, 'error', 'Server error');
      }
    } else {
      setConnectionStatus(statusIndicator, statusText, 'error', 'Server unavailable');
    }
  } catch (error) {
    console.error('MCP health check failed:', error);
    setConnectionStatus(statusIndicator, statusText, 'error', 'Connection failed');
  }
}

/**
 * Test MCP authentication with user's grant key
 */
async function testMcpAuth(statusIndicator, statusText) {
  try {
    // Get grant key from local storage (stored by JobTreadProService as jtpro_grant_key)
    const stored = await chrome.storage.local.get(['jtpro_grant_key']);
    const grantKey = stored.jtpro_grant_key;

    if (!grantKey) {
      setConnectionStatus(statusIndicator, statusText, 'disconnected', 'Configure Grant Key above first');
      showStatus('Enter your Grant Key in the API section above', 'error');
      return;
    }

    // Get license key for the auth header
    const licenseData = await LicenseService.getLicenseData();
    const licenseKey = licenseData?.key;

    // Test the tools endpoint with auth
    const response = await fetch(`${MCP_SERVER_URL}/tools`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${licenseKey}:${grantKey}`,
        'Accept': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      setConnectionStatus(statusIndicator, statusText, 'connected',
        `Connected (${data.toolCount || 0} tools)`);
      showStatus('MCP server connected!', 'success');
    } else if (response.status === 401) {
      setConnectionStatus(statusIndicator, statusText, 'error', 'Invalid grant key');
      showStatus('Grant key not recognized', 'error');
    } else if (response.status === 403) {
      setConnectionStatus(statusIndicator, statusText, 'error', 'Org mismatch');
      showStatus('Grant key doesn\'t match your license org', 'error');
    } else {
      setConnectionStatus(statusIndicator, statusText, 'error', 'Connection failed');
    }
  } catch (error) {
    console.error('MCP auth test failed:', error);
    setConnectionStatus(statusIndicator, statusText, 'error', 'Connection failed');
  }
}

/**
 * Check AI connection status on load
 */
async function checkAiConnectionStatus() {
  const statusIndicator = document.getElementById('aiStatusIndicator');
  const statusText = statusIndicator?.querySelector('.status-text');

  if (!statusIndicator || !statusText) return;

  // Check if grant key is configured (stored by JobTreadProService in local storage)
  const stored = await chrome.storage.local.get(['jtpro_grant_key']);

  if (!stored.jtpro_grant_key) {
    setConnectionStatus(statusIndicator, statusText, 'disconnected', 'Configure Grant Key above');
    return;
  }

  // Grant key is configured, show ready status
  setConnectionStatus(statusIndicator, statusText, 'disconnected', 'Ready - click Test to verify');
}

/**
 * Set connection status display
 */
function setConnectionStatus(indicator, textEl, status, message) {
  indicator.className = `ai-status-indicator ${status}`;
  textEl.textContent = message;
}
