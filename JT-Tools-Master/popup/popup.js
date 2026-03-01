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

// Default settings - use shared JTDefaults (loaded from utils/defaults.js)
const defaultSettings = (typeof JTDefaults !== 'undefined' && JTDefaults.getDefaultSettings)
  ? JTDefaults.getDefaultSettings()
  : {
    dragDrop: true, contrastFix: true, formatter: true, previewMode: false,
    darkMode: false, rgbTheme: false, smartJobSwitcher: true, budgetHierarchy: false,
    quickNotes: true, helpSidebarSupport: true, freezeHeader: false, characterCounter: false,
    kanbanTypeFilter: false, autoCollapseGroups: false, availabilityFilter: false,
    ganttLines: true, pdfMarkupTools: true, reverseThreadOrder: false,
    themeColors: { primary: '#3B82F6', background: '#F3E8FF', text: '#1F1B29' },
    savedThemes: [null, null, null]
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
  const availabilityFilterFeature = document.getElementById('availabilityFilterFeature');
  const availabilityFilterCheckbox = document.getElementById('availabilityFilter');

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
      availabilityFilterFeature?.classList.remove('locked');
      if (availabilityFilterCheckbox) availabilityFilterCheckbox.disabled = false;
    } else {
      // Essential tier - lock PRO features
      dragDropFeature?.classList.add('locked');
      if (dragDropCheckbox) dragDropCheckbox.disabled = true;
      rgbThemeFeature?.classList.add('locked');
      if (rgbThemeCheckbox) rgbThemeCheckbox.disabled = true;
      previewModeFeature?.classList.add('locked');
      if (previewModeCheckbox) previewModeCheckbox.disabled = true;
      availabilityFilterFeature?.classList.add('locked');
      if (availabilityFilterCheckbox) availabilityFilterCheckbox.disabled = true;

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
    availabilityFilterFeature?.classList.add('locked');
    if (availabilityFilterCheckbox) availabilityFilterCheckbox.disabled = true;

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

      // Update account UI to show setup prompt (if AccountService available)
      if (typeof AccountService !== 'undefined') {
        sessionStorage.removeItem('accountSetupSkipped'); // Reset skip state on new license
        await updateAccountUI();
      }
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

    // Helper to safely set checkbox value
    const setCheckbox = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.checked = value;
    };

    // FREE features - work for everyone (no license required)
    setCheckbox('formatter', settings.formatter);
    setCheckbox('darkMode', settings.darkMode);
    setCheckbox('contrastFix', settings.contrastFix);
    setCheckbox('characterCounter', settings.characterCounter !== undefined ? settings.characterCounter : false);
    setCheckbox('budgetHierarchy', settings.budgetHierarchy !== undefined ? settings.budgetHierarchy : false);
    setCheckbox('kanbanTypeFilter', settings.kanbanTypeFilter !== undefined ? settings.kanbanTypeFilter : false);
    setCheckbox('autoCollapseGroups', settings.autoCollapseGroups !== undefined ? settings.autoCollapseGroups : false);
    setCheckbox('ganttLines', settings.ganttLines !== undefined ? settings.ganttLines : true);

    // ESSENTIAL features - require any license (Essential, Pro, Power User)
    setCheckbox('quickNotes', hasEssentialFeatures && (settings.quickNotes !== undefined ? settings.quickNotes : true));
    setCheckbox('smartJobSwitcher', hasEssentialFeatures && (settings.smartJobSwitcher !== undefined ? settings.smartJobSwitcher : true));
    setCheckbox('freezeHeader', hasEssentialFeatures && (settings.freezeHeader !== undefined ? settings.freezeHeader : false));
    setCheckbox('pdfMarkupTools', hasEssentialFeatures && (settings.pdfMarkupTools !== undefined ? settings.pdfMarkupTools : true));
    setCheckbox('reverseThreadOrder', hasEssentialFeatures && (settings.reverseThreadOrder !== undefined ? settings.reverseThreadOrder : false));

    // PRO features - require Pro or Power User tier
    setCheckbox('dragDrop', hasProFeatures && settings.dragDrop);
    setCheckbox('previewMode', hasProFeatures && settings.previewMode);
    setCheckbox('rgbTheme', hasProFeatures && settings.rgbTheme);
    setCheckbox('availabilityFilter', hasProFeatures && (settings.availabilityFilter !== undefined ? settings.availabilityFilter : false));

    // POWER USER features - require Power User tier (API-powered)
    setCheckbox('customFieldFilter', settings.customFieldFilter !== undefined ? settings.customFieldFilter : false);
    setCheckbox('budgetChangelog', settings.budgetChangelog !== undefined ? settings.budgetChangelog : false);

    // Load theme colors
    const themeColors = settings.themeColors || defaultSettings.themeColors;
    loadThemeColors(themeColors);

    // Load saved themes
    const savedThemes = settings.savedThemes || defaultSettings.savedThemes;
    loadSavedThemes(savedThemes);

    // Show/hide customize button based on rgbTheme state (if it exists in the HTML)
    const customizeBtn = document.getElementById('customizeThemeBtn');
    if (customizeBtn) {
      customizeBtn.style.display = (hasProFeatures && settings.rgbTheme) ? 'inline-flex' : 'none';
    }

    // Hide the customization panel initially (if it exists in the HTML)
    const themeCustomization = document.getElementById('themeCustomization');
    if (themeCustomization) {
      themeCustomization.style.display = 'none';
      if (customizeBtn) customizeBtn.classList.remove('expanded');
    }

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

    // Check if user is trying to enable Availability Filter without Pro tier
    if (settings.availabilityFilter && !hasProFeatures) {
      const message = tier ? 'Availability Filter requires Pro or Power User tier' : 'Availability Filter requires a license';
      showStatus(message, 'error');
      document.getElementById('availabilityFilter').checked = false;
      settings.availabilityFilter = false;
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

    // Show/hide customize button based on rgbTheme toggle (if elements exist)
    const customizeBtn = document.getElementById('customizeThemeBtn');
    const themeCustomization = document.getElementById('themeCustomization');
    const shouldShowButton = hasProFeatures && settings.rgbTheme;

    if (customizeBtn) {
      customizeBtn.style.display = shouldShowButton ? 'inline-flex' : 'none';
    }

    // Hide panel when toggle is turned off
    if (!shouldShowButton && themeCustomization) {
      themeCustomization.style.display = 'none';
      if (customizeBtn) customizeBtn.classList.remove('expanded');
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

// Helper to safely get checkbox value with fallback
function getCheckboxValue(id, fallback = false) {
  const el = document.getElementById(id);
  return el ? el.checked : fallback;
}

// Get current settings from checkboxes
async function getCurrentSettings() {
  const result = await chrome.storage.sync.get(['jtToolsSettings']);
  const currentColors = (result.jtToolsSettings && result.jtToolsSettings.themeColors) || defaultSettings.themeColors;
  const savedThemes = (result.jtToolsSettings && result.jtToolsSettings.savedThemes) || defaultSettings.savedThemes;

  return {
    dragDrop: getCheckboxValue('dragDrop', defaultSettings.dragDrop),
    contrastFix: getCheckboxValue('contrastFix', defaultSettings.contrastFix),
    formatter: getCheckboxValue('formatter', defaultSettings.formatter),
    previewMode: getCheckboxValue('previewMode', defaultSettings.previewMode),
    darkMode: getCheckboxValue('darkMode', defaultSettings.darkMode),
    rgbTheme: getCheckboxValue('rgbTheme', defaultSettings.rgbTheme),
    smartJobSwitcher: getCheckboxValue('smartJobSwitcher', defaultSettings.smartJobSwitcher),
    budgetHierarchy: getCheckboxValue('budgetHierarchy', defaultSettings.budgetHierarchy),
    quickNotes: getCheckboxValue('quickNotes', defaultSettings.quickNotes),
    helpSidebarSupport: true, // Always enabled, not user-toggleable
    freezeHeader: getCheckboxValue('freezeHeader', defaultSettings.freezeHeader),
    characterCounter: getCheckboxValue('characterCounter', defaultSettings.characterCounter),
    kanbanTypeFilter: getCheckboxValue('kanbanTypeFilter', defaultSettings.kanbanTypeFilter),
    autoCollapseGroups: getCheckboxValue('autoCollapseGroups', defaultSettings.autoCollapseGroups),
    ganttLines: getCheckboxValue('ganttLines', defaultSettings.ganttLines),
    availabilityFilter: getCheckboxValue('availabilityFilter', false),
    customFieldFilter: getCheckboxValue('customFieldFilter', defaultSettings.customFieldFilter),
    budgetChangelog: getCheckboxValue('budgetChangelog', defaultSettings.budgetChangelog),
    pdfMarkupTools: getCheckboxValue('pdfMarkupTools', defaultSettings.pdfMarkupTools),
    reverseThreadOrder: getCheckboxValue('reverseThreadOrder', defaultSettings.reverseThreadOrder),
    // fileDragToFolder: getCheckboxValue('fileDragToFolder', defaultSettings.fileDragToFolder), // Saved for a later version
    themeColors: currentColors,
    savedThemes: savedThemes
  };
}

// Show status message
function showStatus(message, type = 'success') {
  const statusEl = document.getElementById('statusMessage');
  if (!statusEl) {
    console.log('Status:', message, type);
    return;
  }
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
  const primaryPicker = document.getElementById('primaryColorPicker');
  const backgroundPicker = document.getElementById('backgroundColorPicker');
  const textPicker = document.getElementById('textColorPicker');
  const primaryValue = document.getElementById('primaryColorValue');
  const backgroundValue = document.getElementById('backgroundColorValue');
  const textValue = document.getElementById('textColorValue');

  // Only update if elements exist
  if (primaryPicker) primaryPicker.value = colors.primary;
  if (backgroundPicker) backgroundPicker.value = colors.background;
  if (textPicker) textPicker.value = colors.text;

  if (primaryValue) primaryValue.textContent = colors.primary.toUpperCase();
  if (backgroundValue) backgroundValue.textContent = colors.background.toUpperCase();
  if (textValue) textValue.textContent = colors.text.toUpperCase();

  updateThemePreview();
}

// Get current theme colors from pickers
function getCurrentThemeColors() {
  const primaryPicker = document.getElementById('primaryColorPicker');
  const backgroundPicker = document.getElementById('backgroundColorPicker');
  const textPicker = document.getElementById('textColorPicker');

  return {
    primary: primaryPicker ? primaryPicker.value : defaultSettings.themeColors.primary,
    background: backgroundPicker ? backgroundPicker.value : defaultSettings.themeColors.background,
    text: textPicker ? textPicker.value : defaultSettings.themeColors.text
  };
}

// Update theme preview samples
function updateThemePreview() {
  const colors = getCurrentThemeColors();

  // Primary
  const previewPrimary = document.getElementById('previewPrimary');
  if (previewPrimary) {
    previewPrimary.style.backgroundColor = colors.primary;
    previewPrimary.style.borderColor = colors.primary;
    previewPrimary.style.color = 'white';
  }

  // Background
  const previewBackground = document.getElementById('previewBackground');
  if (previewBackground) {
    previewBackground.style.backgroundColor = colors.background;
    previewBackground.style.color = colors.text;
    previewBackground.style.borderColor = colors.background;
  }

  // Text
  const previewText = document.getElementById('previewText');
  if (previewText) {
    previewText.style.backgroundColor = 'white';
    previewText.style.color = colors.text;
    previewText.style.borderColor = '#e5e7eb';
  }
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

// Preloaded theme presets
const PRESET_THEMES = {
  // Light themes
  ocean:    { primary: '#0EA5E9', background: '#E0F2FE', text: '#0C4A6E' },
  forest:   { primary: '#16A34A', background: '#DCFCE7', text: '#14532D' },
  sunset:   { primary: '#EA580C', background: '#FFF7ED', text: '#431407' },
  berry:    { primary: '#7C3AED', background: '#F3E8FF', text: '#1F1B29' },
  slate:    { primary: '#64748B', background: '#F1F5F9', text: '#1E293B' },
  // Dark themes
  midnight: { primary: '#60A5FA', background: '#1E293B', text: '#CBD5E1' },
  ember:    { primary: '#F97316', background: '#292524', text: '#D6D3D1' },
  neon:     { primary: '#22D3EE', background: '#18181B', text: '#E4E4E7' },
  plum:     { primary: '#A78BFA', background: '#1C1917', text: '#D4D4D8' },
  charcoal: { primary: '#A1A1AA', background: '#27272A', text: '#E4E4E7' }
};

// Load a preset theme — updates pickers, applies, and saves
async function loadPresetTheme(presetKey) {
  const colors = PRESET_THEMES[presetKey];
  if (!colors) return;

  // Update the pickers
  loadThemeColors(colors);

  // Apply and save in one step (same as applyTheme)
  await applyTheme();

  // Highlight the active circle
  document.querySelectorAll('.preloaded-theme-circle').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.preset === presetKey);
  });

  showStatus(`Loaded "${presetKey}" theme`, 'success');
}

// Load saved themes into slots
function loadSavedThemes(savedThemes) {
  savedThemes.forEach((theme, index) => {
    const themeName = document.getElementById(`themeName${index}`);
    const slotPrimary = document.getElementById(`slot${index}Primary`);
    const slotBackground = document.getElementById(`slot${index}Background`);
    const slotText = document.getElementById(`slot${index}Text`);
    const loadBtn = document.querySelector(`[data-slot="${index}"].load-theme-btn`);

    // Skip if elements don't exist (theme tab may have different structure)
    if (!themeName || !slotPrimary || !slotBackground || !slotText) {
      return;
    }

    if (theme) {
      // Theme exists - show load button
      themeName.value = theme.name || `Theme ${index + 1}`;
      slotPrimary.style.backgroundColor = theme.colors.primary;
      slotBackground.style.backgroundColor = theme.colors.background;
      slotText.style.backgroundColor = theme.colors.text;

      if (loadBtn) loadBtn.style.display = 'inline-block';
    } else {
      // No theme saved
      themeName.value = '';
      themeName.placeholder = `Theme ${index + 1}`;
      slotPrimary.style.backgroundColor = '#f3f4f6';
      slotBackground.style.backgroundColor = '#f3f4f6';
      slotText.style.backgroundColor = '#f3f4f6';

      if (loadBtn) loadBtn.style.display = 'none';
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

/**
 * Initialize feature help icon click handlers
 * Opens the relevant guide page when clicked
 */
function initFeatureHelpLinks() {
  const baseUrl = 'https://king0lightai.github.io/JT-Power-Tools/guides/';

  document.querySelectorAll('.feature-help[data-guide]').forEach(helpIcon => {
    helpIcon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation(); // Prevent toggle from being triggered

      const guideName = helpIcon.dataset.guide;
      if (guideName) {
        chrome.tabs.create({ url: `${baseUrl}${guideName}.html` });
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('JT Power Tools popup loaded');

  // Check for password reset token in URL
  const urlParams = new URLSearchParams(window.location.search);
  const resetToken = urlParams.get('reset_token');
  if (resetToken) {
    console.log('Password reset token detected, showing reset form');
    // We'll show the reset form after account UI is initialized
    window.pendingResetToken = resetToken;
  }

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

  // Initialize feature help icons - open guide on click
  initFeatureHelpLinks();

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
      if (updatedSettings.dragDrop || updatedSettings.rgbTheme || updatedSettings.previewMode || updatedSettings.availabilityFilter) {
        console.log('Disabling PRO features - tier:', tier);
        updatedSettings.dragDrop = false;
        updatedSettings.rgbTheme = false;
        updatedSettings.previewMode = false;
        updatedSettings.availabilityFilter = false;
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

  // Initialize account UI
  await initAccountUI();

  // Listen for checkbox changes
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', async () => {
      console.log('Checkbox changed:', checkbox.id, checkbox.checked);

      // Handle mutual exclusivity for appearance modes
      if (checkbox.checked) {
        const darkModeEl = document.getElementById('darkMode');
        const rgbThemeEl = document.getElementById('rgbTheme');
        const contrastFixEl = document.getElementById('contrastFix');

        if (checkbox.id === 'contrastFix') {
          // Contrast Fix enabled - disable Dark Mode and RGB Theme
          if (darkModeEl) darkModeEl.checked = false;
          if (rgbThemeEl) rgbThemeEl.checked = false;
        } else if (checkbox.id === 'darkMode') {
          // Dark Mode enabled - disable Contrast Fix and RGB Theme
          if (contrastFixEl) contrastFixEl.checked = false;
          if (rgbThemeEl) rgbThemeEl.checked = false;
        } else if (checkbox.id === 'rgbTheme') {
          // RGB Theme enabled - disable Contrast Fix and Dark Mode
          if (contrastFixEl) contrastFixEl.checked = false;
          if (darkModeEl) darkModeEl.checked = false;
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
    const pickerEl = document.getElementById(picker);
    const valueEl = document.getElementById(value);
    if (pickerEl) {
      pickerEl.addEventListener('input', (e) => {
        if (valueEl) valueEl.textContent = e.target.value.toUpperCase();
        updateThemePreview();
      });
    }
  });

  // Listen for apply theme button
  const applyThemeBtn = document.getElementById('applyThemeBtn');
  if (applyThemeBtn) {
    applyThemeBtn.addEventListener('click', applyTheme);
  }

  // Listen for customize button to toggle theme customization panel (if it exists)
  const customizeThemeBtn = document.getElementById('customizeThemeBtn');
  if (customizeThemeBtn) {
    customizeThemeBtn.addEventListener('click', () => {
      const themeCustomization = document.getElementById('themeCustomization');
      const isVisible = themeCustomization && themeCustomization.style.display === 'block';

      if (themeCustomization) {
        if (isVisible) {
          themeCustomization.style.display = 'none';
          customizeThemeBtn.classList.remove('expanded');
        } else {
          themeCustomization.style.display = 'block';
          customizeThemeBtn.classList.add('expanded');
        }
      }
    });
  }

  // Listen for preset theme circles
  document.querySelectorAll('.preloaded-theme-circle').forEach(btn => {
    btn.addEventListener('click', () => {
      loadPresetTheme(btn.dataset.preset);
    });
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
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', refreshCurrentTab);
  }

  // Initialize AI Integration section
  await initAiIntegration();

  // Initialize MCP tab
  await initMcpTab();
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

// ===================================
// MCP Tab Functionality
// ===================================

/**
 * Initialize MCP tab functionality
 */
async function initMcpTab() {
  // Setup copy URL button
  const copyUrlBtn = document.getElementById('copyMcpUrl');
  if (copyUrlBtn) {
    copyUrlBtn.addEventListener('click', async () => {
      const urlCode = document.getElementById('mcpServerUrl');
      const urlText = urlCode.textContent;

      try {
        await navigator.clipboard.writeText(urlText);

        // Show copied state
        copyUrlBtn.classList.add('copied');
        const icon = copyUrlBtn.querySelector('i');
        icon.className = 'ph ph-check';

        // Reset after 2 seconds
        setTimeout(() => {
          copyUrlBtn.classList.remove('copied');
          icon.className = 'ph ph-copy';
        }, 2000);
      } catch (err) {
        console.error('Failed to copy MCP URL:', err);
      }
    });
  }

  // Setup Grant Key update button
  const updateGrantKeyBtn = document.getElementById('updateGrantKeyBtn');
  if (updateGrantKeyBtn) {
    updateGrantKeyBtn.addEventListener('click', handleUpdateGrantKey);
  }

  // Setup Grant Key input enter key
  const grantKeyInput = document.getElementById('mcpGrantKeyInput');
  if (grantKeyInput) {
    grantKeyInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleUpdateGrantKey();
    });
  }

  // Setup Copy MCP Config button
  const copyConfigBtn = document.getElementById('copyMcpConfigBtn');
  if (copyConfigBtn) {
    copyConfigBtn.addEventListener('click', handleCopyMcpConfig);
  }

  // Setup platform tabs
  initPlatformTabs();

  // Setup tab-link navigation (prerequisite links that switch to other tabs)
  document.querySelectorAll('[data-tab-link]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = link.dataset.tabLink;
      const tabBtn = document.querySelector(`.tab-item[data-tab="${targetTab}"]`);
      if (tabBtn) tabBtn.click();
    });
  });

  // Check MCP status, credentials, and prerequisites
  await checkMcpStatus();
  await updateMcpCredentialsDisplay();
  await updateMcpPrerequisites();
}

/**
 * Update the MCP credentials display
 */
async function updateMcpCredentialsDisplay() {
  const licenseKeyEl = document.getElementById('mcpLicenseKey');
  const grantKeyEl = document.getElementById('mcpGrantKey');
  const licenseStatusEl = document.getElementById('mcpLicenseStatus');
  const grantStatusEl = document.getElementById('mcpGrantStatus');
  const copyConfigBtn = document.getElementById('copyMcpConfigBtn');

  if (!licenseKeyEl || !grantKeyEl) return;

  // Get license key
  const licenseData = await LicenseService.getLicenseData();
  if (licenseData && licenseData.key) {
    // Show masked key (first 8 chars + ...)
    const maskedKey = licenseData.key.substring(0, 8) + '••••••••';
    licenseKeyEl.textContent = maskedKey;
    licenseKeyEl.classList.remove('not-set');
    licenseStatusEl.className = 'credential-status valid';
  } else {
    licenseKeyEl.textContent = 'Not configured';
    licenseKeyEl.classList.add('not-set');
    licenseStatusEl.className = 'credential-status invalid';
  }

  // Get grant key
  const stored = await chrome.storage.local.get(['jtpro_grant_key']);
  if (stored.jtpro_grant_key) {
    // Show masked grant key
    const maskedGrant = stored.jtpro_grant_key.substring(0, 8) + '••••••••';
    grantKeyEl.textContent = maskedGrant;
    grantKeyEl.classList.remove('not-set');
    grantStatusEl.className = 'credential-status valid';
  } else {
    grantKeyEl.textContent = 'Not configured';
    grantKeyEl.classList.add('not-set');
    grantStatusEl.className = 'credential-status invalid';
  }

  // Enable/disable Copy MCP Config button
  if (copyConfigBtn) {
    const hasCredentials = licenseData?.key && stored.jtpro_grant_key;
    copyConfigBtn.disabled = !hasCredentials;
  }
}

/**
 * Handle updating the grant key
 */
async function handleUpdateGrantKey() {
  const grantKeyInput = document.getElementById('mcpGrantKeyInput');
  const updateBtn = document.getElementById('updateGrantKeyBtn');
  const errorEl = document.getElementById('grantKeyError');

  const newGrantKey = grantKeyInput.value.trim();

  if (!newGrantKey) {
    showGrantKeyError('Please enter a Grant Key');
    return;
  }

  // Disable button during update
  updateBtn.disabled = true;
  updateBtn.innerHTML = '<i class="ph ph-spinner"></i> Updating...';
  errorEl.style.display = 'none';

  try {
    // Test the new grant key via Pro Service
    const result = await JobTreadProService.verifyOrgAccess(newGrantKey);

    if (result.success) {
      // Clear input
      grantKeyInput.value = '';

      // Show success
      showGrantKeySuccess(`Grant Key updated! Connected to ${result.organizationName || 'organization'}`);

      // Update displays
      await updateMcpCredentialsDisplay();
      await checkMcpStatus();
      await checkApiStatus();
    } else {
      // Show error
      if (result.code === 'ORG_MISMATCH') {
        showGrantKeyError('This Grant Key is from a different organization than your license');
      } else if (result.code === 'INVALID_GRANT_KEY') {
        showGrantKeyError('Invalid Grant Key. Please check and try again.');
      } else {
        showGrantKeyError(result.message || result.error || 'Failed to verify Grant Key');
      }
    }
  } catch (error) {
    console.error('Error updating grant key:', error);
    showGrantKeyError('Error connecting to server. Please try again.');
  } finally {
    updateBtn.disabled = false;
    updateBtn.innerHTML = '<i class="ph ph-arrows-clockwise"></i> Update';
  }
}

/**
 * Show grant key error message
 */
function showGrantKeyError(message) {
  const errorEl = document.getElementById('grantKeyError');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.className = 'grant-key-error';
    errorEl.style.display = 'block';
  }
}

/**
 * Show grant key success message
 */
function showGrantKeySuccess(message) {
  const errorEl = document.getElementById('grantKeyError');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.className = 'grant-key-success';
    errorEl.style.display = 'block';

    // Auto-hide after 3 seconds
    setTimeout(() => {
      errorEl.style.display = 'none';
    }, 3000);
  }
}

// Current selected platform for MCP config
let selectedMcpPlatform = 'claude-code';

/**
 * Initialize platform tabs for MCP config generator
 */
function initPlatformTabs() {
  const platformTabs = document.querySelectorAll('.platform-tab');
  const platformNotes = document.querySelectorAll('.platform-note');

  platformTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const platform = tab.dataset.platform;
      selectedMcpPlatform = platform;

      // Update active tab
      platformTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Update active note
      platformNotes.forEach(note => {
        note.classList.remove('active');
        if (note.dataset.platform === platform) {
          note.classList.add('active');
        }
      });
    });
  });
}

/**
 * Generate MCP config for the selected platform
 * @param {string} platform - The platform to generate config for
 * @param {string} licenseKey - The license key
 * @param {string} grantKey - The grant key
 * @returns {string} The config as a formatted string
 */
function generateMcpConfig(platform, licenseKey, grantKey) {
  const authToken = `${licenseKey}:${grantKey}`;
  const serverUrl = MCP_SERVER_URL;

  switch (platform) {
    case 'claude-code':
      // Claude Code: HTTP transport (official type per Anthropic docs)
      return JSON.stringify({
        "mcpServers": {
          "jobtread": {
            "type": "http",
            "url": `${serverUrl}/mcp`,
            "headers": {
              "Authorization": `Bearer ${authToken}`
            }
          }
        }
      }, null, 2);

    case 'claude-desktop':
      // Claude Desktop: Requires mcp-remote wrapper (stdio bridge to remote)
      return JSON.stringify({
        "mcpServers": {
          "jobtread": {
            "command": "npx",
            "args": [
              "-y",
              "mcp-remote",
              `${serverUrl}/mcp`,
              "--header",
              `Authorization:Bearer ${authToken}`
            ]
          }
        }
      }, null, 2);

    case 'chatgpt':
      // ChatGPT: Uses SSE transport via the UI (per OpenAI docs)
      return `MCP Server URL:
${serverUrl}/sse/

Authentication Type: Bearer Token
Bearer Token: ${authToken}

Steps:
1. Go to ChatGPT Settings > Connected apps
2. Click "Add MCP server"
3. Paste the URL above (must end with /sse/)
4. Select "Bearer Token" and paste the token`;

    case 'gemini':
      // Gemini CLI: Uses httpUrl key (per Google Gemini docs)
      return JSON.stringify({
        "mcpServers": {
          "jobtread": {
            "httpUrl": `${serverUrl}/mcp`,
            "headers": {
              "Authorization": `Bearer ${authToken}`
            }
          }
        }
      }, null, 2);

    default:
      return '';
  }
}

/**
 * Handle copying MCP config to clipboard
 */
async function handleCopyMcpConfig() {
  const copyConfigBtn = document.getElementById('copyMcpConfigBtn');

  // Get credentials
  const licenseData = await LicenseService.getLicenseData();
  const stored = await chrome.storage.local.get(['jtpro_grant_key']);

  if (!licenseData?.key || !stored.jtpro_grant_key) {
    showStatus('Please configure both License Key and Grant Key first', 'error');
    return;
  }

  // Generate platform-specific config
  const config = generateMcpConfig(selectedMcpPlatform, licenseData.key, stored.jtpro_grant_key);

  try {
    await navigator.clipboard.writeText(config);

    // Show copied state
    copyConfigBtn.classList.add('copied');
    copyConfigBtn.innerHTML = '<i class="ph ph-check"></i> Copied!';

    // Reset after 2 seconds
    setTimeout(() => {
      copyConfigBtn.classList.remove('copied');
      copyConfigBtn.innerHTML = '<i class="ph ph-copy"></i> Copy Config';
    }, 2000);

    const platformNames = {
      'claude-code': 'Claude Code',
      'claude-desktop': 'Claude Desktop',
      'chatgpt': 'ChatGPT',
      'gemini': 'Gemini'
    };
    showStatus(`${platformNames[selectedMcpPlatform]} config copied!`, 'success');
  } catch (err) {
    console.error('Failed to copy MCP config:', err);
    showStatus('Failed to copy to clipboard', 'error');
  }
}

/**
 * Check MCP server status and update UI
 */
async function checkMcpStatus() {
  const statusSection = document.getElementById('mcpStatus');
  if (!statusSection) return;

  const statusDot = statusSection.querySelector('.status-dot');
  const statusText = statusSection.querySelector('.status-text');

  // Check if user has Power User tier
  const tier = await LicenseService.getTier();
  const hasPowerUser = tier && LicenseService.tierHasFeature(tier, 'customFieldFilter');

  if (!hasPowerUser) {
    statusDot.classList.remove('connected');
    statusDot.classList.add('disconnected');
    statusText.textContent = 'Requires Power User tier';
    return;
  }

  // Check if grant key is configured
  const stored = await chrome.storage.local.get(['jtpro_grant_key', 'jtpro_license_key']);

  if (!stored.jtpro_license_key) {
    statusDot.classList.remove('connected');
    statusDot.classList.add('disconnected');
    statusText.textContent = 'Enter License Key in License tab';
    return;
  }

  if (!stored.jtpro_grant_key) {
    statusDot.classList.remove('connected');
    statusDot.classList.add('disconnected');
    statusText.textContent = 'Enter Grant Key in API tab';
    return;
  }

  // Both keys configured - check server health
  try {
    const response = await fetch(`${MCP_SERVER_URL}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.status === 'ok') {
        statusDot.classList.remove('disconnected');
        statusDot.classList.add('connected');
        statusText.textContent = 'Ready to connect';
        return;
      }
    }

    statusDot.classList.remove('connected');
    statusDot.classList.add('disconnected');
    statusText.textContent = 'Server unavailable';
  } catch (error) {
    console.error('MCP health check failed:', error);
    statusDot.classList.remove('connected');
    statusDot.classList.add('disconnected');
    statusText.textContent = 'Connection error';
  }
}

/**
 * Update MCP prerequisites checklist
 */
async function updateMcpPrerequisites() {
  const prereqLicense = document.getElementById('prereqLicense');
  const prereqGrantKey = document.getElementById('prereqGrantKey');

  if (!prereqLicense || !prereqGrantKey) return;

  // Check license (Power User tier)
  const tier = await LicenseService.getTier();
  const hasPowerUser = tier && LicenseService.tierHasFeature(tier, 'customFieldFilter');
  setPrereqStatus(prereqLicense, hasPowerUser);

  // Check grant key
  const stored = await chrome.storage.local.get(['jtpro_grant_key']);
  setPrereqStatus(prereqGrantKey, !!stored.jtpro_grant_key);

}

/**
 * Set a prerequisite row as done or not
 */
function setPrereqStatus(el, isDone) {
  if (!el) return;
  const icon = el.querySelector('.prereq-icon');
  if (isDone) {
    icon.className = 'ph ph-check-circle prereq-icon prereq-check';
    el.classList.add('prereq-done');
  } else {
    icon.className = 'ph ph-circle-dashed prereq-icon';
    el.classList.remove('prereq-done');
  }
}

// Initialize MCP tab when DOM is ready (add to existing DOMContentLoaded)

// ===================================
// Account Section
// ===================================

// Temporary setup token storage
let currentSetupToken = null;

/**
 * Initialize account UI
 */
async function initAccountUI() {
  // Get elements
  const accountSection = document.getElementById('accountSection');
  const accountLoggedIn = document.getElementById('accountLoggedIn');
  const accountLogin = document.getElementById('accountLogin');
  const accountRegister = document.getElementById('accountRegister');
  const accountSetupPrompt = document.getElementById('accountSetupPrompt');

  if (!accountSection) return;

  // Check if AccountService is available
  if (typeof AccountService === 'undefined') {
    console.warn('AccountService not available');
    accountSection.style.display = 'none';
    return;
  }

  // Initialize AccountService
  await AccountService.init();

  // Set up event listeners
  setupAccountEventListeners();

  // Check if there's a pending password reset token
  if (window.pendingResetToken) {
    // Switch to License tab and show reset form
    const licenseTab = document.querySelector('[data-tab="license"]');
    if (licenseTab) licenseTab.click();
    showAccountForm('reset');
    delete window.pendingResetToken;
  } else {
    // Update account UI state
    await updateAccountUI();
  }
}

/**
 * Set up event listeners for account forms
 */
function setupAccountEventListeners() {
  // Login button
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.addEventListener('click', handleLogin);
  }

  // Register button
  const registerBtn = document.getElementById('registerBtn');
  if (registerBtn) {
    registerBtn.addEventListener('click', handleRegister);
  }

  // Logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  // Show register form
  const showRegisterBtn = document.getElementById('showRegisterBtn');
  if (showRegisterBtn) {
    showRegisterBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showAccountForm('register');
    });
  }

  // Show login form
  const showLoginBtn = document.getElementById('showLoginBtn');
  if (showLoginBtn) {
    showLoginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showAccountForm('login');
    });
  }

  // Setup account button (from prompt)
  const setupAccountBtn = document.getElementById('setupAccountBtn');
  if (setupAccountBtn) {
    setupAccountBtn.addEventListener('click', () => {
      showAccountForm('register');
    });
  }

  // Skip account button
  const skipAccountBtn = document.getElementById('skipAccountBtn');
  if (skipAccountBtn) {
    skipAccountBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // Hide setup prompt, show nothing (user chose to skip)
      document.getElementById('accountSetupPrompt').style.display = 'none';
      // Store that user skipped (won't show prompt again this session)
      sessionStorage.setItem('accountSetupSkipped', 'true');
    });
  }

  // Sign in button (from prompt - for users who already have an account)
  const signInBtn = document.getElementById('signInBtn');
  if (signInBtn) {
    signInBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showAccountForm('login');
    });
  }

  // Show forgot password form
  const showForgotPasswordBtn = document.getElementById('showForgotPasswordBtn');
  if (showForgotPasswordBtn) {
    showForgotPasswordBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showAccountForm('forgot');
    });
  }

  // Back to login from forgot password
  const backToLoginBtn = document.getElementById('backToLoginBtn');
  if (backToLoginBtn) {
    backToLoginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showAccountForm('login');
    });
  }

  // Send reset link button
  const sendResetBtn = document.getElementById('sendResetBtn');
  if (sendResetBtn) {
    sendResetBtn.addEventListener('click', handleForgotPassword);
  }

  // Reset password button
  const resetPasswordBtn = document.getElementById('resetPasswordBtn');
  if (resetPasswordBtn) {
    resetPasswordBtn.addEventListener('click', handleResetPassword);
  }

  // Enter key for forgot password form
  const forgotEmail = document.getElementById('forgotEmail');
  if (forgotEmail) {
    forgotEmail.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleForgotPassword();
    });
  }

  // Enter key for reset password form
  const confirmPassword = document.getElementById('confirmPassword');
  if (confirmPassword) {
    confirmPassword.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleResetPassword();
    });
  }

  // Enter key for login form
  const loginPassword = document.getElementById('loginPassword');
  if (loginPassword) {
    loginPassword.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleLogin();
    });
  }

  // Enter key for register form
  const registerPassword = document.getElementById('registerPassword');
  if (registerPassword) {
    registerPassword.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleRegister();
    });
  }
}

/**
 * Update account UI based on current state
 */
async function updateAccountUI() {
  const accountLoggedIn = document.getElementById('accountLoggedIn');
  const accountLogin = document.getElementById('accountLogin');
  const accountRegister = document.getElementById('accountRegister');
  const accountSetupPrompt = document.getElementById('accountSetupPrompt');
  const accountSection = document.getElementById('accountSection');

  if (!accountSection) return;

  // Check if user is logged in
  if (AccountService.isLoggedIn()) {
    // Show logged in state
    const user = AccountService.getCurrentUser();
    document.getElementById('accountEmail').textContent = user?.email || 'Unknown';
    document.getElementById('accountTier').textContent = `${LicenseService.getTierDisplayName(user?.tier)} Tier`;

    accountLoggedIn.style.display = 'block';
    accountLogin.style.display = 'none';
    accountRegister.style.display = 'none';
    accountSetupPrompt.style.display = 'none';
    accountSection.style.display = 'block';
    return;
  }

  // Check if user has a valid license
  const licenseData = await LicenseService.getLicenseData();
  if (licenseData && licenseData.valid) {
    // User has license but not logged in
    // Check if we already have a setup token
    if (currentSetupToken) {
      // Show register form
      showAccountForm('register');
    } else if (sessionStorage.getItem('accountSetupSkipped') !== 'true') {
      // Show setup prompt (unless skipped)
      accountLoggedIn.style.display = 'none';
      accountLogin.style.display = 'none';
      accountRegister.style.display = 'none';
      accountSetupPrompt.style.display = 'block';
      accountSection.style.display = 'block';
    } else {
      // User skipped - hide account section
      accountSection.style.display = 'none';
    }
  } else {
    // No license - still show login/register so users can sign in.
    // The server will validate whether they have a license on login.
    if (sessionStorage.getItem('accountSetupSkipped') !== 'true') {
      accountLoggedIn.style.display = 'none';
      accountLogin.style.display = 'none';
      accountRegister.style.display = 'none';
      accountSetupPrompt.style.display = 'block';
      accountSection.style.display = 'block';
    } else {
      accountSection.style.display = 'none';
    }
  }
}

/**
 * Show a specific account form
 */
async function showAccountForm(formType) {
  const accountLoggedIn = document.getElementById('accountLoggedIn');
  const accountLogin = document.getElementById('accountLogin');
  const accountRegister = document.getElementById('accountRegister');
  const accountSetupPrompt = document.getElementById('accountSetupPrompt');
  const accountForgotPassword = document.getElementById('accountForgotPassword');
  const accountResetPassword = document.getElementById('accountResetPassword');
  const accountSection = document.getElementById('accountSection');

  // Hide all
  accountLoggedIn.style.display = 'none';
  accountLogin.style.display = 'none';
  accountRegister.style.display = 'none';
  accountSetupPrompt.style.display = 'none';
  if (accountForgotPassword) accountForgotPassword.style.display = 'none';
  if (accountResetPassword) accountResetPassword.style.display = 'none';

  // Clear errors and success messages
  document.getElementById('loginError').style.display = 'none';
  document.getElementById('registerError').style.display = 'none';
  const forgotError = document.getElementById('forgotError');
  const forgotSuccess = document.getElementById('forgotSuccess');
  const resetError = document.getElementById('resetError');
  const resetSuccess = document.getElementById('resetSuccess');
  if (forgotError) forgotError.style.display = 'none';
  if (forgotSuccess) forgotSuccess.style.display = 'none';
  if (resetError) resetError.style.display = 'none';
  if (resetSuccess) resetSuccess.style.display = 'none';

  if (formType === 'login') {
    accountLogin.style.display = 'block';
  } else if (formType === 'register') {
    // Get setup token if we don't have one
    if (!currentSetupToken) {
      const licenseData = await LicenseService.getLicenseData();
      if (licenseData && licenseData.key) {
        const result = await AccountService.requestSetupToken(licenseData.key);
        if (result.success) {
          currentSetupToken = result.data.setupToken;
          // Pre-fill email if available
          const emailInput = document.getElementById('registerEmail');
          if (emailInput && result.data.purchaseEmail) {
            emailInput.value = result.data.purchaseEmail;
          }
        } else {
          showAccountError('register', result.error || 'Failed to prepare registration');
          return;
        }
      }
    }
    accountRegister.style.display = 'block';
  } else if (formType === 'forgot') {
    if (accountForgotPassword) accountForgotPassword.style.display = 'block';
  } else if (formType === 'reset') {
    if (accountResetPassword) accountResetPassword.style.display = 'block';
  }

  accountSection.style.display = 'block';
}

/**
 * Handle login form submission
 */
async function handleLogin() {
  const emailInput = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');
  const loginBtn = document.getElementById('loginBtn');

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showAccountError('login', 'Please enter email and password');
    return;
  }

  // Disable button
  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in...';

  try {
    const result = await AccountService.login(email, password);

    if (result.success) {
      // Clear form
      emailInput.value = '';
      passwordInput.value = '';
      // Update UI
      await updateAccountUI();
      await checkApiStatus();
      showStatus('Signed in successfully!', 'success');
    } else {
      showAccountError('login', result.error || 'Login failed');
    }
  } catch (error) {
    console.error('Login error:', error);
    showAccountError('login', 'An error occurred. Please try again.');
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign In';
  }
}

/**
 * Handle register form submission
 */
async function handleRegister() {
  const nameInput = document.getElementById('registerName');
  const emailInput = document.getElementById('registerEmail');
  const passwordInput = document.getElementById('registerPassword');
  const registerBtn = document.getElementById('registerBtn');

  const displayName = nameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showAccountError('register', 'Please enter email and password');
    return;
  }

  if (password.length < 8) {
    showAccountError('register', 'Password must be at least 8 characters');
    return;
  }

  if (!currentSetupToken) {
    showAccountError('register', 'Registration session expired. Please try again.');
    showAccountForm('register');
    return;
  }

  // Disable button
  registerBtn.disabled = true;
  registerBtn.textContent = 'Creating account...';

  try {
    const result = await AccountService.register(currentSetupToken, email, password, displayName);

    if (result.success) {
      // Clear form and token
      nameInput.value = '';
      emailInput.value = '';
      passwordInput.value = '';
      currentSetupToken = null;
      // Update UI
      await updateAccountUI();
      showStatus('Account created successfully!', 'success');
    } else {
      showAccountError('register', result.error || 'Registration failed');
      // If token expired or invalid, clear it
      if (result.error && (result.error.includes('token') || result.error.includes('expired'))) {
        currentSetupToken = null;
      }
    }
  } catch (error) {
    console.error('Register error:', error);
    showAccountError('register', 'An error occurred. Please try again.');
  } finally {
    registerBtn.disabled = false;
    registerBtn.textContent = 'Create Account';
  }
}

/**
 * Handle logout
 */
async function handleLogout() {
  const logoutBtn = document.getElementById('logoutBtn');
  logoutBtn.disabled = true;
  logoutBtn.textContent = 'Signing out...';

  try {
    await AccountService.logout();
    await updateAccountUI();
    showStatus('Signed out', 'success');
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    logoutBtn.disabled = false;
    logoutBtn.textContent = 'Sign Out';
  }
}

/**
 * Handle forgot password form submission
 */
async function handleForgotPassword() {
  const emailInput = document.getElementById('forgotEmail');
  const sendResetBtn = document.getElementById('sendResetBtn');
  const forgotSuccess = document.getElementById('forgotSuccess');
  const forgotError = document.getElementById('forgotError');

  const email = emailInput.value.trim();

  if (!email) {
    showAccountError('forgot', 'Please enter your email address');
    return;
  }

  // Disable button
  sendResetBtn.disabled = true;
  sendResetBtn.textContent = 'Sending...';
  forgotSuccess.style.display = 'none';
  forgotError.style.display = 'none';

  try {
    const result = await AccountService.requestPasswordReset(email);

    if (result.success) {
      // Show success message
      forgotSuccess.textContent = 'If an account exists with that email, a reset link has been sent. Please check your inbox.';
      forgotSuccess.style.display = 'block';
      // Clear email input
      emailInput.value = '';
    } else {
      showAccountError('forgot', result.error || 'Failed to send reset email');
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    showAccountError('forgot', 'An error occurred. Please try again.');
  } finally {
    sendResetBtn.disabled = false;
    sendResetBtn.textContent = 'Send Reset Link';
  }
}

/**
 * Handle reset password form submission
 */
async function handleResetPassword() {
  const newPasswordInput = document.getElementById('newPassword');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const resetPasswordBtn = document.getElementById('resetPasswordBtn');
  const resetSuccess = document.getElementById('resetSuccess');
  const resetError = document.getElementById('resetError');

  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (!newPassword) {
    showAccountError('reset', 'Please enter a new password');
    return;
  }

  if (newPassword.length < 8) {
    showAccountError('reset', 'Password must be at least 8 characters');
    return;
  }

  if (newPassword !== confirmPassword) {
    showAccountError('reset', 'Passwords do not match');
    return;
  }

  // Get reset token from URL
  const urlParams = new URLSearchParams(window.location.search);
  const resetToken = urlParams.get('reset_token');

  if (!resetToken) {
    showAccountError('reset', 'Invalid reset link. Please request a new one.');
    return;
  }

  // Disable button
  resetPasswordBtn.disabled = true;
  resetPasswordBtn.textContent = 'Resetting...';
  resetSuccess.style.display = 'none';
  resetError.style.display = 'none';

  try {
    const result = await AccountService.resetPassword(resetToken, newPassword);

    if (result.success) {
      // Show success message
      resetSuccess.textContent = 'Password has been reset successfully! You can now sign in with your new password.';
      resetSuccess.style.display = 'block';
      // Clear inputs
      newPasswordInput.value = '';
      confirmPasswordInput.value = '';
      // Clear token from URL
      window.history.replaceState({}, document.title, window.location.pathname);
      // After 2 seconds, show login form
      setTimeout(() => {
        showAccountForm('login');
      }, 2000);
    } else {
      showAccountError('reset', result.error || 'Failed to reset password');
    }
  } catch (error) {
    console.error('Reset password error:', error);
    showAccountError('reset', 'An error occurred. Please try again.');
  } finally {
    resetPasswordBtn.disabled = false;
    resetPasswordBtn.textContent = 'Reset Password';
  }
}

/**
 * Show account error message
 */
function showAccountError(formType, message) {
  const errorIds = {
    'login': 'loginError',
    'register': 'registerError',
    'forgot': 'forgotError',
    'reset': 'resetError'
  };

  const errorEl = document.getElementById(errorIds[formType]);
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }
}
