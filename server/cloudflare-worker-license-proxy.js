/**
 * Cloudflare Worker - License Validation Proxy
 *
 * This worker acts as a secure proxy between the Chrome extension and Gumroad API.
 * It keeps your Product ID and API secrets secure on the server side.
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
 * 6. Deploy the worker
 * 7. Note the worker URL (e.g., https://license-proxy.your-worker.workers.dev)
 * 8. Update license.js with your worker URL
 */

// Rate limiting store (using Cloudflare KV in production)
// Note: Workers are stateless and restart frequently, so this Map won't grow indefinitely
// Old entries are cleaned up inline during rate limit checks
const rateLimitStore = new Map();

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
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
  if (!isValidOrigin(origin)) {
    return jsonResponse({ success: false, error: 'Unauthorized origin' }, 403);
  }

  // Rate limiting
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (isRateLimited(clientIP)) {
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
      return await verifyLicense(sanitizedKey);
    } else if (action === 'revalidate') {
      return await revalidateLicense(sanitizedKey);
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

async function verifyLicense(licenseKey) {
  try {
    // Get Gumroad product ID from environment variable
    const productId = GUMROAD_PRODUCT_ID || 'x2GbSvLBfUSQcwVGDRSj1w==';

    // Call Gumroad API
    const response = await fetch('https://api.gumroad.com/v2/licenses/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'product_id': productId,
        'license_key': licenseKey,
      })
    });

    const data = await response.json();

    if (data.success && data.purchase) {
      // Generate a cryptographic signature for the license
      const signature = await generateSignature(licenseKey, data.purchase.email);

      return jsonResponse({
        success: true,
        data: {
          valid: true,
          purchaseEmail: data.purchase.email,
          productName: data.purchase.product_name,
          purchaseDate: data.purchase.created_at,
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

async function revalidateLicense(licenseKey) {
  // Same as verify, but with different logging/analytics
  console.log('Revalidating license:', licenseKey.substring(0, 8) + '...');
  return await verifyLicense(licenseKey);
}

async function generateSignature(licenseKey, email) {
  // Generate HMAC signature to prevent tampering
  // In production, use a secret key from environment variables
  const secret = SIGNATURE_SECRET || 'your-secret-key-change-this';

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

function isValidOrigin(origin) {
  if (!origin) return false;

  // Allow Chrome extension origins
  if (origin.startsWith('chrome-extension://')) {
    // In production, check against specific extension ID
    const allowedExtensions = (ALLOWED_ORIGINS || '').split(',');
    return allowedExtensions.some(allowed => origin === allowed.trim());
  }

  return false;
}

function isRateLimited(clientIP) {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const maxRequests = parseInt(RATE_LIMIT_MAX || '100');

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
