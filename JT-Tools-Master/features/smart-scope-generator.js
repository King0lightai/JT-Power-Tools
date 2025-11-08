// JobTread Smart Scope Generator Feature Module
// Allows users to select line items and format them into professional scope text

const SmartScopeGeneratorFeature = (() => {
  let isActive = false;
  let observer = null;
  let formatButton = null;
  let updateInterval = null;
  let toolbarContainer = null;

  // Configuration
  const BUTTON_ID = 'jt-smart-scope-button';
  const BUTTON_TEXT = 'Custom Scope';

  // Initialize the feature
  function init() {
    if (isActive) {
      console.log('SmartScopeGenerator: Already initialized');
      return;
    }

    console.log('SmartScopeGenerator: Initializing...');
    isActive = true;

    // Find and inject button into toolbar
    injectButtonIntoToolbar();

    // Check for selected items periodically
    // (JobTread uses React and updates selection dynamically)
    updateInterval = setInterval(() => {
      updateButtonVisibility();
      // Re-inject button if toolbar was rebuilt
      if (!document.getElementById(BUTTON_ID)) {
        injectButtonIntoToolbar();
      }
    }, 500);

    // Watch for DOM changes
    observer = new MutationObserver(() => {
      // Re-inject button if toolbar was rebuilt
      if (!document.getElementById(BUTTON_ID)) {
        injectButtonIntoToolbar();
      }
      updateButtonVisibility();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'] // Watch for class changes (selection state)
    });

    console.log('SmartScopeGenerator: Feature loaded');
  }

  // Cleanup the feature
  function cleanup() {
    if (!isActive) {
      console.log('SmartScopeGenerator: Not active, nothing to cleanup');
      return;
    }

    console.log('SmartScopeGenerator: Cleaning up...');
    isActive = false;

    // Clear interval
    if (updateInterval) {
      clearInterval(updateInterval);
      updateInterval = null;
    }

    // Disconnect observer
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    // Remove button
    if (formatButton && formatButton.parentNode) {
      formatButton.remove();
      formatButton = null;
    }

    toolbarContainer = null;

    console.log('SmartScopeGenerator: Cleanup complete');
  }

  // Find the job header toolbar and inject our button
  function injectButtonIntoToolbar() {
    // Don't inject if already exists
    if (document.getElementById(BUTTON_ID)) {
      formatButton = document.getElementById(BUTTON_ID);
      return;
    }

    // Find the toolbar container
    // Look for the button group with "Edit Job", "Message", etc.
    const buttonGroups = document.querySelectorAll('.absolute.inset-0.flex.justify-end');

    let targetContainer = null;
    for (const group of buttonGroups) {
      // Verify this is the job header toolbar by checking for "Edit Job" button
      const editButton = Array.from(group.querySelectorAll('[role="button"]')).find(btn =>
        btn.textContent.includes('Edit Job')
      );

      if (editButton) {
        targetContainer = group;
        break;
      }
    }

    if (!targetContainer) {
      // Toolbar not found yet, will retry on next interval
      return;
    }

    toolbarContainer = targetContainer;

    // Create our button matching JobTread's style
    formatButton = document.createElement('div');
    formatButton.id = BUTTON_ID;
    formatButton.setAttribute('role', 'button');
    formatButton.setAttribute('tabindex', '0');
    formatButton.className = 'inline-block align-bottom relative cursor-pointer select-none truncate py-2 px-4 shadow-xs active:shadow-inner text-white bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 first:rounded-l-sm last:rounded-r-sm border-y border-l last:border-r text-center shrink-0';
    formatButton.style.cssText = 'display: none; font-weight: 600; transition: all 0.2s ease;';

    // Create button content with icon
    formatButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="inline-block overflow-visible h-[1em] w-[1em] align-[-0.125em] mr-1" viewBox="0 0 24 24">
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275z"></path>
      </svg>
      ${BUTTON_TEXT}
    `;

    // Button click handler
    formatButton.addEventListener('click', handleFormatClick);

    // Insert button before the "..." menu button (last button)
    const lastButton = targetContainer.lastElementChild;
    if (lastButton && lastButton.previousElementSibling) {
      // Insert before the last button (which is usually the "..." menu)
      targetContainer.insertBefore(formatButton, lastButton);
    } else {
      // Just append if we can't find the right spot
      targetContainer.appendChild(formatButton);
    }

    console.log('SmartScopeGenerator: Button injected into toolbar');
  }

  // Find selected budget line items
  // JobTread highlights selected items with bg-blue-* classes
  function getSelectedItems() {
    const selectedRows = [];

    // Strategy 1: Find rows with blue selection classes
    // These are JobTread's selected budget items
    const blueRows = document.querySelectorAll('.group\\/row');

    blueRows.forEach(row => {
      // Check if row has blue selection classes
      const hasBlueSelection = Array.from(row.querySelectorAll('*')).some(el => {
        const classes = el.className || '';
        return classes.includes('bg-blue-50') ||
               classes.includes('bg-blue-100') ||
               classes.includes('bg-blue-200');
      });

      if (hasBlueSelection) {
        selectedRows.push(row);
      }
    });

    // Strategy 2: Also check for checked SVG checkboxes
    // JobTread uses SVG icons for checkboxes at the end of rows
    const checkedCheckboxes = document.querySelectorAll('[class*="group/row"]');

    checkedCheckboxes.forEach(row => {
      // Look for the checked checkbox SVG pattern
      // The checked state has a specific SVG path pattern
      const svgs = row.querySelectorAll('svg');
      svgs.forEach(svg => {
        const paths = svg.querySelectorAll('path');
        paths.forEach(path => {
          const d = path.getAttribute('d');
          // This is the checkmark pattern in JobTread
          if (d && d.includes('m9 11 3 3')) {
            if (!selectedRows.includes(row)) {
              selectedRows.push(row);
            }
          }
        });
      });
    });

    return selectedRows;
  }

  // Extract name/description from a row
  function extractItemName(row) {
    // Strategy 1: Look for textarea with placeholder="Name"
    const nameField = row.querySelector('textarea[placeholder="Name"]');
    if (nameField && nameField.value.trim()) {
      return nameField.value.trim();
    }

    // Strategy 2: Look for the name in the second column (after row number)
    // The name is usually in the second div with font-bold class
    const boldDivs = row.querySelectorAll('.font-bold');
    for (const div of boldDivs) {
      const text = div.textContent.trim();
      if (text && text.length > 0 && text.length < 200) {
        return text;
      }
    }

    // Strategy 3: Look in any textarea in the name column
    const textareas = row.querySelectorAll('textarea');
    for (const textarea of textareas) {
      const value = textarea.value.trim();
      if (value && value.length > 0 && value.length < 200) {
        return value;
      }
    }

    // Strategy 4: Look for text in draggable elements
    const draggables = row.querySelectorAll('[draggable="true"]');
    for (const draggable of draggables) {
      const text = draggable.textContent.trim();
      if (text && text.length > 0 && text.length < 200 && !text.match(/^\d+$/)) {
        return text;
      }
    }

    return 'Unnamed Item';
  }

  // Update button visibility based on selection
  function updateButtonVisibility() {
    if (!isActive || !formatButton) return;

    const selectedRows = getSelectedItems();
    const count = selectedRows.length;

    if (count > 0) {
      formatButton.style.display = 'inline-block';
      // Update button text with count
      const iconSvg = formatButton.querySelector('svg');
      if (iconSvg) {
        formatButton.innerHTML = iconSvg.outerHTML + ` ${BUTTON_TEXT} (${count})`;
      } else {
        formatButton.textContent = `${BUTTON_TEXT} (${count})`;
      }
    } else {
      formatButton.style.display = 'none';
    }
  }

  // Format selected items into professional scope
  function formatScope(rows) {
    const items = rows.map((row, index) => {
      const name = extractItemName(row);
      return `${index + 1}. ${name}`;
    });

    const scopeText = items.join('\n\n');

    // Create professional formatted version
    const formattedScope = `SCOPE OF WORK\n\n${scopeText}\n\nPlease review and let us know if you have any questions.`;

    return formattedScope;
  }

  // Handle format button click
  async function handleFormatClick() {
    const selectedRows = getSelectedItems();

    if (selectedRows.length === 0) {
      showNotification('No items selected', 'error');
      return;
    }

    // Store original button content
    const originalHTML = formatButton.innerHTML;
    formatButton.disabled = true;
    formatButton.style.opacity = '0.6';
    formatButton.style.cursor = 'wait';

    // Update button text
    const iconSvg = formatButton.querySelector('svg');
    if (iconSvg) {
      formatButton.innerHTML = iconSvg.outerHTML + ' Processing...';
    } else {
      formatButton.textContent = 'Processing...';
    }

    try {
      // Format the scope
      const formattedScope = formatScope(selectedRows);

      // Copy to clipboard
      await copyToClipboard(formattedScope);

      // Show success notification
      showNotification(
        `Formatted ${selectedRows.length} item${selectedRows.length === 1 ? '' : 's'} and copied to clipboard!`,
        'success'
      );

      console.log('SmartScopeGenerator: Formatted scope:', formattedScope);

    } catch (error) {
      console.error('SmartScopeGenerator: Error formatting scope:', error);
      showNotification('Error formatting scope', 'error');
    } finally {
      // Re-enable button
      formatButton.disabled = false;
      formatButton.style.opacity = '1';
      formatButton.style.cursor = 'pointer';
      formatButton.innerHTML = originalHTML;
    }
  }

  // Copy text to clipboard
  async function copyToClipboard(text) {
    try {
      // Modern clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }

      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    } catch (error) {
      console.error('SmartScopeGenerator: Error copying to clipboard:', error);
      throw error;
    }
  }

  // Show notification to user
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10001;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      animation: slideInFromTop 0.3s ease-out;
      max-width: 400px;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Remove after 4 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOutToTop 0.3s ease-in';
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 4000);

    // Add animations if not already present
    if (!document.getElementById('jt-notification-animations')) {
      const style = document.createElement('style');
      style.id = 'jt-notification-animations';
      style.textContent = `
        @keyframes slideInFromTop {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slideOutToTop {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(-20px);
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  // Public API
  return {
    init,
    cleanup,
    isActive: () => isActive
  };
})();

// Export for use in main content script
if (typeof window !== 'undefined') {
  window.SmartScopeGeneratorFeature = SmartScopeGeneratorFeature;
}
