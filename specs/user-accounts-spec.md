# User Accounts — Feature Specification

**Version:** 1.0 Draft
**Tier:** All Tiers (Foundation)
**Status:** Planning
**Dependencies:** Cloudflare D1, Cloudflare Workers

---

## Overview

User Accounts introduces a proper authentication system where users create personal accounts (username/password) that store their license key, grant key, and personal data. This eliminates the need to re-enter keys on every browser and enables cross-browser sync of settings, notes, and templates.

---

## Problem Statement

1. **Key entry fatigue** — Users must enter license_key and grant_key on every new browser/device
2. **No cross-browser sync** — Chrome, Edge, Firefox all have separate isolated storage
3. **No user identity** — Can't distinguish individual users in an org (especially when grant keys are shared)
4. **Settings don't roam** — Templates, notes, preferences are locked to one browser
5. **License management is blind** — Admins can't see who's using their license

---

## Solution

A user account system where:
- Users create an account (username + password) after initial license/grant key setup
- Account stores their credentials server-side
- Subsequent logins only require username/password
- All personal data syncs via the account
- License expiry is enforced centrally for all sub-accounts

---

## User Stories

### New User (First Time Setup)
- As a new user, I want to set up the extension with my license key
- As a new Power User, I want to add my grant key for API features
- As a new user, I want to create an account so I don't have to enter keys again
- As a new user, I want to choose a display name for Team Notes attribution

### Existing User (Already Has Keys in Browser)
- As an existing user, I want to create an account using my already-saved license key
- As an existing user, I don't want to re-enter keys I've already configured
- As an existing user, I want my current notes/templates migrated to my account

### Returning User (Has Account, New Browser)
- As a returning user, I want to sign in with just my username and password
- As a returning user, I want my settings and notes to be there automatically
- As a returning user, I want to use any browser without re-entering license keys

### License Admin
- As an admin, I want to see all users on my license
- As an admin, I want to know the license status applies to all my team
- As an admin, I want users to lose access when the license expires

---

## Feature Requirements

### P0 — Must Have (MVP)

| Feature | Description |
|---------|-------------|
| Account creation | Username (email) + password after key verification |
| Secure login | Username + password returns stored credentials |
| Credential storage | License key + grant key stored encrypted server-side |
| License validation | Check license status on every login |
| Sub-account model | Users are linked to a parent license |
| Password hashing | bcrypt or argon2 for password storage |

### P1 — Should Have

| Feature | Description |
|---------|-------------|
| Personal data sync | Notes, templates, settings sync to account |
| Display name | Stored with account, used for Team Notes |
| Last login tracking | Track when users last accessed |
| Session management | JWT tokens with refresh |

### P2 — Nice to Have

| Feature | Description |
|---------|-------------|
| Password reset | Email-based reset flow |
| Admin dashboard | License owner sees all users |
| Device list | User sees their logged-in devices |
| Force logout | Admin can revoke user sessions |
| Account deletion | User can delete their account |

---

## Technical Architecture

### Data Model

```sql
-- Cloudflare D1 Tables

-- Licenses (upgraded from current model)
CREATE TABLE licenses (
  id TEXT PRIMARY KEY,
  license_key TEXT UNIQUE NOT NULL,
  org_id TEXT NOT NULL,              -- JobTread organization ID
  tier TEXT NOT NULL,                -- 'essential', 'pro', 'power_user'
  status TEXT DEFAULT 'active',      -- 'active', 'expired', 'revoked'
  expires_at INTEGER,
  created_at INTEGER,
  updated_at INTEGER
);

-- User accounts (sub-accounts under a license)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  license_id TEXT NOT NULL,          -- FK to licenses
  username TEXT UNIQUE NOT NULL,     -- email address
  password_hash TEXT NOT NULL,       -- bcrypt/argon2
  grant_key_encrypted TEXT,          -- AES-256 encrypted (NULL for non-Power Users)
  display_name TEXT,                 -- for Team Notes attribution
  created_at INTEGER,
  last_login_at INTEGER,
  FOREIGN KEY (license_id) REFERENCES licenses(id)
);

-- Note: grant_key_encrypted is only required for Power User tier.
-- Essential and Pro users don't need a grant key since they don't use API features.

-- User sessions (for JWT refresh tokens)
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  refresh_token_hash TEXT NOT NULL,
  device_info TEXT,                  -- browser/OS info
  created_at INTEGER,
  expires_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Personal synced data
CREATE TABLE user_notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  updated_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE user_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  sort_order INTEGER,
  created_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE user_settings (
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  PRIMARY KEY (user_id, key),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_users_license ON users(license_id);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_sessions_user ON sessions(user_id);
```

### API Endpoints (Cloudflare Worker)

```
Authentication:
POST   /auth/setup              — Verify license + grant, prepare for account creation
POST   /auth/register           — Create account (username, password, display_name)
POST   /auth/login              — Login, returns JWT + user data + grant_key
POST   /auth/refresh            — Refresh access token
POST   /auth/logout             — Invalidate session
POST   /auth/change-password    — Update password (P2)
POST   /auth/reset-password     — Request password reset (P2)

User Data Sync:
GET    /sync/notes              — Get personal notes
POST   /sync/notes              — Save personal notes
GET    /sync/templates          — Get personal templates
POST   /sync/templates          — Save personal templates
GET    /sync/settings           — Get synced settings
POST   /sync/settings           — Save synced settings

Admin (P2):
GET    /admin/users             — List all users on license
POST   /admin/revoke-user       — Revoke a user's access
```

### Authentication Flow

**New User Setup (Power User with grant key):**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Extension  │     │   Worker    │     │  JobTread   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ POST /auth/setup  │                   │
       │ {license_key,     │                   │
       │  grant_key}       │  ← grant_key optional (Power User only)
       │──────────────────►│                   │
       │                   │                   │
       │                   │ Validate license  │
       │                   │ (Gumroad)         │
       │                   │                   │
       │                   │ If Power User:    │
       │                   │ Test grant_key    │
       │                   │──────────────────►│
       │                   │◄──────────────────│
       │                   │ {org_id, user_id} │
       │                   │                   │
       │◄──────────────────│                   │
       │ {valid: true,     │                   │
       │  org_id, tier,    │                   │
       │  setup_token}     │                   │
       │                   │                   │
       │ POST /auth/register                   │
       │ {setup_token,     │                   │
       │  username,        │                   │
       │  password,        │                   │
       │  display_name}    │                   │
       │──────────────────►│                   │
       │                   │                   │
       │                   │ Create user       │
       │                   │ Hash password     │
       │                   │ Encrypt grant_key │
       │                   │ Link to license   │
       │                   │                   │
       │◄──────────────────│                   │
       │ {access_token,    │                   │
       │  refresh_token,   │                   │
       │  user}            │                   │
       │                   │                   │
```

**Existing User Setup (Keys already in browser storage):**

```
┌─────────────┐     ┌─────────────┐
│  Extension  │     │   Worker    │
└──────┬──────┘     └──────┬──────┘
       │                   │
       │ Read from chrome.storage:
       │ - license_key ✓
       │ - grant_key ✓ (if Power User)
       │                   │
       │ POST /auth/setup  │
       │ {license_key,     │  ← pulled from existing storage
       │  grant_key}       │
       │──────────────────►│
       │                   │
       │                   │ Validate (same as above)
       │                   │
       │◄──────────────────│
       │ {valid: true,     │
       │  setup_token}     │
       │                   │
       │ POST /auth/register
       │ (user only enters email, password, display_name)
       │──────────────────►│
       │                   │
       │◄──────────────────│
       │ {success}         │
       │                   │
       │ Optionally migrate existing notes/templates
       │                   │
```

**Returning User Login:**

```
┌─────────────┐     ┌─────────────┐
│  Extension  │     │   Worker    │
└──────┬──────┘     └──────┬──────┘
       │                   │
       │ POST /auth/login  │
       │ {username,        │
       │  password}        │
       │──────────────────►│
       │                   │
       │                   │ Verify password
       │                   │ Check license.status
       │                   │ Check license.expires_at
       │                   │ Decrypt grant_key
       │                   │
       │◄──────────────────│
       │ {access_token,    │
       │  refresh_token,   │
       │  grant_key,       │
       │  license: {       │
       │    tier,          │
       │    status         │
       │  },               │
       │  user: {          │
       │    display_name   │
       │  }}               │
       │                   │
```

### Security Model

| Concern | Implementation |
|---------|----------------|
| Password storage | Argon2id hash (preferred) or bcrypt |
| Grant key storage | AES-256-GCM encryption, key from env secret |
| Access tokens | JWT, 15 min expiry, signed with secret |
| Refresh tokens | Opaque token, 30 day expiry, stored hashed in DB |
| HTTPS | All endpoints over TLS (Cloudflare provides) |
| Rate limiting | 5 login attempts per minute per IP |

### Token Structure

```javascript
// Access Token (JWT)
{
  "sub": "user_id",
  "lic": "license_id",
  "org": "org_id",
  "tier": "power_user",
  "exp": 1234567890,
  "iat": 1234567890
}

// Stored in extension
{
  accessToken: "eyJ...",
  refreshToken: "abc123...",
  grantKey: "decrypted_grant_key",
  user: {
    id: "user_id",
    username: "mike@titus.com",
    displayName: "Mike"
  },
  license: {
    tier: "power_user",
    status: "active"
  }
}
```

---

## UI/UX Design

### First Launch (No Account)

```
┌─────────────────────────────────────────────────────┐
│               JT POWER TOOLS                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Welcome! Let's get you set up.                     │
│                                                     │
│  ○ I already have an account                        │
│                          [Sign In]                  │
│                                                     │
│  ○ I'm new / setting up a new device               │
│                          [Get Started]              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Setup Flow — Step 1: License

**New users** enter their license key. **Existing users** who already have a license key saved in browser storage skip this step — we use their existing key.

```
┌─────────────────────────────────────────────────────┐
│ STEP 1 — License Key                                │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Enter your license key:                            │
│  ┌─────────────────────────────────────────────┐   │
│  │                                             │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Don't have a license? [Get one here]               │
│                                                     │
│                              [Verify & Continue]    │
└─────────────────────────────────────────────────────┘
```

**For existing users with saved license key:**

```
┌─────────────────────────────────────────────────────┐
│ CREATE YOUR ACCOUNT                                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ✓ License found: Power User Tier                   │
│  ✓ Organization: Titus Contracting Inc              │
│                                                     │
│  We found your existing license. Let's create       │
│  your account to sync across devices.               │
│                                                     │
│                              [Continue]             │
└─────────────────────────────────────────────────────┘
```

### Setup Flow — Step 2: Grant Key (Power User Only)

**This step only appears for Power User tier.** Essential and Pro tiers skip directly to account creation since they don't use API features.

**Existing Power Users** who already have a grant key saved skip this step — we use their existing key.

```
┌─────────────────────────────────────────────────────┐
│ STEP 2 — JobTread Connection (Power User)           │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ✓ License verified: Power User Tier                │
│                                                     │
│  Power User features require a JobTread Grant Key   │
│  for API access.                                    │
│                                                     │
│  Enter your JobTread Grant Key:                     │
│  ┌─────────────────────────────────────────────┐   │
│  │                                             │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  [How do I find my grant key?]                      │
│                                                     │
│                              [Verify & Continue]    │
└─────────────────────────────────────────────────────┘
```

**For existing Power Users with saved grant key:**

```
┌─────────────────────────────────────────────────────┐
│ JOBTHREAD CONNECTION                                │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ✓ License verified: Power User Tier                │
│  ✓ Grant key found and valid                        │
│                                                     │
│  Your existing JobTread connection will be          │
│  saved to your account.                             │
│                                                     │
│                              [Continue]             │
└─────────────────────────────────────────────────────┘
```

### Setup Flow — Step 3: Create Account

```
┌─────────────────────────────────────────────────────┐
│ CREATE YOUR ACCOUNT                                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ✓ License verified: Power User Tier                │
│  ✓ Connected to: Titus Contracting Inc              │
│                                                     │
│  Email:                                             │
│  ┌─────────────────────────────────────────────┐   │
│  │ mike@titus.com                              │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Password:                                          │
│  ┌─────────────────────────────────────────────┐   │
│  │ ••••••••••                                  │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Display Name (shown on Team Notes):                │
│  ┌─────────────────────────────────────────────┐   │
│  │ Mike                                        │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│                              [Create Account]       │
└─────────────────────────────────────────────────────┘
```

### Sign In (Returning User)

```
┌─────────────────────────────────────────────────────┐
│                    SIGN IN                          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Email:                                             │
│  ┌─────────────────────────────────────────────┐   │
│  │                                             │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Password:                                          │
│  ┌─────────────────────────────────────────────┐   │
│  │                                             │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  [Forgot password?]                                 │
│                                                     │
│                              [Sign In]              │
│                                                     │
│  Need to set up a new device? [Get Started]         │
└─────────────────────────────────────────────────────┘
```

### Settings Panel — Account Section

```
┌─────────────────────────────────────────────────────┐
│ ACCOUNT                                             │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Signed in as: mike@titus.com                       │
│  Display name: Mike                                 │
│  License: Pro Tier (Active)                         │
│  Organization: Titus Contracting Inc                │
│                                                     │
│  [Change Password]  [Sign Out]                      │
│                                                     │
│  Last synced: 2 minutes ago    [Sync Now]           │
└─────────────────────────────────────────────────────┘
```

### License Expired State

```
┌─────────────────────────────────────────────────────┐
│               ⚠️ LICENSE EXPIRED                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Your team's Power Tools license has expired.       │
│                                                     │
│  Contact your administrator to renew.               │
│                                                     │
│  License holder: admin@titus.com                    │
│                                                     │
│  [Try Again]  [Use Free Features Only]              │
└─────────────────────────────────────────────────────┘
```

---

## Migration Path

### For Existing Users (Already Have Keys Saved)

1. User opens extension after update
2. Extension detects existing `license_key` (and `grant_key` if Power User) in browser storage
3. Prompt: "We've added accounts! Create one to sync your notes across devices."
4. User clicks "Create Account"
5. **Keys are NOT re-entered** — extension uses existing saved keys
6. User only needs to enter: email, password, display name
7. Account is created with their existing credentials

**Flow:**
```
Existing keys in browser storage
         ↓
"Create Account" prompt
         ↓
User enters: email, password, display name (NOT keys)
         ↓
Account created with existing keys
         ↓
Migrate notes/templates to account
```

### Options for Existing Users

- **"Create Account"** → Uses existing keys, creates account, migrates data
- **"Not Now"** → Continue with local storage (legacy mode), remind later
- Legacy mode continues working indefinitely but shows gentle periodic reminder

### Data Migration

When account is created:
- Existing Quick Notes → Prompt: "Upload your notes to sync everywhere?"
- Existing Templates → Prompt: "Upload your templates to sync everywhere?"
- Existing settings → Auto-migrate on account creation
- User can choose to keep local-only or sync to account

---

## Relationship to Other Features

### Team Notes
- User account provides the identity layer
- `user.display_name` used for note attribution
- Personal notes sync via `user_notes` table
- Team notes use `user.license_id` → `org_id` for scoping

### Schedule Assistant
- Uses account's stored `grant_key` for API calls
- No additional auth needed

### Cross-Browser Sync
- Fully solved: login on any browser → pull credentials + data
- No more browser storage dependency for critical data

### Team Hub (Base44 App)
- Can show all users on a license
- Admin features built on this foundation

---

## Rollout Plan

### Phase 1: Core Auth
- Account creation flow
- Login/logout
- Credential storage
- License validation on login

### Phase 2: Data Sync
- Personal notes sync
- Templates sync
- Settings sync (optional)

### Phase 3: Admin Features
- License owner sees users
- Revoke access
- Password reset via email

---

## Success Metrics

- Adoption: % of users who create accounts
- Retention: Do users with accounts have lower churn?
- Cross-browser: Users logging in from multiple browsers
- Sync usage: % of users with synced notes/templates

---

## Open Questions

1. What happens if a user is on two different org licenses? (edge case)
2. Should we allow username change?
3. How do we handle email verification? (P2)
4. Should display name be unique within an org?
5. How long should refresh tokens last?

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Users forget password | Password reset flow (P2), or "contact admin" |
| Grant key rotation | User can update in account settings |
| License transfer | Admin flow to move license to new org |
| Security breach | Encrypted storage, hashed passwords, short-lived tokens |
| Migration friction | Gentle prompts, legacy mode continues working |

