// Google Docs Integration - Authentication Module
// Handles OAuth2 authentication with Google Drive API

const GoogleAuth = (() => {
  let accessToken = null;
  let tokenExpiry = null;

  /**
   * Authenticate with Google using chrome.identity
   * @returns {Promise<string>} Access token
   */
  async function authenticate() {
    return new Promise((resolve, reject) => {
      // Request auth token interactively
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          console.error('GoogleAuth: Authentication failed:', chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
        } else if (!token) {
          console.error('GoogleAuth: No token received');
          reject(new Error('No authentication token received'));
        } else {
          accessToken = token;
          // Tokens typically expire after 1 hour
          tokenExpiry = Date.now() + (3600 * 1000);
          console.log('GoogleAuth: Authentication successful');
          resolve(token);
        }
      });
    });
  }

  /**
   * Get current access token (re-authenticates if expired)
   * @returns {Promise<string>} Access token
   */
  async function getToken() {
    // Check if token exists and is not expired
    if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
      return accessToken;
    }

    // Token expired or doesn't exist, re-authenticate
    console.log('GoogleAuth: Token expired or missing, re-authenticating...');
    return await authenticate();
  }

  /**
   * Revoke the current token and sign out
   * @returns {Promise<void>}
   */
  async function revokeToken() {
    if (!accessToken) {
      console.log('GoogleAuth: No token to revoke');
      return;
    }

    try {
      // Revoke the token with Google
      await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${accessToken}`);

      // Remove from Chrome's cache
      chrome.identity.removeCachedAuthToken({ token: accessToken }, () => {
        console.log('GoogleAuth: Token revoked');
      });

      // Clear local state
      accessToken = null;
      tokenExpiry = null;
    } catch (error) {
      console.error('GoogleAuth: Error revoking token:', error);
      throw error;
    }
  }

  /**
   * Check if user is currently authenticated
   * @returns {boolean}
   */
  function isAuthenticated() {
    return accessToken !== null && tokenExpiry !== null && Date.now() < tokenExpiry;
  }

  /**
   * Get cached token without re-authenticating
   * @returns {string|null}
   */
  function getCachedToken() {
    return accessToken;
  }

  // Public API
  return {
    authenticate,
    getToken,
    revokeToken,
    isAuthenticated,
    getCachedToken
  };
})();

// Make available globally
window.GoogleAuth = GoogleAuth;

console.log('GoogleAuth: Module loaded');
