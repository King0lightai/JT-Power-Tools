/**
 * Express.js License Validation Proxy
 *
 * Alternative to Cloudflare Worker for those who prefer traditional servers.
 * Deploy on: Railway, Render, Heroku, DigitalOcean, AWS, etc.
 *
 * SETUP:
 * 1. npm install express cors helmet express-rate-limit dotenv
 * 2. Create .env file with environment variables (see DEPLOYMENT.md)
 * 3. Run: node express-license-proxy.js
 * 4. Deploy to your hosting provider
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Environment variables
const GUMROAD_PRODUCT_ID = process.env.GUMROAD_PRODUCT_ID || 'x2GbSvLBfUSQcwVGDRSj1w==';
const SIGNATURE_SECRET = process.env.SIGNATURE_SECRET || 'change-this-secret-key';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim());

// Security middleware
app.use(helmet());
app.use(express.json({ limit: '10kb' })); // Limit request size

// CORS configuration (only allow Chrome extension)
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Allow the JobTread app origin (content scripts make requests from this context)
    if (origin === 'https://app.jobtread.com') {
      return callback(null, true);
    }

    // Allow all Chrome extension origins - only real extensions can send this scheme
    if (origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }

    callback(new Error('Unauthorized origin'));
  },
  methods: ['POST'],
  credentials: false
}));

// Rate limiting (100 requests per hour per IP)
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  message: {
    success: false,
    error: 'Too many requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/verify', limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// License verification endpoint
app.post('/verify', async (req, res) => {
  try {
    const { licenseKey, action } = req.body;

    // Validate input
    if (!licenseKey || typeof licenseKey !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid license key format'
      });
    }

    // Sanitize input
    const sanitizedKey = licenseKey.trim().slice(0, 100);

    // Handle different actions
    if (action === 'verify' || !action) {
      const result = await verifyLicense(sanitizedKey);
      return res.json(result);
    } else if (action === 'revalidate') {
      const result = await revalidateLicense(sanitizedKey);
      return res.json(result);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid action'
      });
    }

  } catch (error) {
    console.error('License verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

async function verifyLicense(licenseKey) {
  try {
    // Call Gumroad API
    const formData = new URLSearchParams({
      'product_id': GUMROAD_PRODUCT_ID,
      'license_key': licenseKey,
    });

    const response = await fetch('https://api.gumroad.com/v2/licenses/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData
    });

    const data = await response.json();

    if (data.success && data.purchase) {
      // Generate cryptographic signature
      const signature = generateSignature(licenseKey, data.purchase.email);

      console.log(`✅ License verified: ${data.purchase.email}`);

      return {
        success: true,
        data: {
          valid: true,
          purchaseEmail: data.purchase.email,
          productName: data.purchase.product_name,
          purchaseDate: data.purchase.created_at,
          verifiedAt: Date.now(),
          signature: signature
        }
      };
    } else {
      console.log(`❌ Invalid license key: ${licenseKey.substring(0, 8)}...`);
      return {
        success: false,
        error: data.message || 'Invalid license key'
      };
    }
  } catch (error) {
    console.error('Gumroad API error:', error);
    return {
      success: false,
      error: 'Unable to verify license. Please try again.'
    };
  }
}

async function revalidateLicense(licenseKey) {
  console.log(`🔄 Revalidating license: ${licenseKey.substring(0, 8)}...`);
  return await verifyLicense(licenseKey);
}

function generateSignature(licenseKey, email) {
  // Create HMAC signature to prevent client-side tampering
  const data = `${licenseKey}:${email}:${Date.now()}`;
  const hmac = crypto.createHmac('sha256', SIGNATURE_SECRET);
  hmac.update(data);
  return hmac.digest('hex');
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);

  if (err.message === 'Unauthorized origin') {
    return res.status(403).json({
      success: false,
      error: 'Unauthorized origin'
    });
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 License Proxy Server Started');
  console.log(`📡 Listening on port ${PORT}`);
  console.log(`🔒 Allowed origins:`, ALLOWED_ORIGINS);
  console.log(`⚡ Rate limit: ${process.env.RATE_LIMIT_MAX || 100} requests/hour`);
  console.log('');
  console.log('Endpoints:');
  console.log(`  GET  /health - Health check`);
  console.log(`  POST /verify - License verification`);
  console.log('');

  if (SIGNATURE_SECRET === 'change-this-secret-key') {
    console.warn('⚠️  WARNING: Using default signature secret!');
    console.warn('⚠️  Set SIGNATURE_SECRET in .env file!');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
