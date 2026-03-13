# Security Review: Popup MCP Tab & MCP Server Authentication

**Date:** 2026-03-13
**Scope:** Popup credential handling, MCP server auth, OAuth flow, grant key identity
**Severity Scale:** CRITICAL / HIGH / MEDIUM / LOW / INFO

---

## Executive Summary

The popup's MCP tab and credential handling are **functional but have several security gaps** that should be addressed before wider rollout. The most important issues are: (1) grant keys stored in plaintext in Chrome local storage, (2) credentials logged to console during debugging, (3) no MFA/second-factor for MCP access, and (4) credentials embedded in plaintext configs that users paste into third-party tools.

The "AI Assistant" identity recommendation (line 998 of popup.html) is already present as a warning notice, which is good. Below are all findings with recommended fixes.

---

## FINDINGS

### 1. [HIGH] Grant Key Stored in Plaintext in Chrome Local Storage

**File:** `services/jobtread-pro-service.js:241`
**Issue:** The grant key is stored as raw plaintext in `chrome.storage.local` under key `jtpro_grant_key`. Unlike the license key (which uses XOR obfuscation in `license.js:72`), the grant key has zero obfuscation.

**Risk:** Any extension with `storage` permission, any malicious content script, or anyone inspecting DevTools can read the grant key directly. Combined with the license key, this gives full MCP API access.

**Recommendation:** Apply the same XOR obfuscation used for license data (at minimum), or better, use the `chrome.storage.session` API for ephemeral storage during active sessions. The real fix comes with the User Accounts system using server-side AES-256-GCM encryption.

---

### 2. [HIGH] Credentials Logged to Console in Production

**File:** `services/jobtread-pro-service.js:98, 106, 115-119`
**Issue:** `workerRequest()` logs debug info including license key presence, device ID presence, and grant key presence. While the values aren't logged directly, the `console.log` calls provide confirmation signals for attackers and the `requestBody` object (containing the actual key) is constructed in scope.

**File:** `services/account-service.js:56, 116, 148, 178`
**Issue:** Login/register results are logged. If an error object contains token data, it leaks.

**Recommendation:** Remove or gate all `console.log`/`console.error` calls behind a `DEBUG` flag that is `false` in production builds. Consider a build step that strips console calls.

---

### 3. [HIGH] Bearer Token Format Exposes Both Credentials

**File:** `popup/popup.js:1664, 2109, 2121`
**Issue:** The auth token format is `Bearer ${licenseKey}:${grantKey}` — both credentials concatenated with a colon. This means:
- Both keys travel in every HTTP request header
- If a config JSON is accidentally shared (screenshot, git commit, paste), both keys leak simultaneously
- No ability to rotate one without the other from the client side

**Recommendation:**
- Short-term: Generate a single opaque session token server-side from the license+grant key pair, so raw keys never leave the extension after initial auth.
- Long-term: Move to the planned JWT-based auth from the User Accounts spec, where the server issues a short-lived access token.

---

### 4. [MEDIUM] No MFA/Second Factor for MCP Access

**Issue:** There is no multi-factor authentication for MCP server access. Anyone with a license key + grant key has full API access. Grant keys are org-level (shared), meaning a single compromised key exposes the entire organization.

**Recommendation:** Implement email-based OTP verification via **Resend** for MCP access:

1. When a user first configures MCP (or from a new device), require email verification
2. Server sends a 6-digit OTP via Resend to the email on file
3. User enters OTP in the popup to unlock MCP config generation
4. Store a device-specific verification token with expiry (e.g., 30 days)
5. Re-prompt on grant key changes or suspicious activity

This fits naturally into the existing `AccountService.register()` flow and the device ID system in `JobTreadProService`.

**Implementation sketch for Resend integration:**
```
// Server-side (Cloudflare Worker)
import { Resend } from 'resend';
const resend = new Resend(env.RESEND_API_KEY);

// On MCP access from new device:
await resend.emails.send({
  from: 'security@jobtread-powertools.com',
  to: userEmail,
  subject: 'MCP Access Verification Code',
  html: `Your code: <strong>${otp}</strong> (expires in 10 minutes)`
});
```

---

### 5. [MEDIUM] Config JSON Contains Raw Credentials in Clipboard

**File:** `popup/popup.js:2108-2181`
**Issue:** For non-OAuth platforms (Claude Code, Claude Desktop, Gemini, Grok), `generateMcpConfig()` embeds raw `licenseKey:grantKey` into the JSON config, which is then copied to clipboard. Users paste this into config files that may be:
- Committed to git repositories (especially `.mcp.json` in project roots)
- Shared in screenshots or support threads
- Stored in plaintext config files on disk

**Recommendation:**
- Add a prominent warning before copying: "This config contains your credentials. Do not commit it to git or share it publicly."
- Add `.mcp.json` to the platform note for Claude Code with a `.gitignore` reminder
- Consider generating a short-lived token exchange: user pastes a one-time setup code, server exchanges it for a device-bound token

---

### 6. [MEDIUM] Grant Key Identity — Write Tools Attribution

**File:** `popup/popup.html:996-998`
**Current state:** There IS a warning notice:
> "Write actions are performed as the account that created the grant key. We recommend using a dedicated account (e.g. 'AI Assistant') so your team can easily identify AI-created items."

**Assessment:** This warning is good but could be stronger:
- It's a passive notice that users may scroll past
- It should be surfaced during grant key setup, not just in the tools list
- There's no server-side enforcement — the MCP server doesn't add any attribution header or audit trail

**Recommendation:**
- Show this warning prominently during initial grant key configuration (in `handleUpdateGrantKey()`)
- Add a confirmation checkbox: "I understand write actions will be attributed to the grant key owner"
- Server-side: Log all write operations with the device ID + timestamp for audit
- Consider adding an `X-Tool-Caller: ai-assistant` or `X-Automation: true` header from the MCP server when making JobTread API calls, if the JobTread API supports it

---

### 7. [MEDIUM] OAuth Flow for ChatGPT/Claude Web — No PKCE or State Verification

**File:** `popup/popup.js:2078, 2144-2150`
**Issue:** For OAuth platforms, the popup simply provides the server URL. The actual OAuth implementation lives server-side (on the Cloudflare Worker), which we don't have source code for here. However, the popup side shows:
- No PKCE challenge generation
- No state parameter verification
- No nonce tracking

**Recommendation:** Verify the server-side OAuth implementation includes:
- PKCE (Proof Key for Code Exchange) with S256 challenge method
- `state` parameter to prevent CSRF
- Short-lived authorization codes (< 5 minutes)
- Token binding to the requesting origin

---

### 8. [LOW] XOR Obfuscation Is Not Encryption

**File:** `services/license.js:62-71`
**Issue:** The security comment (lines 62-71) correctly notes this is NOT cryptographic. However, the XOR key `'jt-power-tools-v1'` is hardcoded in client-side code, making it trivially reversible.

**Assessment:** This is acceptable for the current threat model (preventing casual inspection). Server-side revalidation every 24 hours is the real security. No immediate action needed, but don't expand this pattern to more sensitive data.

---

### 9. [LOW] Grant Key Input Not Rate-Limited Client-Side

**File:** `popup/popup.js:1910-1959`
**Issue:** `handleUpdateGrantKey()` has no client-side rate limiting. A user (or automated script) could brute-force grant key verification attempts. The server-side rate limiting (mentioned in the user accounts spec) would help, but client-side throttling adds defense in depth.

**Recommendation:** Add a simple client-side cooldown after failed attempts (e.g., 3 failures = 30 second lockout).

---

### 10. [INFO] Existing Positive Security Patterns

These are things done well:
- **Grant key input uses `type="password"`** (popup.html:780) — prevents shoulder surfing
- **Keys are masked in display** (popup.js:1870, 1884) — first 8 chars + dots
- **OAuth platforms don't embed credentials** (popup.js:2078-2086) — ChatGPT/Claude Web only get the URL
- **Server-side license revalidation** every 24 hours (license.js:14)
- **Device ID system** (jobtread-pro-service.js:28-57) — uses `crypto.getRandomValues()` for device fingerprinting
- **HTTPS enforced** — all worker URLs use HTTPS
- **Org mismatch detection** (popup.js:2944) — grant key must match license org
- **Write tools warning exists** (popup.html:998) — recommends "AI Assistant" account

---

## PRIORITY ACTION ITEMS

| Priority | Finding | Effort |
|----------|---------|--------|
| P0 | #2 Strip console.log from production | Small |
| P0 | #5 Add credential-in-clipboard warning | Small |
| P1 | #1 Obfuscate grant key in storage | Small |
| P1 | #3 Move to server-issued session tokens | Medium |
| P1 | #6 Surface write attribution warning during setup | Small |
| P2 | #4 Implement Resend MFA for MCP access | Large |
| P2 | #7 Verify server-side OAuth has PKCE + state | Medium |
| P2 | #9 Client-side rate limit on grant key attempts | Small |

---

## MFA VIA RESEND — IMPLEMENTATION ROADMAP

For your specific ask about Resend-based MFA for MCP use:

### Phase 1: Email Verification on MCP Setup
- Require email verification when first configuring MCP from a new device
- Use Resend to send a 6-digit OTP with 10-minute expiry
- Store verified device token in `chrome.storage.local` with 30-day TTL
- Re-verify on grant key changes

### Phase 2: Per-Session MFA for Write Operations
- Before enabling write tools, require a fresh OTP
- Cache write authorization for the session (until popup closes)
- Audit log all write operations with device + timestamp

### Phase 3: Admin Controls
- Org admins can require MFA for all MCP users
- Ability to revoke device authorizations
- Email notifications on new device access

---

*This review covers client-side code only. A separate review of the Cloudflare Worker (MCP server, license proxy, pro worker) is recommended for complete coverage.*
