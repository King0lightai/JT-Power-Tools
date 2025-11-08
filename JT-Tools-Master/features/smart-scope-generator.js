// JobTread Smart Scope Generator Feature Module
// Allows users to select line items and format them into professional scope text

const SmartScopeGeneratorFeature = (() => {
  let isActive = false;
  let observer = null;
  let formatButton = null;
  let selectedItems = new Set();
  let checkboxListeners = new Map();
  let buttonContainer = null;

  // Configuration
  const BUTTON_ID = 'jt-smart-scope-button';
  const CONTAINER_ID = 'jt-smart-scope-container';
  const BUTTON_TEXT = '✨ Format with AI';

  // Initialize the feature
  function init() {
    if (isActive) {
      console.log('SmartScopeGenerator: Already initialized');
      return;
    }

    console.log('SmartScopeGenerator: Initializing...');
    isActive = true;

    // Create the format button (initially hidden)
    createFormatButton();

    // Initialize existing checkboxes
    initializeCheckboxes();

    // Watch for new checkboxes being added to the DOM
    observer = new MutationObserver(() => {
      initializeCheckboxes();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
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

    // Disconnect observer
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    // Remove button
    if (buttonContainer) {
      buttonContainer.remove();
      buttonContainer = null;
      formatButton = null;
    }

    // Clear checkbox listeners
    checkboxListeners.forEach((listener, checkbox) => {
      checkbox.removeEventListener('change', listener);
    });
    checkboxListeners.clear();
    selectedItems.clear();

    console.log('SmartScopeGenerator: Cleanup complete');
  }

  // Create the floating format button
  function createFormatButton() {
    if (buttonContainer) return;

    // Create container
    buttonContainer = document.createElement('div');
    buttonContainer.id = CONTAINER_ID;
    buttonContainer.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 10000;
      display: none;
      animation: slideIn 0.3s ease-out;
    `;

    // Create button
    formatButton = document.createElement('button');
    formatButton.id = BUTTON_ID;
    formatButton.textContent = BUTTON_TEXT;
    formatButton.style.cssText = `
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
      transition: all 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Button hover effects
    formatButton.addEventListener('mouseenter', () => {
      formatButton.style.transform = 'translateY(-2px)';
      formatButton.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
    });

    formatButton.addEventListener('mouseleave', () => {
      formatButton.style.transform = 'translateY(0)';
      formatButton.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
    });

    // Button click handler
    formatButton.addEventListener('click', handleFormatClick);

    buttonContainer.appendChild(formatButton);
    document.body.appendChild(buttonContainer);

    // Add animation keyframes
    if (!document.getElementById('jt-scope-animations')) {
      const style = document.createElement('style');
      style.id = 'jt-scope-animations';
      style.textContent = `
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  // Initialize checkboxes on the page
  function initializeCheckboxes() {
    if (!isActive) return;

    // Find all checkboxes that might be part of line items
    // We'll look for checkboxes in common budget/line item contexts
    const checkboxes = findLineItemCheckboxes();

    checkboxes.forEach(checkbox => {
      // Skip if already initialized
      if (checkboxListeners.has(checkbox)) return;

      // Create listener for this checkbox
      const listener = () => handleCheckboxChange(checkbox);
      checkbox.addEventListener('change', listener);
      checkboxListeners.set(checkbox, listener);

      // Check if it's already selected
      if (checkbox.checked) {
        selectedItems.add(checkbox);
      }
    });

    // Update button visibility
    updateButtonVisibility();
  }

  // Find checkboxes that are likely part of line items
  function findLineItemCheckboxes() {
    const checkboxes = [];

    // Strategy 1: Find checkboxes in table rows (common pattern for line items)
    const tableCheckboxes = document.querySelectorAll('table input[type="checkbox"]');
    checkboxes.push(...tableCheckboxes);

    // Strategy 2: Find checkboxes in list items
    const listCheckboxes = document.querySelectorAll('li input[type="checkbox"], [role="listitem"] input[type="checkbox"]');
    checkboxes.push(...listCheckboxes);

    // Strategy 3: Find checkboxes in divs that might be budget items
    // (looking for patterns like data-testid, class names with 'item', 'row', 'line', etc.)
    const budgetCheckboxes = document.querySelectorAll(`
      [class*="budget"] input[type="checkbox"],
      [class*="line-item"] input[type="checkbox"],
      [class*="item-row"] input[type="checkbox"],
      [data-testid*="item"] input[type="checkbox"]
    `);
    checkboxes.push(...budgetCheckboxes);

    // Remove duplicates
    return [...new Set(checkboxes)];
  }

  // Handle checkbox state change
  function handleCheckboxChange(checkbox) {
    if (checkbox.checked) {
      selectedItems.add(checkbox);
    } else {
      selectedItems.delete(checkbox);
    }

    updateButtonVisibility();
  }

  // Update button visibility based on selection
  function updateButtonVisibility() {
    if (!buttonContainer || !formatButton) return;

    // Clean up stale checkboxes (removed from DOM)
    selectedItems.forEach(checkbox => {
      if (!document.body.contains(checkbox)) {
        selectedItems.delete(checkbox);
      }
    });

    const selectedCount = selectedItems.size;

    if (selectedCount > 0) {
      buttonContainer.style.display = 'block';
      formatButton.textContent = `${BUTTON_TEXT} (${selectedCount} item${selectedCount === 1 ? '' : 's'})`;
    } else {
      buttonContainer.style.display = 'none';
    }
  }

  // Extract description text from a checkbox's associated item
  function extractItemDescription(checkbox) {
    // Try to find the description text near the checkbox
    // This is adaptive - it tries multiple strategies

    // Strategy 1: Look in the same row (for table-based layouts)
    const row = checkbox.closest('tr');
    if (row) {
      // Try to find description column (usually has placeholder or specific class)
      const descriptionCell = row.querySelector('textarea[placeholder*="Description"], textarea[placeholder*="description"]');
      if (descriptionCell && descriptionCell.value) {
        return descriptionCell.value.trim();
      }

      // Try to find any text content in the row
      const cellTexts = Array.from(row.querySelectorAll('td'))
        .map(td => td.textContent.trim())
        .filter(text => text.length > 0 && text.length < 500); // Reasonable description length

      if (cellTexts.length > 0) {
        return cellTexts.join(' - ');
      }
    }

    // Strategy 2: Look in parent container (for div-based layouts)
    const container = checkbox.closest('[class*="item"], [class*="row"], li, [role="listitem"]');
    if (container) {
      // Try to find textarea or input fields
      const descField = container.querySelector('textarea, input[type="text"]');
      if (descField && descField.value) {
        return descField.value.trim();
      }

      // Get text content, excluding the checkbox itself
      const clone = container.cloneNode(true);
      const cloneCheckbox = clone.querySelector('input[type="checkbox"]');
      if (cloneCheckbox) {
        cloneCheckbox.remove();
      }
      const text = clone.textContent.trim();
      if (text.length > 0 && text.length < 500) {
        return text;
      }
    }

    // Strategy 3: Look for adjacent labels or text
    const label = checkbox.closest('label') || document.querySelector(`label[for="${checkbox.id}"]`);
    if (label) {
      const text = label.textContent.trim();
      if (text.length > 0) {
        return text;
      }
    }

    // Strategy 4: Look for next sibling text elements
    let sibling = checkbox.nextElementSibling;
    let attempts = 0;
    while (sibling && attempts < 5) {
      const text = sibling.textContent.trim();
      if (text.length > 0 && text.length < 500) {
        return text;
      }
      sibling = sibling.nextElementSibling;
      attempts++;
    }

    return 'Item description not found';
  }

  // Format the selected items into a professional scope
  function formatScope(items) {
    const descriptions = items.map((checkbox, index) => {
      const description = extractItemDescription(checkbox);
      return `${index + 1}. ${description}`;
    });

    const scopeText = descriptions.join('\n\n');

    // Create a professional formatted version
    const formattedScope = `SCOPE OF WORK\n\n${scopeText}\n\nPlease review and let us know if you have any questions.`;

    return formattedScope;
  }

  // Handle format button click
  async function handleFormatClick() {
    if (selectedItems.size === 0) {
      showNotification('No items selected', 'error');
      return;
    }

    // Disable button during processing
    formatButton.disabled = true;
    formatButton.textContent = 'Processing...';

    try {
      // Get selected checkboxes as array
      const items = Array.from(selectedItems);

      // Format the scope
      const formattedScope = formatScope(items);

      // Copy to clipboard
      await copyToClipboard(formattedScope);

      // Show success notification
      showNotification(`Formatted ${items.length} item${items.length === 1 ? '' : 's'} and copied to clipboard!`, 'success');

      // Optional: Try to open JobTread's AI assistant
      // This is a bonus feature - we'll try to find and open it
      tryOpenAIAssistant(formattedScope);

    } catch (error) {
      console.error('SmartScopeGenerator: Error formatting scope:', error);
      showNotification('Error formatting scope', 'error');
    } finally {
      // Re-enable button
      formatButton.disabled = false;
      updateButtonVisibility();
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

  // Try to open JobTread's AI assistant (if available)
  function tryOpenAIAssistant(scopeText) {
    // This is experimental - we'll try to find common patterns for AI assistants
    // Look for buttons or links with text like "AI", "Assistant", "Send Message", etc.

    const possibleSelectors = [
      'button[aria-label*="AI"]',
      'button[aria-label*="Assistant"]',
      'a[href*="message"]',
      'button:has-text("AI")',
      '[data-testid*="ai"]',
      '[class*="ai-assistant"]'
    ];

    for (const selector of possibleSelectors) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          console.log('SmartScopeGenerator: Found potential AI assistant button:', element);
          // We won't auto-click it, just log it for now
          // User can manually open the AI assistant
          return true;
        }
      } catch (e) {
        // Invalid selector, continue
      }
    }

    return false;
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
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOutToTop 0.3s ease-in';
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);

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
