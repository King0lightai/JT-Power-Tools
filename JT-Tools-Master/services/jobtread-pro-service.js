/**
 * JobTread Pro Service
 * Wraps the Cloudflare Worker API for use in the extension
 * Integrates with existing Gumroad license system
 */

const JobTreadProService = (() => {
  // Debug flag — set to false for production builds to suppress console output
  const DEBUG = false;

  // Safe logging — only outputs when DEBUG is true
  function log(...args) { if (DEBUG) log('', ...args); }
  function logError(...args) { if (DEBUG) logError('', ...args); }

  // Storage keys
  const STORAGE_KEYS = {
    DEVICE_ID: 'jtpro_device_id',
    GRANT_KEY: 'jtpro_grant_key',
    GRANT_KEY_VERSION: 'jtpro_grant_key_version',
    ORG_ID: 'jtpro_org_id',
    ORG_NAME: 'jtpro_org_name',
    DEVICE_AUTHORIZED: 'jtpro_device_authorized',
    JOBS_CACHE: 'jtpro_jobs_cache',
    JOBS_CACHE_TIME: 'jtpro_jobs_cache_time',
    CUSTOM_FIELDS_CACHE: 'jtpro_custom_fields_cache',
    CUSTOM_FIELDS_CACHE_TIME: 'jtpro_custom_fields_cache_time',
    SESSION_TOKEN: 'jtpro_session_token',
    SESSION_TOKEN_EXPIRY: 'jtpro_session_token_expiry'
  };

  // Obfuscation key for grant key storage (matches license.js pattern)
  const OBFUSCATION_KEY = 'jt-power-tools-gk-v1';

  /**
   * Obfuscate a string using XOR + Base64 (same pattern as LicenseService)
   * NOT cryptographic — prevents casual inspection in Chrome storage
   */
  function obfuscateValue(text) {
    try {
      const textBytes = new TextEncoder().encode(text);
      const keyBytes = new TextEncoder().encode(OBFUSCATION_KEY);
      const obfuscated = new Uint8Array(textBytes.length);
      for (let i = 0; i < textBytes.length; i++) {
        obfuscated[i] = textBytes[i] ^ keyBytes[i % keyBytes.length];
      }
      return btoa(String.fromCharCode(...obfuscated));
    } catch (error) {
      logError('Obfuscation error:', error);
      return text;
    }
  }

  /**
   * Deobfuscate a string from XOR + Base64
   */
  function deobfuscateValue(obfuscatedText) {
    try {
      const obfuscated = Uint8Array.from(atob(obfuscatedText), c => c.charCodeAt(0));
      const keyBytes = new TextEncoder().encode(OBFUSCATION_KEY);
      const original = new Uint8Array(obfuscated.length);
      for (let i = 0; i < obfuscated.length; i++) {
        original[i] = obfuscated[i] ^ keyBytes[i % keyBytes.length];
      }
      return new TextDecoder().decode(original);
    } catch (error) {
      logError('Deobfuscation error:', error);
      return null;
    }
  }

  /**
   * Save grant key to storage (obfuscated)
   */
  async function saveGrantKey(grantKey) {
    const obfuscated = obfuscateValue(grantKey);
    await chrome.storage.local.set({
      [STORAGE_KEYS.GRANT_KEY]: obfuscated,
      [STORAGE_KEYS.GRANT_KEY_VERSION]: 2
    });
  }

  /**
   * Read grant key from storage (deobfuscate, with legacy migration)
   * @returns {Promise<string|null>} The plaintext grant key or null
   */
  async function getGrantKey() {
    try {
      const result = await chrome.storage.local.get([
        STORAGE_KEYS.GRANT_KEY,
        STORAGE_KEYS.GRANT_KEY_VERSION
      ]);
      if (!result[STORAGE_KEYS.GRANT_KEY]) return null;

      // v2: obfuscated format
      if (result[STORAGE_KEYS.GRANT_KEY_VERSION] === 2) {
        return deobfuscateValue(result[STORAGE_KEYS.GRANT_KEY]);
      }

      // Legacy v1: plaintext — migrate to obfuscated
      const plainKey = result[STORAGE_KEYS.GRANT_KEY];
      log('Migrating legacy grant key to obfuscated format');
      await saveGrantKey(plainKey);
      return plainKey;
    } catch (error) {
      logError('Error reading grant key:', error);
      return null;
    }
  }

  /**
   * Request a short-lived session token from the server.
   * Replaces sending raw licenseKey:grantKey in every request header.
   * Falls back to raw credentials if the server doesn't support session tokens yet.
   * @returns {Promise<{token: string, isSession: boolean}>}
   */
  async function getSessionToken() {
    try {
      // Check for a cached, unexpired session token
      const cached = await chrome.storage.local.get([
        STORAGE_KEYS.SESSION_TOKEN,
        STORAGE_KEYS.SESSION_TOKEN_EXPIRY
      ]);

      if (cached[STORAGE_KEYS.SESSION_TOKEN] && cached[STORAGE_KEYS.SESSION_TOKEN_EXPIRY]) {
        const timeLeft = cached[STORAGE_KEYS.SESSION_TOKEN_EXPIRY] - Date.now();
        if (timeLeft > 2 * 60 * 1000) { // more than 2 min remaining
          return { token: cached[STORAGE_KEYS.SESSION_TOKEN], isSession: true };
        }
      }

      // Get raw credentials to exchange for a session token
      const licenseData = await getLicenseKey();
      const grantKey = await getGrantKey();
      if (!licenseData || !grantKey) {
        return { token: null, isSession: false };
      }

      // Try the session token endpoint
      const mcpServerUrl = window.WORKER_CONFIG?.MCP_SERVER_URL
        || 'https://jobtread-mcp-server.king0light-ai.workers.dev';

      const response = await fetch(`${mcpServerUrl}/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey: licenseData.licenseKey,
          grantKey
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.sessionToken && data.expiresAt) {
          // Cache the session token
          await chrome.storage.local.set({
            [STORAGE_KEYS.SESSION_TOKEN]: data.sessionToken,
            [STORAGE_KEYS.SESSION_TOKEN_EXPIRY]: data.expiresAt
          });
          return { token: data.sessionToken, isSession: true };
        }
      }

      // Server doesn't support session tokens yet — fall back to raw credentials
      log('Session token endpoint not available, falling back to raw credentials');
      return { token: `${licenseData.licenseKey}:${grantKey}`, isSession: false };
    } catch (error) {
      // Network error — fall back to raw credentials
      logError('Session token exchange failed:', error);
      const licenseData = await getLicenseKey();
      const grantKey = await getGrantKey();
      if (licenseData && grantKey) {
        return { token: `${licenseData.licenseKey}:${grantKey}`, isSession: false };
      }
      return { token: null, isSession: false };
    }
  }

  // Cache duration (2 minutes for jobs, 1 hour for custom fields)
  const JOBS_CACHE_DURATION = 2 * 60 * 1000;
  const CUSTOM_FIELDS_CACHE_DURATION = 60 * 60 * 1000;

  /**
   * Get or generate device ID
   */
  async function getDeviceId() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.DEVICE_ID);

      if (result[STORAGE_KEYS.DEVICE_ID]) {
        return result[STORAGE_KEYS.DEVICE_ID];
      }

      // Generate new device ID
      const deviceId = await generateDeviceId();
      await chrome.storage.local.set({ [STORAGE_KEYS.DEVICE_ID]: deviceId });
      log('Generated new device ID');
      return deviceId;
    } catch (error) {
      logError('Error getting device ID:', error);
      return null;
    }
  }

  /**
   * Generate a unique device ID
   */
  async function generateDeviceId() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    const hex = Array.from(array)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return `dev_${hex}`;
  }

  /**
   * Get device name for display
   */
  function getDeviceName() {
    const ua = navigator.userAgent;
    let browser = 'Unknown';
    let os = 'Unknown';

    // Detect browser
    if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';

    // Detect OS
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'Mac';
    else if (ua.includes('Linux')) os = 'Linux';

    return `${browser} on ${os}`;
  }

  /**
   * Make request to Cloudflare Worker
   */
  async function workerRequest(action, params = {}) {
    if (!window.WORKER_CONFIG || !window.WORKER_CONFIG.USE_WORKER) {
      throw new Error('Worker not configured. Please update worker-config.js');
    }

    const workerUrl = window.WORKER_CONFIG.WORKER_URL;

    if (workerUrl.includes('YOUR_SUBDOMAIN')) {
      throw new Error('Please update WORKER_URL in worker-config.js with your actual Cloudflare Worker URL');
    }

    try {
      // Get Gumroad license key from existing license system
      const licenseData = await getLicenseKey();
      log('License data:', licenseData ? 'Found' : 'Missing');

      if (!licenseData) {
        throw new Error('No Gumroad license found. Please activate your license first.');
      }

      // Get device ID
      const deviceId = await getDeviceId();
      log('Device ID:', deviceId ? 'Generated' : 'Missing');

      const requestBody = {
        action,
        licenseKey: licenseData.licenseKey,
        deviceId,
        ...params
      };

      log('Sending request to Worker:', {
        action,
        hasLicenseKey: !!licenseData.licenseKey,
        hasDeviceId: !!deviceId,
        hasGrantKey: !!params.grantKey,
        workerUrl
      });

      const response = await fetch(workerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        logError('Worker error:', response.status, errorText);
        throw new Error(`Worker error ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      // Handle error responses
      if (data.error) {
        logError('API error:', data);
        return data;
      }

      return data;
    } catch (error) {
      logError('Request failed:', error);
      throw error;
    }
  }

  /**
   * Get Gumroad license key from existing license service
   */
  async function getLicenseKey() {
    try {
      // Check if LicenseService is available
      if (typeof LicenseService !== 'undefined') {
        const licenseData = await LicenseService.getLicenseData();
        log('License data from LicenseService:', licenseData ? {
          valid: licenseData.valid,
          hasKey: !!licenseData.key,
          email: licenseData.purchaseEmail
        } : 'null');

        if (licenseData && licenseData.valid && licenseData.key) {
          return {
            licenseKey: licenseData.key,  // Fix: use 'key' not 'licenseKey'
            email: licenseData.purchaseEmail
          };
        }
      }

      log('No valid license found');
      return null;
    } catch (error) {
      logError('Error getting license:', error);
      return null;
    }
  }

  /**
   * Register user with Worker (creates user in DB if needed)
   */
  async function registerUser() {
    try {
      log('Registering user with Worker...');
      const result = await workerRequest('registerUser', {
        deviceName: getDeviceName()
      });

      log('Registration result:', result);
      return result;
    } catch (error) {
      logError('registerUser failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verify organization access with Grant Key
   * This connects the JobTread API and locks the license to the org
   */
  async function verifyOrgAccess(grantKey) {
    try {
      // First, ensure user is registered in Worker's database
      log('Ensuring user is registered...');
      const registerResult = await registerUser();

      if (!registerResult.success && registerResult.code !== 'DEVICE_NOT_AUTHORIZED') {
        logError('Registration failed:', registerResult);
        return {
          success: false,
          error: registerResult.error || 'Failed to register with Worker',
          code: registerResult.code
        };
      }

      // Now verify org access
      log('Verifying org access...');
      const result = await workerRequest('verifyOrgAccess', {
        grantKey: grantKey.trim(),
        deviceName: getDeviceName()
      });

      if (result.error) {
        return {
          success: false,
          error: result.error,
          code: result.code,
          message: result.message
        };
      }

      // Save org info
      if (result.success) {
        // Store grant key obfuscated (not plaintext)
        await saveGrantKey(grantKey.trim());
        await chrome.storage.local.set({
          [STORAGE_KEYS.ORG_ID]: result.orgId,
          [STORAGE_KEYS.ORG_NAME]: result.organizationName,
          [STORAGE_KEYS.DEVICE_AUTHORIZED]: true
        });

        // Invalidate any cached session token when grant key changes
        await chrome.storage.local.remove([
          STORAGE_KEYS.SESSION_TOKEN,
          STORAGE_KEYS.SESSION_TOKEN_EXPIRY
        ]);

        // Clear cache when new org is connected
        await clearCache();
      }

      return result;
    } catch (error) {
      logError('verifyOrgAccess failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get user status from Worker
   */
  async function getStatus() {
    try {
      return await workerRequest('getStatus');
    } catch (error) {
      logError('getStatus failed:', error);
      return { error: error.message };
    }
  }

  /**
   * Check if API is configured and ready
   */
  async function isConfigured() {
    try {
      const result = await chrome.storage.local.get([
        STORAGE_KEYS.GRANT_KEY,
        STORAGE_KEYS.ORG_ID,
        STORAGE_KEYS.DEVICE_AUTHORIZED
      ]);

      return !!(result[STORAGE_KEYS.GRANT_KEY] &&
                result[STORAGE_KEYS.ORG_ID] &&
                result[STORAGE_KEYS.DEVICE_AUTHORIZED]);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get stored org info
   */
  async function getOrgInfo() {
    try {
      const result = await chrome.storage.local.get([
        STORAGE_KEYS.ORG_ID,
        STORAGE_KEYS.ORG_NAME
      ]);

      return {
        orgId: result[STORAGE_KEYS.ORG_ID] || null,
        orgName: result[STORAGE_KEYS.ORG_NAME] || null
      };
    } catch (error) {
      return { orgId: null, orgName: null };
    }
  }

  /**
   * Get custom fields through Worker
   */
  async function getCustomFields() {
    // Check cache first
    try {
      const cached = await chrome.storage.local.get([
        STORAGE_KEYS.CUSTOM_FIELDS_CACHE,
        STORAGE_KEYS.CUSTOM_FIELDS_CACHE_TIME
      ]);

      const cacheAge = Date.now() - (cached[STORAGE_KEYS.CUSTOM_FIELDS_CACHE_TIME] || 0);

      if (cached[STORAGE_KEYS.CUSTOM_FIELDS_CACHE] && cacheAge < CUSTOM_FIELDS_CACHE_DURATION) {
        log('Using cached custom fields');
        return { fields: cached[STORAGE_KEYS.CUSTOM_FIELDS_CACHE], _cached: true };
      }
    } catch (e) {
      // Cache read failed, continue to fetch
    }

    try {
      const result = await workerRequest('getCustomFields', { limit: 25 });

      if (result.fields) {
        // Cache the results
        await chrome.storage.local.set({
          [STORAGE_KEYS.CUSTOM_FIELDS_CACHE]: result.fields,
          [STORAGE_KEYS.CUSTOM_FIELDS_CACHE_TIME]: Date.now()
        });
      }

      return result;
    } catch (error) {
      logError('getCustomFields failed:', error);
      throw error;
    }
  }

  /**
   * Get all jobs through Worker
   */
  async function getAllJobs() {
    // Check cache first
    try {
      const cached = await chrome.storage.local.get([
        STORAGE_KEYS.JOBS_CACHE,
        STORAGE_KEYS.JOBS_CACHE_TIME
      ]);

      const cacheAge = Date.now() - (cached[STORAGE_KEYS.JOBS_CACHE_TIME] || 0);

      if (cached[STORAGE_KEYS.JOBS_CACHE] && cacheAge < JOBS_CACHE_DURATION) {
        log('Using cached jobs');
        return { jobs: cached[STORAGE_KEYS.JOBS_CACHE], _cached: true };
      }
    } catch (e) {
      // Cache read failed, continue to fetch
    }

    try {
      const result = await workerRequest('getAllJobs');

      if (result.jobs) {
        // Cache the results
        await chrome.storage.local.set({
          [STORAGE_KEYS.JOBS_CACHE]: result.jobs,
          [STORAGE_KEYS.JOBS_CACHE_TIME]: Date.now()
        });
      }

      return result;
    } catch (error) {
      logError('getAllJobs failed:', error);
      throw error;
    }
  }

  /**
   * Get filtered jobs through Worker
   * @param {Array} filters - Array of { fieldName, values: [...] } objects (OR logic within values)
   * @param {string} jobStatus - 'open', 'closed', or 'all' (default: 'all')
   */
  async function getFilteredJobs(filters, jobStatus = 'all') {
    try {
      return await workerRequest('getFilteredJobs', { filters, jobStatus });
    } catch (error) {
      logError('getFilteredJobs failed:', error);
      throw error;
    }
  }

  /**
   * Get unique values for a custom field across all jobs
   * Used to populate filter dropdowns for fields without predefined options
   * @param {string} fieldId - The custom field ID
   * @param {string} fieldName - The custom field name (alternative to ID)
   */
  async function getCustomFieldValues(fieldId, fieldName) {
    try {
      const result = await workerRequest('getCustomFieldValues', { fieldId, fieldName });
      return result.values || [];
    } catch (error) {
      logError('getCustomFieldValues failed:', error);
      throw error;
    }
  }

  /**
   * Clear all cached data
   */
  async function clearCache() {
    try {
      await chrome.storage.local.remove([
        STORAGE_KEYS.JOBS_CACHE,
        STORAGE_KEYS.JOBS_CACHE_TIME,
        STORAGE_KEYS.CUSTOM_FIELDS_CACHE,
        STORAGE_KEYS.CUSTOM_FIELDS_CACHE_TIME
      ]);

      // Also clear cache on Worker side
      try {
        await workerRequest('clearCache');
      } catch (e) {
        // Worker cache clear failed, local cache is cleared at least
      }

      log('Cache cleared');
    } catch (error) {
      logError('Error clearing cache:', error);
    }
  }

  /**
   * Disconnect (remove Grant Key but keep org lock)
   */
  async function disconnect() {
    try {
      const result = await workerRequest('disconnect');

      if (result.success) {
        await chrome.storage.local.remove([
          STORAGE_KEYS.GRANT_KEY,
          STORAGE_KEYS.DEVICE_AUTHORIZED
        ]);
        await clearCache();
      }

      return result;
    } catch (error) {
      logError('disconnect failed:', error);
      return { error: error.message };
    }
  }

  /**
   * Clear all configuration (for testing or license transfer)
   */
  async function clearConfig() {
    try {
      await chrome.storage.local.remove(Object.values(STORAGE_KEYS));
      log('Configuration cleared');
    } catch (error) {
      logError('Error clearing config:', error);
    }
  }

  /**
   * Get task types for the organization (via Pro Worker)
   */
  async function getTaskTypes() {
    try {
      const result = await workerRequest('getTaskTypes');
      return result.taskTypes || [];
    } catch (error) {
      logError('getTaskTypes failed:', error);
      throw error;
    }
  }

  /**
   * Get unassigned tasks for a date range (via Pro Worker)
   * @param {string} startDate - Start date YYYY-MM-DD
   * @param {string} endDate - End date YYYY-MM-DD
   */
  async function getUnassignedTasks(startDate, endDate) {
    try {
      const result = await workerRequest('getUnassignedTasks', { startDate, endDate });
      return result.tasks || [];
    } catch (error) {
      logError('getUnassignedTasks failed:', error);
      throw error;
    }
  }

  // Public API
  return {
    // Configuration
    isConfigured,
    getOrgInfo,
    getDeviceId,

    // Authentication
    verifyOrgAccess,
    getStatus,
    getGrantKey,
    getSessionToken,
    disconnect,
    clearConfig,

    // Data fetching
    getCustomFields,
    getAllJobs,
    getFilteredJobs,
    getCustomFieldValues,

    // Task Type Filter
    getTaskTypes,
    getUnassignedTasks,

    // Cache management
    clearCache,

    // Storage keys (for direct access if needed)
    STORAGE_KEYS
  };
})();

// Export for use in different contexts
if (typeof window !== 'undefined') {
  window.JobTreadProService = JobTreadProService;
}
