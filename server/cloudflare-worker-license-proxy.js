/**
 * Cloudflare Worker - License Validation Proxy
 *
 * This worker acts as a secure proxy between the Chrome extension and Gumroad API.
 * It keeps your Product ID and API secrets secure on the server side.
 *
 * v2.0 - Added tier detection from Gumroad variants and D1 database storage
 *
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Go to https://dash.cloudflare.com
 * 2. Navigate to Workers & Pages
 * 3. Create a new Worker
 * 4. Copy this code into the worker editor
 * 5. Add environment variables in Worker settings:
 *    - GUMROAD_PRODUCT_ID: Your Gumroad product ID
 *    - ALLOWED_ORIGINS: Your extension ID (chrome-extension://YOUR_EXTENSION_ID)
 *    - RATE_LIMIT_MAX: 100 (requests per IP per hour)
 *    - SIGNATURE_SECRET: Your HMAC signing secret
 * 6. Add D1 database binding:
 *    - Binding name: DB
 *    - Database: jobtread-extension-users
 * 7. Deploy the worker
 * 8. Note the worker URL (e.g., https://license-proxy.your-worker.workers.dev)
 * 9. Update license.js with your worker URL
 */

// Rate limiting store (using Cloudflare KV in production)
// Note: Workers are stateless and restart frequently, so this Map won't grow indefinitely
// Old entries are cleaned up inline during rate limit checks
const rateLimitStore = new Map();

// Tier definitions - matches tiers.js in MCP server
const TIERS = {
  ESSENTIAL: 'essential',
  PRO: 'pro',
  POWER_USER: 'power_user'
};

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env, ctx);
  }
};

// Legacy format for backwards compatibility
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request, {}));
});

async function handleRequest(request, env, ctx) {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return handleCORS();
  }

  // Only allow POST requests
  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  // Verify origin (Chrome extension only)
  const origin = request.headers.get('Origin');
  if (!isValidOrigin(origin, env)) {
    return jsonResponse({ success: false, error: 'Unauthorized origin' }, 403);
  }

  // Rate limiting
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (isRateLimited(clientIP, env)) {
    return jsonResponse({
      success: false,
      error: 'Too many requests. Please try again later.'
    }, 429);
  }

  try {
    // Parse request body
    const body = await request.json();
    const { licenseKey, action } = body;

    if (!licenseKey || typeof licenseKey !== 'string') {
      return jsonResponse({ success: false, error: 'Invalid license key' }, 400);
    }

    // Sanitize license key (remove any potentially malicious content)
    const sanitizedKey = licenseKey.trim().slice(0, 100); // Limit length

    // Handle different actions
    if (action === 'verify' || !action) {
      return await verifyLicense(sanitizedKey, env, ctx);
    } else if (action === 'revalidate') {
      return await revalidateLicense(sanitizedKey, env, ctx);
    } else {
      return jsonResponse({ success: false, error: 'Invalid action' }, 400);
    }

  } catch (error) {
    console.error('License proxy error:', error);
    return jsonResponse({
      success: false,
      error: 'Internal server error'
    }, 500);
  }
}

async function verifyLicense(licenseKey, env, ctx) {
  try {
    // Get Gumroad product ID from environment variable
    const productId = env?.GUMROAD_PRODUCT_ID || (typeof GUMROAD_PRODUCT_ID !== 'undefined' ? GUMROAD_PRODUCT_ID : 'x2GbSvLBfUSQcwVGDRSj1w==');

    // Call Gumroad API
    const response = await fetch('https://api.gumroad.com/v2/licenses/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'product_id': productId,
        'license_key': licenseKey,
        'increment_uses_count': 'false' // Don't increment on every check
      })
    });

    const data = await response.json();

    if (data.success && data.purchase) {
      // Determine tier from Gumroad purchase data (variants, price, etc.)
      const tier = determineTier(data.purchase);

      // Generate a cryptographic signature for the license
      const signature = await generateSignature(licenseKey, data.purchase.email, env);

      // Store/update license in D1 database (if binding available)
      if (env?.DB) {
        ctx?.waitUntil(storeLicenseInDb(env.DB, licenseKey, data.purchase, tier));
      }

      return jsonResponse({
        success: true,
        data: {
          valid: true,
          tier: tier, // NEW: Include tier in response
          purchaseEmail: data.purchase.email,
          productName: data.purchase.product_name,
          purchaseDate: data.purchase.created_at,
          variantName: data.purchase.variants || null, // Include variant for debugging
          verifiedAt: Date.now(),
          signature: signature // Client will use this to verify integrity
        }
      });
    } else {
      return jsonResponse({
        success: false,
        error: data.message || 'Invalid license key'
      });
    }
  } catch (error) {
    console.error('Gumroad API error:', error);
    return jsonResponse({
      success: false,
      error: 'Unable to verify license with Gumroad'
    }, 500);
  }
}

/**
 * Determine the subscription tier from Gumroad purchase data
 * Checks: variants field, product name, and price as fallbacks
 *
 * BACKWARDS COMPATIBILITY:
 * - Existing "JT Power Tools" purchases (no variant) = PRO tier
 * - New purchases with variants map directly to tier
 */
function determineTier(purchase) {
  // First, check the variants field (most reliable for variant-based products)
  const variants = (purchase.variants || '').toLowerCase().trim();

  // If variants field has content, use it to determine tier
  if (variants && variants.length > 0) {
    // Check for Power User tier first (most specific)
    if (variants.includes('power user') || variants.includes('power_user')) {
      return TIERS.POWER_USER;
    }

    // Check for Pro tier
    if (variants.includes(' pro') || variants.includes('pro ') || variants === 'pro') {
      return TIERS.PRO;
    }

    // Check for Essential tier
    if (variants.includes('essential') || variants.includes('basic')) {
      return TIERS.ESSENTIAL;
    }

    // BACKWARDS COMPATIBILITY: Existing variant "JT POWER TOOLS" = PRO tier
    // This was the original product before tier system was added
    if (variants.includes('jt power tools') || variants.includes('jtpowertools') || variants === 'jt power tools') {
      console.log('Legacy variant "JT POWER TOOLS" detected, assigning PRO tier');
      return TIERS.PRO;
    }
  }

  // Second, check product name for tier-specific products
  const productName = (purchase.product_name || '').toLowerCase();

  // Check for explicit tier names in product name
  if (productName.includes('power user') || productName.includes('power_user')) {
    return TIERS.POWER_USER;
  }
  if (productName.includes('essential')) {
    return TIERS.ESSENTIAL;
  }

  // BACKWARDS COMPATIBILITY:
  // Old product was just "JT Power Tools" with no tier variants
  // All existing subscribers should be treated as PRO tier
  if (productName.includes('jt power tools') || productName.includes('jobtread') || productName.includes('jtpowertools')) {
    console.log('Legacy JT Power Tools product detected, assigning PRO tier:', productName);
    return TIERS.PRO;
  }

  // Check for explicit "pro" in name (but not as part of another word)
  if (productName.includes(' pro') || productName.includes('pro ') || productName === 'pro') {
    return TIERS.PRO;
  }

  // Third, use price as fallback (in cents)
  // $30+ = Power User, $20+ = Pro, $10+ = Essential
  const price = purchase.price || 0;

  if (price >= 3000) {
    return TIERS.POWER_USER;
  }
  if (price >= 2000) {
    return TIERS.PRO;
  }
  if (price >= 1000) {
    return TIERS.ESSENTIAL;
  }

  // Default to PRO for any unrecognized purchase
  // This ensures backwards compatibility for ALL existing users
  console.log('Unable to determine tier from variant/product, defaulting to PRO (backwards compat):', {
    variants: purchase.variants,
    productName: purchase.product_name,
    price: purchase.price
  });
  return TIERS.PRO;
}

/**
 * Store or update license record in D1 database
 */
async function storeLicenseInDb(db, licenseKey, purchase, tier) {
  try {
    // Check if license already exists
    const existing = await db.prepare(
      'SELECT id, tier FROM users WHERE gumroad_license_key = ?'
    ).bind(licenseKey).first();

    if (existing) {
      // Update existing record - update tier if changed (e.g., upgrade)
      await db.prepare(`
        UPDATE users SET
          email = ?,
          tier = ?,
          license_valid = 1,
          last_validated = datetime('now')
        WHERE gumroad_license_key = ?
      `).bind(
        purchase.email,
        tier,
        licenseKey
      ).run();

      console.log('Updated license in DB:', licenseKey.substring(0, 8) + '...', 'tier:', tier);
    } else {
      // Insert new record
      const id = crypto.randomUUID();
      await db.prepare(`
        INSERT INTO users (id, email, gumroad_license_key, tier, created_at, license_valid, last_validated)
        VALUES (?, ?, ?, ?, datetime('now'), 1, datetime('now'))
      `).bind(
        id,
        purchase.email,
        licenseKey,
        tier
      ).run();

      console.log('Created new license in DB:', licenseKey.substring(0, 8) + '...', 'tier:', tier);
    }
  } catch (error) {
    // Don't fail the request if DB storage fails
    console.error('Failed to store license in DB:', error);
  }
}

async function revalidateLicense(licenseKey, env, ctx) {
  // Same as verify, but with different logging/analytics
  console.log('Revalidating license:', licenseKey.substring(0, 8) + '...');
  return await verifyLicense(licenseKey, env, ctx);
}

async function generateSignature(licenseKey, email, env) {
  // Generate HMAC signature to prevent tampering
  // In production, use a secret key from environment variables
  const secret = env?.SIGNATURE_SECRET || (typeof SIGNATURE_SECRET !== 'undefined' ? SIGNATURE_SECRET : 'your-secret-key-change-this');

  const encoder = new TextEncoder();
  const data = encoder.encode(licenseKey + email + Date.now());
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, data);
  return bufferToHex(signature);
}

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function isValidOrigin(origin, env) {
  console.log('[DEBUG] Checking origin:', origin);

  if (!origin) {
    console.log('[DEBUG] No origin provided');
    return false;
  }

  // Allow Chrome extension origins
  if (origin.startsWith('chrome-extension://')) {
    // In production, check against specific extension ID
    const allowedOriginsStr = env?.ALLOWED_ORIGINS || (typeof ALLOWED_ORIGINS !== 'undefined' ? ALLOWED_ORIGINS : '');
    const allowedExtensions = allowedOriginsStr.split(',');
    console.log('[DEBUG] Allowed extensions:', allowedExtensions);
    const isAllowed = allowedExtensions.some(allowed => origin === allowed.trim());
    console.log('[DEBUG] Origin allowed?', isAllowed);
    return isAllowed;
  }

  console.log('[DEBUG] Origin does not start with chrome-extension://');
  return false;
}

function isRateLimited(clientIP, env) {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const maxRequestsStr = env?.RATE_LIMIT_MAX || (typeof RATE_LIMIT_MAX !== 'undefined' ? RATE_LIMIT_MAX : '100');
  const maxRequests = parseInt(maxRequestsStr);

  // Clean up old entries (inline cleanup to avoid setInterval in global scope)
  for (const [key, value] of rateLimitStore.entries()) {
    if (now - value.timestamp > oneHour) {
      rateLimitStore.delete(key);
    }
  }

  if (!rateLimitStore.has(clientIP)) {
    rateLimitStore.set(clientIP, { count: 1, timestamp: now });
    return false;
  }

  const record = rateLimitStore.get(clientIP);

  // Reset if more than an hour has passed
  if (now - record.timestamp > oneHour) {
    rateLimitStore.set(clientIP, { count: 1, timestamp: now });
    return false;
  }

  // Increment count
  record.count++;

  if (record.count > maxRequests) {
    return true;
  }

  return false;
}

function handleCORS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*', // Restrict in production
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    }
  });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*', // Restrict in production
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}
