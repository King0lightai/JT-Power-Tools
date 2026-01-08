# Cloudflare Worker Setup Guide

Your extension is now ready to connect to your Cloudflare Worker! Follow these steps to complete the setup.

## 📋 What's Been Done

✅ Cloudflare Worker code deployed
✅ Pro Client library integrated into extension
✅ Popup updated to use Worker API
✅ Job Switcher updated to use Worker API
✅ Device authorization system ready
✅ Org locking security implemented

## 🔧 Configuration Required

### Step 1: Update Worker URL

1. Open `JT-Tools-Master/config/worker-config.js`
2. Replace `YOUR_SUBDOMAIN` with your actual Cloudflare Worker URL:

```javascript
const WORKER_CONFIG = {
  // Your deployed Worker URL - something like:
  // https://jobtread-tools-pro.your-name.workers.dev
  WORKER_URL: 'https://jobtread-tools-pro.YOUR_SUBDOMAIN.workers.dev',

  USE_WORKER: true  // Keep this as true
};
```

**To find your Worker URL:**
- Go to your Cloudflare dashboard
- Click on "Workers & Pages"
- Find your `jobtread-tools-pro` worker
- Copy the URL shown

### Step 2: Reload Extension

After updating the Worker URL:

1. Go to `chrome://extensions/`
2. Click the **reload** button on "JT Power Tools"
3. Open the extension popup

## 🧪 Testing the Connection

### Test Flow:

1. **Activate Gumroad License** (if not already done):
   - Open extension popup
   - Scroll to "Premium License" section
   - Enter your Gumroad license key
   - Click "Verify"
   - ✅ Should see "Premium Active"

2. **Connect JobTread API**:
   - Scroll to "API (Experimental)" section
   - Enter your JobTread Grant Key
   - Click "Test"
   - ✅ Should see "Connected to [Your Org Name]!"

3. **Test Custom Field Filtering**:
   - Go to JobTread
   - Press `Alt+J` or `J+S` to open Quick Job Switcher
   - Enable "Custom Field Filter" toggle
   - Select a field and value
   - ✅ Should see filtered jobs

## 🔍 Troubleshooting

### Error: "Worker not configured"
- Make sure you updated `worker-config.js` with your actual Worker URL
- Reload the extension after changing the config

### Error: "Please activate your Gumroad license first"
- You need to enter and verify your Gumroad license key first
- The Worker requires a valid license to operate

### Error: "Organization mismatch"
- This license is locked to a different organization
- This is the "Proof of Org" security working correctly
- Contact support if you need to transfer the license

### Error: "Invalid Grant Key"
- Double-check your Grant Key from JobTread
- Go to: Settings → Integrations → API in JobTread
- Copy the Grant Key exactly as shown

### Jobs not filtering
- Open browser console (F12)
- Look for messages starting with "QuickJobSwitcher:"
- Should see "Using Pro Service (Worker API)"
- Check for any error messages

## 🔐 Security Features

Your Worker implements:

1. **License Validation**: Verifies with Gumroad on every request
2. **Device Authorization**: Each browser must be authorized
3. **Org Locking**: License locks to first organization used
4. **Proof of Org**: New devices must prove they belong to the same org

## 📊 How It Works

```
Extension Popup              Cloudflare Worker         External Services
     │                              │                         │
     ├─ Enter Gumroad License ─────┼─ Verify ───────────────► Gumroad API
     │                              │   ✓ Valid                    │
     │                              │◄─────────────────────────────┘
     │                              │
     │◄─ Device Authorized ─────────┤ (Auto-authorize first device)
     │                              │
     ├─ Enter Grant Key ────────────┼─ Test ─────────────────► JobTread API
     │                              │   ✓ Valid + Org ID           │
     │                              │◄─────────────────────────────┘
     │                              │
     │◄─ Connected to Org ──────────┤ (Lock license to Org ID)
     │                              │
     │                              │
Job Switcher                       │
     │                              │
     ├─ Request Custom Fields ──────┼─ Fetch ─────────────────► JobTread API
     │                              │   (With org verification)    │
     │                              │◄─────────────────────────────┘
     │◄─ Return Fields ─────────────┤ (Cached for 1 hour)
     │                              │
     ├─ Filter Jobs ────────────────┼─ Query ─────────────────► JobTread API
     │                              │   (Server-side filtering)    │
     │                              │◄─────────────────────────────┘
     │◄─ Return Filtered Jobs ──────┤ (Cached for 2 minutes)
```

## 🎯 Next Steps

Once configured:

1. All API calls will go through your Worker
2. No more CORS issues
3. Secure license validation
4. Org-locked security
5. Caching for better performance

## 💡 Tips

- The Worker caches custom fields for 1 hour
- Job queries are cached for 2 minutes
- Multiple users in same org can share one license
- Each user's browser is tracked separately
- Device authorization persists across sessions

## 📝 Fallback Mode

If the Worker is not configured, the extension will:
- Fall back to direct API calls (old behavior)
- Show "API configured (Direct)" in popup
- Continue to work for development/testing

This ensures backward compatibility during transition.

---

**Need Help?** Check the browser console (F12) for detailed error messages.
