/**
 * JobTread Smart Filter Proxy Worker
 *
 * Cloudflare Worker that proxies requests to the JobTread Pave API
 * - Securely stores Grant Key in environment variables
 * - Caches responses in KV for performance
 * - Handles CORS for browser extension requests
 *
 * Required Environment Variables:
 *   - JOBTREAD_GRANT_KEY: Your JobTread API grant key
 *   - ORG_ID: Your JobTread organization ID
 *   - EXTENSION_SECRET: Secret key for authenticating extension requests
 *
 * Required KV Namespace Binding:
 *   - JOBTREAD_CACHE: KV namespace for caching responses
 */

const JOBTREAD_API = 'https://api.jobtread.com/pave';
const CACHE_TTL_JOBS = 120;        // 2 min for job lists
const CACHE_TTL_FIELDS = 3600;     // 1 hour for custom fields (rarely change)

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    // Only allow POST requests
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    try {
      // Validate extension authentication
      const extensionKey = request.headers.get('X-Extension-Key');
      if (extensionKey !== env.EXTENSION_SECRET) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }

      const body = await request.json();
      const { action, filters, fieldId } = body;

      switch (action) {
        case 'getCustomFields':
          return await getCustomFields(env, ctx);

        case 'getFilteredJobs':
          return await getFilteredJobs(env, ctx, filters);

        case 'getAllJobs':
          return await getAllJobs(env, ctx);

        case 'getFieldValues':
          return await getFieldValues(env, ctx, fieldId);

        case 'testConnection':
          return await testConnection(env);

        default:
          return jsonResponse({ error: 'Unknown action' }, 400);
      }

    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse({ error: error.message }, 500);
    }
  }
};

/**
 * Test API connection
 */
async function testConnection(env) {
  const query = {
    query: {
      $: { grantKey: env.JOBTREAD_GRANT_KEY },
      organization: {
        $: { id: env.ORG_ID },
        id: {},
        name: {}
      }
    }
  };

  const data = await jobtreadRequest(env, query);

  if (data.organization) {
    return jsonResponse({
      success: true,
      organization: {
        id: data.organization.id,
        name: data.organization.name
      }
    });
  }

  return jsonResponse({ success: false, error: 'No organization data' }, 400);
}

/**
 * Get job custom fields with options
 */
async function getCustomFields(env, ctx) {
  const cacheKey = 'customFields:job';

  // Check cache first
  if (env.JOBTREAD_CACHE) {
    const cached = await env.JOBTREAD_CACHE.get(cacheKey, 'json');
    if (cached) {
      return jsonResponse({ ...cached, _cached: true });
    }
  }

  const query = {
    query: {
      $: { grantKey: env.JOBTREAD_GRANT_KEY },
      organization: {
        $: { id: env.ORG_ID },
        customFields: {
          $: {
            where: ['targetType', '=', 'job'],
            sortBy: [{ field: 'position' }]
          },
          nodes: {
            id: {},
            name: {},
            type: {},
            options: {}
          }
        }
      }
    }
  };

  const data = await jobtreadRequest(env, query);
  const fields = data.organization?.customFields?.nodes || [];

  const result = { fields };

  // Cache for 1 hour
  if (env.JOBTREAD_CACHE) {
    ctx.waitUntil(
      env.JOBTREAD_CACHE.put(cacheKey, JSON.stringify(result), {
        expirationTtl: CACHE_TTL_FIELDS
      })
    );
  }

  return jsonResponse(result);
}

/**
 * Get jobs filtered by custom field values
 */
async function getFilteredJobs(env, ctx, filters) {
  // If no filters, return all jobs
  if (!filters || filters.length === 0) {
    return getAllJobs(env, ctx);
  }

  // Generate cache key from filters
  const filterKey = filters.map(f => `${f.fieldName}:${f.value}`).sort().join('|');
  const cacheKey = `jobs:filtered:${await hashString(filterKey)}`;

  // Check cache
  if (env.JOBTREAD_CACHE) {
    const cached = await env.JOBTREAD_CACHE.get(cacheKey, 'json');
    if (cached) {
      return jsonResponse({ ...cached, _cached: true });
    }
  }

  // Build dynamic query with 'with' clauses
  const query = buildFilteredJobsQuery(env, filters);
  const data = await jobtreadRequest(env, query);
  const jobs = data.organization?.jobs?.nodes || [];

  const result = { jobs, filters };

  // Cache for 2 minutes
  if (env.JOBTREAD_CACHE) {
    ctx.waitUntil(
      env.JOBTREAD_CACHE.put(cacheKey, JSON.stringify(result), {
        expirationTtl: CACHE_TTL_JOBS
      })
    );
  }

  return jsonResponse(result);
}

/**
 * Build Pave query for filtered jobs using 'with' clause
 */
function buildFilteredJobsQuery(env, filters) {
  // Build "with" clauses for each filter
  const withClauses = {};
  filters.forEach((filter, index) => {
    const key = `filter${index}`;
    withClauses[key] = {
      _: 'customFieldValues',
      $: {
        where: [['customField', 'name'], '=', filter.fieldName]
      },
      values: { $: { field: 'value' } }
    };
  });

  // Build where conditions
  const whereConditions = filters.map((filter, index) => {
    return [[`filter${index}`, 'values'], '=', filter.value];
  });

  // Single filter vs multiple filters (AND logic)
  const whereClause = whereConditions.length === 1
    ? whereConditions[0]
    : { and: whereConditions };

  return {
    query: {
      $: { grantKey: env.JOBTREAD_GRANT_KEY },
      organization: {
        $: { id: env.ORG_ID },
        jobs: {
          $: {
            size: 100,
            with: withClauses,
            where: whereClause,
            sortBy: [{ field: 'name' }]
          },
          nodes: {
            id: {},
            name: {},
            number: {},
            status: {},
            customFieldValues: {
              nodes: {
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
    }
  };
}

/**
 * Get all jobs (unfiltered)
 */
async function getAllJobs(env, ctx) {
  const cacheKey = 'jobs:all';

  // Check cache
  if (env.JOBTREAD_CACHE) {
    const cached = await env.JOBTREAD_CACHE.get(cacheKey, 'json');
    if (cached) {
      return jsonResponse({ ...cached, _cached: true });
    }
  }

  const query = {
    query: {
      $: { grantKey: env.JOBTREAD_GRANT_KEY },
      organization: {
        $: { id: env.ORG_ID },
        jobs: {
          $: {
            size: 100,
            sortBy: [{ field: 'name' }]
          },
          nodes: {
            id: {},
            name: {},
            number: {},
            status: {},
            customFieldValues: {
              nodes: {
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
    }
  };

  const data = await jobtreadRequest(env, query);
  const jobs = data.organization?.jobs?.nodes || [];

  const result = { jobs };

  // Cache for 2 minutes
  if (env.JOBTREAD_CACHE) {
    ctx.waitUntil(
      env.JOBTREAD_CACHE.put(cacheKey, JSON.stringify(result), {
        expirationTtl: CACHE_TTL_JOBS
      })
    );
  }

  return jsonResponse(result);
}

/**
 * Get unique values for a specific custom field
 */
async function getFieldValues(env, ctx, fieldId) {
  if (!fieldId) {
    return jsonResponse({ error: 'fieldId required' }, 400);
  }

  const cacheKey = `fieldValues:${fieldId}`;

  // Check cache
  if (env.JOBTREAD_CACHE) {
    const cached = await env.JOBTREAD_CACHE.get(cacheKey, 'json');
    if (cached) {
      return jsonResponse({ ...cached, _cached: true });
    }
  }

  // Get all jobs to extract unique values
  const query = {
    query: {
      $: { grantKey: env.JOBTREAD_GRANT_KEY },
      organization: {
        $: { id: env.ORG_ID },
        jobs: {
          $: { size: 100 },
          nodes: {
            customFieldValues: {
              nodes: {
                value: {},
                customField: {
                  id: {}
                }
              }
            }
          }
        }
      }
    }
  };

  const data = await jobtreadRequest(env, query);
  const jobs = data.organization?.jobs?.nodes || [];

  // Extract unique values for this field
  const values = new Set();
  jobs.forEach(job => {
    const fieldValues = job.customFieldValues?.nodes || [];
    fieldValues.forEach(fv => {
      if (fv.customField?.id === fieldId && fv.value) {
        values.add(fv.value);
      }
    });
  });

  const result = { values: Array.from(values).sort(), fieldId };

  // Cache for 5 minutes
  if (env.JOBTREAD_CACHE) {
    ctx.waitUntil(
      env.JOBTREAD_CACHE.put(cacheKey, JSON.stringify(result), {
        expirationTtl: 300
      })
    );
  }

  return jsonResponse(result);
}

/**
 * Make request to JobTread Pave API
 */
async function jobtreadRequest(env, query) {
  const response = await fetch(JOBTREAD_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(query)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`JobTread API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Hash string for cache keys
 */
async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

/**
 * Handle CORS preflight requests
 */
function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Extension-Key',
      'Access-Control-Max-Age': '86400'
    }
  });
}

/**
 * Create JSON response with CORS headers
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
