/**
 * Authentication Module for MCP Server
 * Validates license + grant key combination
 */

const JOBTREAD_API = 'https://api.jobtread.com/pave';

/**
 * Validate MCP authorization header
 * Format: "Bearer <license_key>:<grant_key>"
 *
 * @param {Object} env - Cloudflare environment bindings
 * @param {string} authHeader - Authorization header value
 * @returns {Object} - { valid, license, user, grantKey, error, code }
 */
export async function validateAuth(env, authHeader) {
  // Check header exists
  if (!authHeader) {
    return {
      valid: false,
      error: 'Missing Authorization header',
      code: 'NO_AUTH'
    };
  }

  // Parse Bearer token
  if (!authHeader.startsWith('Bearer ')) {
    return {
      valid: false,
      error: 'Invalid Authorization format. Expected: Bearer <license_key>:<grant_key>',
      code: 'INVALID_AUTH_FORMAT'
    };
  }

  const token = authHeader.slice(7); // Remove "Bearer "
  const [licenseKey, grantKey] = token.split(':');

  if (!licenseKey || !grantKey) {
    return {
      valid: false,
      error: 'Invalid token format. Expected: <license_key>:<grant_key>',
      code: 'INVALID_TOKEN_FORMAT'
    };
  }

  // 1. Look up license in database
  const license = await getLicense(env, licenseKey);
  if (!license) {
    return {
      valid: false,
      error: 'License not found',
      code: 'INVALID_LICENSE'
    };
  }

  if (!license.license_valid) {
    return {
      valid: false,
      error: 'License expired or invalid',
      code: 'LICENSE_EXPIRED'
    };
  }

  // 2. Validate grant key with JobTread
  const grantResult = await validateGrantKey(grantKey);
  if (!grantResult.valid) {
    return {
      valid: false,
      error: grantResult.error || 'Invalid Grant Key',
      code: 'INVALID_GRANT_KEY'
    };
  }

  // 3. Check org match (if license is locked)
  if (license.org_locked && license.jobtread_org_id) {
    if (grantResult.orgId !== license.jobtread_org_id) {
      return {
        valid: false,
        error: `Organization mismatch. License is registered to "${license.jobtread_org_name}".`,
        code: 'ORG_MISMATCH'
      };
    }
  } else if (!license.org_locked) {
    // First time - lock to this org
    await lockLicenseToOrg(env, license.id, grantResult.orgId, grantResult.orgName);
    license.jobtread_org_id = grantResult.orgId;
    license.jobtread_org_name = grantResult.orgName;
    license.org_locked = true;
  }

  // 4. Build user info from grant
  const user = {
    id: grantResult.userId,
    orgId: grantResult.orgId,
    orgName: grantResult.orgName
  };

  return {
    valid: true,
    license: {
      id: license.id,
      tier: license.tier || 'power_user', // Default to power_user for now
      orgId: license.jobtread_org_id,
      orgName: license.jobtread_org_name
    },
    user,
    grantKey
  };
}

/**
 * Get license from database
 */
async function getLicense(env, licenseKey) {
  const result = await env.DB.prepare(
    'SELECT * FROM users WHERE gumroad_license_key = ?'
  ).bind(licenseKey).first();
  return result;
}

/**
 * Validate grant key with JobTread API
 */
async function validateGrantKey(grantKey) {
  try {
    const body = {
      query: {
        $: { grantKey },
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
      }
    };

    const response = await fetch(JOBTREAD_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      return { valid: false, error: 'JobTread API error' };
    }

    const data = await response.json();

    // Check for Pave errors
    if (data.errors && data.errors.length > 0) {
      return { valid: false, error: data.errors[0].message || 'Invalid grant key' };
    }

    const memberships = data.currentGrant?.user?.memberships?.nodes || [];
    if (memberships.length === 0 || !memberships[0].organization) {
      return { valid: false, error: 'Could not determine organization' };
    }

    const org = memberships[0].organization;
    const userId = data.currentGrant?.user?.id;

    return {
      valid: true,
      userId,
      orgId: org.id,
      orgName: org.name
    };
  } catch (error) {
    console.error('Grant key validation error:', error);
    return { valid: false, error: error.message };
  }
}

/**
 * Lock license to organization (first-time setup)
 */
async function lockLicenseToOrg(env, licenseId, orgId, orgName) {
  await env.DB.prepare(`
    UPDATE users SET
      jobtread_org_id = ?,
      jobtread_org_name = ?,
      org_locked = true,
      last_active_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(orgId, orgName, licenseId).run();
}

/**
 * Detect MCP client name from request headers
 */
export function detectClientName(request) {
  const userAgent = request.headers.get('User-Agent') || '';

  if (userAgent.includes('Claude')) return 'claude';
  if (userAgent.includes('ChatGPT') || userAgent.includes('OpenAI')) return 'chatgpt';
  if (userAgent.includes('Gemini') || userAgent.includes('Google')) return 'gemini';
  if (userAgent.includes('Cursor')) return 'cursor';
  if (userAgent.includes('Copilot') || userAgent.includes('VSCode')) return 'copilot';
  if (userAgent.includes('Goose')) return 'goose';
  if (userAgent.includes('JetBrains')) return 'jetbrains';
  if (userAgent.includes('Windsurf')) return 'windsurf';

  return 'unknown';
}
