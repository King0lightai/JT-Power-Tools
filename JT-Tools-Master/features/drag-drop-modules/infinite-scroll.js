/**
 * Infinite Calendar Scroll Module
 * Automatically loads next/previous month when scrolling to bottom/top
 */

const InfiniteScroll = (() => {
  let isEnabled = false;
  let scrollTimeout = null;
  let isLoading = false;
  let lastScrollPosition = 0;
  const SCROLL_THRESHOLD = 300; // pixels from top/bottom to trigger load
  const DEBOUNCE_DELAY = 150; // ms to wait before checking scroll

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

    // Attach scroll listener to window
    window.addEventListener('scroll', handleScroll, { passive: true });

    console.log('[InfiniteScroll] Infinite scroll enabled');
  }

  /**
   * Handle scroll events with debouncing
   */
  function handleScroll() {
    if (!isEnabled || isLoading) {
      return;
    }

    // Clear existing timeout
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }

    // Debounce scroll events
    scrollTimeout = setTimeout(() => {
      checkScrollPosition();
    }, DEBOUNCE_DELAY);
  }

  /**
   * Check if we're at top or bottom and load more if needed
   */
  function checkScrollPosition() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;
    const scrollBottom = scrollHeight - scrollTop - clientHeight;

    // Determine scroll direction
    const scrollingDown = scrollTop > lastScrollPosition;
    lastScrollPosition = scrollTop;

    console.log(`[InfiniteScroll] Scroll position: top=${scrollTop}, bottom=${scrollBottom}, direction=${scrollingDown ? 'down' : 'up'}`);

    // Check if near bottom (scrolling down)
    if (scrollingDown && scrollBottom < SCROLL_THRESHOLD) {
      console.log('[InfiniteScroll] Near bottom, loading next month');
      loadNextMonth();
    }
    // Check if near top (scrolling up)
    else if (!scrollingDown && scrollTop < SCROLL_THRESHOLD) {
      console.log('[InfiniteScroll] Near top, loading previous month');
      loadPreviousMonth();
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

    // Remove scroll listener
    window.removeEventListener('scroll', handleScroll);

    // Clear timeout
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
      scrollTimeout = null;
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
