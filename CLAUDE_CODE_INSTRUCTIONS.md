# Claude Code Instructions: JobTread Tools Pro

## What You're Building

A multi-tenant Cloudflare Worker + browser extension that adds "Smart Job Filtering" to JobTread. Users purchase a license through Gumroad, and the license is locked to their JobTread organization.

## Key Security Requirement: Proof of Org

Licenses must be locked to a single JobTread organization to prevent sharing across companies:

1. **First activation**: User provides Gumroad license + JobTread Grant Key → License gets LOCKED to that Org ID
2. **Additional users**: Must provide a Grant Key that belongs to the SAME org to be authorized
3. **Wrong org**: If someone tries to use a stolen license with a different org's Grant Key → BLOCKED

## Files Provided

- `src/index.js` - Complete Cloudflare Worker code
- `client/jobtread-pro-client.js` - Browser extension client library
- `client/page-helper.js` - Reads current org from JobTread page UI
- `schema.sql` - D1 database schema
- `wrangler.toml` - Cloudflare configuration template
- `IMPLEMENTATION_GUIDE.md` - Detailed architecture documentation

## Tasks

### 1. Set Up Cloudflare Infrastructure

```bash
# Create D1 database
wrangler d1 create jobtread-extension-users

# Run schema
wrangler d1 execute jobtread-extension-users --file=./schema.sql

# Create KV namespace for caching
wrangler kv:namespace create "CACHE"
```

Update `wrangler.toml` with the IDs from these commands.

### 2. Configure Gumroad

```bash
# Set the Gumroad product ID as a secret
wrangler secret put GUMROAD_PRODUCT_ID
```

### 3. Deploy Worker

```bash
wrangler deploy
```

### 4. Integrate with Extension

The extension needs to:

1. **On popup open**: Call `client.init()` to check license/device status
2. **If needs activation**: Show license key input form
3. **If needs org verification**: Show Grant Key input form with org name
4. **Before any API call**: Check current org matches using `page-helper.js`
5. **If org mismatch**: Show warning, block API calls

### Key API Flows

**New User:**
```
registerUser(licenseKey, deviceId) 
  → { needsJobTreadConnection: true }
  → verifyOrgAccess(licenseKey, deviceId, grantKey)
  → { success: true, deviceAuthorized: true }
```

**Existing User, New Device:**
```
registerUser(licenseKey, deviceId)
  → { needsOrgVerification: true, organizationName: "Titus Contracting" }
  → verifyOrgAccess(licenseKey, deviceId, grantKey)
  → If org matches: { success: true }
  → If org differs: { error: "ORG_MISMATCH" } ← BLOCKED
```

**Page Check (client-side):**
```javascript
// Before filtering, check page shows correct org
const currentOrg = JobTreadPageHelper.getCurrentOrgName();
// Reads: "Search Titus Contracting Inc" → "Titus Contracting Inc"

if (currentOrg !== client.user.organizationName) {
  showWarning("Wrong organization - switch back to use filtering");
  return; // Don't call API
}
```

## Database Tables

- `users` - One row per Gumroad license, stores org lock
- `authorized_devices` - Tracks which browsers can use each license  
- `api_usage` - Usage tracking for analytics

## Error Codes to Handle

| Code | Meaning | User Action |
|------|---------|-------------|
| `LICENSE_NOT_FOUND` | Invalid license | Show activation form |
| `LICENSE_INVALID` | Refunded/expired | Contact support |
| `DEVICE_NOT_AUTHORIZED` | New device | Show org verification form |
| `ORG_MISMATCH` | Wrong org Grant Key | "License belongs to different org" |
| `WRONG_ORG` | Page shows wrong org | "Switch back to [Org Name]" |

## Testing Scenarios

1. ✅ New license activation works
2. ✅ Second device requires org verification
3. ✅ Matching org Grant Key authorizes device
4. ❌ Different org Grant Key is blocked
5. ✅ Extension detects wrong org from page
6. ✅ Refunded licenses are rejected
