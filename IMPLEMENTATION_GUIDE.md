# JobTread Tools Pro - Implementation Guide for Claude Code

## Overview

Build a multi-tenant Cloudflare Worker that powers the JobTread Tools Pro browser extension. The system uses Gumroad for license validation and implements "Proof of Org" security to prevent license sharing across organizations.

## Architecture

```
Browser Extension → Cloudflare Worker → JobTread API
                          ↓
                    ┌─────┴─────┐
                    ↓           ↓
              Gumroad API    D1 Database
              (License)      (Users/Devices)
```

## Security Model: Proof of Org

1. **First user** activates license → enters JobTread Grant Key → license gets LOCKED to that Org ID
2. **Additional users** with same license must provide a Grant Key that belongs to the SAME org
3. **Each browser/device** gets a unique ID and must be authorized
4. **Wrong org** = blocked immediately (can't use stolen license in different company)

---

## Step 1: Cloudflare Setup

### 1.1 Create D1 Database

```bash
wrangler d1 create jobtread-extension-users
```

Save the database_id from output.

### 1.2 Create Database Tables

Create file `schema.sql`:

```sql
-- Users table (one per Gumroad license)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT,
  gumroad_license_key TEXT UNIQUE NOT NULL,
  gumroad_product_id TEXT,
  license_valid BOOLEAN DEFAULT true,
  jobtread_grant_key TEXT,
  jobtread_org_id TEXT,
  jobtread_org_name TEXT,
  org_locked BOOLEAN DEFAULT false,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Authorized devices (many per license)
CREATE TABLE authorized_devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  device_name TEXT,
  verified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, device_id)
);

-- Usage tracking
CREATE TABLE api_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  cached BOOLEAN DEFAULT false,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_users_license ON users(gumroad_license_key);
CREATE INDEX idx_devices_user ON authorized_devices(user_id);
CREATE INDEX idx_usage_user ON api_usage(user_id, created_at);
```

Run:
```bash
wrangler d1 execute jobtread-extension-users --file=./schema.sql
```

### 1.3 Create KV Namespace

```bash
wrangler kv:namespace create "CACHE"
```

Save the id from output.

### 1.4 Create wrangler.toml

```toml
name = "jobtread-tools-pro"
main = "src/index.js"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "jobtread-extension-users"
database_id = "YOUR_DATABASE_ID"  # From step 1.1

kv_namespaces = [
  { binding = "CACHE", id = "YOUR_KV_ID" }  # From step 1.3
]
```

### 1.5 Set Gumroad Secret

```bash
wrangler secret put GUMROAD_PRODUCT_ID
# Paste your Gumroad product ID when prompted
```

---

## Step 2: Worker Implementation

### File: `src/index.js`

The Worker handles these actions:

| Action | Auth Required | Description |
|--------|---------------|-------------|
| `verifyLicense` | No | Check if Gumroad license is valid |
| `registerUser` | No | Register/check device status |
| `verifyOrgAccess` | No | Prove org membership with Grant Key |
| `getStatus` | Yes | Get user status |
| `getCustomFields` | Yes | Get job custom fields for filtering |
| `getFilteredJobs` | Yes | Get jobs matching filters |
| `getAllJobs` | Yes | Get all jobs |
| `rawQuery` | Yes | Execute custom Pave query |
| `clearCache` | Yes | Clear cached data |
| `disconnect` | Yes | Remove Grant Key (keeps org lock) |
| `transferLicense` | Yes | Unlock org (for legitimate transfers) |
| `listDevices` | Yes | List authorized devices |
| `revokeDevice` | Yes | Revoke a device |

### Key Security Logic

#### Registration Flow (`registerUser`)

```javascript
async function handleRegisterUser(env, body) {
  const { licenseKey, deviceId, deviceName } = body;
  
  // 1. Verify with Gumroad
  const licenseResult = await verifyGumroadLicense(env, licenseKey);
  if (!licenseResult.valid) return error;
  
  // 2. Check if user exists
  let user = await getUser(env, licenseKey);
  
  if (!user) {
    // NEW USER: Create and auto-authorize first device
    user = await createUser(env, licenseKey, licenseResult);
    await authorizeDevice(env, user.id, deviceId, deviceName);
    return { success: true, deviceAuthorized: true, needsJobTreadConnection: true };
  }
  
  // EXISTING USER: Check if device authorized
  const isAuthorized = await isDeviceAuthorized(env, user.id, deviceId);
  
  if (isAuthorized) {
    return { success: true, deviceAuthorized: true };
  }
  
  // DEVICE NOT AUTHORIZED: Check if org locked
  if (user.org_locked && user.jobtread_org_id) {
    // Require org verification
    return { 
      success: true, 
      deviceAuthorized: false, 
      needsOrgVerification: true,
      organizationName: user.jobtread_org_name 
    };
  }
  
  // Org not locked yet - authorize device
  await authorizeDevice(env, user.id, deviceId, deviceName);
  return { success: true, deviceAuthorized: true, needsJobTreadConnection: true };
}
```

#### Org Verification Flow (`verifyOrgAccess`)

```javascript
async function handleVerifyOrgAccess(env, body) {
  const { licenseKey, deviceId, grantKey } = body;
  
  const user = await getUser(env, licenseKey);
  
  // 1. Test the Grant Key with JobTread
  const orgInfo = await testGrantKey(grantKey);
  // Returns: { id: "22PGZ...", name: "Titus Contracting" }
  
  // 2. If license is locked, verify org matches
  if (user.org_locked && user.jobtread_org_id) {
    if (orgInfo.id !== user.jobtread_org_id) {
      // SECURITY BLOCK: Different org!
      return { 
        error: 'Organization mismatch',
        code: 'ORG_MISMATCH',
        message: 'Your Grant Key belongs to a different organization'
      };
    }
  }
  
  // 3. Authorize device
  await authorizeDevice(env, user.id, deviceId);
  
  // 4. Lock to org if not already
  if (!user.org_locked) {
    await lockUserToOrg(env, user.id, grantKey, orgInfo);
  }
  
  return { success: true, deviceAuthorized: true };
}
```

#### Protected Action Check

```javascript
// All protected actions must check:
const isAuthorized = await isDeviceAuthorized(env, user.id, deviceId);
if (!isAuthorized) {
  return { 
    error: 'Device not authorized',
    code: 'DEVICE_NOT_AUTHORIZED',
    needsOrgVerification: true 
  };
}
```

---

## Step 3: Client Library

### File: `client/jobtread-pro-client.js`

Key methods:

```javascript
class JobTreadProClient {
  constructor(workerUrl) {
    this.workerUrl = workerUrl;
    this.licenseKey = null;
    this.deviceId = null;  // Unique per browser
  }

  // Generate/retrieve persistent device ID
  async getDeviceId() { ... }
  
  // Initialize - check stored credentials
  async init() {
    await this.loadCredentials();
    if (!this.licenseKey) return { needsActivation: true };
    
    const result = await this.request('registerUser');
    
    if (result.needsOrgVerification) {
      return { needsOrgVerification: true, organizationName: result.organizationName };
    }
    
    return { initialized: true };
  }
  
  // Activate with Gumroad license
  async activate(licenseKey) { ... }
  
  // Verify org access with Grant Key
  async verifyOrgAccess(grantKey) { ... }
  
  // API methods (require authorization)
  async getFilteredJobs(filters) { ... }
  async getAllJobs() { ... }
}
```

### File: `client/page-helper.js`

Reads current org from JobTread UI:

```javascript
const JobTreadPageHelper = {
  getCurrentOrgName() {
    // Read from global search: "Search [Org Name]"
    const input = document.querySelector('input[placeholder^="Search "]');
    if (input) {
      return input.placeholder.replace('Search ', '').trim();
    }
    return null;
  },
  
  isCorrectOrg(expectedOrgName) {
    const current = this.getCurrentOrgName();
    return current?.toLowerCase() === expectedOrgName?.toLowerCase();
  }
};
```

---

## Step 4: Extension Integration

### Content Script Check (Before API Calls)

```javascript
// Before making any API call, verify user is on correct org
const orgCheck = JobTreadPageHelper.isCorrectOrg(client.user.organizationName);

if (!orgCheck) {
  showWarning("You're viewing a different organization. Switch back to use filtering.");
  return;
}

// Proceed with API call
const jobs = await client.getFilteredJobs(filters);
```

### User Flows

#### New User
1. Enter Gumroad license key
2. Enter JobTread Grant Key
3. License locked to org, device authorized
4. Ready to use

#### Existing User, New Device (Same Org)
1. Enter Gumroad license key
2. "This license belongs to [Org Name]"
3. Enter JobTread Grant Key to verify
4. System confirms org matches
5. Device authorized, ready to use

#### Attacker (Different Org)
1. Enter stolen Gumroad license key
2. "This license belongs to [Org Name]"
3. Enter THEIR Grant Key
4. System detects org mismatch
5. **BLOCKED** - Cannot proceed

---

## Step 5: Gumroad Setup

1. Create product on Gumroad
2. Enable "Generate a unique license key per sale"
3. Copy Product ID from product settings
4. Add to Worker: `wrangler secret put GUMROAD_PRODUCT_ID`

### Gumroad API Verification

```javascript
async function verifyGumroadLicense(env, licenseKey) {
  const response = await fetch('https://api.gumroad.com/v2/licenses/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      product_id: env.GUMROAD_PRODUCT_ID,
      license_key: licenseKey
    })
  });
  
  const data = await response.json();
  
  if (!data.success) return { valid: false };
  if (data.purchase.refunded) return { valid: false, error: 'Refunded' };
  
  return { 
    valid: true, 
    email: data.purchase.email,
    productId: data.purchase.product_id 
  };
}
```

---

## Step 6: Deployment

```bash
# Install dependencies
npm install

# Deploy Worker
wrangler deploy

# View logs
wrangler tail
```

---

## API Reference

### Request Format

All requests are POST to Worker URL with JSON body:

```json
{
  "action": "actionName",
  "licenseKey": "XXXX-XXXX-XXXX-XXXX",
  "deviceId": "dev_abc123...",
  ...additionalParams
}
```

### Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (missing params) |
| 401 | Invalid/missing license |
| 403 | Not authorized (device/org mismatch) |
| 429 | Rate limited |
| 500 | Server error |

### Error Codes

| Code | Meaning |
|------|---------|
| `LICENSE_NOT_FOUND` | License not registered |
| `LICENSE_INVALID` | License revoked/refunded |
| `DEVICE_NOT_AUTHORIZED` | Device needs verification |
| `ORG_MISMATCH` | Grant Key org doesn't match license org |
| `JOBTREAD_NOT_CONNECTED` | Need to connect JobTread first |

---

## Testing Checklist

- [ ] New user can activate with valid Gumroad license
- [ ] First device is auto-authorized
- [ ] License gets locked to org after Grant Key provided
- [ ] Second device on same license requires org verification
- [ ] Second device with matching org Grant Key is authorized
- [ ] Different org Grant Key is rejected with ORG_MISMATCH
- [ ] Refunded licenses are rejected
- [ ] Page helper detects current org from JobTread UI
- [ ] Extension shows warning when viewing wrong org
- [ ] Rate limiting works (100 req/min)
- [ ] Cache works for job queries
- [ ] Device revocation works
- [ ] License transfer clears org lock and devices

---

## File Structure

```
jobtread-tools-pro/
├── src/
│   └── index.js          # Cloudflare Worker
├── client/
│   ├── jobtread-pro-client.js   # Main client library
│   ├── page-helper.js           # JobTread page utilities
│   └── popup-example.js         # Extension popup example
├── schema.sql            # Database schema
├── wrangler.toml         # Cloudflare config
├── package.json
└── README.md
```
