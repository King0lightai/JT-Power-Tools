# License Proxy Server Deployment Guide

This guide explains how to deploy the secure license validation proxy for JT Power Tools.

## Why We Need This

The license validation proxy solves critical security issues:

1. **Keeps Product ID Secret** - Your Gumroad product ID is no longer exposed in client code
2. **Prevents License Bypass** - Validation happens server-side where users can't modify it
3. **Rate Limiting** - Prevents abuse and API hammering
4. **License Revocation** - Can check if licenses have been refunded/disabled
5. **Analytics** - Track license validation attempts

## Deployment Options

### Option 1: Cloudflare Workers (Recommended)

**Pros:**
- ✅ Free tier (100,000 requests/day)
- ✅ Global edge network (fast response times)
- ✅ Zero server maintenance
- ✅ Easy deployment via dashboard or CLI
- ✅ Built-in rate limiting and DDoS protection

**Cost:** Free for up to 100k requests/day, then $5/month for 10M requests

#### Step-by-Step Deployment

1. **Create Cloudflare Account**
   - Go to https://dash.cloudflare.com
   - Sign up for free account

2. **Create New Worker**
   - Navigate to "Workers & Pages" in sidebar
   - Click "Create Application"
   - Select "Create Worker"
   - Name it: `jt-tools-license-proxy`

3. **Deploy Worker Code**
   - Copy contents of `cloudflare-worker-license-proxy.js`
   - Paste into the worker editor
   - Click "Save and Deploy"

4. **Configure Environment Variables**
   - In worker settings, go to "Settings" → "Variables"
   - Add these environment variables:
     ```
     GUMROAD_PRODUCT_ID = x2GbSvLBfUSQcwVGDRSj1w==
     SIGNATURE_SECRET = [generate a random 32-char string]
     RATE_LIMIT_MAX = 100
     ALLOWED_ORIGINS = chrome-extension://YOUR_EXTENSION_ID
     ```
   - To generate a random secret:
     ```bash
     node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
     ```

5. **Get Your Worker URL**
   - After deployment, copy your worker URL
   - Example: `https://jt-tools-license-proxy.your-subdomain.workers.dev`
   - You'll need this URL for the extension

6. **Update Extension Code**
   - Open `JT-Tools-Master/services/license.js`
   - Update the `LICENSE_PROXY_URL` constant with your worker URL

7. **Test the Proxy**
   ```bash
   curl -X POST https://jt-tools-license-proxy.your-subdomain.workers.dev \
     -H "Content-Type: application/json" \
     -H "Origin: chrome-extension://YOUR_EXTENSION_ID" \
     -d '{"licenseKey":"TEST_KEY","action":"verify"}'
   ```

---

### Option 2: Node.js/Express Server

If you prefer a traditional server, use the Express.js version:

**Pros:**
- ✅ Full control over server
- ✅ Can add custom database logging
- ✅ Easier to debug locally

**Cons:**
- ❌ Requires server hosting (AWS, DigitalOcean, etc.)
- ❌ Monthly hosting costs ($5-20/month)
- ❌ Need to manage security, SSL, updates

#### Quick Start

1. **Install dependencies:**
   ```bash
   cd server
   npm install express cors helmet express-rate-limit
   ```

2. **Create `.env` file:**
   ```env
   GUMROAD_PRODUCT_ID=x2GbSvLBfUSQcwVGDRSj1w==
   SIGNATURE_SECRET=your_random_32_char_secret
   ALLOWED_ORIGINS=chrome-extension://YOUR_EXTENSION_ID
   PORT=3000
   ```

3. **Run server:**
   ```bash
   node express-license-proxy.js
   ```

4. **Deploy to hosting:**
   - Use Railway, Render, or Heroku for easy deployment
   - All have free tiers with SSL included

---

## Security Checklist

After deployment, verify:

- [ ] Environment variables are set correctly
- [ ] `SIGNATURE_SECRET` is a strong random string (not default)
- [ ] `ALLOWED_ORIGINS` is set to your actual extension ID
- [ ] Rate limiting is enabled
- [ ] HTTPS/SSL is working
- [ ] Test both valid and invalid license keys
- [ ] Monitor error logs for issues

---

## Getting Your Extension ID

### For Development (Unpacked Extension):
1. Go to `chrome://extensions`
2. Enable Developer Mode
3. Your extension ID is shown under the extension name
4. Example: `abcdefghijklmnopqrstuvwxyz123456`

### For Production (Chrome Web Store):
1. After publishing to Chrome Web Store
2. The extension ID remains the same
3. Update the worker's `ALLOWED_ORIGINS` with the production ID

---

## Monitoring & Maintenance

### Cloudflare Workers Dashboard
- View request analytics
- Monitor error rates
- Check for abuse attempts
- Upgrade plan if needed

### Recommended Alerts
Set up notifications for:
- High error rates (>5%)
- Rate limit triggers
- Unusual traffic patterns

---

## Cost Estimates

### Cloudflare Workers
- **Free tier:** 100,000 requests/day
- **Paid tier:** $5/month for 10M requests
- **For 1000 users:** ~3,000 requests/day (well within free tier)
- **For 10,000 users:** ~30,000 requests/day (still free)

### Traditional Server
- **Railway/Render:** $5-7/month (free tier available)
- **DigitalOcean Droplet:** $6/month
- **AWS EC2 t3.micro:** ~$8/month

---

## Troubleshooting

### Error: "Unauthorized origin"
- Check that `ALLOWED_ORIGINS` matches your extension ID
- Verify extension is sending correct Origin header

### Error: "Too many requests"
- User hit rate limit (100 requests/hour by default)
- Check if extension is calling verify too frequently

### Error: "Unable to verify license with Gumroad"
- Gumroad API might be down (check status.gumroad.com)
- Verify `GUMROAD_PRODUCT_ID` is correct

### Extension still showing license error
- Clear extension storage: `chrome.storage.sync.clear()`
- Reload extension
- Try entering license key again

---

## Next Steps

After deploying the proxy:

1. ✅ Update `license.js` with your proxy URL
2. ✅ Test license activation with real key
3. ✅ Test with invalid key
4. ✅ Implement re-validation in extension
5. ✅ Add encryption to stored license data
6. ✅ Bundle and obfuscate extension code

---

## Support

If you run into issues deploying:
- Cloudflare Workers Docs: https://developers.cloudflare.com/workers
- Express.js Docs: https://expressjs.com
- Gumroad API Docs: https://help.gumroad.com/article/76-license-keys

## Alternative: Gumroad Webhooks

For advanced users, consider implementing Gumroad webhooks to:
- Detect refunds and auto-revoke licenses
- Track sales in real-time
- Build custom analytics

See: https://help.gumroad.com/article/266-gumroad-webhooks

---

# JobTread API Proxy Worker

This worker provides secure access to the JobTread Pave API for the Smart Job Filter feature.

## Features

- **Secure API Key Storage** - Grant Key stored in Cloudflare environment variables
- **Response Caching** - Uses KV to cache responses (2 min for jobs, 1 hour for custom fields)
- **Server-Side Filtering** - Uses Pave `with` clause for efficient job filtering
- **Multi-Filter Support** - AND logic for combining multiple custom field filters
- **CORS Handling** - Proper CORS headers for browser extension requests

## Deployment Steps

### 1. Create KV Namespace

```bash
# Using Wrangler CLI
wrangler kv:namespace create "JOBTREAD_CACHE"
```

Or create via Cloudflare Dashboard:
- Go to Workers & Pages → KV
- Create a namespace named `JOBTREAD_CACHE`
- Copy the namespace ID

### 2. Update wrangler.toml

Edit `server/wrangler.toml` and replace `YOUR_KV_NAMESPACE_ID` with your actual KV namespace ID.

### 3. Set Secrets

```bash
cd server

# Set your JobTread Grant Key
wrangler secret put JOBTREAD_GRANT_KEY
# Enter: your_grant_key_here

# Set your Organization ID
wrangler secret put ORG_ID
# Enter: your_org_id_here

# Set extension authentication secret
wrangler secret put EXTENSION_SECRET
# Enter: (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

### 4. Deploy Worker

```bash
cd server
wrangler deploy
```

Your worker will be available at: `https://jt-power-tools-api.YOUR_SUBDOMAIN.workers.dev`

### 5. Update Extension

After deploying, update the extension to use the worker URL instead of direct API calls.

## API Endpoints

All requests are POST to the worker URL with JSON body:

### Test Connection
```json
{ "action": "testConnection" }
```

### Get Custom Fields
```json
{ "action": "getCustomFields" }
```

### Get All Jobs
```json
{ "action": "getAllJobs" }
```

### Get Filtered Jobs
```json
{
  "action": "getFilteredJobs",
  "filters": [
    { "fieldName": "Status", "value": "Construction" },
    { "fieldName": "Job Type", "value": "Residential" }
  ]
}
```

### Get Field Values
```json
{
  "action": "getFieldValues",
  "fieldId": "abc123"
}
```

## Request Headers

All requests must include:
```
Content-Type: application/json
X-Extension-Key: your_extension_secret
```

## Response Format

Success:
```json
{
  "jobs": [...],
  "filters": [...],
  "_cached": true  // indicates response was from cache
}
```

Error:
```json
{
  "error": "Error message"
}
```

## Cache TTLs

| Data Type | TTL |
|-----------|-----|
| Custom Fields | 1 hour |
| Job Lists | 2 minutes |
| Field Values | 5 minutes |

## Local Development

```bash
cd server
wrangler dev
```

This starts a local development server at `http://localhost:8787`
