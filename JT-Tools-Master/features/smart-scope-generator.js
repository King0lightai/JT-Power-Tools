// JobTread Smart Scope Generator Feature Module
// Allows users to select line items and format them into professional scope text

const SmartScopeGeneratorFeature = (() => {
  let isActive = false;
  let observer = null;
  let formatButton = null;
  let updateInterval = null;

  // Configuration
  const BUTTON_ID = 'jt-smart-scope-button';
  const BUTTON_TEXT = 'Generate Custom Scope';
  const MAX_EXPAND_LEVELS = 10; // Increased to handle deeply nested budgets
  const EXPAND_DELAY = 500; // Increased delay between expansions (ms)
  const DEFAULT_PROMPT = 'Please rewrite the following scope of work into a professional, client-facing proposal with clear formatting, professional language, and proper structure:';

  // Store loaded prompts
  let customPrompts = null;

  // Initialize the feature
  function init() {
    if (isActive) {
      console.log('SmartScopeGenerator: Already initialized');
      return;
    }

    console.log('SmartScopeGenerator: Initializing...');
    isActive = true;

    // Load custom prompts from storage
    loadCustomPrompts();

    // Find and inject button into Mass Budget Actions sidebar
    injectButtonIntoSidebar();

    // Check for sidebar and re-inject if needed
    updateInterval = setInterval(() => {
      if (!document.getElementById(BUTTON_ID)) {
        injectButtonIntoSidebar();
      }
    }, 1000);

    // Watch for DOM changes
    observer = new MutationObserver(() => {
      if (!document.getElementById(BUTTON_ID)) {
        injectButtonIntoSidebar();
      }
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

    console.log('SmartScopeGenerator: Cleanup complete');
  }

  // Find the Mass Budget Actions sidebar and inject our button
  function injectButtonIntoSidebar() {
    // Don't inject if already exists
    if (document.getElementById(BUTTON_ID)) {
      formatButton = document.getElementById(BUTTON_ID);
      return;
    }

    // Find the Mass Budget Actions sidebar
    // Look for the container with "Mass Budget Actions" title
    const sidebars = document.querySelectorAll('.absolute.inset-0.bg-white.shadow-line-left');

    let targetContainer = null;
    for (const sidebar of sidebars) {
      // Check if this sidebar has "Mass Budget Actions" text
      const title = sidebar.querySelector('.font-bold.text-jtOrange.uppercase');
      if (title && title.textContent.includes('Mass Budget Actions')) {
        // Find the action buttons container (the second .p-4.space-y-2 div)
        const actionContainers = sidebar.querySelectorAll('.p-4.space-y-2');
        if (actionContainers.length >= 2) {
          targetContainer = actionContainers[1]; // Second container has the action buttons
        }
        break;
      }
    }

    if (!targetContainer) {
      // Sidebar not found or not open yet
      return;
    }

    // Create our button matching JobTread's action button style
    formatButton = document.createElement('div');
    formatButton.id = BUTTON_ID;
    formatButton.setAttribute('role', 'button');
    formatButton.setAttribute('tabindex', '0');
    formatButton.className = 'block w-full relative cursor-pointer select-none truncate py-2 px-4 shadow-xs active:shadow-inner text-white bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 rounded-sm border border-purple-600 text-center font-semibold';
    formatButton.style.cssText = 'transition: all 0.2s ease;';

    // Create button content with icon
    formatButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="inline-block overflow-visible h-[1em] w-[1em] align-[-0.125em]" viewBox="0 0 24 24">
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275z"></path>
      </svg>
      ${BUTTON_TEXT}
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="inline-block overflow-visible h-[1em] w-[1em] align-[-0.125em]" viewBox="0 0 24 24">
        <path d="M9 5H2v7l6.29 6.29c.94.94 2.48.94 3.42 0l3.58-3.58c.94-.94.94-2.48 0-3.42zM7 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2"></path>
      </svg>
    `;

    // Button click handler
    formatButton.addEventListener('click', handleFormatClick);

    // Insert button at the top of the action buttons container
    if (targetContainer.firstChild) {
      targetContainer.insertBefore(formatButton, targetContainer.firstChild);
    } else {
      targetContainer.appendChild(formatButton);
    }

    console.log('SmartScopeGenerator: Button injected into Mass Budget Actions sidebar');
  }

  // Load custom prompts from chrome.storage
  async function loadCustomPrompts() {
    try {
      const result = await chrome.storage.sync.get(['jtToolsSettings']);
      const settings = result.jtToolsSettings || {};
      customPrompts = settings.scopePrompts || [
        { name: 'Professional Proposal', text: DEFAULT_PROMPT },
        { name: 'Detailed Breakdown', text: 'Please expand this scope of work with detailed explanations of each item, including materials, labor, and timeline considerations:' },
        { name: 'Budget Justification', text: 'Please rewrite this scope to emphasize value and justify the costs, explaining why each item is necessary for the project:' }
      ];
      console.log('SmartScopeGenerator: Loaded custom prompts:', customPrompts);
    } catch (error) {
      console.error('SmartScopeGenerator: Error loading prompts:', error);
      customPrompts = [
        { name: 'Professional Proposal', text: DEFAULT_PROMPT },
        { name: 'Detailed Breakdown', text: 'Please expand this scope of work with detailed explanations of each item, including materials, labor, and timeline considerations:' },
        { name: 'Budget Justification', text: 'Please rewrite this scope to emphasize value and justify the costs, explaining why each item is necessary for the project:' }
      ];
    }
  }

  // Show prompt selection modal
  function showPromptSelectionModal() {
    return new Promise((resolve) => {
      // Create modal overlay
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.2s ease;
      `;

      // Create modal content
      const modal = document.createElement('div');
      modal.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        animation: slideIn 0.3s ease;
      `;

      // Create modal header
      const header = document.createElement('div');
      header.style.cssText = `
        margin-bottom: 20px;
        border-bottom: 2px solid #e5e7eb;
        padding-bottom: 12px;
      `;
      header.innerHTML = `
        <h2 style="margin: 0; font-size: 20px; font-weight: 600; color: #1f2937;">Select AI Prompt</h2>
        <p style="margin: 8px 0 0 0; font-size: 14px; color: #6b7280;">Choose how the AI should enhance your scope:</p>
      `;

      // Create prompt options
      const optionsContainer = document.createElement('div');
      optionsContainer.style.cssText = 'margin-bottom: 20px;';

      // Default prompt option
      const defaultOption = createPromptOption('Default', DEFAULT_PROMPT, true);
      optionsContainer.appendChild(defaultOption);

      // Custom prompt options
      if (customPrompts) {
        customPrompts.forEach((prompt, index) => {
          const option = createPromptOption(prompt.name, prompt.text, false);
          optionsContainer.appendChild(option);
        });
      }

      // Create buttons
      const buttonsContainer = document.createElement('div');
      buttonsContainer.style.cssText = `
        display: flex;
        gap: 12px;
        justify-content: flex-end;
      `;

      const cancelButton = document.createElement('button');
      cancelButton.textContent = 'Cancel';
      cancelButton.style.cssText = `
        padding: 10px 20px;
        border: 1px solid #d1d5db;
        background: white;
        color: #374151;
        border-radius: 6px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      `;
      cancelButton.onmouseover = () => cancelButton.style.background = '#f3f4f6';
      cancelButton.onmouseout = () => cancelButton.style.background = 'white';
      cancelButton.onclick = () => {
        overlay.remove();
        resolve(null);
      };

      buttonsContainer.appendChild(cancelButton);

      // Assemble modal
      modal.appendChild(header);
      modal.appendChild(optionsContainer);
      modal.appendChild(buttonsContainer);
      overlay.appendChild(modal);

      // Add animations
      const style = document.createElement('style');
      style.textContent = `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);

      // Close on overlay click
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.remove();
          resolve(null);
        }
      });

      // Add to DOM
      document.body.appendChild(overlay);

      // Helper function to create prompt option
      function createPromptOption(name, text, isDefault) {
        const option = document.createElement('div');
        option.style.cssText = `
          padding: 16px;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          margin-bottom: 12px;
          cursor: pointer;
          transition: all 0.2s;
          background: ${isDefault ? '#f0f9ff' : 'white'};
          border-color: ${isDefault ? '#3b82f6' : '#e5e7eb'};
        `;

        option.innerHTML = `
          <div style="display: flex; align-items: center; margin-bottom: 8px;">
            <div style="width: 20px; height: 20px; border-radius: 50%; border: 2px solid ${isDefault ? '#3b82f6' : '#d1d5db'}; margin-right: 12px; display: flex; align-items: center; justify-content: center; background: ${isDefault ? '#3b82f6' : 'white'};">
              ${isDefault ? '<div style="width: 10px; height: 10px; border-radius: 50%; background: white;"></div>' : ''}
            </div>
            <div style="font-weight: 600; color: #1f2937; font-size: 15px;">${name}${isDefault ? ' <span style="color: #3b82f6; font-size: 13px;">(Recommended)</span>' : ''}</div>
          </div>
          <div style="font-size: 13px; color: #6b7280; margin-left: 32px; line-height: 1.5;">${text}</div>
        `;

        option.onmouseover = () => {
          option.style.borderColor = '#3b82f6';
          option.style.background = '#f0f9ff';
        };
        option.onmouseout = () => {
          if (!isDefault) {
            option.style.borderColor = '#e5e7eb';
            option.style.background = 'white';
          }
        };

        option.onclick = () => {
          overlay.remove();
          resolve(text);
        };

        return option;
      }
    });
  }

  // Find all collapsed group expand buttons (chevron right icons)
  function findCollapsedGroups() {
    const collapsedGroups = [];

    // Look for chevron right icons in budget rows
    // These indicate collapsed groups
    const rows = document.querySelectorAll('.group\\/row');

    rows.forEach(row => {
      // Look for chevron right SVG (collapsed state)
      const svgs = row.querySelectorAll('svg');
      svgs.forEach(svg => {
        const paths = svg.querySelectorAll('path');
        paths.forEach(path => {
          const d = path.getAttribute('d');
          // Chevron right pattern: m9 18 6-6-6-6
          if (d && d.includes('m9 18 6-6-6-6')) {
            // Find the clickable parent button
            let button = svg.closest('[role="button"]');
            if (button) {
              collapsedGroups.push(button);
            }
          }
        });
      });
    });

    return collapsedGroups;
  }

  // Find all expanded group collapse buttons (chevron down icons)
  function findExpandedGroups() {
    const expandedGroups = [];

    // Look for chevron down icons in budget rows
    const rows = document.querySelectorAll('.group\\/row');

    rows.forEach(row => {
      // Look for chevron down SVG (expanded state)
      const svgs = row.querySelectorAll('svg');
      svgs.forEach(svg => {
        const paths = svg.querySelectorAll('path');
        paths.forEach(path => {
          const d = path.getAttribute('d');
          // Chevron down pattern: m6 9 6 6 6-6
          if (d && d.includes('m6 9 6 6 6-6')) {
            // Find the clickable parent button
            let button = svg.closest('[role="button"]');
            if (button) {
              expandedGroups.push(button);
            }
          }
        });
      });
    });

    return expandedGroups;
  }

  // Expand all collapsed groups (up to MAX_EXPAND_LEVELS)
  async function expandAllGroups() {
    console.log('SmartScopeGenerator: Expanding collapsed groups...');

    const expandedButtons = [];

    for (let level = 0; level < MAX_EXPAND_LEVELS; level++) {
      const collapsedGroups = findCollapsedGroups();

      if (collapsedGroups.length === 0) {
        console.log(`SmartScopeGenerator: All groups expanded at level ${level}`);
        break;
      }

      console.log(`SmartScopeGenerator: Expanding ${collapsedGroups.length} groups at level ${level}...`);

      // Click all collapsed groups
      collapsedGroups.forEach(button => {
        button.click();
        expandedButtons.push(button);
      });

      // Wait for DOM to update (longer delay for complex budgets)
      await new Promise(resolve => setTimeout(resolve, EXPAND_DELAY));
    }

    console.log(`SmartScopeGenerator: Expanded ${expandedButtons.length} total groups`);

    // Extra wait to ensure all DOM rendering is complete
    await new Promise(resolve => setTimeout(resolve, 500));

    return expandedButtons;
  }

  // Collapse all expanded groups
  async function collapseAllGroups(expandedButtons) {
    console.log('SmartScopeGenerator: Collapsing expanded groups...');

    // Find all currently expanded groups
    const expandedGroups = findExpandedGroups();

    console.log(`SmartScopeGenerator: Collapsing ${expandedGroups.length} groups...`);

    // Click to collapse them
    expandedGroups.forEach(button => {
      button.click();
    });

    // Wait for DOM to update
    await new Promise(resolve => setTimeout(resolve, 200));

    console.log('SmartScopeGenerator: Groups collapsed');
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
        // Use classList to avoid issues with SVGAnimatedString on SVG elements
        if (!el.classList) return false;
        return el.classList.contains('bg-blue-50') ||
               el.classList.contains('bg-blue-100') ||
               el.classList.contains('bg-blue-200');
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

  // Extract name from the Name column (2nd column, width: 300px)
  function extractItemName(row) {
    // Get all column divs in the row
    const columns = row.querySelectorAll(':scope > div');

    // The Name column is the 2nd column (index 1)
    // It has style="width: 300px; flex-grow: 300;"
    if (columns.length >= 2) {
      const nameColumn = columns[1];

      // Look for textarea with placeholder="Name"
      const nameField = nameColumn.querySelector('textarea[placeholder="Name"]');
      if (nameField && nameField.value.trim()) {
        return nameField.value.trim();
      }

      // Look for text in draggable elements
      const draggables = nameColumn.querySelectorAll('[draggable="true"]');
      for (const draggable of draggables) {
        const text = draggable.textContent.trim();
        if (text && text.length > 0 && !text.match(/^\d+$/)) {
          return text;
        }
      }

      // Look for any textarea
      const textareas = nameColumn.querySelectorAll('textarea');
      for (const textarea of textareas) {
        const value = textarea.value.trim();
        if (value && value.length > 0) {
          return value;
        }
      }
    }

    return '';
  }

  // Extract description from the Description column (5th column, width: 435px)
  function extractItemDescription(row) {
    // Get all column divs in the row
    const columns = row.querySelectorAll(':scope > div');

    // The Description column is the 5th column (index 4)
    // It has style="width: 435px; flex-grow: 435;"
    if (columns.length >= 5) {
      const descColumn = columns[4];

      // Look for textarea in this column
      const textareas = descColumn.querySelectorAll('textarea');
      for (const textarea of textareas) {
        const value = textarea.value.trim();
        if (value && value.length > 0) {
          return value;
        }
      }

      // Look for text content in divs
      const textDivs = descColumn.querySelectorAll('div');
      for (const div of textDivs) {
        const text = div.textContent.trim();
        if (text && text.length > 0 && text.length < 1000) {
          return text;
        }
      }
    }

    return '';
  }

  // Format selected items into professional scope
  function formatScope(rows) {
    const items = [];

    rows.forEach((row, index) => {
      const name = extractItemName(row);
      const description = extractItemDescription(row);

      if (!name) return; // Skip rows without names

      let itemText = `${index + 1}. ${name}`;

      // Add description if available
      if (description) {
        itemText += `\n   ${description}`;
      }

      items.push(itemText);
    });

    if (items.length === 0) {
      return null;
    }

    const scopeText = items.join('\n\n');

    // Create professional formatted version
    const formattedScope = `SCOPE OF WORK\n\n${scopeText}\n\nPlease review and let us know if you have any questions.`;

    return formattedScope;
  }

  // Find and click the Message button in the job header toolbar
  function clickMessageButton() {
    // Look for the Message button in the toolbar
    // It has text "Message" and is in a button group

    // Strategy 1: Find by button text content
    const buttons = document.querySelectorAll('[role="button"]');
    for (const button of buttons) {
      const text = button.textContent.trim();
      if (text === 'Message' || text.includes(' Message')) {
        // Check if it's in the toolbar (has specific classes)
        const classes = button.className || '';
        if (classes.includes('inline-block') &&
            classes.includes('py-2') &&
            classes.includes('px-4') &&
            classes.includes('border-y')) {
          console.log('SmartScopeGenerator: Found Message button, clicking...');
          button.click();
          return true;
        }
      }
    }

    // Strategy 2: Find by looking for the SVG pattern (plus icon) with "Message" text
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      if (el.textContent.trim().endsWith(' Message') || el.textContent.trim() === 'Message') {
        const svg = el.querySelector('svg path[d*="M5 12h14M12 5v14"]');
        if (svg) {
          console.log('SmartScopeGenerator: Found Message button via SVG, clicking...');
          el.click();
          return true;
        }
      }
    }

    console.log('SmartScopeGenerator: Message button not found');
    return false;
  }

  // Find and click the compose button in the message popup
  async function clickComposeButton() {
    // Wait for the popup to appear and the compose button to be available
    console.log('SmartScopeGenerator: Waiting for compose button...');

    for (let attempt = 0; attempt < 10; attempt++) {
      // Look for the compose button by its SVG pattern
      // The SVG has paths: "M12 8V4H8" and "M2 14h2M20 14h2M15 13v2M9 13v2"
      const buttons = document.querySelectorAll('[role="button"]');

      for (const button of buttons) {
        const svgs = button.querySelectorAll('svg');
        for (const svg of svgs) {
          const paths = svg.querySelectorAll('path');
          for (const path of paths) {
            const d = path.getAttribute('d');
            // Check for the compose icon pattern
            if (d && (d.includes('M12 8V4H8') || d.includes('M2 14h2M20 14h2'))) {
              // Verify it's a small button (py-1 px-2 classes)
              const classes = button.className || '';
              if (classes.includes('py-1') && classes.includes('px-2')) {
                console.log('SmartScopeGenerator: Found compose button, clicking...');
                button.click();
                return true;
              }
            }
          }
        }
      }

      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log('SmartScopeGenerator: Compose button not found');
    return false;
  }

  // Find the Writing Assistant input field, paste text, and submit with Enter
  async function pasteIntoWritingAssistant(text) {
    console.log('SmartScopeGenerator: Waiting for Writing Assistant input...');

    for (let attempt = 0; attempt < 10; attempt++) {
      // Look for input with placeholder "How can I help?"
      const inputs = document.querySelectorAll('input[placeholder="How can I help?"]');

      if (inputs.length > 0) {
        const input = inputs[0];
        console.log('SmartScopeGenerator: Found Writing Assistant input, pasting...');

        // Focus the input first
        input.focus();
        await new Promise(resolve => setTimeout(resolve, 100));

        // Use modern clipboard API if available, otherwise set value directly
        try {
          // Clear existing value
          input.value = '';

          // Simulate typing by setting value and dispatching proper events
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeInputValueSetter.call(input, text);

          // Dispatch input event (React listens to this)
          const inputEvent = new Event('input', { bubbles: true });
          input.dispatchEvent(inputEvent);

          console.log('SmartScopeGenerator: Text pasted, submitting with Enter key...');
          await new Promise(resolve => setTimeout(resolve, 200));

          // Press Enter to submit (more reliable than clicking Send)
          input.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
          }));

          input.dispatchEvent(new KeyboardEvent('keypress', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
          }));

          input.dispatchEvent(new KeyboardEvent('keyup', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
          }));

          console.log('SmartScopeGenerator: Enter key pressed');
          return true;

        } catch (error) {
          console.error('SmartScopeGenerator: Error pasting text:', error);
        }
      }

      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log('SmartScopeGenerator: Writing Assistant input not found');
    return false;
  }

  // Click the Send button in Writing Assistant
  async function clickSendButton() {
    console.log('SmartScopeGenerator: Looking for Send button...');

    // Retry for up to 5 seconds to find enabled Send button
    for (let attempt = 0; attempt < 15; attempt++) {
      const buttons = document.querySelectorAll('button');

      for (const button of buttons) {
        const text = button.textContent.trim();
        if (text.includes('Send')) {
          // Check if it's enabled (not disabled)
          if (!button.disabled) {
            console.log('SmartScopeGenerator: Found enabled Send button, clicking...');
            button.click();
            return true;
          } else {
            console.log(`SmartScopeGenerator: Send button found but disabled (attempt ${attempt + 1}/15)...`);
          }
        }
      }

      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log('SmartScopeGenerator: Send button not found or still disabled after 5 seconds');
    return false;
  }

  // Wait for AI response and click Copy button
  async function waitForAIResponseAndCopy() {
    console.log('SmartScopeGenerator: Waiting for AI response...');

    for (let attempt = 0; attempt < 100; attempt++) { // 30 seconds total (100 * 300ms)
      // Look for the Copy button in the response
      // It has an SVG with paths for a copy icon
      const buttons = document.querySelectorAll('[role="button"]');

      for (const button of buttons) {
        const text = button.textContent.trim();
        if (text === 'Copy' || text.includes('Copy')) {
          // Verify it has the copy icon SVG
          const svg = button.querySelector('svg');
          if (svg) {
            const paths = svg.querySelectorAll('path');
            for (const path of paths) {
              const d = path.getAttribute('d');
              // Copy icon pattern: M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10
              if (d && d.includes('M4 16c-1.1 0-2-.9-2-2V4c0-1.1')) {
                console.log('SmartScopeGenerator: Found Copy button in AI response, clicking...');
                button.click();
                return true;
              }
            }
          }
        }
      }

      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log('SmartScopeGenerator: AI response Copy button not found (timeout)');
    return false;
  }

  // Handle format button click
  async function handleFormatClick(e) {
    e.preventDefault();
    e.stopPropagation();

    // Step 0: Show prompt selection modal
    const selectedPrompt = await showPromptSelectionModal();

    // User cancelled
    if (selectedPrompt === null) {
      console.log('SmartScopeGenerator: User cancelled prompt selection');
      return;
    }

    console.log('SmartScopeGenerator: Selected prompt:', selectedPrompt);

    // Store original button content
    const originalHTML = formatButton.innerHTML;
    formatButton.disabled = true;
    formatButton.style.opacity = '0.6';
    formatButton.style.cursor = 'wait';
    formatButton.style.pointerEvents = 'none';

    // Update button text
    const iconSvg = formatButton.querySelector('svg');
    if (iconSvg) {
      formatButton.innerHTML = iconSvg.outerHTML + ' Expanding groups...';
    } else {
      formatButton.textContent = 'Expanding groups...';
    }

    try {
      // Step 1: Expand all collapsed groups
      const expandedButtons = await expandAllGroups();

      // Update button text
      if (iconSvg) {
        formatButton.innerHTML = iconSvg.outerHTML + ' Extracting items...';
      } else {
        formatButton.textContent = 'Extracting items...';
      }

      // Step 2: Get selected items (now visible in DOM)
      const selectedRows = getSelectedItems();

      if (selectedRows.length === 0) {
        showNotification('No items selected', 'error');
        // Collapse groups back
        await collapseAllGroups(expandedButtons);
        return;
      }

      // Step 3: Format the scope
      const formattedScope = formatScope(selectedRows);

      if (!formattedScope) {
        showNotification('No valid items found to format', 'error');
        // Collapse groups back
        await collapseAllGroups(expandedButtons);
        return;
      }

      // Update button text
      if (iconSvg) {
        formatButton.innerHTML = iconSvg.outerHTML + ' Copying to clipboard...';
      } else {
        formatButton.textContent = 'Copying to clipboard...';
      }

      // Step 4: Copy to clipboard
      await copyToClipboard(formattedScope);

      // Step 5: Collapse groups back to original state
      await collapseAllGroups(expandedButtons);

      // Show success notification
      showNotification(
        `✓ Formatted ${selectedRows.length} item${selectedRows.length === 1 ? '' : 's'} and copied to clipboard!`,
        'success'
      );

      console.log('SmartScopeGenerator: Formatted scope:', formattedScope);

      // Step 6: Automated AI workflow
      setTimeout(async () => {
        try {
          // 6a. Click Message button
          const messageClicked = clickMessageButton();
          if (!messageClicked) {
            showNotification('Could not find Message button', 'error');
            return;
          }
          showNotification('Opening message composer...', 'info');

          // 6b. Click compose button
          const composeClicked = await clickComposeButton();
          if (!composeClicked) {
            showNotification('Could not find compose button', 'error');
            return;
          }
          showNotification('Writing Assistant opened...', 'info');

          // 6c. Paste into Writing Assistant with selected prompt and submit with Enter
          const promptedText = `${selectedPrompt}\n\n${formattedScope}`;
          const pasted = await pasteIntoWritingAssistant(promptedText);
          if (!pasted) {
            showNotification('Could not paste and submit to AI', 'error');
            return;
          }
          showNotification('Waiting for AI response (up to 30s)...', 'info');

          // 6d. Wait for AI response and copy
          const copied = await waitForAIResponseAndCopy();
          if (copied) {
            showNotification('✓ AI-enhanced scope copied to clipboard!', 'success');

            // 6e. Press Escape twice to close dialogs
            await new Promise(resolve => setTimeout(resolve, 500));
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
            await new Promise(resolve => setTimeout(resolve, 300));
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));

            console.log('SmartScopeGenerator: Closed dialogs with Escape');
          } else {
            showNotification('AI response timeout. Original scope in clipboard.', 'error');
          }
        } catch (error) {
          console.error('SmartScopeGenerator: Error in AI workflow:', error);
          showNotification('Error in AI workflow. Original scope in clipboard.', 'error');
        }
      }, 500);

    } catch (error) {
      console.error('SmartScopeGenerator: Error formatting scope:', error);
      showNotification('Error formatting scope', 'error');
    } finally {
      // Re-enable button
      formatButton.disabled = false;
      formatButton.style.opacity = '1';
      formatButton.style.cursor = 'pointer';
      formatButton.style.pointerEvents = 'auto';
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

    // Remove after 3 seconds (shorter for info messages)
    const duration = type === 'info' ? 2000 : 4000;
    setTimeout(() => {
      notification.style.animation = 'slideOutToTop 0.3s ease-in';
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, duration);

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
