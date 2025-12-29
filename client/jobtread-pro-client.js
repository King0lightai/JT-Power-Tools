/**
 * JobTread Tools Pro - Browser Extension Client Library
 *
 * Handles communication with the Cloudflare Worker API.
 * Manages license activation, device authorization, and API calls.
 */

class JobTreadProClient {
  constructor(workerUrl) {
    this.workerUrl = workerUrl;
    this.licenseKey = null;
    this.deviceId = null;
    this.user = null;  // Stores user info after successful init
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  /**
   * Initialize the client - checks stored credentials and device status
   * @returns {Object} Status object with required next steps
   */
  async init() {
    await this.loadCredentials();

    // Generate device ID if not exists
    if (!this.deviceId) {
      this.deviceId = await this.generateDeviceId();
      await this.saveCredentials();
    }

    // If no license key, user needs to activate
    if (!this.licenseKey) {
      return { needsActivation: true };
    }

    // Check device status with worker
    const result = await this.request('registerUser', {
      deviceId: this.deviceId,
      deviceName: this.getDeviceName()
    });

    if (result.error) {
      // Handle specific error codes
      if (result.code === 'LICENSE_INVALID') {
        // Clear stored license
        this.licenseKey = null;
        await this.saveCredentials();
        return { needsActivation: true, error: result.error };
      }
      return { error: result.error, code: result.code };
    }

    if (result.needsOrgVerification) {
      return {
        needsOrgVerification: true,
        organizationName: result.organizationName
      };
    }

    if (result.needsJobTreadConnection) {
      return { needsJobTreadConnection: true };
    }

    // Successfully initialized
    this.user = {
      deviceAuthorized: result.deviceAuthorized,
      organizationName: result.organizationName,
      orgId: result.orgId
    };

    return { initialized: true, user: this.user };
  }

  // ===========================================================================
  // License & Device Management
  // ===========================================================================

  /**
   * Activate a Gumroad license key
   */
  async activate(licenseKey) {
    this.licenseKey = licenseKey.trim();

    const result = await this.request('registerUser', {
      deviceId: this.deviceId,
      deviceName: this.getDeviceName()
    });

    if (result.error) {
      this.licenseKey = null;
      return result;
    }

    // Save credentials on successful activation
    await this.saveCredentials();

    if (result.needsJobTreadConnection) {
      return { success: true, needsJobTreadConnection: true };
    }

    if (result.needsOrgVerification) {
      return {
        success: true,
        needsOrgVerification: true,
        organizationName: result.organizationName
      };
    }

    this.user = {
      deviceAuthorized: result.deviceAuthorized,
      organizationName: result.organizationName,
      orgId: result.orgId
    };

    return { success: true, user: this.user };
  }

  /**
   * Verify organization access with a JobTread Grant Key
   * This proves the user belongs to the same org as the license
   */
  async verifyOrgAccess(grantKey) {
    const result = await this.request('verifyOrgAccess', {
      deviceId: this.deviceId,
      grantKey: grantKey.trim(),
      deviceName: this.getDeviceName()
    });

    if (result.error) {
      return result;
    }

    this.user = {
      deviceAuthorized: result.deviceAuthorized,
      organizationName: result.organizationName,
      orgId: result.orgId
    };

    return { success: true, user: this.user };
  }

  /**
   * Disconnect JobTread (keeps license but removes grant key)
   */
  async disconnect() {
    return await this.request('disconnect', {
      deviceId: this.deviceId
    });
  }

  /**
   * Get user status and device list
   */
  async getStatus() {
    return await this.request('getStatus', {
      deviceId: this.deviceId
    });
  }

  /**
   * List authorized devices
   */
  async listDevices() {
    return await this.request('listDevices', {
      deviceId: this.deviceId
    });
  }

  /**
   * Revoke a device
   */
  async revokeDevice(targetDeviceId) {
    return await this.request('revokeDevice', {
      deviceId: this.deviceId,
      targetDeviceId
    });
  }

  /**
   * Transfer license to new organization (clears all devices and org lock)
   */
  async transferLicense() {
    const result = await this.request('transferLicense', {
      deviceId: this.deviceId
    });

    if (result.success) {
      this.user = null;
    }

    return result;
  }

  /**
   * Clear stored license
   */
  async clearLicense() {
    this.licenseKey = null;
    this.user = null;
    await this.saveCredentials();
  }

  // ===========================================================================
  // JobTread API Methods
  // ===========================================================================

  /**
   * Get custom fields for jobs
   */
  async getCustomFields() {
    return await this.request('getCustomFields', {
      deviceId: this.deviceId
    });
  }

  /**
   * Get all jobs
   */
  async getAllJobs() {
    return await this.request('getAllJobs', {
      deviceId: this.deviceId
    });
  }

  /**
   * Get jobs filtered by custom field values
   * @param {Array} filters - Array of { fieldName, value } objects
   */
  async getFilteredJobs(filters) {
    return await this.request('getFilteredJobs', {
      deviceId: this.deviceId,
      filters
    });
  }

  /**
   * Execute a raw Pave query
   * @param {Object} query - Pave query object (org and grant key will be injected)
   */
  async rawQuery(query) {
    return await this.request('rawQuery', {
      deviceId: this.deviceId,
      query
    });
  }

  /**
   * Clear cached data
   */
  async clearCache() {
    return await this.request('clearCache', {
      deviceId: this.deviceId
    });
  }

  // ===========================================================================
  // Core Request Method
  // ===========================================================================

  /**
   * Make a request to the Cloudflare Worker
   */
  async request(action, params = {}) {
    try {
      const response = await fetch(this.workerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action,
          licenseKey: this.licenseKey,
          ...params
        })
      });

      const data = await response.json();

      // Handle device not authorized - requires org verification
      if (data.code === 'DEVICE_NOT_AUTHORIZED') {
        return {
          error: data.error,
          code: data.code,
          needsOrgVerification: true,
          organizationName: data.organizationName
        };
      }

      // Handle JobTread not connected
      if (data.code === 'JOBTREAD_NOT_CONNECTED') {
        return {
          error: data.error,
          code: data.code,
          needsJobTreadConnection: true
        };
      }

      return data;
    } catch (error) {
      console.error('JobTread Pro Client error:', error);
      return { error: 'Network error', message: error.message };
    }
  }

  // ===========================================================================
  // Credential Storage
  // ===========================================================================

  /**
   * Load credentials from Chrome storage
   */
  async loadCredentials() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.sync.get(['jtpro_licenseKey', 'jtpro_deviceId'], (result) => {
          this.licenseKey = result.jtpro_licenseKey || null;
          this.deviceId = result.jtpro_deviceId || null;
          resolve();
        });
      } else {
        // Fallback to localStorage for testing
        this.licenseKey = localStorage.getItem('jtpro_licenseKey');
        this.deviceId = localStorage.getItem('jtpro_deviceId');
        resolve();
      }
    });
  }

  /**
   * Save credentials to Chrome storage
   */
  async saveCredentials() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.sync.set({
          jtpro_licenseKey: this.licenseKey,
          jtpro_deviceId: this.deviceId
        }, resolve);
      } else {
        // Fallback to localStorage for testing
        if (this.licenseKey) {
          localStorage.setItem('jtpro_licenseKey', this.licenseKey);
        } else {
          localStorage.removeItem('jtpro_licenseKey');
        }
        if (this.deviceId) {
          localStorage.setItem('jtpro_deviceId', this.deviceId);
        }
        resolve();
      }
    });
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Generate a unique device ID
   */
  async generateDeviceId() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    const hex = Array.from(array)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return `dev_${hex}`;
  }

  /**
   * Get a human-readable device name
   */
  getDeviceName() {
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
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iOS')) os = 'iOS';

    return `${browser} on ${os}`;
  }

  /**
   * Check if client is ready to make API calls
   */
  isReady() {
    return this.licenseKey && this.deviceId && this.user?.deviceAuthorized;
  }

  /**
   * Get the organization name this license is locked to
   */
  getOrganizationName() {
    return this.user?.organizationName || null;
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = JobTreadProClient;
} else if (typeof window !== 'undefined') {
  window.JobTreadProClient = JobTreadProClient;
}
