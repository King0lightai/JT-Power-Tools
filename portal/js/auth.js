/**
 * Auth Manager for JT Power Tools Portal
 *
 * Handles JWT storage, refresh, and session state.
 * Tokens stored in localStorage (portal) — extension will use chrome.storage.
 */

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'jt_access_token',
  REFRESH_TOKEN: 'jt_refresh_token',
  USER: 'jt_user',
};

const auth = {
  // ─── Token Management ─────────────────────────────────────

  getAccessToken() {
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  },

  getRefreshToken() {
    return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  },

  getUser() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.USER));
    } catch {
      return null;
    }
  },

  setTokens(accessToken, refreshToken) {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    if (refreshToken) {
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    }
  },

  setUser(user) {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  },

  clearAll() {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
  },

  isLoggedIn() {
    return !!this.getAccessToken();
  },

  // ─── Auth Actions ─────────────────────────────────────────

  async login(email, password) {
    const data = await api.post('/auth/login', { email, password });
    this.setTokens(data.accessToken, data.refreshToken);
    this.setUser(data.user);
    return data;
  },

  async register(fields) {
    const data = await api.post('/auth/register', fields);
    this.setTokens(data.accessToken, data.refreshToken);
    this.setUser(data.user);
    return data;
  },

  async refresh() {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const response = await fetch(
        'https://jobtread-mcp-server.king0light-ai.workers.dev/auth/refresh',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        }
      );

      if (!response.ok) {
        this.clearAll();
        return false;
      }

      const data = await response.json();
      this.setTokens(data.accessToken);
      if (data.user) this.setUser(data.user);
      return true;
    } catch {
      this.clearAll();
      return false;
    }
  },

  async logout() {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      try {
        await fetch(
          'https://jobtread-mcp-server.king0light-ai.workers.dev/auth/logout',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          }
        );
      } catch {
        // Non-critical
      }
    }
    this.clearAll();
    window.location.href = '/';
  },

  // ─── Route Guards ─────────────────────────────────────────

  /** Redirect to login if not authenticated */
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = '/';
      return false;
    }
    return true;
  },

  /** Redirect to dashboard if already authenticated */
  redirectIfLoggedIn() {
    if (this.isLoggedIn()) {
      window.location.href = '/dashboard.html';
      return true;
    }
    return false;
  },

  /** Check if current user is owner or admin */
  isAdmin() {
    const user = this.getUser();
    return user && (user.role === 'owner' || user.role === 'admin');
  },
};

// Make globally available
window.auth = auth;
