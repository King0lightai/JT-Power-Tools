# Web-Based Login & Onboarding Portal — Implementation Plan

## Goal
Replace the current multi-step extension-based onboarding (install extension → enter license key → enter grant key → create account) with a **web portal** where admins manage org keys once and team members just sign in. Move the MCP configuration tab from the extension popup to the web portal.

---

## Architecture Overview

```
BEFORE (Current):
  User installs extension → Opens popup → License tab (enter key) → API tab (enter grant key) → Creates account
  Each user does ALL steps individually

AFTER (Proposed):
  Admin: Goes to portal → Enters license key + grant key ONCE → Invites team
  Team:  Gets invite → Creates account on portal → Installs extension → Signs in → Done
  MCP:   Managed entirely on portal (removed from extension popup)
```

**Tech Stack for Portal:**
- Cloudflare Pages (static site hosting — free tier)
- Same Cloudflare Worker backend (already exists)
- Same D1 database (add org_admin role + invite tables)
- Vanilla HTML/CSS/JS (matches extension's approach, no framework needed)

---

## Phase 1: Backend — Org Admin & Invite System

### 1A. D1 Schema Changes

Add to existing database:

```sql
-- Add role column to users table
ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'member';
-- Values: 'admin' (org manager), 'member' (standard user)

-- Invite tokens for team onboarding
CREATE TABLE invites (
  id TEXT PRIMARY KEY,
  license_id TEXT NOT NULL,
  email TEXT,                    -- NULL = open invite link, non-NULL = email-specific
  token TEXT UNIQUE NOT NULL,    -- Random invite token
  created_by TEXT NOT NULL,      -- User ID of admin who created it
  created_at INTEGER NOT NULL,
  expires_at INTEGER,            -- NULL = never expires
  used_at INTEGER,               -- NULL = not yet used
  used_by TEXT,                  -- User ID who accepted
  FOREIGN KEY (license_id) REFERENCES licenses(id)
);

CREATE INDEX idx_invites_token ON invites(token);
CREATE INDEX idx_invites_license ON invites(license_id);
```

### 1B. New Worker API Endpoints

Add to the existing Cloudflare Worker (`jt-tools-license-proxy`):

```
# Admin endpoints (require admin role JWT)
POST   /admin/org                  — Get org details (license, grant key status, tier)
POST   /admin/team                 — List all users on this license
POST   /admin/update-grant-key     — Update org-level grant key
POST   /admin/create-invite        — Create invite link (open or email-specific)
POST   /admin/revoke-invite        — Revoke a pending invite
POST   /admin/remove-member        — Remove a team member
POST   /admin/promote-member       — Promote member to admin

# Invite endpoints (public, token-authenticated)
GET    /invite/:token              — Validate invite, return org name + tier info
POST   /invite/:token/accept       — Accept invite + register account in one step

# Updated auth endpoints
POST   /auth/register              — (UPDATED) Accept optional invite_token param
POST   /auth/login                 — (UPDATED) Return org-level grant key + license data
```

### 1C. Auto-Admin Assignment

When a user registers with a license key (no invite):
- If they're the **first user** on that license → role = `'admin'`
- If user's email matches the Gumroad `purchaseEmail` → role = `'admin'`
- Otherwise → role = `'member'`

When a user registers via invite:
- Always role = `'member'` (admin explicitly invited them)

---

## Phase 2: Web Portal — `app.jtpowertools.com`

### 2A. Portal Pages

The portal is a static site hosted on Cloudflare Pages. All pages talk to the same Worker API the extension already uses.

**Page Structure:**
```
portal/
├── index.html              — Landing / login page
├── register.html           — New account registration
├── invite.html             — Accept invite page (reads ?token= param)
├── forgot-password.html    — Password reset request
├── reset-password.html     — Set new password (reads ?token= param)
├── dashboard.html          — Main authenticated dashboard
├── mcp.html                — MCP setup page (moved from extension)
├── css/
│   └── portal.css          — Shared styles (reuse extension's design language)
├── js/
│   ├── api.js              — API client (fetch wrapper, JWT management)
│   ├── auth.js             — Login/logout/token refresh logic
│   ├── dashboard.js        — Dashboard page logic
│   ├── mcp.js              — MCP config generator (moved from popup.js)
│   └── invite.js           — Invite acceptance logic
└── assets/
    └── (icons, logo)
```

### 2B. Login Page (`index.html`)

Simple email + password form. Redirects to dashboard on success.
- JWT stored in localStorage (same pattern as extension uses Chrome storage)
- Auto-redirect to dashboard if valid token exists

### 2C. Register Page (`register.html`)

Two paths:
1. **With invite token** (`register.html?invite=abc123`):
   - Pre-fills org name, shows "You've been invited to [Org Name]"
   - User enters: email, password, display name
   - No license key or grant key needed

2. **Without invite** (admin creating first account):
   - User enters: license key, grant key (if Power User), email, password, display name
   - Becomes org admin automatically

### 2D. Dashboard Page (`dashboard.html`)

**For all users:**
- Account info (email, display name, tier)
- Extension install link (Chrome Web Store)
- Quick status: "Extension connected" / "Install extension to get started"
- Link to MCP setup page (Power Users only)
- Change password
- Sign out

**For admins (additional sections):**
- **Team Management**: List of all users on the license, their last login, role
- **Invite Team**: Generate invite link or send email invites
- **License Info**: Current tier, Gumroad license key (masked), expiration
- **Grant Key Management**: Current status, update grant key (Power Users)
- **Remove/promote members**

### 2E. MCP Page (`mcp.html`) — Moved from Extension

Port the entire MCP tab from `popup.html` to a standalone web page:
- Same platform tabs (Claude, ChatGPT, Gemini, Grok)
- Same variant sub-tabs (Claude Code, Claude Desktop, Claude Web)
- Same config generator with embedded credentials
- Same available tools list (39 read + 27 write)
- **Advantage**: More screen real estate, easier to copy configs, can bookmark it

The credentials (license key + grant key) come from the authenticated API session instead of Chrome storage.

---

## Phase 3: Extension Changes

### 3A. Simplified Popup Login

Replace the current License tab + API tab + Account section flow with a single streamlined login:

**New popup flow (not logged in):**
```
┌─────────────────────────────────────────┐
│            JT POWER TOOLS               │
├─────────────────────────────────────────┤
│                                         │
│  Sign in to activate your features.     │
│                                         │
│  Email:    [________________]           │
│  Password: [________________]           │
│                                         │
│           [Sign In]                     │
│                                         │
│  Don't have an account?                 │
│  Set up at app.jtpowertools.com         │
│                                         │
│  ─── or use without an account ───      │
│  [Enter License Key Manually]           │
│                                         │
└─────────────────────────────────────────┘
```

On successful sign-in:
1. Server returns: JWT + license tier + grant key (if Power User) + user data
2. Extension stores everything in Chrome storage (same as today)
3. Features unlock based on tier
4. Grant key auto-configures Pro Service
5. User sees the normal Features tab

### 3B. Remove MCP Tab from Extension Popup

- Remove the entire `tab-mcp` section from `popup.html`
- Remove MCP-related JS from `popup.js` (~500 lines)
- Add a link in the popup footer or API tab: "Set up MCP at app.jtpowertools.com/mcp"
- Keep the MCP docs pages in `docs/mcp/` as-is (they're standalone)

### 3C. Keep Legacy Mode

For users who don't want to create an account:
- Keep the manual license key entry as a fallback ("Enter License Key Manually")
- Keep the API tab for manual grant key entry
- This ensures backwards compatibility — no one is forced to migrate

### 3D. Updated Popup Tabs (after changes)

```
Tabs: Features | Theme | API | License
                                  ↑
                        Now shows: Sign In / Account info
                        (merged License + Account into one clean tab)
```

Or even simpler — 3 tabs:
```
Tabs: Features | Theme | Account
                          ↑
              Sign in, license status, grant key status
              "Manage at app.jtpowertools.com" link
```

### 3E. Extension ↔ Portal Connection Detection

After signing in on the portal, the extension should detect the session:
- Option A: User manually signs in on extension too (simplest)
- Option B: Portal sets a cookie/storage value that extension can read via content script on `app.jtpowertools.com` (more seamless but more complex)

**Recommendation: Option A for MVP.** User signs in once on portal (to set up) and once in extension popup (to activate). Same credentials, takes 5 seconds.

---

## Phase 4: Migration for Existing Users

### 4A. Existing Users WITH Accounts
- **Zero migration needed.** Same database, same credentials.
- They can log into the portal with their existing email/password.
- First user per license auto-promoted to admin.

### 4B. Existing Users WITHOUT Accounts (keys only)
- Extension continues to work as-is (legacy mode).
- Gentle prompt: "Your admin has set up a team portal. Create your account to sync across devices."
- They can create an account on the portal using their existing license key.

### 4C. Admin Promotion Logic
For each license in the database:
1. If a user's email matches the Gumroad `purchaseEmail` → promote to admin
2. If no match, the first registered user on that license → promote to admin
3. Run this as a one-time migration script on the D1 database

---

## Implementation Order

### Sprint 1: Backend (Worker changes)
1. Add `role` column to users table
2. Add invites table
3. Implement admin endpoints (`/admin/org`, `/admin/team`, `/admin/create-invite`)
4. Implement invite endpoints (`/invite/:token`, `/invite/:token/accept`)
5. Update `/auth/register` to accept invite tokens
6. Update `/auth/login` to return org-level data
7. Auto-admin assignment logic
8. Run migration to promote existing first-users to admin

### Sprint 2: Web Portal (core pages)
1. Login page
2. Register page (with and without invite)
3. Dashboard page (user view)
4. Admin dashboard (team management, invites)
5. Forgot/reset password pages
6. Basic CSS styling (reuse extension design language)

### Sprint 3: MCP Migration
1. Port MCP config generator to `mcp.html` on portal
2. Port platform tabs, variant tabs, and config generation JS
3. Wire up credential fetching from authenticated API (instead of Chrome storage)
4. Add "Set up MCP" link from extension popup to portal
5. Remove MCP tab from extension popup

### Sprint 4: Extension Simplification
1. Add "Sign In" as primary action in popup (before feature toggles)
2. Auto-pull license + grant key from server on sign-in
3. Keep manual key entry as fallback
4. Simplify tab structure (Features | Theme | Account)
5. Add portal links throughout popup

### Sprint 5: Polish & Migration
1. Existing user admin promotion migration script
2. Invite email templates (if doing email invites)
3. Portal responsive design
4. Extension update prompt for existing users
5. Documentation updates

---

## What This Achieves

**Before (current onboarding for a 20-person org):**
- Admin buys license on Gumroad
- Admin gets grant key from JobTread
- Admin sends license key + grant key to 20 people via email/Slack
- Each person: installs extension → enters license key → enters grant key → optionally creates account
- **~5 min per person, high error rate, lots of support questions**

**After (new onboarding):**
- Admin buys license on Gumroad
- Admin goes to portal → enters license key + grant key ONCE → gets invite link
- Admin shares invite link with team
- Each person: clicks link → creates account (email + password) → installs extension → signs in
- **~1 min per person, no keys to copy, no errors**

**MCP setup (moved to portal):**
- Full-screen experience instead of cramped popup tab
- Easier to copy configs with more screen space
- Bookmarkable URL for team reference
- Can be shared as a link: "go to app.jtpowertools.com/mcp to set up AI"
