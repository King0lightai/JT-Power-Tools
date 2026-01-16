/**
 * JobTread Tools Pro - Cloudflare Worker
 *
 * Multi-tenant API proxy with Gumroad license validation and "Proof of Org" security.
 * Licenses are locked to a single JobTread organization to prevent sharing.
 *
 * Required Environment:
 *   - GUMROAD_PRODUCT_ID: Your Gumroad product ID (secret)
 *   - DB: D1 database binding
 *   - CACHE: KV namespace binding
 */

const JOBTREAD_API = 'https://api.jobtread.com/pave';
const CACHE_TTL_JOBS = 120;        // 2 min for job lists
const CACHE_TTL_FIELDS = 3600;     // 1 hour for custom fields

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
      const body = await request.json();
      const { action } = body;

      // Route to appropriate handler
      switch (action) {
        // --- Public actions (no auth required) ---
        case 'verifyLicense':
          return await handleVerifyLicense(env, body);

        case 'registerUser':
          return await handleRegisterUser(env, body);

        case 'verifyOrgAccess':
          return await handleVerifyOrgAccess(env, body);

        // --- Protected actions (require device authorization) ---
        case 'getStatus':
          return await withAuth(env, body, handleGetStatus);

        case 'getCustomFields':
          return await withAuth(env, body, (env, user) => handleGetCustomFields(env, ctx, user));

        case 'getFilteredJobs':
          return await withAuth(env, body, (env, user) => handleGetFilteredJobs(env, ctx, user, body.filters));

        case 'getAllJobs':
          return await withAuth(env, body, (env, user) => handleGetAllJobs(env, ctx, user));

        case 'rawQuery':
          return await withAuth(env, body, (env, user) => handleRawQuery(env, user, body.query));

        case 'clearCache':
          return await withAuth(env, body, (env, user) => handleClearCache(env, user));

        case 'disconnect':
          return await withAuth(env, body, handleDisconnect);

        case 'listDevices':
          return await withAuth(env, body, handleListDevices);

        case 'revokeDevice':
          return await withAuth(env, body, (env, user) => handleRevokeDevice(env, user, body.targetDeviceId));

        case 'transferLicense':
          return await withAuth(env, body, handleTransferLicense);

        default:
          return jsonResponse({ error: 'Unknown action' }, 400);
      }

    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse({ error: error.message }, 500);
    }
  }
};

// =============================================================================
// Authentication Middleware
// =============================================================================

/**
 * Wrapper for protected actions - verifies license and device authorization
 */
async function withAuth(env, body, handler) {
  const { licenseKey, deviceId } = body;

  if (!licenseKey || !deviceId) {
    return jsonResponse({ error: 'Missing licenseKey or deviceId', code: 'MISSING_CREDENTIALS' }, 400);
  }

  // Get user by license key
  const user = await getUser(env, licenseKey);
  if (!user) {
    return jsonResponse({ error: 'License not found', code: 'LICENSE_NOT_FOUND' }, 401);
  }

  if (!user.license_valid) {
    return jsonResponse({ error: 'License invalid or expired', code: 'LICENSE_INVALID' }, 401);
  }

  // Check device authorization
  const isAuthorized = await isDeviceAuthorized(env, user.id, deviceId);
  if (!isAuthorized) {
    return jsonResponse({
      error: 'Device not authorized',
      code: 'DEVICE_NOT_AUTHORIZED',
      needsOrgVerification: true,
      organizationName: user.jobtread_org_name
    }, 403);
  }

  // Check if JobTread is connected
  if (!user.jobtread_grant_key) {
    return jsonResponse({
      error: 'JobTread not connected',
      code: 'JOBTREAD_NOT_CONNECTED',
      needsJobTreadConnection: true
    }, 403);
  }

  // Update last active
  await updateLastActive(env, user.id, deviceId);

  // Call the actual handler
  return handler(env, user);
}

// =============================================================================
// Public Action Handlers
// =============================================================================

/**
 * Verify a Gumroad license key
 */
async function handleVerifyLicense(env, body) {
  const { licenseKey } = body;

  if (!licenseKey) {
    return jsonResponse({ error: 'Missing licenseKey' }, 400);
  }

  const result = await verifyGumroadLicense(env, licenseKey);
  return jsonResponse(result);
}

/**
 * Register user and check device status
 */
async function handleRegisterUser(env, body) {
  const { licenseKey, deviceId, deviceName } = body;

  if (!licenseKey || !deviceId) {
    return jsonResponse({ error: 'Missing licenseKey or deviceId' }, 400);
  }

  // 1. Verify license with Gumroad
  const licenseResult = await verifyGumroadLicense(env, licenseKey);
  if (!licenseResult.valid) {
    return jsonResponse({
      error: licenseResult.error || 'Invalid license',
      code: 'LICENSE_INVALID'
    }, 401);
  }

  // 2. Check if user exists
  let user = await getUser(env, licenseKey);

  if (!user) {
    // NEW USER: Create and auto-authorize first device
    user = await createUser(env, licenseKey, licenseResult);
    await authorizeDevice(env, user.id, deviceId, deviceName);

    return jsonResponse({
      success: true,
      deviceAuthorized: true,
      needsJobTreadConnection: true,
      message: 'License activated! Please connect your JobTread account.'
    });
  }

  // Update license validity (in case it was re-validated)
  if (!user.license_valid) {
    await env.DB.prepare('UPDATE users SET license_valid = true WHERE id = ?').bind(user.id).run();
    user.license_valid = true;
  }

  // EXISTING USER: Check if device is already authorized
  const isAuthorized = await isDeviceAuthorized(env, user.id, deviceId);

  if (isAuthorized) {
    // Check if JobTread is connected
    if (!user.jobtread_grant_key) {
      return jsonResponse({
        success: true,
        deviceAuthorized: true,
        needsJobTreadConnection: true
      });
    }

    return jsonResponse({
      success: true,
      deviceAuthorized: true,
      organizationName: user.jobtread_org_name,
      orgId: user.jobtread_org_id
    });
  }

  // DEVICE NOT AUTHORIZED: Check if org is locked
  if (user.org_locked && user.jobtread_org_id) {
    // Require org verification for new device (team member joining)
    return jsonResponse({
      success: true,
      deviceAuthorized: false,
      needsOrgVerification: true,
      organizationName: user.jobtread_org_name,
      message: '👥 Team license registered to "' + user.jobtread_org_name + '". Enter your Grant Key to verify you\'re part of this organization.'
    });
  }

  // Org not locked yet - authorize device and ask for JobTread connection (first setup)
  await authorizeDevice(env, user.id, deviceId, deviceName);
  return jsonResponse({
    success: true,
    deviceAuthorized: true,
    needsJobTreadConnection: true,
    message: '🚀 License activated! Setup API access for your team by entering your Grant Key below.'
  });
}

/**
 * Verify org access with Grant Key - implements "Proof of Org"
 */
async function handleVerifyOrgAccess(env, body) {
  const { licenseKey, deviceId, grantKey, deviceName } = body;

  if (!licenseKey || !deviceId || !grantKey) {
    return jsonResponse({ error: 'Missing required fields' }, 400);
  }

  const user = await getUser(env, licenseKey);
  if (!user) {
    return jsonResponse({ error: 'License not found', code: 'LICENSE_NOT_FOUND' }, 401);
  }

  // 1. Test the Grant Key with JobTread API
  const orgInfo = await testGrantKey(grantKey);
  if (!orgInfo.success) {
    return jsonResponse({
      error: 'Invalid Grant Key',
      code: 'INVALID_GRANT_KEY',
      message: orgInfo.error || 'Could not connect to JobTread with this Grant Key'
    }, 400);
  }

  // 2. If license is already locked to an org, verify it matches
  if (user.org_locked && user.jobtread_org_id) {
    if (orgInfo.id !== user.jobtread_org_id) {
      // SECURITY BLOCK: Different org!
      return jsonResponse({
        error: 'Organization mismatch',
        code: 'ORG_MISMATCH',
        message: 'This license is registered to "' + user.jobtread_org_name + '". Your Grant Key belongs to a different organization.',
        expectedOrg: user.jobtread_org_name
      }, 403);
    }
  }

  // 3. Authorize this device
  await authorizeDevice(env, user.id, deviceId, deviceName);

  // 4. Lock to org if not already locked
  if (!user.org_locked) {
    await lockUserToOrg(env, user.id, grantKey, orgInfo);
  } else {
    // Update grant key (user might be using a different key for same org)
    await env.DB.prepare(
      'UPDATE users SET jobtread_grant_key = ?, last_active_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(grantKey, user.id).run();
  }

  return jsonResponse({
    success: true,
    deviceAuthorized: true,
    organizationName: orgInfo.name,
    orgId: orgInfo.id,
    message: 'Successfully connected to ' + orgInfo.name
  });
}

// =============================================================================
// Protected Action Handlers
// =============================================================================

/**
 * Get user status
 */
async function handleGetStatus(env, user) {
  const devices = await env.DB.prepare(
    'SELECT id, device_name, last_active_at FROM authorized_devices WHERE user_id = ?'
  ).bind(user.id).all();

  return jsonResponse({
    success: true,
    user: {
      email: user.email,
      organizationName: user.jobtread_org_name,
      orgId: user.jobtread_org_id,
      orgLocked: user.org_locked,
      createdAt: user.created_at,
      lastActiveAt: user.last_active_at
    },
    devices: devices.results || []
  });
}

/**
 * Get custom fields for jobs
 */
async function handleGetCustomFields(env, ctx, user) {
  const cacheKey = `cf:${user.jobtread_org_id}`;

  // Check cache first
  if (env.CACHE) {
    const cached = await env.CACHE.get(cacheKey, 'json');
    if (cached) {
      await trackUsage(env, user.id, 'getCustomFields', true);
      return jsonResponse({ ...cached, _cached: true });
    }
  }

  // Fixed: No "query" wrapper, pass grantKey separately
  const paveQuery = {
    organization: {
      $: { id: user.jobtread_org_id },
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
  };

  const data = await jobtreadRequest(paveQuery, user.jobtread_grant_key);
  const fields = data.organization?.customFields?.nodes || [];
  const result = { fields };

  // Cache for 1 hour
  if (env.CACHE) {
    ctx.waitUntil(
      env.CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: CACHE_TTL_FIELDS })
    );
  }

  await trackUsage(env, user.id, 'getCustomFields', false);
  return jsonResponse(result);
}

/**
 * Get jobs filtered by custom field values
 */
async function handleGetFilteredJobs(env, ctx, user, filters) {
  // If no filters, return all jobs
  if (!filters || filters.length === 0) {
    return handleGetAllJobs(env, ctx, user);
  }

  // Generate cache key from filters
  const filterKey = filters.map(f => `${f.fieldName}:${f.value}`).sort().join('|');
  const cacheKey = `jobs:${user.jobtread_org_id}:${await hashString(filterKey)}`;

  // Check cache
  if (env.CACHE) {
    const cached = await env.CACHE.get(cacheKey, 'json');
    if (cached) {
      await trackUsage(env, user.id, 'getFilteredJobs', true);
      return jsonResponse({ ...cached, _cached: true });
    }
  }

  // Build query with 'with' clauses for server-side filtering
  const paveQuery = buildFilteredJobsQuery(user.jobtread_org_id, filters);
  const data = await jobtreadRequest(paveQuery, user.jobtread_grant_key);
  const jobs = data.organization?.jobs?.nodes || [];

  const result = { jobs, filters };

  // Cache for 2 minutes
  if (env.CACHE) {
    ctx.waitUntil(
      env.CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: CACHE_TTL_JOBS })
    );
  }

  await trackUsage(env, user.id, 'getFilteredJobs', false);
  return jsonResponse(result);
}

/**
 * Build Pave query with 'with' clause for server-side filtering
 * Fixed to use proper Pave structure without "query" wrapper
 */
function buildFilteredJobsQuery(orgId, filters) {
  // Build "with" clauses for each filter
  const withClauses = {};
  filters.forEach((filter, index) => {
    const key = `filter${index}`;
    withClauses[key] = {
      _: 'customFieldValues',
      $: {
        where: [['customField', 'name'], '=', filter.fieldName],
        size: 1
      },
      nodes: {
        value: {}
      }
    };
  });

  // Build where conditions - check the first node's value
  const whereConditions = filters.map((filter, index) => {
    return [[`filter${index}`, 'nodes', 0, 'value'], '=', filter.value];
  });

  // Single filter vs multiple filters (AND logic)
  const whereClause = whereConditions.length === 1
    ? whereConditions[0]
    : { and: whereConditions };

  // Fixed: Return just the paveQuery portion, no "query" wrapper
  return {
    organization: {
      $: { id: orgId },
      jobs: {
        $: {
          size: 500,  // Increased to support larger orgs (minimal data = safe)
          with: withClauses,
          where: whereClause,
          sortBy: [{ field: 'name' }]
        },
        nodes: {
          id: {},
          name: {},
          number: {},
          status: {}
        }
      }
    }
  };
}

/**
 * Get all jobs (unfiltered)
 */
async function handleGetAllJobs(env, ctx, user) {
  const cacheKey = `jobs:${user.jobtread_org_id}:all`;

  // Check cache
  if (env.CACHE) {
    const cached = await env.CACHE.get(cacheKey, 'json');
    if (cached) {
      await trackUsage(env, user.id, 'getAllJobs', true);
      return jsonResponse({ ...cached, _cached: true });
    }
  }

  // Fixed: No "query" wrapper, pass grantKey separately
  const paveQuery = {
    organization: {
      $: { id: user.jobtread_org_id },
      jobs: {
        $: {
          size: 500,  // Increased to support larger orgs (minimal data = safe)
          sortBy: [{ field: 'name' }]
        },
        nodes: {
          id: {},
          name: {},
          number: {},
          status: {}
        }
      }
    }
  };

  const data = await jobtreadRequest(paveQuery, user.jobtread_grant_key);
  const jobs = data.organization?.jobs?.nodes || [];
  const result = { jobs };

  // Cache for 2 minutes
  if (env.CACHE) {
    ctx.waitUntil(
      env.CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: CACHE_TTL_JOBS })
    );
  }

  await trackUsage(env, user.id, 'getAllJobs', false);
  return jsonResponse(result);
}

/**
 * Execute a raw Pave query
 * Fixed: Don't force-nest inside organization - let caller control structure
 */
async function handleRawQuery(env, user, paveQuery) {
  if (!paveQuery) {
    return jsonResponse({ error: 'Missing query' }, 400);
  }

  // Fixed: Pass the paveQuery directly - caller decides structure
  // If they want organization data, they should include it in their query
  const data = await jobtreadRequest(paveQuery, user.jobtread_grant_key);

  await trackUsage(env, user.id, 'rawQuery', false);
  return jsonResponse({ data });
}

/**
 * Clear cached data for this user
 */
async function handleClearCache(env, user) {
  if (!env.CACHE) {
    return jsonResponse({ success: true, message: 'No cache configured' });
  }

  // List and delete all keys for this org
  const prefix = `jobs:${user.jobtread_org_id}`;
  const list = await env.CACHE.list({ prefix });

  for (const key of list.keys) {
    await env.CACHE.delete(key.name);
  }

  // Also clear custom fields cache
  await env.CACHE.delete(`cf:${user.jobtread_org_id}`);

  return jsonResponse({ success: true, message: 'Cache cleared' });
}

/**
 * Disconnect JobTread (removes grant key but keeps org lock)
 */
async function handleDisconnect(env, user) {
  await env.DB.prepare(
    'UPDATE users SET jobtread_grant_key = NULL, last_active_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(user.id).run();

  return jsonResponse({
    success: true,
    message: 'JobTread disconnected. License remains locked to ' + user.jobtread_org_name
  });
}

/**
 * List authorized devices
 */
async function handleListDevices(env, user) {
  const devices = await env.DB.prepare(
    'SELECT id, device_id, device_name, verified_at, last_active_at FROM authorized_devices WHERE user_id = ?'
  ).bind(user.id).all();

  return jsonResponse({
    success: true,
    devices: devices.results || []
  });
}

/**
 * Revoke a device
 */
async function handleRevokeDevice(env, user, targetDeviceId) {
  if (!targetDeviceId) {
    return jsonResponse({ error: 'Missing targetDeviceId' }, 400);
  }

  await env.DB.prepare(
    'DELETE FROM authorized_devices WHERE user_id = ? AND device_id = ?'
  ).bind(user.id, targetDeviceId).run();

  return jsonResponse({ success: true, message: 'Device revoked' });
}

/**
 * Transfer license (unlock org - for legitimate transfers)
 */
async function handleTransferLicense(env, user) {
  // Remove all devices and unlock org
  await env.DB.batch([
    env.DB.prepare('DELETE FROM authorized_devices WHERE user_id = ?').bind(user.id),
    env.DB.prepare(
      'UPDATE users SET jobtread_grant_key = NULL, jobtread_org_id = NULL, jobtread_org_name = NULL, org_locked = false WHERE id = ?'
    ).bind(user.id)
  ]);

  return jsonResponse({
    success: true,
    message: 'License transferred. All devices removed. License can now be activated on a new organization.'
  });
}

// =============================================================================
// Database Helpers
// =============================================================================

/**
 * Get user by license key
 */
async function getUser(env, licenseKey) {
  const result = await env.DB.prepare(
    'SELECT * FROM users WHERE gumroad_license_key = ?'
  ).bind(licenseKey).first();
  return result;
}

/**
 * Create a new user
 */
async function createUser(env, licenseKey, licenseResult) {
  const id = generateId('usr');

  await env.DB.prepare(`
    INSERT INTO users (id, email, gumroad_license_key, gumroad_product_id, license_valid)
    VALUES (?, ?, ?, ?, true)
  `).bind(id, licenseResult.email, licenseKey, licenseResult.productId).run();

  return { id, email: licenseResult.email, license_valid: true };
}

/**
 * Check if device is authorized
 */
async function isDeviceAuthorized(env, userId, deviceId) {
  const result = await env.DB.prepare(
    'SELECT id FROM authorized_devices WHERE user_id = ? AND device_id = ?'
  ).bind(userId, deviceId).first();
  return !!result;
}

/**
 * Authorize a device
 */
async function authorizeDevice(env, userId, deviceId, deviceName) {
  const id = generateId('dev');

  // Upsert - update if exists, insert if not
  await env.DB.prepare(`
    INSERT INTO authorized_devices (id, user_id, device_id, device_name)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, device_id) DO UPDATE SET
      device_name = excluded.device_name,
      last_active_at = CURRENT_TIMESTAMP
  `).bind(id, userId, deviceId, deviceName || 'Unknown Device').run();
}

/**
 * Lock user to organization
 */
async function lockUserToOrg(env, userId, grantKey, orgInfo) {
  await env.DB.prepare(`
    UPDATE users SET
      jobtread_grant_key = ?,
      jobtread_org_id = ?,
      jobtread_org_name = ?,
      org_locked = true,
      last_active_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(grantKey, orgInfo.id, orgInfo.name, userId).run();
}

/**
 * Update last active timestamps
 */
async function updateLastActive(env, userId, deviceId) {
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?').bind(userId),
    env.DB.prepare('UPDATE authorized_devices SET last_active_at = CURRENT_TIMESTAMP WHERE user_id = ? AND device_id = ?').bind(userId, deviceId)
  ]);
}

/**
 * Track API usage
 */
async function trackUsage(env, userId, action, cached) {
  await env.DB.prepare(
    'INSERT INTO api_usage (user_id, action, cached) VALUES (?, ?, ?)'
  ).bind(userId, action, cached).run();
}

// =============================================================================
// External API Helpers
// =============================================================================

/**
 * Verify license with Gumroad API
 */
async function verifyGumroadLicense(env, licenseKey) {
  try {
    const response = await fetch('https://api.gumroad.com/v2/licenses/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        product_id: env.GUMROAD_PRODUCT_ID,
        license_key: licenseKey
      })
    });

    const data = await response.json();

    if (!data.success) {
      return { valid: false, error: 'Invalid license key' };
    }

    if (data.purchase.refunded) {
      return { valid: false, error: 'License has been refunded' };
    }

    if (data.purchase.chargebacked) {
      return { valid: false, error: 'License has been chargebacked' };
    }

    return {
      valid: true,
      email: data.purchase.email,
      productId: data.purchase.product_id
    };
  } catch (error) {
    console.error('Gumroad API error:', error);
    return { valid: false, error: 'Could not verify license' };
  }
}

/**
 * Test a Grant Key with JobTread API
 */
async function testGrantKey(grantKey) {
  try {
    // Fixed: No "query" wrapper, pass grantKey separately
    const paveQuery = {
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

    const data = await jobtreadRequest(paveQuery, grantKey);

    // Get the organization from currentGrant -> user -> memberships
    const memberships = data.currentGrant?.user?.memberships?.nodes || [];

    if (memberships.length > 0 && memberships[0].organization) {
      const org = memberships[0].organization;
      return {
        success: true,
        id: org.id,
        name: org.name
      };
    }

    return { success: false, error: 'Could not get organization info' };
  } catch (error) {
    console.error('JobTread API error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Make request to JobTread Pave API
 * Fixed to properly handle Pave query structure and error detection
 */
async function jobtreadRequest(paveQuery, grantKey) {
  // Build the request body - MUST wrap in "query" per JobTread docs
  const body = {
    query: {
      $: { grantKey },
      ...paveQuery
    }
  };

  console.log('JobTread Request:', JSON.stringify(body, null, 2));

  const response = await fetch(JOBTREAD_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const responseText = await response.text();

  console.log('JobTread Response Status:', response.status);
  console.log('JobTread Response Body:', responseText.slice(0, 500));

  if (!response.ok) {
    throw new Error(`JobTread API HTTP error: ${response.status} - ${responseText}`);
  }

  // Parse JSON
  let data;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    throw new Error(`JobTread API returned invalid JSON: ${responseText.slice(0, 200)}`);
  }

  // CHECK FOR PAVE-LEVEL ERRORS (these come with 200 OK status)
  if (data.errors && data.errors.length > 0) {
    const errorMessages = data.errors.map(e => e.message || JSON.stringify(e)).join('; ');
    throw new Error(`JobTread Pave error: ${errorMessages}`);
  }

  return data;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate a unique ID with prefix
 */
function generateId(prefix) {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}${randomPart}`;
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
      'Access-Control-Allow-Headers': 'Content-Type',
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
