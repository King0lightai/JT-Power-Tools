/**
 * Infinite Calendar Scroll Module
 * Automatically loads next/previous month when scrolling to bottom/top
 *
 * Dependencies: utils/debounce.js (TimingUtils)
 */

const InfiniteScroll = (() => {
  let isEnabled = false;
  let debouncedScrollCheck = null;
  let isLoading = false;
  let lastScrollPosition = 0;
  let scrollContainer = null; // The actual element that scrolls
  const SCROLL_THRESHOLD = 300; // pixels from top/bottom to trigger load
  const DEBOUNCE_DELAY = 150; // ms to wait before checking scroll

  /**
   * Find the scrollable container for the calendar
   * @returns {Element|Window} The element that scrolls
   */
  function findScrollContainer() {
    // First, try to find a scrollable div container
    const allElements = document.querySelectorAll('*');

    for (const el of allElements) {
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;

      // Check if element has scroll
      if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
        // Check if this container has the calendar table
        const hasCalendar = el.querySelector('table td.group') !== null;
        if (hasCalendar) {
          console.log('[InfiniteScroll] 🎯 Found scrollable calendar container:', el);
          return el;
        }
      }
    }

    console.log('[InfiniteScroll] 📄 No scrollable container found, using window');
    return window;
  }

  /**
   * Initialize infinite scroll functionality
   */
  function init() {
    if (isEnabled) {
      console.log('[InfiniteScroll] Already initialized');
      return;
    }

    console.log('[InfiniteScroll] Initializing infinite calendar scroll');
    isEnabled = true;

    // Create debounced scroll check function using TimingUtils
    debouncedScrollCheck = window.TimingUtils.debounce(checkScrollPosition, DEBOUNCE_DELAY);

    // Find the scroll container
    scrollContainer = findScrollContainer();

    // Diagnostic: Check page scroll properties
    console.log('[InfiniteScroll] 🔍 Page Diagnostics:');
    if (scrollContainer === window) {
      console.log(`  - Using: window (document scroll)`);
      console.log(`  - window.pageYOffset: ${window.pageYOffset}`);
      console.log(`  - document.documentElement.scrollTop: ${document.documentElement.scrollTop}`);
      console.log(`  - document.documentElement.scrollHeight: ${document.documentElement.scrollHeight}`);
      console.log(`  - document.documentElement.clientHeight: ${document.documentElement.clientHeight}`);
      console.log(`  - Scrollable height: ${document.documentElement.scrollHeight - document.documentElement.clientHeight}px`);
    } else {
      console.log(`  - Using: scrollable container element`);
      console.log(`  - scrollTop: ${scrollContainer.scrollTop}`);
      console.log(`  - scrollHeight: ${scrollContainer.scrollHeight}`);
      console.log(`  - clientHeight: ${scrollContainer.clientHeight}`);
      console.log(`  - Scrollable height: ${scrollContainer.scrollHeight - scrollContainer.clientHeight}px`);
    }

    // Attach scroll listener to the appropriate container
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });

    console.log('[InfiniteScroll] ✅ Infinite scroll enabled - scroll the page to test!');
  }

  /**
   * Handle scroll events with debouncing
   */
  function handleScroll() {
    console.log(`[InfiniteScroll] 📜 Scroll event detected - enabled: ${isEnabled}, isLoading: ${isLoading}`);

    if (!isEnabled || isLoading) {
      console.log(`[InfiniteScroll] ⏭️ Skipping scroll check (enabled: ${isEnabled}, isLoading: ${isLoading})`);
      return;
    }

    // Use debounced scroll check (via TimingUtils)
    debouncedScrollCheck();
  }

  /**
   * Check if we're at top or bottom and load more if needed
   */
  function checkScrollPosition() {
    let scrollTop, scrollHeight, clientHeight;

    // Get scroll properties based on container type
    if (scrollContainer === window) {
      scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      scrollHeight = document.documentElement.scrollHeight;
      clientHeight = document.documentElement.clientHeight;
    } else {
      scrollTop = scrollContainer.scrollTop;
      scrollHeight = scrollContainer.scrollHeight;
      clientHeight = scrollContainer.clientHeight;
    }

    const scrollBottom = scrollHeight - scrollTop - clientHeight;

    // Determine scroll direction
    const scrollingDown = scrollTop > lastScrollPosition;
    lastScrollPosition = scrollTop;

    console.log(`[InfiniteScroll] ========== SCROLL CHECK ==========`);
    console.log(`[InfiniteScroll] Container: ${scrollContainer === window ? 'window' : 'element'}`);
    console.log(`[InfiniteScroll] scrollTop: ${scrollTop}px`);
    console.log(`[InfiniteScroll] scrollHeight: ${scrollHeight}px`);
    console.log(`[InfiniteScroll] clientHeight: ${clientHeight}px`);
    console.log(`[InfiniteScroll] scrollBottom: ${scrollBottom}px`);
    console.log(`[InfiniteScroll] THRESHOLD: ${SCROLL_THRESHOLD}px`);
    console.log(`[InfiniteScroll] Direction: ${scrollingDown ? 'DOWN' : 'UP'}`);
    console.log(`[InfiniteScroll] isLoading: ${isLoading}`);
    console.log(`[InfiniteScroll] ===================================`);

    // Check if near bottom (scrolling down)
    if (scrollingDown && scrollBottom < SCROLL_THRESHOLD) {
      console.log('[InfiniteScroll] ✅ TRIGGER: Near bottom, loading next month');
      loadNextMonth();
    }
    // Check if near top (scrolling up)
    else if (!scrollingDown && scrollTop < SCROLL_THRESHOLD) {
      console.log('[InfiniteScroll] ✅ TRIGGER: Near top, loading previous month');
      loadPreviousMonth();
    } else {
      console.log('[InfiniteScroll] ❌ No trigger - not near threshold');
    }
  }

  /**
   * Load next month by clicking the next button
   */
  function loadNextMonth() {
    if (isLoading) {
      console.log('[InfiniteScroll] Already loading, skipping');
      return;
    }

    // Find the next month button
    const nextButton = findNextMonthButton();

    if (nextButton) {
      console.log('[InfiniteScroll] Found next month button, clicking');
      isLoading = true;

      // Store current scroll position
      const currentScrollTop = window.pageYOffset;

      // Click the button
      nextButton.click();

      // Wait for content to load, then restore scroll position
      setTimeout(() => {
        // Restore scroll position (adjusted for new content)
        window.scrollTo(0, currentScrollTop);
        isLoading = false;
        console.log('[InfiniteScroll] Next month loaded');
      }, 500);
    } else {
      console.warn('[InfiniteScroll] Could not find next month button');
    }
  }

  /**
   * Load previous month by clicking the previous button
   */
  function loadPreviousMonth() {
    if (isLoading) {
      console.log('[InfiniteScroll] Already loading, skipping');
      return;
    }

    // Find the previous month button
    const prevButton = findPreviousMonthButton();

    if (prevButton) {
      console.log('[InfiniteScroll] Found previous month button, clicking');
      isLoading = true;

      // Store current scroll position
      const currentScrollTop = window.pageYOffset;

      // Click the button
      prevButton.click();

      // Wait for content to load, then adjust scroll position
      setTimeout(() => {
        // Calculate new scroll position to maintain visual position
        const newScrollHeight = document.documentElement.scrollHeight;
        const oldScrollHeight = newScrollHeight - 500; // Approximate old height

        // Scroll down to compensate for new content above
        window.scrollTo(0, currentScrollTop + 500);
        isLoading = false;
        console.log('[InfiniteScroll] Previous month loaded');
      }, 500);
    } else {
      console.warn('[InfiniteScroll] Could not find previous month button');
    }
  }

  /**
   * Find the next month navigation button
   * @returns {HTMLElement|null} The next button element
   */
  function findNextMonthButton() {
    // Look for the calendar navigation buttons specifically
    // They should be near the month/year header (like "December 2024")

    // First, find the calendar container or month header
    // Look for elements that contain month names
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];

    let calendarHeader = null;
    const allText = document.querySelectorAll('*');

    for (const el of allText) {
      const text = el.textContent;
      // Look for "Month Year" pattern like "December 2024"
      for (const month of monthNames) {
        if (text.includes(month) && /\d{4}/.test(text) && text.length < 50) {
          // Found a potential calendar header
          calendarHeader = el;
          break;
        }
      }
      if (calendarHeader) break;
    }

    if (!calendarHeader) {
      console.warn('[InfiniteScroll] Could not find calendar header');
      return null;
    }

    console.log('[InfiniteScroll] Found calendar header:', calendarHeader.textContent);

    // Now find navigation buttons near this header
    // Look within the same parent or nearby siblings
    let searchRoot = calendarHeader.parentElement;

    // Search up a few levels to find the container with nav buttons
    for (let i = 0; i < 5; i++) {
      if (!searchRoot) break;

      // Look for right arrow button in this container
      const buttons = searchRoot.querySelectorAll('div[role="button"], button');

      for (const button of buttons) {
        const svg = button.querySelector('svg');
        if (!svg) continue;

        const path = svg.querySelector('path');
        if (!path) continue;

        const d = path.getAttribute('d');

        // Right arrow: "m9 18 6-6-6-6"
        if (d && d.includes('m9 18 6-6-6-6')) {
          console.log('[InfiniteScroll] Found next month button near calendar header');
          return button;
        }
      }

      searchRoot = searchRoot.parentElement;
    }

    console.warn('[InfiniteScroll] Could not find next month button near calendar');
    return null;
  }

  /**
   * Find the previous month navigation button
   * @returns {HTMLElement|null} The previous button element
   */
  function findPreviousMonthButton() {
    // Look for the calendar navigation buttons specifically
    // They should be near the month/year header (like "December 2024")

    // First, find the calendar container or month header
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];

    let calendarHeader = null;
    const allText = document.querySelectorAll('*');

    for (const el of allText) {
      const text = el.textContent;
      // Look for "Month Year" pattern like "December 2024"
      for (const month of monthNames) {
        if (text.includes(month) && /\d{4}/.test(text) && text.length < 50) {
          // Found a potential calendar header
          calendarHeader = el;
          break;
        }
      }
      if (calendarHeader) break;
    }

    if (!calendarHeader) {
      console.warn('[InfiniteScroll] Could not find calendar header');
      return null;
    }

    console.log('[InfiniteScroll] Found calendar header:', calendarHeader.textContent);

    // Now find navigation buttons near this header
    let searchRoot = calendarHeader.parentElement;

    // Search up a few levels to find the container with nav buttons
    for (let i = 0; i < 5; i++) {
      if (!searchRoot) break;

      // Look for left arrow button in this container
      const buttons = searchRoot.querySelectorAll('div[role="button"], button');

      for (const button of buttons) {
        const svg = button.querySelector('svg');
        if (!svg) continue;

        const path = svg.querySelector('path');
        if (!path) continue;

        const d = path.getAttribute('d');

        // Left arrow: "m15 18-6-6 6-6"
        if (d && d.includes('m15 18-6-6 6-6')) {
          console.log('[InfiniteScroll] Found previous month button near calendar header');
          return button;
        }
      }

      searchRoot = searchRoot.parentElement;
    }

    console.warn('[InfiniteScroll] Could not find previous month button near calendar');
    return null;
  }

  /**
   * Clean up infinite scroll functionality
   */
  function cleanup() {
    if (!isEnabled) {
      console.log('[InfiniteScroll] Not enabled, nothing to cleanup');
      return;
    }

    console.log('[InfiniteScroll] Cleaning up infinite scroll');
    isEnabled = false;

    // Remove scroll listener from the correct container
    if (scrollContainer) {
      scrollContainer.removeEventListener('scroll', handleScroll);
      scrollContainer = null;
    }

    // Cancel debounced function
    if (debouncedScrollCheck) {
      debouncedScrollCheck.cancel();
      debouncedScrollCheck = null;
    }

    // Reset state
    isLoading = false;
    lastScrollPosition = 0;

    console.log('[InfiniteScroll] Cleanup complete');
  }

  /**
   * Check if infinite scroll is currently enabled
   * @returns {boolean}
   */
  function isActive() {
    return isEnabled;
  }

  // Public API
  return {
    init,
    cleanup,
    isActive
  };
})();

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.InfiniteScroll = InfiniteScroll;
}
