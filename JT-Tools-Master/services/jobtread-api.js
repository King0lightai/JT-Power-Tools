// JobTread API Client Service
// Handles GraphQL API calls for fetching jobs, custom fields, and other data

const JobTreadAPI = (() => {
  // API Configuration
  const API_URL = 'https://api.jobtread.com/graphql';

  // Storage keys
  const STORAGE_KEYS = {
    API_KEY: 'jtToolsApiKey',
    JOBS_CACHE: 'jtToolsJobsCache',
    CUSTOM_FIELDS_CACHE: 'jtToolsCustomFieldsCache',
    CACHE_TIMESTAMP: 'jtToolsCacheTimestamp'
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
   * Check if API is configured
   * @returns {Promise<boolean>}
   */
  async function isConfigured() {
    const apiKey = await getApiKey();
    return !!apiKey;
  }

  /**
   * Execute a GraphQL query
   * @param {string} query - GraphQL query string
   * @param {Object} variables - Query variables
   * @returns {Promise<Object>} Response data
   */
  async function graphqlQuery(query, variables = {}) {
    const apiKey = await getApiKey();

    if (!apiKey) {
      throw new Error('JobTread API key not configured');
    }

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          query,
          variables
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      if (result.errors && result.errors.length > 0) {
        console.error('JobTreadAPI: GraphQL errors:', result.errors);
        throw new Error(result.errors[0].message);
      }

      return result.data;
    } catch (error) {
      console.error('JobTreadAPI: Query failed:', error);
      throw error;
    }
  }

  /**
   * Introspect the GraphQL schema to discover available types and fields
   * @returns {Promise<Object>} Schema information
   */
  async function introspectSchema() {
    const introspectionQuery = `
      query IntrospectionQuery {
        __schema {
          queryType {
            name
            fields {
              name
              description
              args {
                name
                type {
                  name
                  kind
                }
              }
              type {
                name
                kind
                ofType {
                  name
                  kind
                }
              }
            }
          }
          types {
            name
            kind
            description
            fields {
              name
              description
              type {
                name
                kind
                ofType {
                  name
                  kind
                }
              }
            }
          }
        }
      }
    `;

    return await graphqlQuery(introspectionQuery);
  }

  /**
   * Get a simplified list of available query types
   * @returns {Promise<Array>} List of query field names and descriptions
   */
  async function getAvailableQueries() {
    try {
      const schema = await introspectSchema();
      const queryFields = schema.__schema?.queryType?.fields || [];

      return queryFields.map(field => ({
        name: field.name,
        description: field.description,
        args: field.args?.map(arg => arg.name) || [],
        returnType: field.type?.name || field.type?.ofType?.name
      }));
    } catch (error) {
      console.error('JobTreadAPI: Failed to get available queries:', error);
      throw error;
    }
  }

  /**
   * Get type details from schema
   * @param {string} typeName - Name of the type to inspect
   * @returns {Promise<Object>} Type fields and information
   */
  async function getTypeDetails(typeName) {
    const typeQuery = `
      query TypeDetails {
        __type(name: "${typeName}") {
          name
          kind
          description
          fields {
            name
            description
            type {
              name
              kind
              ofType {
                name
                kind
              }
            }
          }
        }
      }
    `;

    const result = await graphqlQuery(typeQuery);
    return result.__type;
  }

  /**
   * Fetch jobs with custom fields
   * This query structure will be refined once we discover the actual schema
   * @param {Object} options - Query options (pagination, filters)
   * @returns {Promise<Array>} List of jobs
   */
  async function fetchJobs(options = {}) {
    const { limit = 100, offset = 0, search = '' } = options;

    // This is a tentative query structure - will be updated based on actual schema
    const jobsQuery = `
      query GetJobs($limit: Int, $offset: Int, $search: String) {
        jobs(limit: $limit, offset: $offset, search: $search) {
          nodes {
            id
            name
            number
            status
            customFields {
              id
              name
              value
              fieldDefinition {
                id
                name
                type
              }
            }
          }
          totalCount
          pageInfo {
            hasNextPage
          }
        }
      }
    `;

    try {
      const data = await graphqlQuery(jobsQuery, { limit, offset, search });
      return data.jobs;
    } catch (error) {
      console.error('JobTreadAPI: Failed to fetch jobs:', error);
      throw error;
    }
  }

  /**
   * Fetch custom field definitions for jobs
   * @returns {Promise<Array>} List of custom field definitions
   */
  async function fetchCustomFieldDefinitions() {
    // Check cache first
    try {
      const cached = await chrome.storage.local.get([
        STORAGE_KEYS.CUSTOM_FIELDS_CACHE,
        STORAGE_KEYS.CACHE_TIMESTAMP
      ]);

      const cacheAge = Date.now() - (cached[STORAGE_KEYS.CACHE_TIMESTAMP] || 0);

      if (cached[STORAGE_KEYS.CUSTOM_FIELDS_CACHE] && cacheAge < CUSTOM_FIELDS_CACHE_DURATION) {
        console.log('JobTreadAPI: Using cached custom fields');
        return cached[STORAGE_KEYS.CUSTOM_FIELDS_CACHE];
      }
    } catch (e) {
      // Cache read failed, continue to fetch
    }

    // Tentative query - will be updated based on actual schema
    const customFieldsQuery = `
      query GetCustomFieldDefinitions {
        customFieldDefinitions(objectType: JOB) {
          nodes {
            id
            name
            type
            options
            required
          }
        }
      }
    `;

    try {
      const data = await graphqlQuery(customFieldsQuery);
      const definitions = data.customFieldDefinitions?.nodes || [];

      // Cache the results
      await chrome.storage.local.set({
        [STORAGE_KEYS.CUSTOM_FIELDS_CACHE]: definitions,
        [STORAGE_KEYS.CACHE_TIMESTAMP]: Date.now()
      });

      return definitions;
    } catch (error) {
      console.error('JobTreadAPI: Failed to fetch custom field definitions:', error);
      throw error;
    }
  }

  /**
   * Fetch jobs filtered by custom field value
   * @param {string} fieldId - Custom field definition ID
   * @param {string} value - Value to filter by
   * @returns {Promise<Array>} Filtered jobs
   */
  async function fetchJobsByCustomField(fieldId, value) {
    // This query structure will be refined based on actual API capabilities
    const filterQuery = `
      query GetJobsByCustomField($fieldId: ID!, $value: String!) {
        jobs(customFieldFilter: { fieldId: $fieldId, value: $value }) {
          nodes {
            id
            name
            number
            status
            customFields {
              id
              name
              value
            }
          }
        }
      }
    `;

    try {
      const data = await graphqlQuery(filterQuery, { fieldId, value });
      return data.jobs?.nodes || [];
    } catch (error) {
      console.error('JobTreadAPI: Failed to fetch filtered jobs:', error);
      throw error;
    }
  }

  /**
   * Test API connection with current key
   * @returns {Promise<Object>} Connection test result
   */
  async function testConnection() {
    try {
      // Try a simple query to test the connection
      const testQuery = `
        query TestConnection {
          __typename
        }
      `;

      await graphqlQuery(testQuery);
      return { success: true, message: 'API connection successful' };
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
        STORAGE_KEYS.CACHE_TIMESTAMP
      ]);
      console.log('JobTreadAPI: Cache cleared');
    } catch (error) {
      console.error('JobTreadAPI: Error clearing cache:', error);
    }
  }

  // Public API
  return {
    // Configuration
    getApiKey,
    setApiKey,
    isConfigured,
    testConnection,

    // Schema discovery
    introspectSchema,
    getAvailableQueries,
    getTypeDetails,

    // Data fetching
    fetchJobs,
    fetchCustomFieldDefinitions,
    fetchJobsByCustomField,

    // Raw query access
    graphqlQuery,

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
