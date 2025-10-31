# Premium Licensing Setup Guide

This guide explains how to set up Gumroad premium licensing for JT-Tools.

## Overview

The premium licensing system allows you to:
- Sell monthly/lifetime subscriptions on Gumroad
- Gate premium features (currently Schedule Drag & Drop)
- Verify licenses without hosting your own backend
- Update the extension via Chrome Web Store while keeping premium features

## Prerequisites

1. A Gumroad account
2. A product created on Gumroad
3. License keys enabled for your product

## Setup Steps

### 1. Create Your Gumroad Product

1. Go to [Gumroad](https://gumroad.com)
2. Click "Create a product"
3. Set up your product (e.g., "JT-Tools Premium")
4. Enable "Generate license keys" in product settings
5. Set pricing (monthly subscription or one-time payment)
6. Note your **product permalink** (e.g., `jt-tools`)

### 2. Configure the Extension

Open `/services/license.js` and update lines 6-7:

```javascript
const PRODUCT_PERMALINK = 'your-product-permalink'; // Replace with your actual permalink
const PRODUCT_ID = 'your-product-id'; // Replace with your actual product ID
```

For example:
- If your product URL is `https://gumroad.com/l/jt-tools`, your permalink is `jt-tools`
- Your product ID can be found in your Gumroad product settings (e.g., `x2GbSvLBfUSQcwVGDRSj1w==`)

The extension uses `product_id` for license verification by default.

### 3. Build and Test

1. Load the extension in Chrome (unpacked)
2. Open the popup
3. Try entering a test license key from Gumroad
4. Verify the license validates correctly

### 4. Publish to Chrome Web Store

1. Package your extension
2. Upload to Chrome Web Store
3. Users can now purchase licenses from your Gumroad page
4. They enter their license key in the extension popup

## How It Works

### For Users:
1. Install extension from Chrome Web Store (free)
2. Free features work immediately (Contrast Fix, Formatter)
3. Premium features (Drag & Drop) are locked
4. Purchase license from your Gumroad page
5. Enter license key in extension popup
6. Premium features unlock

### For You:
1. User purchases on Gumroad
2. Gumroad generates unique license key
3. User enters key in extension
4. Extension calls Gumroad API to verify
5. If valid, premium features unlock
6. License stored in chrome.storage.sync (syncs across devices)

## Gumroad API

The extension uses Gumroad's License Verification API:

```
POST https://api.gumroad.com/v2/licenses/verify
```

Parameters:
- `product_id`: Your product's ID (recommended) OR
- `product_permalink`: Your product's permalink (alternative)
- `license_key`: User's license key

Response includes:
- `success`: true/false
- `purchase`: Object with purchaser info (email, date, etc.)

The extension is configured to use `product_id` by default for more reliable verification.

## Security Notes

- License keys are validated server-side by Gumroad
- Keys are stored in chrome.storage.sync (encrypted by Chrome)
- No sensitive data is stored in the extension
- API calls go directly to Gumroad (HTTPS)
- Product permalink is public (not sensitive)

## Adding More Premium Features

To gate additional features behind premium licensing:

1. Add premium badge to popup HTML:
```html
<h3>Feature Name <span class="premium-badge">⭐ PREMIUM</span></h3>
```

2. Check license before enabling:
```javascript
const hasLicense = await LicenseService.hasValidLicense();
if (hasLicense) {
  // Enable feature
}
```

3. Update content.js to check license:
```javascript
const hasLicense = await LicenseService.hasValidLicense();
if (!hasLicense) {
  return; // Don't initialize premium feature
}
```

## Testing

### Test with real license:
1. Create test product on Gumroad
2. Generate test license key
3. Enter in extension popup
4. Verify features unlock

### Test without license:
1. Don't enter license key
2. Verify premium features are locked
3. Verify error messages show correctly

## Support

If users have issues with licensing:
1. Check they're using the correct product permalink
2. Verify their license key is valid on Gumroad
3. Check console logs for API errors
4. Ensure they have internet connection (API calls need network)

## Future Enhancements

Consider adding:
- License expiration (for subscription model)
- Multiple license tiers (Basic, Pro, Enterprise)
- Grace period for expired subscriptions
- Offline license caching (with periodic revalidation)
- License transfer between accounts

## Revenue Model

With this setup:
- One-time payment: Lifetime access
- Monthly subscription: Check license validity periodically
- Both: User flexibility, steady revenue stream

You can manage all billing, renewals, and payments through Gumroad's dashboard.
