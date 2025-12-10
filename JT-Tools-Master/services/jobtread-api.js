// JobTread API Client Service
// Handles Pave API calls for fetching jobs, custom fields, and other data

const JobTreadAPI = (() => {
  // API Configuration - JobTread uses Pave query language
  const API_URL = 'https://api.jobtread.com/pave';

  /**
   * Detect if we're running in a context that needs the background proxy
   * Content scripts run in web page context and face CORS restrictions
   * Popup and service worker run in extension context and can make direct calls
   */
  function needsProxy() {
    // Check if we're in a content script context
    // Content scripts have access to chrome.runtime but not chrome.action
    // Popup and service worker have access to chrome.action
    try {
      // If we can't access chrome at all, we're in a web page context
      if (typeof chrome === 'undefined' || !chrome.runtime) {
        return false; // Can't use proxy anyway
      }
      // If we have chrome.action, we're in popup or service worker (extension context)
      if (chrome.action) {
        return false; // Direct fetch will work
      }
      // Otherwise we're likely in a content script
      return true;
    } catch (e) {
      return true; // Default to proxy for safety
    }
  }

  /**
   * Make a fetch request, routing through background proxy if in content script
   * @param {string} url - URL to fetch
   * @param {Object} options - Fetch options
   * @returns {Promise<Response>} Fetch response or proxy result
   */
  async function proxyFetch(url, options) {
    if (needsProxy()) {
      console.log('JobTreadAPI: Using background proxy for API request');
      // Send through background service worker
      const result = await chrome.runtime.sendMessage({
        type: 'JOBTREAD_API_REQUEST',
        url: url,
        options: options
      });

      // Convert proxy result to a Response-like object
      return {
        ok: result.success,
        status: result.status || (result.success ? 200 : 500),
        statusText: result.statusText || '',
        text: async () => typeof result.data === 'string' ? result.data : JSON.stringify(result.data),
        json: async () => result.data,
        headers: { entries: () => [] }, // Simplified headers
        _proxyResult: result
      };
    } else {
      console.log('JobTreadAPI: Using direct fetch (extension context)');
      // Direct fetch in extension context (popup or service worker)
      return fetch(url, options);
    }
  }

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
   * The query must be wrapped in a "query" key with grantKey in "$"
   * @param {Object} query - Pave query object (inner query, will be wrapped)
   * @returns {Promise<Object>} Response data
   */
  async function paveQuery(query) {
    const apiKey = await getApiKey();

    if (!apiKey) {
      throw new Error('JobTread API key not configured');
    }

    try {
      // Wrap query in the correct format per JT docs:
      // { "query": { "$": { "grantKey": "..." }, ...innerQuery } }
      const wrappedQuery = {
        query: {
          $: { grantKey: apiKey },
          ...query
        }
      };

      console.log('JobTreadAPI: Wrapped query:', JSON.stringify(wrappedQuery, null, 2));

      const bodyString = JSON.stringify(wrappedQuery);

      const response = await proxyFetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: bodyString
      });

      console.log('JobTreadAPI: Response status:', response.status);

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
        id: {},
        user: {
          id: {},
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
    console.log('JobTreadAPI: discoverOrganization full result:', JSON.stringify(result, null, 2));

    // Response comes back WITHOUT the "query" wrapper - data is at root level
    const memberships = result.currentGrant?.user?.memberships?.nodes || [];
    console.log('JobTreadAPI: memberships found:', memberships.length, memberships);

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

      // Response comes back WITHOUT the "query" wrapper
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

    // Pave query for custom fields - get all and filter for jobs client-side
    // Using the correct format from JT docs
    const query = {
      organization: {
        $: { id: orgId },
        id: {},
        customFields: {
          $: {
            sortBy: [
              { field: 'targetType' },
              { field: 'position' }
            ]
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
      // Response comes back WITHOUT the "query" wrapper
      const allDefinitions = result.organization?.customFields?.nodes || [];

      // Log all targetTypes for debugging
      const targetTypes = [...new Set(allDefinitions.map(cf => cf.targetType))];
      console.log('JobTreadAPI: All custom field targetTypes found:', targetTypes);
      console.log('JobTreadAPI: All custom fields:', allDefinitions);

      // Separate by targetType
      const jobFields = allDefinitions.filter(cf =>
        cf.targetType && cf.targetType.toLowerCase() === 'job'
      );
      const budgetFields = allDefinitions.filter(cf =>
        cf.targetType && cf.targetType.toLowerCase() === 'budget'
      );
      const otherFields = allDefinitions.filter(cf =>
        cf.targetType && !['job', 'budget'].includes(cf.targetType.toLowerCase())
      );

      console.log('JobTreadAPI: Job fields:', jobFields.length, ', Budget fields:', budgetFields.length, ', Other:', otherFields.length);

      // Return ALL custom fields with their targetType preserved
      // This allows the UI to show all available fields and indicate which type they are
      // Cache the results
      await chrome.storage.local.set({
        [STORAGE_KEYS.CUSTOM_FIELDS_CACHE]: allDefinitions,
        [STORAGE_KEYS.CUSTOM_FIELDS_TIMESTAMP]: Date.now()
      });

      console.log('JobTreadAPI: Returning all custom field definitions:', allDefinitions.length);
      return allDefinitions;
    } catch (error) {
      console.error('JobTreadAPI: Failed to fetch custom field definitions:', error);
      throw error;
    }
  }

  /**
   * Fetch jobs with their custom field values
   * @param {Object} options - Query options
   * @param {number} options.limit - Max number of jobs to fetch (default 100)
   * @param {string} options.status - Filter by job status
   * @param {string} options.customFieldName - Custom field name to filter by
   * @param {string} options.customFieldValue - Custom field value to filter by
   * @returns {Promise<Array>} List of jobs with custom fields
   */
  async function fetchJobs(options = {}) {
    const { limit = 100, status = null, customFieldName = null, customFieldValue = null } = options;

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

    // Add custom field filter using the "with" pattern from JT docs
    if (customFieldName && customFieldValue) {
      queryParams.with = {
        cf: {
          _: 'customFieldValues',
          $: {
            where: [['customField', 'name'], '=', customFieldName]
          },
          values: {
            $: { field: 'value' }
          }
        }
      };
      // Combine with existing where clause if present
      const cfWhere = [['cf', 'values'], '=', customFieldValue];
      if (queryParams.where) {
        queryParams.where = ['and', queryParams.where, cfWhere];
      } else {
        queryParams.where = cfWhere;
      }
    }

    // Pave query for jobs
    const query = {
      organization: {
        $: { id: orgId },
        id: {},
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
      // Response comes back WITHOUT the "query" wrapper
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
   * @param {string} orgId - Optional org ID for testing
   * @returns {Promise<Object>} Test result
   */
  async function directApiTest(apiKey, orgId = null) {
    // Use the correct JT Docs format:
    // { "query": { "$": { "grantKey": "..." }, ...innerQuery } }
    const wrappedQuery = {
      query: {
        $: { grantKey: apiKey },
        currentGrant: {
          id: {},
          user: {
            id: {},
            name: {},
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
      }
    };

    console.log('JobTreadAPI: Direct test with correct format...');
    console.log('JobTreadAPI: Using API key:', apiKey.substring(0, 10) + '...');
    console.log('JobTreadAPI: Wrapped query:', JSON.stringify(wrappedQuery, null, 2));

    try {
      const response = await proxyFetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(wrappedQuery)
      });

      console.log('JobTreadAPI: Response status:', response.status);
      const responseText = await response.text();
      console.log('JobTreadAPI: Response body:', responseText);

      let parsedResponse;
      try {
        parsedResponse = JSON.parse(responseText);
      } catch (e) {
        parsedResponse = responseText;
      }

      if (response.ok) {
        console.log('SUCCESS! API connection works!');
        return {
          success: true,
          data: parsedResponse
        };
      } else {
        return {
          success: false,
          status: response.status,
          error: responseText
        };
      }
    } catch (error) {
      console.error('JobTreadAPI: Direct test error:', error.message);
      return {
        success: false,
        error: error.message
      };
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
