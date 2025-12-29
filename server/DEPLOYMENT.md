# JobTread Tools Pro - Deployment Guide

This guide explains how to deploy the secure Cloudflare Worker for JobTread Tools Pro.

## Architecture Overview

```
Browser Extension → Cloudflare Worker → JobTread API
                          ↓
                    ┌─────┴─────┐
                    ↓           ↓
              Gumroad API    D1 Database
              (License)      (Users/Devices)
```

## Security Model: Proof of Org

Licenses are locked to a single JobTread organization to prevent sharing:

1. **First user** activates license → enters Grant Key → license gets LOCKED to that Org ID
2. **Additional users** with same license must provide Grant Key that belongs to SAME org
3. **Each browser/device** gets a unique ID and must be authorized
4. **Wrong org** = blocked immediately (can't use stolen license in different company)

---

## Prerequisites

- [Cloudflare account](https://dash.cloudflare.com) (free tier works)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed
- Gumroad product with license keys enabled

---

## Deployment Steps

### 1. Create D1 Database

```bash
cd server
wrangler d1 create jobtread-extension-users
```

**Save the output!** You'll need the `database_id`.

### 2. Run Database Schema

```bash
wrangler d1 execute jobtread-extension-users --file=./schema.sql
```

This creates the `users`, `authorized_devices`, and `api_usage` tables.

### 3. Create KV Namespace

```bash
wrangler kv:namespace create "CACHE"
```

**Save the output!** You'll need the namespace `id`.

### 4. Update wrangler.toml

Edit `server/wrangler.toml` and replace the placeholder IDs:

```toml
[[d1_databases]]
binding = "DB"
database_name = "jobtread-extension-users"
database_id = "YOUR_ACTUAL_DATABASE_ID"  # From step 1

[[kv_namespaces]]
binding = "CACHE"
id = "YOUR_ACTUAL_KV_NAMESPACE_ID"  # From step 3
```

### 5. Set Gumroad Secret

```bash
wrangler secret put GUMROAD_PRODUCT_ID
# Paste your Gumroad product ID when prompted
```

### 6. Deploy Worker

```bash
wrangler deploy
```

Your worker will be available at: `https://jobtread-tools-pro.YOUR_SUBDOMAIN.workers.dev`

---

## API Reference

All requests are POST to the worker URL with JSON body.

### Public Actions (No Auth Required)

#### Verify License
```json
{
  "action": "verifyLicense",
  "licenseKey": "XXXX-XXXX-XXXX-XXXX"
}
```

#### Register User / Check Device Status
```json
{
  "action": "registerUser",
  "licenseKey": "XXXX-XXXX-XXXX-XXXX",
  "deviceId": "dev_abc123...",
  "deviceName": "Chrome on Windows"
}
```

#### Verify Org Access (Proof of Org)
```json
{
  "action": "verifyOrgAccess",
  "licenseKey": "XXXX-XXXX-XXXX-XXXX",
  "deviceId": "dev_abc123...",
  "grantKey": "YOUR_JOBTREAD_GRANT_KEY"
}
```

### Protected Actions (Require Device Authorization)

All protected actions require `licenseKey` and `deviceId`.

#### Get User Status
```json
{
  "action": "getStatus",
  "licenseKey": "...",
  "deviceId": "..."
}
```

#### Get Custom Fields
```json
{
  "action": "getCustomFields",
  "licenseKey": "...",
  "deviceId": "..."
}
```

#### Get All Jobs
```json
{
  "action": "getAllJobs",
  "licenseKey": "...",
  "deviceId": "..."
}
```

#### Get Filtered Jobs
```json
{
  "action": "getFilteredJobs",
  "licenseKey": "...",
  "deviceId": "...",
  "filters": [
    { "fieldName": "Status", "value": "Construction" },
    { "fieldName": "Job Type", "value": "Residential" }
  ]
}
```

#### Raw Pave Query
```json
{
  "action": "rawQuery",
  "licenseKey": "...",
  "deviceId": "...",
  "query": {
    "jobs": {
      "$": { "size": 10 },
      "nodes": { "id": {}, "name": {} }
    }
  }
}
```

#### Clear Cache
```json
{
  "action": "clearCache",
  "licenseKey": "...",
  "deviceId": "..."
}
```

#### Disconnect JobTread
```json
{
  "action": "disconnect",
  "licenseKey": "...",
  "deviceId": "..."
}
```

#### List Devices
```json
{
  "action": "listDevices",
  "licenseKey": "...",
  "deviceId": "..."
}
```

#### Revoke Device
```json
{
  "action": "revokeDevice",
  "licenseKey": "...",
  "deviceId": "...",
  "targetDeviceId": "dev_xyz789..."
}
```

#### Transfer License (Unlock Org)
```json
{
  "action": "transferLicense",
  "licenseKey": "...",
  "deviceId": "..."
}
```

---

## Response Format

### Success Response
```json
{
  "success": true,
  "jobs": [...],
  "_cached": true  // Indicates response was from cache
}
```

### Error Response
```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `LICENSE_NOT_FOUND` | 401 | License not registered |
| `LICENSE_INVALID` | 401 | License revoked/refunded |
| `DEVICE_NOT_AUTHORIZED` | 403 | Device needs org verification |
| `ORG_MISMATCH` | 403 | Grant Key org doesn't match license org |
| `JOBTREAD_NOT_CONNECTED` | 403 | Need to connect JobTread first |
| `INVALID_GRANT_KEY` | 400 | Grant Key failed to authenticate |

---

## Cache TTLs

| Data Type | TTL |
|-----------|-----|
| Custom Fields | 1 hour |
| Job Lists | 2 minutes |

---

## Database Schema

### users
- `id` - Primary key
- `email` - From Gumroad
- `gumroad_license_key` - License key (unique)
- `jobtread_grant_key` - Encrypted Grant Key
- `jobtread_org_id` - Locked organization ID
- `jobtread_org_name` - Organization name for display
- `org_locked` - Whether org is locked
- `license_valid` - Whether license is still valid

### authorized_devices
- `id` - Primary key
- `user_id` - Foreign key to users
- `device_id` - Unique device identifier
- `device_name` - Human-readable name
- `verified_at` - When device was authorized
- `last_active_at` - Last activity timestamp

### api_usage
- `id` - Auto-increment
- `user_id` - Foreign key to users
- `action` - API action called
- `cached` - Whether response was from cache
- `created_at` - Timestamp

---

## Local Development

```bash
cd server
wrangler dev
```

This starts a local development server at `http://localhost:8787`

Note: Local dev requires D1 local database. Run:
```bash
wrangler d1 execute jobtread-extension-users --file=./schema.sql --local
```

---

## Monitoring

### View Logs
```bash
wrangler tail
```

### Query Database
```bash
# List all users
wrangler d1 execute jobtread-extension-users --command "SELECT * FROM users"

# Check device count per user
wrangler d1 execute jobtread-extension-users --command "SELECT user_id, COUNT(*) FROM authorized_devices GROUP BY user_id"

# View recent API usage
wrangler d1 execute jobtread-extension-users --command "SELECT * FROM api_usage ORDER BY created_at DESC LIMIT 20"
```

---

## Security Checklist

- [ ] D1 database created and schema applied
- [ ] KV namespace created for caching
- [ ] GUMROAD_PRODUCT_ID set as secret
- [ ] wrangler.toml has correct database and KV IDs
- [ ] Worker deployed successfully
- [ ] Test new license activation
- [ ] Test device authorization on second browser
- [ ] Test org mismatch rejection
- [ ] Monitor for unusual patterns

---

## Troubleshooting

### Error: "License not found"
- Verify GUMROAD_PRODUCT_ID is correct
- Check license key format

### Error: "Device not authorized"
- User needs to verify org access with Grant Key
- Check if org is locked and matches

### Error: "Organization mismatch"
- User's Grant Key belongs to different org than license
- This is a security block - intentional

### Error: "JobTread not connected"
- User hasn't provided Grant Key yet
- Show connection form in extension

### Cache not working
- Verify KV namespace ID in wrangler.toml
- Check worker logs for KV errors

---

## Cost Estimates

### Cloudflare Workers
- **Free tier:** 100,000 requests/day
- **Paid tier:** $5/month for 10M requests

### D1 Database
- **Free tier:** 5GB storage, 5M rows read/day
- **Paid tier:** $0.75/million rows read

### KV Storage
- **Free tier:** 100,000 reads/day, 1,000 writes/day
- **Paid tier:** $0.50/million reads

For most extensions, free tier is sufficient.
