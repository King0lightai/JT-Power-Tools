/**
 * JT Power Tools - Browser Polyfill
 * Provides cross-browser compatibility between Chrome and Firefox
 *
 * Firefox uses the `browser.*` namespace with Promises
 * Chrome uses the `chrome.*` namespace with callbacks (and some Promise support in MV3)
 *
 * This polyfill normalizes the API so all code can use `chrome.*` and it works
 * in both browsers. Firefox already aliases `chrome` to `browser` for most APIs,
 * but this polyfill ensures edge cases are handled.
 */

(function () {
  'use strict';

  // Detect Firefox
  const isFirefox = typeof browser !== 'undefined' && browser.runtime && browser.runtime.id;

  if (!isFirefox) {
    // Chrome: nothing to do, chrome.* APIs are native
    return;
  }

  // Firefox: Ensure chrome.* namespace works correctly
  // Firefox already provides a `chrome` global that mirrors `browser` for most APIs,
  // but some edge cases need patching.

  // Ensure chrome.storage.sync callbacks work in Firefox
  // Firefox's chrome.storage.sync returns Promises, but callback-style code
  // expects the callback to be invoked. Firefox handles this natively in most cases.

  // Patch chrome.runtime.lastError for Firefox compatibility
  // Firefox uses Promise rejections instead of chrome.runtime.lastError
  // The StorageWrapper already handles both patterns, so this is mostly safe.

  // Ensure chrome.action exists (Firefox MV2 uses browser.browserAction)
  if (!chrome.action && chrome.browserAction) {
    chrome.action = chrome.browserAction;
  }

  // Export detection flag
  if (typeof window !== 'undefined') {
    window.__JT_IS_FIREFOX = true;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.__JT_IS_FIREFOX = true;
  }
})();
