# Chrome Web Store Submission Guide

## Required Information for Submission

### 1. Basic Information

**Extension Name:**
JT Power Tools

**Short Description (132 characters max):**
Powerful productivity tools for JobTread: Drag & Drop scheduling, Dark Mode, Budget Formatter, and enhanced text contrast.

**Category:**
Productivity

**Language:**
English (United States)

---

### 2. Detailed Description
(See CHROME_WEB_STORE_LISTING.md for full description)

---

### 3. Privacy Policy

**Privacy Policy URL:**
Host the PRIVACY_POLICY.md file on:
- Option 1: GitHub Pages (recommended)
  - Create `docs` folder in your repo
  - Add PRIVACY_POLICY.md to docs
  - Enable GitHub Pages in repo settings
  - URL: https://king0lightai.github.io/JT-Tools/PRIVACY_POLICY.html

- Option 2: Your own website
- Option 3: Paste into Chrome Web Store directly

**Single Purpose Description (Required):**
"JT Power Tools enhances JobTread with productivity features including drag-and-drop scheduling, dark mode, budget text formatting, and improved text contrast for construction project management."

**Permission Justifications:**

**storage:**
"Required to save user preferences (feature toggles, dark mode setting, premium license key) locally in the browser. Data is stored using Chrome's sync storage and syncs across the user's devices."

**activeTab:**
"Required to apply formatting, styling, and dark mode to JobTread pages when users activate features. Only accesses the active tab when users are on JobTread."

**Host Permission - https://*.jobtread.com/***
"Required to inject feature functionality (drag-drop, formatting, dark mode, contrast fix) into JobTread pages. Extension only works on JobTread domains and requires this access to modify page behavior."

**Host Permission - https://api.gumroad.com/***
"Required to verify premium license keys with Gumroad's licensing API. Only used when users purchase and activate premium features. No personal data is sent, only the license key for verification."

---

### 4. Store Listing Assets

**Icon Sizes Required:**
- 128x128 pixels (main icon)
- 48x48 pixels (small icon)
- 16x16 pixels (tiny icon)

**Screenshots (Required - at least 1):**
- Size: 1280x800 or 640x400 pixels
- Format: PNG or JPEG
- Recommended: 3-5 screenshots showing:
  1. Popup interface with feature toggles
  2. Drag & Drop in action (month view)
  3. Budget Formatter toolbar
  4. Dark mode comparison (before/after)
  5. Premium license activation

**Promotional Images (Optional but Recommended):**
- Small Promo Tile: 440x280 pixels
- Large Promo Tile: 920x680 pixels
- Marquee Promo: 1400x560 pixels

---

### 5. Distribution Settings

**Visibility:**
- Public (recommended for community access)
- Or Unlisted (only accessible via direct link)

**Regions:**
- All regions (or select specific countries)

**Pricing:**
- Free (premium features via external Gumroad license)

---

### 6. Additional Requirements

**Content Rating:**
- Everyone (suitable for all ages)
- Business/Productivity tool

**Monetization:**
- Uses external payment processor (Gumroad) for premium features
- Must disclose this in listing

**Website:**
https://github.com/King0lightai/JT-Tools

**Support Email:**
Your contact email for user support

**Support URL (optional):**
https://github.com/King0lightai/JT-Tools/issues

---

### 7. Review Preparation

**Test Account Information:**
If Google requests test credentials to review premium features:
- Provide a valid Gumroad license key for testing
- Or explain that premium features can be tested without license (drag-drop will just be disabled)

**Demo Video (Optional but Helpful):**
- Screen recording showing all features in action
- 30-60 seconds
- Upload to YouTube as unlisted
- Include link in submission notes

---

### 8. Important Disclosures

**In Store Listing, Add:**

"IMPORTANT NOTES:
- Premium features (Schedule Drag & Drop) require a separate license purchase via Gumroad
- All other features are completely free
- Extension is not officially affiliated with JobTread
- Works only on JobTread websites (*.jobtread.com)
- No data collection - your information stays private"

---

### 9. Submission Checklist

Before submitting, verify:

- [ ] Extension tested on clean Chrome install
- [ ] All features work as described
- [ ] Privacy policy is accessible via public URL
- [ ] Screenshots clearly show features
- [ ] Icon files are proper dimensions
- [ ] Description is clear and accurate
- [ ] Permissions are justified
- [ ] Store listing mentions it's not officially affiliated with JobTread
- [ ] Premium features are clearly marked as requiring separate purchase
- [ ] Version number matches manifest.json (1.0.0)
- [ ] Extension package (.zip) is under 100MB
- [ ] No minified or obfuscated code (except React from JobTread)

---

### 10. Package Preparation

**Files to Include in ZIP:**
```
JT-Tools-Master/
├── manifest.json
├── background/
│   └── service-worker.js
├── content.js
├── features/
│   ├── drag-drop.js
│   ├── contrast-fix.js
│   ├── formatter.js
│   └── dark-mode.js
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── services/
│   └── license.js
├── styles/
│   ├── formatter-toolbar.css
│   └── dark-mode.css
└── icons/ (if you create icons)
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

**Files to EXCLUDE:**
- .git/
- .gitignore
- node_modules/
- README.md (or make it user-friendly)
- Development files
- CLAUDE_SESSIONS.md or other internal docs

**Create Package:**
```bash
cd JT-Tools-Master
zip -r ../jt-power-tools-v1.0.0.zip . -x "*.git*" -x "*.DS_Store" -x "*node_modules*"
```

---

### 11. Post-Submission

**After Approval:**
1. Update GitHub README with Chrome Web Store link
2. Add badge: `[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/YOUR_EXTENSION_ID)](https://chrome.google.com/webstore/detail/YOUR_EXTENSION_ID)`
3. Update Gumroad product page with installation link
4. Monitor reviews and respond promptly
5. Track issues on GitHub

**Expected Review Time:**
- Typically 1-3 business days
- Can be longer for first submission
- May require revisions

---

### 12. Common Rejection Reasons (Avoid These)

❌ **Insufficient Privacy Policy** - Must be comprehensive and accessible
❌ **Overly Broad Permissions** - Ours are justified
❌ **Misleading Description** - Be honest about features
❌ **Missing Single Purpose Statement** - Include clear purpose
❌ **Trademark Issues** - We clearly state "not affiliated"
❌ **Code Obfuscation** - Our code is readable
❌ **Malicious Code** - Our code is clean

✅ **We're Good On All These!**

---

### 13. Helpful Links

- Chrome Web Store Developer Dashboard: https://chrome.google.com/webstore/devconsole
- Chrome Web Store Policies: https://developer.chrome.com/docs/webstore/program-policies/
- Extension Quality Guidelines: https://developer.chrome.com/docs/extensions/mv3/quality_guidelines/
- Developer Program Policies: https://developer.chrome.com/docs/webstore/program_policies/

---

## Final Tips

1. **Be Honest**: Clearly state what the extension does
2. **Show, Don't Tell**: Use good screenshots
3. **Privacy First**: Emphasize no data collection
4. **Professional**: Use clean, professional language
5. **Responsive**: Respond quickly to any Google requests
6. **Patient**: First review can take time
7. **Updates**: Keep extension updated and maintained

---

Good luck with your submission! 🚀
