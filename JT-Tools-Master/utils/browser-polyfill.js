/**
 * JT Power Tools - Browser Polyfill
 * Provides cross-browser compatibility between Chrome and Firefox
 *
 * Firefox uses the `browser.*` namespace with Promises
 * Chrome uses the `chrome.*` namespace with callbacks (and Promise support in MV3)
 *
 * This polyfill wraps `browser.storage` so that `chrome.storage.*` works
 * correctly in Firefox — supporting both Promise-based (await) and
 * callback-based usage patterns used throughout the codebase.
 */

(function () {
  'use strict';

  // Detect Firefox
  const isFirefox = typeof browser !== 'undefined' && browser.runtime && browser.runtime.id;

  if (!isFirefox) {
    // Chrome: nothing to do, chrome.* APIs are native
    return;
  }

  // Firefox: Ensure chrome.action exists (Firefox MV2 uses browser.browserAction)
  if (!chrome.action && chrome.browserAction) {
    chrome.action = chrome.browserAction;
  }

  /**
   * Wrap a Firefox browser.storage area (sync or local) so it works with both:
   *   - Promise-based: `await chrome.storage.sync.get(keys)`
   *   - Callback-based: `chrome.storage.sync.get(keys, callback)`
   *
   * Firefox's native `browser.storage.*` only returns Promises.
   * Chrome's `chrome.storage.*` uses callbacks.
   * Code in this extension uses BOTH patterns, so we need to support both.
   */
  function wrapStorageArea(browserArea) {
    if (!browserArea) return browserArea;

    return {
      _jt_polyfilled: true,

      get: function (keys, callback) {
        const promise = browserArea.get(keys);
        if (typeof callback === 'function') {
          promise.then(function (result) { callback(result); })
                 .catch(function () { callback({}); });
          return;
        }
        return promise;
      },

      set: function (data, callback) {
        const promise = browserArea.set(data);
        if (typeof callback === 'function') {
          promise.then(function () { callback(); })
                 .catch(function () { callback(); });
          return;
        }
        return promise;
      },

      remove: function (keys, callback) {
        const promise = browserArea.remove(keys);
        if (typeof callback === 'function') {
          promise.then(function () { callback(); })
                 .catch(function () { callback(); });
          return;
        }
        return promise;
      },

      clear: function (callback) {
        const promise = browserArea.clear();
        if (typeof callback === 'function') {
          promise.then(function () { callback(); })
                 .catch(function () { callback(); });
          return;
        }
        return promise;
      },

      // getBytesInUse is not supported in Firefox — provide a safe no-op
      getBytesInUse: function (keys, callback) {
        if (typeof browserArea.getBytesInUse === 'function') {
          var promise = browserArea.getBytesInUse(keys);
          if (typeof callback === 'function') {
            promise.then(function (bytes) { callback(bytes); })
                   .catch(function () { callback(0); });
            return;
          }
          return promise;
        }
        // Not available — return 0
        if (typeof callback === 'function') {
          callback(0);
          return;
        }
        return Promise.resolve(0);
      }
    };
  }

  // Override chrome.storage with wrapped browser.storage areas
  if (typeof browser.storage !== 'undefined') {
    var wrappedStorage = {
      sync: wrapStorageArea(browser.storage.sync),
      local: wrapStorageArea(browser.storage.local),
      onChanged: browser.storage.onChanged
    };

    // Try direct assignment first
    try {
      chrome.storage = wrappedStorage;
    } catch (e) {
      // Direct assignment failed (chrome.storage may be non-writable)
    }

    // Verify the override took effect
    if (!chrome.storage || !chrome.storage.local || !chrome.storage.local._jt_polyfilled) {
      // Direct assignment was silently ignored — use Object.defineProperty
      try {
        Object.defineProperty(chrome, 'storage', {
          value: wrappedStorage,
          writable: true,
          configurable: true
        });
      } catch (e2) {
        // Object.defineProperty also failed — last resort: patch individual areas
        try {
          if (chrome.storage) {
            chrome.storage.sync = wrappedStorage.sync;
            chrome.storage.local = wrappedStorage.local;
            chrome.storage.onChanged = wrappedStorage.onChanged;
          }
        } catch (e3) {
          console.error('Browser polyfill: Could not override chrome.storage at all', e3);
        }
      }
    }

    // Final verification
    if (chrome.storage && chrome.storage.local && chrome.storage.local._jt_polyfilled) {
      console.log('Browser polyfill: chrome.storage successfully overridden (sync + local)');
    } else {
      console.warn('Browser polyfill: chrome.storage override may not have taken effect');
    }
  }

  // Export detection flag
  if (typeof window !== 'undefined') {
    window.__JT_IS_FIREFOX = true;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.__JT_IS_FIREFOX = true;
  }
})();
