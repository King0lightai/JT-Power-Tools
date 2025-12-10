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
      console.log('JobTreadAPI: Org ID saved:', orgId);
      return true;
    } catch (error) {
      console.error('JobTreadAPI: Error saving org ID:', error);
      return false;
    }
  }

  /**
   * Check if API is configured (has API key)
   * @returns {Promise<boolean>}
   */
  async function isConfigured() {
    const apiKey = await getApiKey();
    return !!apiKey;
  }

  /**
   * Check if fully configured (has both API key and org ID)
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
      // Debug: Check if query is already a string (would indicate double-stringify issue)
      console.log('JobTreadAPI: Query input type:', typeof query);
      console.log('JobTreadAPI: Query input:', query);

      // Prepare body - ensure we're not double-stringifying
      const bodyString = typeof query === 'string' ? query : JSON.stringify(query);

      // Debug: Log exactly what's being sent
      console.log('JobTreadAPI: Body type:', typeof bodyString);
      console.log('JobTreadAPI: Body string:', bodyString);
      console.log('JobTreadAPI: Body first char:', bodyString.charAt(0));
      console.log('JobTreadAPI: API Key (first 10 chars):', apiKey.substring(0, 10) + '...');

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: bodyString
      });

      // Debug: Log response details
      console.log('JobTreadAPI: Response status:', response.status);
      console.log('JobTreadAPI: Response headers:', Object.fromEntries(response.headers.entries()));

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
   * Discover organization ID from the current grant
   * Uses currentGrant -> user -> memberships to find orgs
   * @returns {Promise<Object>} Organization info with id and name
   */
  async function discoverOrganization() {
    const query = {
      currentGrant: {
        user: {
          memberships: {
            nodes: {
              organization: {
                id: {},
                name: {}
              }
            }
          }
        }
      }
    };

    const result = await paveQuery(query);
    const memberships = result.currentGrant?.user?.memberships?.nodes || [];

    if (memberships.length > 0) {
      const org = memberships[0].organization;
      return {
        id: org.id,
        name: org.name
      };
    }

    throw new Error('No organization found for this grant key');
  }

  /**
   * Test API connection by fetching organization name
   * @param {string} orgId - Organization ID to test with (optional - will auto-discover)
   * @returns {Promise<Object>} Connection test result
   */
  async function testConnection(orgId = null) {
    try {
      // If no org ID provided, try to discover it
      if (!orgId) {
        orgId = await getOrgId();
      }

      // If still no org ID, try to discover from currentGrant
      if (!orgId) {
        console.log('JobTreadAPI: No org ID, attempting auto-discovery...');
        try {
          const org = await discoverOrganization();
          if (org) {
            await setOrgId(org.id);
            return {
              success: true,
              message: 'API connection successful',
              organization: {
                id: org.id,
                name: org.name
              }
            };
          }
        } catch (discoverError) {
          console.error('JobTreadAPI: Auto-discovery failed:', discoverError);
          return {
            success: false,
            message: discoverError.message || 'Failed to discover organization',
            error: discoverError
          };
        }
      }

      // If we have an org ID, verify it works
      const query = {
        organization: {
          $: { id: orgId },
          id: {},
          name: {}
        }
      };

      const result = await paveQuery(query);

      if (result.organization) {
        // Save the org ID since it worked
        await setOrgId(orgId);

        return {
          success: true,
          message: 'API connection successful',
          organization: {
            id: result.organization.id,
            name: result.organization.name
          }
        };
      }

      return { success: false, message: 'No organization data returned' };
    } catch (error) {
      // Check for CORS errors
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        return {
          success: false,
          message: 'CORS blocked - API calls require a server proxy',
          error
        };
      }
      return {
        success: false,
        message: error.message || 'Connection failed',
        error
      };
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
        throw new Error('Organization ID not configured');
      }
    }

    // Pave query for custom fields targeting jobs
    // Matches the user's exact example format
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
    const { limit = 100, status = null } = options;

    let orgId = await getOrgId();
    if (!orgId) {
      throw new Error('Organization ID not configured');
    }

    // Build query parameters
    const queryParams = {
      size: limit,
      sortBy: [{ field: 'createdAt', direction: 'DESC' }]
    };

    // Add status filter if provided
    if (status) {
      queryParams.where = ['status', '=', status];
    }

    // Pave query for jobs
    const query = {
      organization: {
        $: { id: orgId },
        jobs: {
          $: queryParams,
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

  /**
   * Direct API test - bypasses storage, uses provided credentials directly
   * Useful for debugging connection issues
   * @param {string} apiKey - API key to test with
   * @returns {Promise<Object>} Test result
   */
  async function directApiTest(apiKey) {
    const query = {
      currentGrant: {
        user: {
          memberships: {
            nodes: {
              organization: {
                id: {},
                name: {}
              }
            }
          }
        }
      }
    };

    console.log('JobTreadAPI: Direct test starting...');
    console.log('JobTreadAPI: Using API key:', apiKey.substring(0, 10) + '...');
    console.log('JobTreadAPI: Query object:', query);

    const bodyString = JSON.stringify(query);
    console.log('JobTreadAPI: Body string:', bodyString);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: bodyString
      });

      console.log('JobTreadAPI: Response status:', response.status);
      const responseText = await response.text();
      console.log('JobTreadAPI: Response body:', responseText);

      if (response.ok) {
        return { success: true, data: JSON.parse(responseText) };
      } else {
        return { success: false, status: response.status, error: responseText };
      }
    } catch (error) {
      console.error('JobTreadAPI: Direct test error:', error);
      return { success: false, error: error.message };
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

    // Organization discovery
    discoverOrganization,

    // Data fetching
    fetchCustomFieldDefinitions,
    fetchJobs,
    getCustomFieldValues,

    // Raw query access
    paveQuery,

    // Cache management
    clearCache,

    // Direct testing
    directApiTest,

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
