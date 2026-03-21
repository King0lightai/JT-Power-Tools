/**
 * API Client for JT Power Tools Portal
 *
 * Wraps fetch with JWT token management, auto-refresh, and error handling.
 */

const API_BASE = 'https://jobtread-mcp-server.king0light-ai.workers.dev';

const api = {
  /**
   * Make an authenticated API request.
   * Automatically attaches the access token and handles 401 refresh.
   */
  async request(path, options = {}) {
    const url = `${API_BASE}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Attach access token if available
    const token = auth.getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response = await fetch(url, {
      method: options.method || 'POST',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    // If 401 and we have a refresh token, try to refresh
    if (response.status === 401 && auth.getRefreshToken()) {
      const refreshed = await auth.refresh();
      if (refreshed) {
        // Retry with new token
        headers['Authorization'] = `Bearer ${auth.getAccessToken()}`;
        response = await fetch(url, {
          method: options.method || 'POST',
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
        });
      } else {
        // Refresh failed — redirect to login
        auth.logout();
        return null;
      }
    }

    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(data.error || 'Request failed', response.status, data);
    }

    return data;
  },

  // Convenience methods
  post(path, body) {
    return this.request(path, { method: 'POST', body });
  },

  get(path) {
    return this.request(path, { method: 'GET' });
  },
};

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

// Make globally available
window.api = api;
window.ApiError = ApiError;
