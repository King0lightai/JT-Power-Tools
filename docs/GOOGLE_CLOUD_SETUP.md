# Google Cloud Setup for Google Docs Integration

**Time Required:** 15 minutes

This guide walks you through setting up Google Cloud OAuth credentials for the Google Docs integration feature.

---

## Prerequisites

- Google account (any Gmail account works)
- JT Power Tools extension ID from Chrome Web Store

---

## Step-by-Step Instructions

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Sign in with your Google account
3. Click the project dropdown at the top (next to "Google Cloud")
4. Click **"New Project"**
5. Enter project details:
   - **Project name:** `JT Power Tools`
   - **Organization:** Leave as default (No organization)
   - **Location:** Leave as default
6. Click **"Create"**
7. Wait for project creation (takes ~30 seconds)
8. Select your new project from the dropdown

---

### Step 2: Enable Google Drive API

1. In your project, click the hamburger menu (☰) → **"APIs & Services"** → **"Library"**
2. In the search box, type: `Google Drive API`
3. Click on **"Google Drive API"** from the results
4. Click the blue **"Enable"** button
5. Wait for it to enable (~10 seconds)

---

### Step 3: Configure OAuth Consent Screen

1. Go to **"APIs & Services"** → **"OAuth consent screen"** (left sidebar)
2. Select **"External"** (unless you have a Google Workspace)
3. Click **"Create"**
4. Fill in the App information:
   - **App name:** `JT Power Tools`
   - **User support email:** Your email address
   - **App logo:** (Optional - can skip)
   - **Application home page:** `https://github.com/King0lightai/JT-Power-Tools`
   - **Application privacy policy:** `https://github.com/King0lightai/JT-Power-Tools/blob/main/chrome-web-store/PRIVACY_POLICY.md`
   - **Application terms of service:** (Optional - can skip)
   - **Authorized domains:** `jobtread.com`
   - **Developer contact email:** Your email address
5. Click **"Save and Continue"**
6. **Scopes:** Click **"Add or Remove Scopes"**
   - Search for: `drive.file`
   - Check the box for: `https://www.googleapis.com/auth/drive.file`
   - Click **"Update"** at the bottom
   - Click **"Save and Continue"**
7. **Test users:** Click **"Add Users"**
   - Add your email address (for testing)
   - Add any other test users if needed
   - Click **"Add"**
   - Click **"Save and Continue"**
8. Review the summary
9. Click **"Back to Dashboard"**

---

### Step 4: Create OAuth Client ID

1. Go to **"APIs & Services"** → **"Credentials"** (left sidebar)
2. Click **"Create Credentials"** (top button) → **"OAuth client ID"**
3. If prompted to configure consent screen, you already did (Step 3)
4. Configure OAuth client:
   - **Application type:** Select **"Chrome extension"** from the dropdown
   - **Name:** `JT Power Tools Extension`
   - **Item ID:** Your Chrome Web Store extension ID
     - This is the ID from your Chrome Web Store URL
     - Format: `kfbcifdgmcendohejbiiojjkgdbjkpcn`
     - Found in: `https://chromewebstore.google.com/detail/jt-power-tools/YOUR_ID_HERE`
5. Click **"Create"**
6. A popup appears with your credentials

---

### Step 5: Copy Your Client ID

**Important:** You'll see a popup with your OAuth client details.

```
Your Client ID
123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com

Your Client Secret
GOCSPX-AbCdEfGhIjKlMnOpQrStUvWxYz
```

**Copy the Client ID** (the long string ending in `.apps.googleusercontent.com`)

**Note:** You don't need the Client Secret for Chrome extensions - only the Client ID.

Click **"OK"** to close the popup.

---

### Step 6: Update Extension Manifest

1. Open your extension's `manifest.json` file
2. Find the `oauth2` section (around line 52)
3. Replace `YOUR_CLIENT_ID` with your actual Client ID:

**Before:**
```json
"oauth2": {
  "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
  "scopes": [
    "https://www.googleapis.com/auth/drive.file"
  ]
}
```

**After:**
```json
"oauth2": {
  "client_id": "123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com",
  "scopes": [
    "https://www.googleapis.com/auth/drive.file"
  ]
}
```

4. Save the file
5. Reload the extension in `chrome://extensions`

---

## Step 7: Test Authentication

1. Navigate to a job in JobTread: `app.jobtread.com/jobs/[job-id]`
2. Go to the Files tab
3. Upload a test Excel or Word file (if needed)
4. Click the **"✏️ Edit in Google Sheets"** or **"Edit in Google Docs"** button
5. You should see a Google sign-in popup
6. Sign in and grant permissions
7. The file should open in Google Docs/Sheets

**If you see an error:**
- Check that Client ID is correct in manifest.json
- Make sure you enabled Google Drive API
- Verify you're using the published extension ID
- Check browser console for error messages

---

## Important Notes

### About the `drive.file` Scope

This is a **restricted scope** that only allows the extension to:
- ✅ Access files that IT creates
- ✅ Create new files in user's Google Drive
- ✅ Update files it created
- ✅ Delete files it created

It **CANNOT:**
- ❌ See user's existing Google Drive files
- ❌ Access files created by other apps
- ❌ Browse user's Google Drive

**This is the most secure option and exactly what we need.**

### Publishing Your Extension

When you're ready to publish to Chrome Web Store:

1. The OAuth consent screen will need to be **verified by Google** for production use
2. For now, it's in "Testing" mode (up to 100 test users)
3. To publish publicly:
   - Submit your app for verification in Google Cloud Console
   - Google will review (takes 3-5 days typically)
   - Once approved, remove from "Testing" status

**For development and testing, "Testing" mode is fine!**

### Quota Limits (Free Tier)

Google Drive API free tier includes:
- **1 billion queries per day** (you won't hit this)
- **1,000 queries per 100 seconds per user**

This is more than enough for normal usage. Even with 1,000 users, you won't hit limits.

---

## Troubleshooting

### "Error 401: Invalid Client"
- Check that Client ID in manifest.json matches Google Cloud Console
- Make sure you're using the Chrome Extension Item ID, not a random ID

### "Error: redirect_uri_mismatch"
- Make sure Application type is "Chrome extension"
- Verify Item ID matches your published extension

### "Access blocked: This app's request is invalid"
- OAuth consent screen not configured
- Go back to Step 3

### "This app is blocked"
- Your app is in "Testing" mode but you're not a test user
- Go to OAuth consent screen → Test users → Add your email

### Can't find Google Drive API in library
- Make sure you've selected the correct project (top dropdown)
- Try refreshing the page

---

## What You'll Have After Setup

✅ Google Cloud project created
✅ Google Drive API enabled
✅ OAuth consent screen configured
✅ OAuth Client ID created
✅ Extension manifest updated with Client ID
✅ Ready to test authentication!

---

## Next Steps

Once setup is complete:
1. Test the authentication flow
2. Try editing a file in Google Docs
3. Save it back to JobTread
4. Verify the updated file appears

---

## Need Help?

If you encounter issues:
1. Check the browser console for errors (F12)
2. Check extension background page logs (`chrome://extensions` → Details → Inspect views: background page)
3. Verify all steps were followed exactly
4. Try creating a new OAuth client ID if needed

---

## Security Notes

- **Never commit your Client ID to a public repository** if it's a private extension
- For public extensions (Chrome Web Store), the Client ID can be public
- The Client Secret is NOT used for Chrome extensions
- Users authenticate with their own Google accounts
- You (the developer) cannot access user data

---

**That's it! You're ready to use Google Docs integration.** 🎉
