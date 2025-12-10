// JobTread API Client Service
// Handles Pave API calls for fetching jobs, custom fields, and other data

const JobTreadAPI = (() => {
  // API Configuration - JobTread uses Pave query language
  const API_URL = 'https://api.jobtread.com/pave';

  // Storage keys
  const STORAGE_KEYS = {
    API_KEY: 'jtToolsApiKey',
    ORG_ID: 'jtToolsOrgId',
    JOBS_CACHE: 'jtToolsJobsCache',
    CUSTOM_FIELDS_CACHE: 'jtToolsCustomFieldsCache',
    CUSTOM_FIELDS_TIMESTAMP: 'jtToolsCustomFieldsTimestamp',
    JOBS_TIMESTAMP: 'jtToolsJobsTimestamp'
  };

  // Cache duration (5 minutes for jobs, 1 hour for custom field definitions)
  const JOBS_CACHE_DURATION = 5 * 60 * 1000;
  const CUSTOM_FIELDS_CACHE_DURATION = 60 * 60 * 1000;

  /**
   * Get the stored API key
   * @returns {Promise<string|null>}
   */
  async function getApiKey() {
    try {
      const result = await chrome.storage.sync.get(STORAGE_KEYS.API_KEY);
      return result[STORAGE_KEYS.API_KEY] || null;
    } catch (error) {
      console.error('JobTreadAPI: Error getting API key:', error);
      return null;
    }
  }

  /**
   * Save API key to storage
   * @param {string} apiKey
   * @returns {Promise<boolean>}
   */
  async function setApiKey(apiKey) {
    try {
      await chrome.storage.sync.set({ [STORAGE_KEYS.API_KEY]: apiKey });
      console.log('JobTreadAPI: API key saved');
      return true;
    } catch (error) {
      console.error('JobTreadAPI: Error saving API key:', error);
      return false;
    }
  }

  /**
   * Get the stored organization ID
   * @returns {Promise<string|null>}
   */
  async function getOrgId() {
    try {
      const result = await chrome.storage.sync.get(STORAGE_KEYS.ORG_ID);
      return result[STORAGE_KEYS.ORG_ID] || null;
    } catch (error) {
      console.error('JobTreadAPI: Error getting org ID:', error);
      return null;
    }
  }

  /**
   * Save organization ID to storage
   * @param {string} orgId
   * @returns {Promise<boolean>}
   */
  async function setOrgId(orgId) {
    try {
      await chrome.storage.sync.set({ [STORAGE_KEYS.ORG_ID]: orgId });
      console.log('JobTreadAPI: Org ID saved');
      return true;
    } catch (error) {
      console.error('JobTreadAPI: Error saving org ID:', error);
      return false;
    }
  }

  /**
   * Check if API is configured (has both API key and org ID)
   * @returns {Promise<boolean>}
   */
  async function isConfigured() {
    const apiKey = await getApiKey();
    return !!apiKey;
  }

  /**
   * Check if fully configured (has org ID too)
   * @returns {Promise<boolean>}
   */
  async function isFullyConfigured() {
    const apiKey = await getApiKey();
    const orgId = await getOrgId();
    return !!(apiKey && orgId);
  }

  /**
   * Execute a Pave query
   * JobTread uses Pave query language - a JSON-based query format
   * @param {Object} query - Pave query object
   * @returns {Promise<Object>} Response data
   */
  async function paveQuery(query) {
    const apiKey = await getApiKey();

    if (!apiKey) {
      throw new Error('JobTread API key not configured');
    }

    try {
      console.log('JobTreadAPI: Executing Pave query:', JSON.stringify(query, null, 2));

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(query)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('JobTreadAPI: API Error:', response.status, errorText);
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('JobTreadAPI: Query result:', result);

      // Check for errors in the response
      if (result.errors && result.errors.length > 0) {
        console.error('JobTreadAPI: Pave errors:', result.errors);
        throw new Error(result.errors[0].message || 'Query failed');
      }

      return result;
    } catch (error) {
      console.error('JobTreadAPI: Query failed:', error);
      throw error;
    }
  }

  /**
   * Fetch the current user's organization info
   * Used to discover the organization ID
   * @returns {Promise<Object>} User and organization info
   */
  async function fetchCurrentUser() {
    const query = {
      viewer: {
        id: {},
        email: {},
        name: {},
        organizations: {
          nodes: {
            id: {},
            name: {}
          }
        }
      }
    };

    const result = await paveQuery(query);
    return result.viewer;
  }

  /**
   * Auto-discover and save organization ID from current user
   * @returns {Promise<string|null>} Organization ID or null
   */
  async function discoverOrgId() {
    try {
      const user = await fetchCurrentUser();

      if (user?.organizations?.nodes?.length > 0) {
        const orgId = user.organizations.nodes[0].id;
        await setOrgId(orgId);
        console.log('JobTreadAPI: Discovered org ID:', orgId);
        return orgId;
      }

      return null;
    } catch (error) {
      console.error('JobTreadAPI: Failed to discover org ID:', error);
      throw error;
    }
  }

  /**
   * Fetch custom field definitions for jobs
   * @param {string} orgId - Organization ID (optional, will use stored if not provided)
   * @returns {Promise<Array>} List of custom field definitions
   */
  async function fetchCustomFieldDefinitions(orgId = null) {
    // Check cache first
    try {
      const cached = await chrome.storage.local.get([
        STORAGE_KEYS.CUSTOM_FIELDS_CACHE,
        STORAGE_KEYS.CUSTOM_FIELDS_TIMESTAMP
      ]);

      const cacheAge = Date.now() - (cached[STORAGE_KEYS.CUSTOM_FIELDS_TIMESTAMP] || 0);

      if (cached[STORAGE_KEYS.CUSTOM_FIELDS_CACHE] && cacheAge < CUSTOM_FIELDS_CACHE_DURATION) {
        console.log('JobTreadAPI: Using cached custom fields');
        return cached[STORAGE_KEYS.CUSTOM_FIELDS_CACHE];
      }
    } catch (e) {
      // Cache read failed, continue to fetch
    }

    // Get org ID if not provided
    if (!orgId) {
      orgId = await getOrgId();
      if (!orgId) {
        // Try to discover it
        orgId = await discoverOrgId();
        if (!orgId) {
          throw new Error('Organization ID not configured');
        }
      }
    }

    // Pave query for custom fields targeting jobs
    const query = {
      organization: {
        $: { id: orgId },
        customFields: {
          $: {
            where: ['targetType', '=', 'job'],
            sortBy: [{ field: 'position' }]
          },
          nodes: {
            id: {},
            name: {},
            type: {},
            targetType: {},
            options: {}
          }
        }
      }
    };

    try {
      const result = await paveQuery(query);
      const definitions = result.organization?.customFields?.nodes || [];

      // Cache the results
      await chrome.storage.local.set({
        [STORAGE_KEYS.CUSTOM_FIELDS_CACHE]: definitions,
        [STORAGE_KEYS.CUSTOM_FIELDS_TIMESTAMP]: Date.now()
      });

      console.log('JobTreadAPI: Fetched custom field definitions:', definitions);
      return definitions;
    } catch (error) {
      console.error('JobTreadAPI: Failed to fetch custom field definitions:', error);
      throw error;
    }
  }

  /**
   * Fetch jobs with their custom field values
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of jobs with custom fields
   */
  async function fetchJobs(options = {}) {
    const { limit = 100, search = '', status = null } = options;

    let orgId = await getOrgId();
    if (!orgId) {
      orgId = await discoverOrgId();
      if (!orgId) {
        throw new Error('Organization ID not configured');
      }
    }

    // Build where clause
    const whereConditions = [];
    if (status) {
      whereConditions.push(['status', '=', status]);
    }

    // Pave query for jobs
    const query = {
      organization: {
        $: { id: orgId },
        jobs: {
          $: {
            first: limit,
            ...(whereConditions.length > 0 && { where: whereConditions }),
            sortBy: [{ field: 'createdAt', direction: 'DESC' }]
          },
          nodes: {
            id: {},
            name: {},
            number: {},
            status: {},
            createdAt: {},
            customFieldValues: {
              nodes: {
                id: {},
                value: {},
                customField: {
                  id: {},
                  name: {},
                  type: {}
                }
              }
            }
          }
        }
      }
    };

    try {
      const result = await paveQuery(query);
      const jobs = result.organization?.jobs?.nodes || [];
      console.log('JobTreadAPI: Fetched jobs:', jobs.length);
      return jobs;
    } catch (error) {
      console.error('JobTreadAPI: Failed to fetch jobs:', error);
      throw error;
    }
  }

  /**
   * Fetch jobs filtered by a specific custom field value
   * @param {string} customFieldId - Custom field ID
   * @param {string} value - Value to filter by
   * @returns {Promise<Array>} Filtered jobs
   */
  async function fetchJobsByCustomField(customFieldId, value) {
    let orgId = await getOrgId();
    if (!orgId) {
      orgId = await discoverOrgId();
      if (!orgId) {
        throw new Error('Organization ID not configured');
      }
    }

    // Pave query for jobs filtered by custom field
    // Note: The exact filter syntax may need adjustment based on API capabilities
    const query = {
      organization: {
        $: { id: orgId },
        jobs: {
          $: {
            first: 100,
            where: [
              ['customFieldValues', 'some', [
                ['customField', 'id', '=', customFieldId],
                ['value', '=', value]
              ]]
            ],
            sortBy: [{ field: 'number', direction: 'DESC' }]
          },
          nodes: {
            id: {},
            name: {},
            number: {},
            status: {},
            customFieldValues: {
              nodes: {
                id: {},
                value: {},
                customField: {
                  id: {},
                  name: {}
                }
              }
            }
          }
        }
      }
    };

    try {
      const result = await paveQuery(query);
      return result.organization?.jobs?.nodes || [];
    } catch (error) {
      console.error('JobTreadAPI: Failed to fetch filtered jobs:', error);
      throw error;
    }
  }

  /**
   * Get unique values for a custom field across all jobs
   * Useful for building filter dropdowns
   * @param {string} customFieldId - Custom field ID
   * @returns {Promise<Array>} Unique values
   */
  async function getCustomFieldValues(customFieldId) {
    // Fetch all jobs and extract unique values for the field
    const jobs = await fetchJobs({ limit: 500 });

    const values = new Set();
    jobs.forEach(job => {
      const fieldValues = job.customFieldValues?.nodes || [];
      fieldValues.forEach(fv => {
        if (fv.customField?.id === customFieldId && fv.value) {
          values.add(fv.value);
        }
      });
    });

    return Array.from(values).sort();
  }

  /**
   * Test API connection with current key
   * @returns {Promise<Object>} Connection test result
   */
  async function testConnection() {
    try {
      // Try to fetch current user to test the connection
      const user = await fetchCurrentUser();

      if (user) {
        // Auto-discover org ID while we're at it
        if (user.organizations?.nodes?.length > 0) {
          const orgId = user.organizations.nodes[0].id;
          await setOrgId(orgId);
        }

        return {
          success: true,
          message: 'API connection successful',
          user: {
            email: user.email,
            name: user.name,
            orgId: user.organizations?.nodes?.[0]?.id,
            orgName: user.organizations?.nodes?.[0]?.name
          }
        };
      }

      return { success: false, message: 'No user data returned' };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Connection failed',
        error
      };
    }
  }

  /**
   * Clear all cached data
   * @returns {Promise<void>}
   */
  async function clearCache() {
    try {
      await chrome.storage.local.remove([
        STORAGE_KEYS.JOBS_CACHE,
        STORAGE_KEYS.CUSTOM_FIELDS_CACHE,
        STORAGE_KEYS.CUSTOM_FIELDS_TIMESTAMP,
        STORAGE_KEYS.JOBS_TIMESTAMP
      ]);
      console.log('JobTreadAPI: Cache cleared');
    } catch (error) {
      console.error('JobTreadAPI: Error clearing cache:', error);
    }
  }

  /**
   * Remove API configuration (logout)
   * @returns {Promise<void>}
   */
  async function clearConfig() {
    try {
      await chrome.storage.sync.remove([
        STORAGE_KEYS.API_KEY,
        STORAGE_KEYS.ORG_ID
      ]);
      await clearCache();
      console.log('JobTreadAPI: Configuration cleared');
    } catch (error) {
      console.error('JobTreadAPI: Error clearing config:', error);
    }
  }

  // Public API
  return {
    // Configuration
    getApiKey,
    setApiKey,
    getOrgId,
    setOrgId,
    isConfigured,
    isFullyConfigured,
    testConnection,
    clearConfig,

    // Data fetching
    fetchCurrentUser,
    discoverOrgId,
    fetchCustomFieldDefinitions,
    fetchJobs,
    fetchJobsByCustomField,
    getCustomFieldValues,

    // Raw query access
    paveQuery,

    // Cache management
    clearCache,

    // Constants
    STORAGE_KEYS
  };
})();

// Export for use in content scripts
if (typeof window !== 'undefined') {
  window.JobTreadAPI = JobTreadAPI;
}

// Export for service worker
if (typeof module !== 'undefined' && module.exports) {
  module.exports = JobTreadAPI;
}
