/**
 * Account Service
 * Handles user authentication, session management, and data sync
 * Works alongside LicenseService for account-based auth
 *
 * v1.0 - Initial implementation with JWT auth
 */

const AccountService = (() => {
  // API endpoint (same as license proxy)
  const API_URL = 'https://jt-tools-license-proxy.king0light-ai.workers.dev';

  // Storage keys
  const STORAGE_KEYS = {
    ACCESS_TOKEN: 'jtAccountAccessToken',
    REFRESH_TOKEN: 'jtAccountRefreshToken',
    USER_DATA: 'jtAccountUserData',
    TOKEN_EXPIRY: 'jtAccountTokenExpiry',
    NOTES_SYNC_TIMESTAMP: 'jtNotesLastSync',
    TEMPLATES_SYNC_TIMESTAMP: 'jtTemplatesLastSync'
  };

  // Token refresh threshold (refresh if less than 2 minutes left)
  const REFRESH_THRESHOLD = 2 * 60 * 1000; // 2 minutes in ms

  // Current state
  let currentUser = null;
  let accessToken = null;
  let refreshToken = null;
  let tokenExpiry = null;
  let refreshPromise = null;

  /**
   * Initialize the service - load stored tokens
   */
  async function init() {
    try {
      const stored = await chrome.storage.local.get([
        STORAGE_KEYS.ACCESS_TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.USER_DATA,
        STORAGE_KEYS.TOKEN_EXPIRY
      ]);

      accessToken = stored[STORAGE_KEYS.ACCESS_TOKEN] || null;
      refreshToken = stored[STORAGE_KEYS.REFRESH_TOKEN] || null;
      currentUser = stored[STORAGE_KEYS.USER_DATA] || null;
      tokenExpiry = stored[STORAGE_KEYS.TOKEN_EXPIRY] || null;

      // Check if token needs refresh
      if (accessToken && isTokenExpiringSoon()) {
        console.log('AccountService: Token expiring soon, refreshing...');
        await refreshAccessToken();
      }

      console.log('AccountService: Initialized', { hasUser: !!currentUser });
      return { success: true };
    } catch (error) {
      console.error('AccountService: Init error', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if user is logged in
   */
  function isLoggedIn() {
    return !!accessToken && !!currentUser;
  }

  /**
   * Get current user data
   */
  function getCurrentUser() {
    return currentUser;
  }

  /**
   * Get access token (auto-refresh if needed)
   */
  async function getAccessToken() {
    if (!accessToken) return null;

    // Check if token needs refresh
    if (isTokenExpiringSoon()) {
      await refreshAccessToken();
    }

    return accessToken;
  }

  /**
   * Check if token is expiring soon
   */
  function isTokenExpiringSoon() {
    if (!tokenExpiry) return true;
    return (tokenExpiry - Date.now()) < REFRESH_THRESHOLD;
  }

  /**
   * Request a setup token after license validation
   * @param {string} licenseKey - The validated license key
   * @param {string} grantKey - Optional grant key for Power Users
   */
  async function requestSetupToken(licenseKey, grantKey = null) {
    try {
      const response = await fetch(`${API_URL}/auth/setup-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey, grantKey })
      });

      const result = await response.json();

      if (result.success) {
        console.log('AccountService: Setup token received');
        return { success: true, data: result.data };
      } else {
        console.error('AccountService: Setup token failed', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('AccountService: Setup token error', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  /**
   * Register a new account
   * @param {string} setupToken - Token from requestSetupToken
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {string} displayName - Optional display name
   */
  async function register(setupToken, email, password, displayName = null) {
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupToken, email, password, displayName })
      });

      const result = await response.json();

      if (result.success) {
        // Store tokens and user data
        await storeAuthData(result.data);
        console.log('AccountService: Registration successful');
        return { success: true, data: result.data };
      } else {
        console.error('AccountService: Registration failed', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('AccountService: Registration error', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  /**
   * Login with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   */
  async function login(email, password) {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const result = await response.json();

      if (result.success) {
        // Store tokens and user data
        await storeAuthData(result.data);
        console.log('AccountService: Login successful');
        return { success: true, data: result.data };
      } else {
        console.error('AccountService: Login failed', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('AccountService: Login error', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  /**
   * Refresh the access token
   */
  async function refreshAccessToken() {
    // Prevent concurrent refresh attempts
    if (refreshPromise) {
      return refreshPromise;
    }

    if (!refreshToken) {
      return { success: false, error: 'No refresh token' };
    }

    refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });

        const result = await response.json();

        if (result.success) {
          // Update access token and expiry
          accessToken = result.data.accessToken;
          tokenExpiry = Date.now() + (result.data.expiresIn * 1000);

          // Update user data if provided
          if (result.data.user) {
            currentUser = result.data.user;
          }

          // Store updated data
          await chrome.storage.local.set({
            [STORAGE_KEYS.ACCESS_TOKEN]: accessToken,
            [STORAGE_KEYS.TOKEN_EXPIRY]: tokenExpiry,
            [STORAGE_KEYS.USER_DATA]: currentUser
          });

          console.log('AccountService: Token refreshed');
          return { success: true };
        } else {
          // Refresh failed - clear auth data
          console.error('AccountService: Token refresh failed', result.error);
          await clearAuthData();
          return { success: false, error: result.error };
        }
      } catch (error) {
        console.error('AccountService: Token refresh error', error);
        return { success: false, error: 'Network error' };
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  }

  /**
   * Logout - clear local data and invalidate session on server
   */
  async function logout() {
    try {
      // Try to invalidate session on server (don't wait if it fails)
      if (refreshToken) {
        fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        }).catch(() => {}); // Ignore errors
      }

      // Clear local data
      await clearAuthData();
      console.log('AccountService: Logged out');
      return { success: true };
    } catch (error) {
      console.error('AccountService: Logout error', error);
      // Still clear local data even if server request fails
      await clearAuthData();
      return { success: true };
    }
  }

  /**
   * Store authentication data locally
   */
  async function storeAuthData(data) {
    accessToken = data.accessToken;
    refreshToken = data.refreshToken;
    currentUser = data.user;
    tokenExpiry = Date.now() + (data.expiresIn * 1000);

    await chrome.storage.local.set({
      [STORAGE_KEYS.ACCESS_TOKEN]: accessToken,
      [STORAGE_KEYS.REFRESH_TOKEN]: refreshToken,
      [STORAGE_KEYS.USER_DATA]: currentUser,
      [STORAGE_KEYS.TOKEN_EXPIRY]: tokenExpiry
    });

    // Store grant key separately if provided (for Pro Service)
    if (data.grantKey) {
      await chrome.storage.local.set({ jtAccountGrantKey: data.grantKey });
    }

    // Store license key if provided (syncs license across devices)
    if (data.licenseKey && window.LicenseService) {
      console.log('AccountService: Syncing license key from server');
      // Verify and store the license using LicenseService
      await window.LicenseService.verifyLicense(data.licenseKey);
    }
  }

  /**
   * Clear all authentication data (including sync state)
   */
  async function clearAuthData() {
    accessToken = null;
    refreshToken = null;
    currentUser = null;
    tokenExpiry = null;

    await chrome.storage.local.remove([
      STORAGE_KEYS.ACCESS_TOKEN,
      STORAGE_KEYS.REFRESH_TOKEN,
      STORAGE_KEYS.USER_DATA,
      STORAGE_KEYS.TOKEN_EXPIRY,
      STORAGE_KEYS.NOTES_SYNC_TIMESTAMP,
      'jtAccountGrantKey'
    ]);
  }

  /**
   * Make an authenticated API request
   * @param {string} endpoint - API endpoint (e.g., '/sync/notes')
   * @param {object} options - Fetch options
   */
  async function authenticatedFetch(endpoint, options = {}) {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    // Handle 401 - try refresh once
    if (response.status === 401) {
      const refreshResult = await refreshAccessToken();
      if (refreshResult.success) {
        // Retry with new token
        const newToken = await getAccessToken();
        return fetch(`${API_URL}${endpoint}`, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${newToken}`,
            'Content-Type': 'application/json'
          }
        });
      }
    }

    return response;
  }

  // ==========================================================================
  // GRANT KEY MANAGEMENT (Power Users)
  // ==========================================================================

  /**
   * Update grant key for the current user (Power Users only)
   * @param {string} grantKey - The new grant key to store
   */
  async function updateGrantKey(grantKey) {
    try {
      const token = await getAccessToken();
      if (!token) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await fetch(`${API_URL}/auth/update-grant-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ grantKey })
      });

      const result = await response.json();

      if (result.success) {
        console.log('AccountService: Grant key updated successfully');
        return { success: true };
      } else {
        console.error('AccountService: Grant key update failed', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('AccountService: Grant key update error', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  /**
   * Get the stored grant key for the current user
   * (Retrieved from local storage - stored during login)
   */
  async function getGrantKey() {
    try {
      const stored = await chrome.storage.local.get(['jtAccountGrantKey']);
      return stored.jtAccountGrantKey || null;
    } catch (error) {
      console.error('AccountService: Error getting grant key', error);
      return null;
    }
  }

  // ==========================================================================
  // SYNC METHODS (P1 - Will be implemented when sync endpoints are ready)
  // ==========================================================================

  /**
   * Sync notes with server
   * @param {Array} localNotes - Local notes array from QuickNotesStorage
   * @returns {Promise<{success: boolean, notes?: Array, stats?: Object, error?: string}>}
   */
  async function syncNotes(localNotes = []) {
    if (!isLoggedIn()) {
      return { success: false, error: 'Not logged in' };
    }

    try {
      // Get last sync timestamp
      const stored = await chrome.storage.local.get([STORAGE_KEYS.NOTES_SYNC_TIMESTAMP]);
      const lastSyncTimestamp = stored[STORAGE_KEYS.NOTES_SYNC_TIMESTAMP] || null;

      // Get deleted note IDs to sync
      let deletedNoteIds = [];
      if (window.QuickNotesStorage && window.QuickNotesStorage.getDeletedNoteIds) {
        deletedNoteIds = await window.QuickNotesStorage.getDeletedNoteIds();
      }

      console.log('AccountService: Syncing notes...', {
        localNotesCount: localNotes.length,
        deletedCount: deletedNoteIds.length,
        lastSyncTimestamp
      });

      // Make authenticated request to sync endpoint
      const response = await authenticatedFetch('/sync/notes', {
        method: 'POST',
        body: JSON.stringify({
          lastSyncTimestamp,
          notes: localNotes.map(note => ({
            id: note.id,
            title: note.title,
            content: note.content,
            folder: note.folder || 'General',
            isPinned: note.isPinned || false,
            createdAt: note.createdAt,
            updatedAt: note.updatedAt
          })),
          deletedNoteIds: deletedNoteIds
        })
      });

      const result = await response.json();

      if (result.success) {
        // Save new sync timestamp
        await chrome.storage.local.set({
          [STORAGE_KEYS.NOTES_SYNC_TIMESTAMP]: result.data.syncTimestamp
        });

        // Clear deleted note IDs after successful sync
        if (deletedNoteIds.length > 0 && window.QuickNotesStorage && window.QuickNotesStorage.clearDeletedNotes) {
          await window.QuickNotesStorage.clearDeletedNotes();
        }

        console.log('AccountService: Notes synced successfully', result.data.stats);
        return {
          success: true,
          notes: result.data.notes,
          stats: result.data.stats
        };
      } else {
        console.error('AccountService: Sync failed', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('AccountService: Sync error', error);
      return { success: false, error: 'Network error during sync' };
    }
  }

  /**
   * Get last notes sync timestamp
   * @returns {Promise<number|null>}
   */
  async function getLastSyncTimestamp() {
    const stored = await chrome.storage.local.get([STORAGE_KEYS.NOTES_SYNC_TIMESTAMP]);
    return stored[STORAGE_KEYS.NOTES_SYNC_TIMESTAMP] || null;
  }

  /**
   * Clear sync state (called on logout)
   */
  async function clearSyncState() {
    await chrome.storage.local.remove([
      STORAGE_KEYS.NOTES_SYNC_TIMESTAMP,
      STORAGE_KEYS.TEMPLATES_SYNC_TIMESTAMP
    ]);
  }

  /**
   * Sync templates with server
   * @param {Object} localData - Local templates data { templates: [], defaultTemplateId: null }
   * @returns {Promise<Object>} - Sync result with merged templates
   */
  async function syncTemplates(localData) {
    if (!isLoggedIn()) {
      return { success: false, error: 'Not logged in' };
    }

    try {
      // Get last sync timestamp
      const stored = await chrome.storage.local.get([STORAGE_KEYS.TEMPLATES_SYNC_TIMESTAMP]);
      const lastSyncTimestamp = stored[STORAGE_KEYS.TEMPLATES_SYNC_TIMESTAMP] || null;

      // Get deleted template IDs to sync
      let deletedTemplateIds = [];
      if (window.QuickNotesStorage && window.QuickNotesStorage.getDeletedTemplateIds) {
        deletedTemplateIds = await window.QuickNotesStorage.getDeletedTemplateIds();
      }

      console.log('AccountService: Syncing templates...', {
        localTemplatesCount: localData.templates?.length || 0,
        deletedCount: deletedTemplateIds.length,
        defaultTemplateId: localData.defaultTemplateId,
        lastSyncTimestamp
      });

      // Make authenticated request to sync endpoint
      const response = await authenticatedFetch('/sync/templates', {
        method: 'POST',
        body: JSON.stringify({
          lastSyncTimestamp,
          templates: (localData.templates || []).map(template => ({
            id: template.id,
            name: template.name,
            content: template.content,
            createdAt: template.createdAt,
            updatedAt: template.updatedAt
          })),
          defaultTemplateId: localData.defaultTemplateId,
          deletedTemplateIds: deletedTemplateIds
        })
      });

      const result = await response.json();

      if (result.success) {
        // Save new sync timestamp
        await chrome.storage.local.set({
          [STORAGE_KEYS.TEMPLATES_SYNC_TIMESTAMP]: result.data.syncTimestamp
        });

        // Clear deleted template IDs after successful sync
        if (deletedTemplateIds.length > 0 && window.QuickNotesStorage && window.QuickNotesStorage.clearDeletedTemplates) {
          await window.QuickNotesStorage.clearDeletedTemplates();
        }

        console.log('AccountService: Templates synced successfully', result.data.stats);
        return {
          success: true,
          templates: result.data.templates,
          defaultTemplateId: result.data.defaultTemplateId,
          stats: result.data.stats
        };
      } else {
        console.error('AccountService: Template sync failed', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('AccountService: Template sync error', error);
      return { success: false, error: 'Network error during sync' };
    }
  }

  /**
   * Get last templates sync timestamp
   * @returns {Promise<number|null>}
   */
  async function getLastTemplatesSyncTimestamp() {
    const stored = await chrome.storage.local.get([STORAGE_KEYS.TEMPLATES_SYNC_TIMESTAMP]);
    return stored[STORAGE_KEYS.TEMPLATES_SYNC_TIMESTAMP] || null;
  }

  /**
   * Sync settings with server
   */
  async function syncSettings() {
    // TODO: Implement when settings sync is needed
    console.log('AccountService: syncSettings - Not yet implemented');
    return { success: false, error: 'Not yet implemented' };
  }

  // ==========================================================================
  // TEAM NOTES (Shared across organization)
  // ==========================================================================

  /**
   * Get all team notes for the organization
   * @returns {Promise<Object>} - Result with notes array
   */
  async function getTeamNotes() {
    if (!isLoggedIn()) {
      return { success: false, error: 'Not logged in' };
    }

    try {
      console.log('AccountService: Fetching team notes...');

      const response = await authenticatedFetch('/sync/team-notes', {
        method: 'POST',
        body: JSON.stringify({})
      });

      const result = await response.json();

      if (result.success) {
        console.log('AccountService: Team notes fetched', {
          count: result.data.notes?.length || 0
        });
        return {
          success: true,
          notes: result.data.notes || [],
          serverTimestamp: result.data.serverTimestamp
        };
      } else {
        console.error('AccountService: Failed to fetch team notes', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('AccountService: Team notes fetch error', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  /**
   * Save (create or update) a team note
   * @param {Object} note - Note object { id?, title, content, folder?, isPinned? }
   * @returns {Promise<Object>} - Result with saved note data
   */
  async function saveTeamNote(note) {
    if (!isLoggedIn()) {
      return { success: false, error: 'Not logged in' };
    }

    if (!note.title && !note.content) {
      return { success: false, error: 'Title or content is required' };
    }

    try {
      console.log('AccountService: Saving team note...', { id: note.id || 'new', folder: note.folder });

      const response = await authenticatedFetch('/sync/team-notes/push', {
        method: 'POST',
        body: JSON.stringify({
          id: note.id || null,
          title: note.title || 'Untitled Note',
          content: note.content || '',
          folder: note.folder || 'General',
          isPinned: note.isPinned || false
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log('AccountService: Team note saved', result.data);
        return {
          success: true,
          data: result.data
        };
      } else {
        console.error('AccountService: Failed to save team note', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('AccountService: Team note save error', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  /**
   * Delete a team note
   * @param {string} noteId - ID of the note to delete
   * @returns {Promise<Object>} - Result with success/error
   */
  async function deleteTeamNote(noteId) {
    if (!isLoggedIn()) {
      return { success: false, error: 'Not logged in' };
    }

    if (!noteId) {
      return { success: false, error: 'Note ID is required' };
    }

    try {
      console.log('AccountService: Deleting team note...', { id: noteId });

      const response = await authenticatedFetch('/sync/team-notes/delete', {
        method: 'POST',
        body: JSON.stringify({ id: noteId })
      });

      const result = await response.json();

      if (result.success) {
        console.log('AccountService: Team note deleted');
        return { success: true };
      } else {
        console.error('AccountService: Failed to delete team note', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('AccountService: Team note delete error', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  // ==========================================================================
  // PASSWORD RESET
  // ==========================================================================

  /**
   * Request a password reset email
   * @param {string} email - User's email address
   * @returns {Promise<Object>} - Result with success/error
   */
  async function requestPasswordReset(email) {
    if (!email) {
      return { success: false, error: 'Email is required' };
    }

    try {
      console.log('AccountService: Requesting password reset for:', email);

      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: email.toLowerCase() })
      });

      const result = await response.json();

      if (result.success) {
        console.log('AccountService: Password reset email requested');
        return { success: true, message: result.message };
      } else {
        console.error('AccountService: Password reset request failed', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('AccountService: Password reset request error', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  /**
   * Reset password using a reset token
   * @param {string} token - Password reset token from email
   * @param {string} newPassword - New password to set
   * @returns {Promise<Object>} - Result with success/error
   */
  async function resetPassword(token, newPassword) {
    if (!token) {
      return { success: false, error: 'Reset token is required' };
    }

    if (!newPassword || newPassword.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters' };
    }

    try {
      console.log('AccountService: Resetting password...');

      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token, newPassword })
      });

      const result = await response.json();

      if (result.success) {
        console.log('AccountService: Password reset successful');
        return { success: true, message: result.message };
      } else {
        console.error('AccountService: Password reset failed', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('AccountService: Password reset error', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  // Public API
  return {
    // Initialization
    init,

    // Auth state
    isLoggedIn,
    getCurrentUser,
    getAccessToken,

    // Auth operations
    requestSetupToken,
    register,
    login,
    logout,
    refreshAccessToken,
    requestPasswordReset,
    resetPassword,

    // API helpers
    authenticatedFetch,

    // Grant key management
    updateGrantKey,
    getGrantKey,

    // Sync operations
    syncNotes,
    syncTemplates,
    syncSettings,
    getLastSyncTimestamp,
    getLastTemplatesSyncTimestamp,
    clearSyncState,

    // Team notes
    getTeamNotes,
    saveTeamNote,
    deleteTeamNote
  };
})();

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.AccountService = AccountService;
}

// Initialize on load
if (typeof chrome !== 'undefined' && chrome.runtime) {
  AccountService.init();
}
