/**
 * Cross-Browser API Polyfill
 * Provides compatibility layer between Chrome and Safari extension APIs
 *
 * Chrome uses: chrome.* (callback-based and promise-based in MV3)
 * Safari uses: browser.* (promise-based)
 *
 * This polyfill normalizes the API to work across both browsers.
 */

(function() {
  'use strict';

  // Detect which API is available
  const isChrome = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
  const isSafari = typeof browser !== 'undefined' && browser.runtime && browser.runtime.id;

  // If neither API is available, we're not in an extension context
  if (!isChrome && !isSafari) {
    console.warn('Browser extension API not detected');
    return;
  }

  // Create a unified browser API object
  const browserAPI = (() => {
    // Safari already uses browser.* with promises
    if (isSafari && typeof browser !== 'undefined') {
      return browser;
    }

    // Chrome MV3 already supports promises on most APIs
    // But we'll wrap it to ensure consistent behavior
    if (isChrome && typeof chrome !== 'undefined') {
      return chrome;
    }

    return null;
  })();

  // Export the unified API
  if (typeof window !== 'undefined') {
    // Make it available globally as 'browserAPI'
    window.browserAPI = browserAPI;

    // Also create browser.* alias for Safari compatibility
    if (isChrome && typeof browser === 'undefined') {
      window.browser = chrome;
    }
  }

  // Storage API wrapper with error handling
  const StorageAPI = {
    sync: {
      async get(keys) {
        try {
          if (browserAPI.storage && browserAPI.storage.sync) {
            return await browserAPI.storage.sync.get(keys);
          }
          // Fallback to local storage if sync is not available
          console.warn('sync storage not available, using local storage');
          return await browserAPI.storage.local.get(keys);
        } catch (error) {
          console.error('Storage get error:', error);
          throw error;
        }
      },

      async set(items) {
        try {
          if (browserAPI.storage && browserAPI.storage.sync) {
            return await browserAPI.storage.sync.set(items);
          }
          // Fallback to local storage if sync is not available
          console.warn('sync storage not available, using local storage');
          return await browserAPI.storage.local.set(items);
        } catch (error) {
          console.error('Storage set error:', error);
          throw error;
        }
      },

      async remove(keys) {
        try {
          if (browserAPI.storage && browserAPI.storage.sync) {
            return await browserAPI.storage.sync.remove(keys);
          }
          // Fallback to local storage if sync is not available
          console.warn('sync storage not available, using local storage');
          return await browserAPI.storage.local.remove(keys);
        } catch (error) {
          console.error('Storage remove error:', error);
          throw error;
        }
      }
    },

    local: {
      async get(keys) {
        try {
          return await browserAPI.storage.local.get(keys);
        } catch (error) {
          console.error('Local storage get error:', error);
          throw error;
        }
      },

      async set(items) {
        try {
          return await browserAPI.storage.local.set(items);
        } catch (error) {
          console.error('Local storage set error:', error);
          throw error;
        }
      },

      async remove(keys) {
        try {
          return await browserAPI.storage.local.remove(keys);
        } catch (error) {
          console.error('Local storage remove error:', error);
          throw error;
        }
      }
    }
  };

  // Runtime API wrapper
  const RuntimeAPI = {
    get id() {
      return browserAPI.runtime.id;
    },

    sendMessage(message, callback) {
      if (callback) {
        // Callback-based (Chrome legacy style)
        browserAPI.runtime.sendMessage(message, callback);
      } else {
        // Promise-based
        return browserAPI.runtime.sendMessage(message);
      }
    },

    onMessage: {
      addListener(callback) {
        browserAPI.runtime.onMessage.addListener(callback);
      },
      removeListener(callback) {
        browserAPI.runtime.onMessage.removeListener(callback);
      }
    },

    onInstalled: {
      addListener(callback) {
        browserAPI.runtime.onInstalled.addListener(callback);
      },
      removeListener(callback) {
        browserAPI.runtime.onInstalled.removeListener(callback);
      }
    },

    getURL(path) {
      return browserAPI.runtime.getURL(path);
    },

    getManifest() {
      return browserAPI.runtime.getManifest();
    }
  };

  // Tabs API wrapper
  const TabsAPI = {
    async query(queryInfo) {
      try {
        return await browserAPI.tabs.query(queryInfo);
      } catch (error) {
        console.error('Tabs query error:', error);
        throw error;
      }
    },

    async sendMessage(tabId, message, options) {
      try {
        return await browserAPI.tabs.sendMessage(tabId, message, options);
      } catch (error) {
        // This is expected if content script isn't loaded yet
        // Don't log as error, just return null
        return null;
      }
    },

    async reload(tabId, reloadProperties) {
      try {
        return await browserAPI.tabs.reload(tabId, reloadProperties);
      } catch (error) {
        console.error('Tab reload error:', error);
        throw error;
      }
    },

    async get(tabId) {
      try {
        return await browserAPI.tabs.get(tabId);
      } catch (error) {
        console.error('Tab get error:', error);
        throw error;
      }
    }
  };

  // Export wrapped APIs
  if (typeof window !== 'undefined') {
    window.BrowserStorage = StorageAPI;
    window.BrowserRuntime = RuntimeAPI;
    window.BrowserTabs = TabsAPI;

    // Utility to check browser type
    window.BrowserInfo = {
      isChrome,
      isSafari,
      name: isSafari ? 'Safari' : isChrome ? 'Chrome' : 'Unknown'
    };
  }

  console.log(`Browser Polyfill loaded for: ${isSafari ? 'Safari' : 'Chrome'}`);
})();
