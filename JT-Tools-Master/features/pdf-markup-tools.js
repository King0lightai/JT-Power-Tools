/**
 * JobTread PDF Markup Tools Enhancement
 * Integrates with JobTread's native PDF annotation system
 *
 * New Tools:
 * - Highlight tool (uses JobTread's rectangle + yellow color)
 * - Custom stamps library (uses JobTread's text tool)
 * - Line tool shortcut
 * - Enhanced eraser
 *
 * Integration Strategy:
 * - Programmatically triggers JobTread's native tool buttons
 * - Uses their annotation system for persistence and undo/redo
 * - Adds shortcuts and presets on top of their system
 *
 * @module PDFMarkupTools
 * @author JT Power Tools Team
 */

const PDFMarkupToolsFeature = (() => {
  // Local state
  let isActive = false;
  let observer = null;
  let styleElement = null;
  let injectedTools = [];
  let currentStampCategory = 'approval'; // approval, date, custom

  // Store references to injected elements for cleanup
  const toolbarEnhancements = new WeakMap();

  // Cache for JobTread's native tool buttons
  let jtNativeButtons = null;

  // Stamp library
  const stampLibrary = {
    approval: [
      { name: 'APPROVED', icon: '✓', color: '#22c55e', textColor: '#fff' },
      { name: 'REVIEWED', icon: '👁', color: '#3b82f6', textColor: '#fff' },
      { name: 'REJECTED', icon: '✗', color: '#ef4444', textColor: '#fff' },
      { name: 'PENDING', icon: '⏱', color: '#f59e0b', textColor: '#fff' },
      { name: 'CONFIDENTIAL', icon: '🔒', color: '#dc2626', textColor: '#fff' }
    ],
    date: [
      { name: 'DATE_STAMP', icon: '📅', color: '#6366f1', textColor: '#fff', includeDate: true },
      { name: 'COMPLETED', icon: '✓', color: '#10b981', textColor: '#fff', includeDate: true },
      { name: 'RECEIVED', icon: '📥', color: '#0ea5e9', textColor: '#fff', includeDate: true }
    ],
    architecture: [
      { name: 'LIGHT_CEILING', icon: '💡', color: '#fbbf24', textColor: '#000' },
      { name: 'OUTLET_STD', icon: '⚡', color: '#3b82f6', textColor: '#fff' },
      { name: 'OUTLET_GFCI', icon: '⚡', color: '#ef4444', textColor: '#fff' },
      { name: 'SWITCH', icon: 'S', color: '#6b7280', textColor: '#fff' },
      { name: 'SWITCH_3WAY', icon: 'S3', color: '#6b7280', textColor: '#fff' },
      { name: 'HVAC_VENT', icon: '❄', color: '#0ea5e9', textColor: '#fff' },
      { name: 'DOOR', icon: '🚪', color: '#78716c', textColor: '#fff' },
      { name: 'WINDOW', icon: '🪟', color: '#0284c7', textColor: '#fff' },
      { name: 'CALLOUT_A', icon: 'A', color: '#dc2626', textColor: '#fff' },
      { name: 'CALLOUT_B', icon: 'B', color: '#dc2626', textColor: '#fff' },
      { name: 'CALLOUT_C', icon: 'C', color: '#dc2626', textColor: '#fff' },
      { name: 'DIMENSION', icon: '↔', color: '#059669', textColor: '#fff' }
    ],
    custom: [] // User-created stamps stored in Chrome storage
  };

  /**
   * Inject CSS styles for our new tools
   */
  function injectCSS() {
    if (styleElement) return;

    const css = `
      /* PDF Markup Tools Enhancement Styles */
      .jt-pdf-tool-btn {
        display: inline-block;
        vertical-align: bottom;
        position: relative;
        cursor: pointer;
        user-select: none;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        padding: 0.25rem 0.5rem;
        box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        background-color: #fff;
        color: #4b5563;
        border: 1px solid #e5e7eb;
        text-align: center;
        flex-shrink: 0;
      }

      .jt-pdf-tool-btn:hover {
        background-color: #f9fafb;
      }

      .jt-pdf-tool-btn:active {
        box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.05);
      }

      .jt-pdf-tool-btn.active {
        background-color: #374151;
        color: #fff;
        border-color: #374151;
      }

      .jt-pdf-tool-btn.active:hover {
        background-color: #1f2937;
      }

      .jt-pdf-tool-btn svg {
        display: inline-block;
        overflow: visible;
        height: 1em;
        width: 1em;
        vertical-align: -0.125em;
      }

      /* Stamp selector dropdown */
      .jt-stamp-selector {
        position: absolute;
        left: 100%;
        top: 0;
        margin-left: 0.5rem;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 0.25rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        z-index: 10000;
        min-width: 200px;
        max-width: 300px;
        display: none;
      }

      .jt-stamp-selector.show {
        display: block;
      }

      .jt-stamp-category {
        padding: 0.5rem;
        border-bottom: 1px solid #e5e7eb;
      }

      .jt-stamp-category-btn {
        padding: 0.25rem 0.5rem;
        margin-right: 0.25rem;
        border-radius: 0.25rem;
        background: #f3f4f6;
        color: #6b7280;
        border: none;
        cursor: pointer;
        font-size: 0.875rem;
      }

      .jt-stamp-category-btn.active {
        background: #3b82f6;
        color: white;
      }

      .jt-stamp-list {
        padding: 0.5rem;
        max-height: 400px;
        overflow-y: auto;
      }

      .jt-stamp-item {
        display: flex;
        align-items: center;
        padding: 0.5rem;
        margin-bottom: 0.25rem;
        border-radius: 0.25rem;
        cursor: pointer;
        border: 1px solid #e5e7eb;
      }

      .jt-stamp-item:hover {
        background: #f9fafb;
      }

      .jt-stamp-icon {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 0.25rem;
        margin-right: 0.5rem;
        font-size: 1.25rem;
      }

      .jt-stamp-name {
        font-size: 0.875rem;
        font-weight: 500;
        color: #374151;
      }

      /* Highlight tool indicator */
      .jt-highlight-icon {
        fill: #fbbf24;
        stroke: #f59e0b;
      }

      /* Separator line between tool groups */
      .jt-tool-separator {
        height: 1px;
        background: #e5e7eb;
        margin: 0.5rem 0;
      }

      /* Badge for new tools */
      .jt-new-badge {
        position: absolute;
        top: -4px;
        right: -4px;
        background: #ef4444;
        color: white;
        font-size: 0.625rem;
        padding: 0.125rem 0.25rem;
        border-radius: 0.25rem;
        font-weight: 600;
      }

      /* Toast notification animations */
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(400px);
          opacity: 0;
        }
      }

      .jt-pdf-notification {
        transition: all 0.3s ease-out;
      }
    `;

    styleElement = document.createElement('style');
    styleElement.textContent = css;
    styleElement.id = 'jt-pdf-markup-tools-styles';
    document.head.appendChild(styleElement);
    console.log('PDF Markup Tools: CSS injected');
  }

  /**
   * Create SVG icon for highlight tool
   */
  function createHighlightIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.classList.add('jt-highlight-icon');

    // Highlighter pen icon
    const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path1.setAttribute('d', 'M9 11 4 6l4-4 5 5');
    svg.appendChild(path1);

    const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path2.setAttribute('d', 'm9 11 4 4-8 8H2l1-9 6-3z');
    svg.appendChild(path2);

    const path3 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path3.setAttribute('d', 'm16 16 3-8 3 3-8 3');
    svg.appendChild(path3);

    return svg;
  }

  /**
   * Create SVG icon for stamp tool
   */
  function createStampIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');

    // Stamp icon (star in circle)
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '12');
    circle.setAttribute('r', '10');
    svg.appendChild(circle);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83');
    svg.appendChild(path);

    return svg;
  }

  /**
   * Create SVG icon for line tool
   */
  function createLineIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '5');
    line.setAttribute('y1', '19');
    line.setAttribute('x2', '19');
    line.setAttribute('y2', '5');
    svg.appendChild(line);

    return svg;
  }

  /**
   * Create SVG icon for eraser tool
   */
  function createEraserIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');

    const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path1.setAttribute('d', 'm7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21');
    svg.appendChild(path1);

    const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path2.setAttribute('d', 'M22 21H7');
    svg.appendChild(path2);

    const path3 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path3.setAttribute('d', 'm5 11 9 9');
    svg.appendChild(path3);

    return svg;
  }

  /**
   * Create a tool button
   */
  function createToolButton(icon, tooltip, onClick) {
    const btn = document.createElement('div');
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    btn.setAttribute('title', tooltip);
    btn.className = 'jt-pdf-tool-btn shadow-xs mt-2';

    btn.appendChild(icon);

    // Add click handler
    btn.addEventListener('click', onClick);

    // Add keyboard support
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick(e);
      }
    });

    return btn;
  }

  /**
   * Create stamp selector dropdown
   */
  function createStampSelector() {
    const container = document.createElement('div');
    container.className = 'jt-stamp-selector';
    container.id = 'jt-stamp-selector';

    // Category buttons
    const categorySection = document.createElement('div');
    categorySection.className = 'jt-stamp-category';

    const categories = [
      { key: 'approval', label: 'Approval' },
      { key: 'date', label: 'Date' },
      { key: 'architecture', label: 'Architecture' },
      { key: 'custom', label: 'Custom' }
    ];

    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'jt-stamp-category-btn';
      btn.textContent = cat.label;
      if (cat.key === currentStampCategory) {
        btn.classList.add('active');
      }

      btn.addEventListener('click', () => {
        currentStampCategory = cat.key;
        updateStampSelector();
      });

      categorySection.appendChild(btn);
    });

    container.appendChild(categorySection);

    // Stamp list
    const stampList = document.createElement('div');
    stampList.className = 'jt-stamp-list';
    stampList.id = 'jt-stamp-list';
    container.appendChild(stampList);

    updateStampList(stampList);

    return container;
  }

  /**
   * Update stamp list based on current category
   */
  function updateStampList(stampList) {
    if (!stampList) {
      stampList = document.getElementById('jt-stamp-list');
      if (!stampList) return;
    }

    stampList.innerHTML = '';

    const stamps = stampLibrary[currentStampCategory] || [];

    if (stamps.length === 0) {
      const empty = document.createElement('div');
      empty.style.padding = '1rem';
      empty.style.textAlign = 'center';
      empty.style.color = '#6b7280';
      empty.textContent = 'No stamps in this category';
      stampList.appendChild(empty);
      return;
    }

    stamps.forEach(stamp => {
      const item = document.createElement('div');
      item.className = 'jt-stamp-item';

      const icon = document.createElement('div');
      icon.className = 'jt-stamp-icon';
      icon.style.backgroundColor = stamp.color;
      icon.style.color = stamp.textColor;
      icon.textContent = stamp.icon;

      const name = document.createElement('div');
      name.className = 'jt-stamp-name';
      name.textContent = stamp.name.replace(/_/g, ' ');

      item.appendChild(icon);
      item.appendChild(name);

      item.addEventListener('click', () => {
        applyStamp(stamp);
        hideStampSelector();
      });

      stampList.appendChild(item);
    });
  }

  /**
   * Update stamp selector UI
   */
  function updateStampSelector() {
    // Update category buttons
    const categoryBtns = document.querySelectorAll('.jt-stamp-category-btn');
    categoryBtns.forEach(btn => {
      if (btn.textContent.toLowerCase() === currentStampCategory) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update stamp list
    const stampList = document.getElementById('jt-stamp-list');
    if (stampList) {
      updateStampList(stampList);
    }
  }

  /**
   * Show stamp selector
   */
  function showStampSelector(button) {
    const selector = document.getElementById('jt-stamp-selector');
    if (!selector) return;

    // Position relative to button
    const rect = button.getBoundingClientRect();
    selector.style.top = rect.top + 'px';
    selector.style.left = (rect.right + 8) + 'px';

    selector.classList.add('show');
  }

  /**
   * Hide stamp selector
   */
  function hideStampSelector() {
    const selector = document.getElementById('jt-stamp-selector');
    if (selector) {
      selector.classList.remove('show');
    }
  }

  /**
   * Get the active SVG plan element
   */
  function getActiveSVG() {
    return document.querySelector('svg[cursor="crosshair"]');
  }

  /**
   * Find JobTread's native tool buttons
   * Returns object with button references keyed by button index/type
   */
  function findJobTreadButtons() {
    if (jtNativeButtons) return jtNativeButtons;

    const buttons = document.querySelectorAll('.inline-block.align-bottom.relative.cursor-pointer.select-none.truncate.py-1.px-2.shadow-xs');

    if (buttons.length === 0) {
      console.warn('PDF Markup Tools: Could not find JobTread native buttons');
      return null;
    }

    console.log(`PDF Markup Tools: Found ${buttons.length} JobTread native buttons`);

    // Map buttons by their likely function (based on order and SVG content)
    // Button 4 appears to be freedraw based on user's console output
    jtNativeButtons = {
      all: Array.from(buttons),
      freedraw: buttons[4], // Button 4 is the freedraw tool
      square: buttons[3],   // Rectangle/square tool (for highlights)
      // Add more as we identify them
    };

    // Also find the delete button (separate selector - has different classes)
    const deleteBtn = document.querySelector('.inline-block.align-bottom.relative.cursor-pointer.select-none.truncate.py-2.px-4.shadow-xs.text-red-500');
    if (deleteBtn) {
      jtNativeButtons.delete = deleteBtn;
      console.log('PDF Markup Tools: Found delete button');
    }

    return jtNativeButtons;
  }

  /**
   * Check if a JobTread button is active
   */
  function isJobTreadButtonActive(button) {
    if (!button) return false;
    return button.classList.contains('bg-gray-700') && button.classList.contains('text-white');
  }

  /**
   * Activate a JobTread native tool by clicking its button
   */
  function activateJobTreadTool(buttonKey) {
    const buttons = findJobTreadButtons();
    if (!buttons) {
      console.error('PDF Markup Tools: Cannot find JobTread buttons');
      return false;
    }

    const button = buttons[buttonKey];
    if (!button) {
      console.error(`PDF Markup Tools: Button "${buttonKey}" not found`);
      return false;
    }

    // Only click if not already active
    if (!isJobTreadButtonActive(button)) {
      console.log(`PDF Markup Tools: Activating JobTread ${buttonKey} tool`);
      button.click();
      return true;
    }

    console.log(`PDF Markup Tools: JobTread ${buttonKey} tool already active`);
    return true;
  }

  /**
   * Find and click JobTread's color picker to set a specific color
   */
  function setJobTreadColor(hexColor) {
    console.log(`PDF Markup Tools: Attempting to set color to ${hexColor}`);

    // Convert hex to RGB
    const rgb = hexToRgb(hexColor);
    if (!rgb) {
      console.error('PDF Markup Tools: Invalid hex color');
      return;
    }

    // Look for the color picker button (appears when a drawing tool is active)
    // Structure: div.w-7.h-7.border with background-color style
    const colorPicker = document.querySelector('.w-7.h-7.border.flex.items-center.justify-center.rounded-sm.border-gray-300.shadow-xs.self-center.cursor-pointer');

    if (colorPicker) {
      console.log('PDF Markup Tools: Found color picker, clicking to open...');
      colorPicker.click();

      // Wait for color picker modal to open and render RGB inputs
      setTimeout(() => {
        setRgbValues(rgb.r, rgb.g, rgb.b);
      }, 200);
    } else {
      console.log('PDF Markup Tools: Color picker not found (tool may not be active yet)');
    }
  }

  /**
   * Convert hex color to RGB
   */
  function hexToRgb(hex) {
    // Remove # if present
    hex = hex.replace('#', '');

    // Parse hex values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      return null;
    }

    return { r, g, b };
  }

  /**
   * Set RGB values in JobTread's color picker
   */
  function setRgbValues(r, g, b) {
    console.log(`PDF Markup Tools: Setting RGB values: R=${r}, G=${g}, B=${b}`);

    // Find all number inputs in the color picker area
    const allInputs = Array.from(document.querySelectorAll('input[type="number"], input[type="text"]'));

    // Filter to likely RGB inputs (value should be 0-255)
    const rgbInputs = allInputs.filter(input => {
      const value = parseInt(input.value);
      return !isNaN(value) && value >= 0 && value <= 255 && input.parentElement;
    });

    console.log(`PDF Markup Tools: Found ${rgbInputs.length} potential RGB inputs`);

    if (rgbInputs.length >= 3) {
      // Assume first 3 inputs are R, G, B in order
      const [rInput, gInput, bInput] = rgbInputs.slice(0, 3);

      setInputValue(rInput, r);
      setInputValue(gInput, g);
      setInputValue(bInput, b);

      console.log('PDF Markup Tools: Successfully set RGB values');
      showNotification(`Color set to yellow (RGB: ${r}, ${g}, ${b})`);
    } else {
      console.warn('PDF Markup Tools: Could not find RGB inputs');
      showNotification('Please manually select yellow color', 'info');
    }
  }

  /**
   * Set input value and trigger React events
   */
  function setInputValue(input, value) {
    // Set the value using React's way
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    ).set;

    nativeInputValueSetter.call(input, value);

    // Dispatch events to trigger React's change detection
    const inputEvent = new Event('input', { bubbles: true });
    input.dispatchEvent(inputEvent);

    const changeEvent = new Event('change', { bubbles: true });
    input.dispatchEvent(changeEvent);

    // Also trigger blur to ensure value is committed
    const blurEvent = new Event('blur', { bubbles: true });
    input.dispatchEvent(blurEvent);
  }

  /**
   * Show a notification to the user
   */
  function showNotification(message, type = 'info') {
    console.log(`PDF Markup Tools: ${message}`);

    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.className = 'jt-pdf-notification';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: ${type === 'error' ? '#ef4444' : '#3b82f6'};
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 10000;
      font-size: 14px;
      font-weight: 500;
      max-width: 300px;
      animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(toast);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * Apply a stamp to the PDF
   * Currently copies stamp text to clipboard for manual pasting
   */
  function applyStamp(stamp) {
    console.log('PDF Markup Tools: Applying stamp:', stamp);

    // Prepare stamp text
    let stampText = stamp.icon + ' ' + stamp.name.replace(/_/g, ' ');
    if (stamp.includeDate) {
      const date = new Date().toLocaleDateString();
      stampText += ' - ' + date;
    }

    // Copy to clipboard
    navigator.clipboard.writeText(stampText).then(() => {
      showNotification(`"${stampText}" copied to clipboard. Click on the PDF to paste using JobTread's text tool.`);

      // TODO: Auto-activate JobTread's text tool if we can identify it
      // For now, user manually activates text tool and pastes
    }).catch(err => {
      console.error('Failed to copy stamp text:', err);
      showNotification('Stamp: ' + stampText, 'info');
    });
  }

  // Note: makeDraggable function removed - JobTread handles annotation manipulation

  /**
   * Handle highlight tool click - activates JobTread's rectangle tool with yellow color
   */
  function handleHighlightClick() {
    console.log('PDF Markup Tools: Highlight tool clicked');

    const highlightBtn = document.querySelector('[data-jt-tool="highlight"]');
    if (!highlightBtn) return;

    const wasActive = highlightBtn.classList.contains('active');

    if (!wasActive) {
      // Activate JobTread's rectangle/square tool
      const success = activateJobTreadTool('square');

      if (success) {
        // Mark our button as active
        deactivateOtherTools('highlight');
        highlightBtn.classList.add('active');

        // Try to set yellow color for highlighting
        setJobTreadColor('#FFFF00');

        // Show user notification
        showNotification('Highlight mode active - Draw rectangles to highlight areas');
      } else {
        console.error('PDF Markup Tools: Failed to activate highlight tool');
        showNotification('Could not activate highlight tool', 'error');
      }
    } else {
      // Deactivate
      highlightBtn.classList.remove('active');
      // Optionally deactivate JobTread's tool by clicking it again
      const buttons = findJobTreadButtons();
      if (buttons && buttons.square && isJobTreadButtonActive(buttons.square)) {
        buttons.square.click();
      }
      showNotification('Highlight mode deactivated');
    }
  }

  /**
   * Deactivate all other JT tools (visual state only)
   * JobTread's buttons manage their own state
   */
  function deactivateOtherTools(exceptTool) {
    const tools = ['highlight', 'line', 'eraser', 'stamp'];

    tools.forEach(toolName => {
      if (toolName === exceptTool) return;

      const btn = document.querySelector(`[data-jt-tool="${toolName}"]`);
      if (btn && btn.classList.contains('active')) {
        btn.classList.remove('active');
      }
    });

    // Hide stamp selector if open
    if (exceptTool !== 'stamp') {
      hideStampSelector();
    }
  }

  // Note: Old drawing mode functions removed - we now use JobTread's native tools
  // This eliminates event listener conflicts and ensures proper integration with
  // their save/undo system

  /**
   * Handle line tool click - activates JobTread's freedraw tool for lines
   */
  function handleLineClick() {
    console.log('PDF Markup Tools: Line tool clicked');

    const lineBtn = document.querySelector('[data-jt-tool="line"]');
    if (!lineBtn) return;

    const wasActive = lineBtn.classList.contains('active');

    if (!wasActive) {
      // Activate JobTread's freedraw tool
      const success = activateJobTreadTool('freedraw');

      if (success) {
        deactivateOtherTools('line');
        lineBtn.classList.add('active');
        showNotification('Line tool active - Draw lines on the PDF');
      } else {
        console.error('PDF Markup Tools: Failed to activate line tool');
        showNotification('Could not activate line tool', 'error');
      }
    } else {
      lineBtn.classList.remove('active');
      const buttons = findJobTreadButtons();
      if (buttons && buttons.freedraw && isJobTreadButtonActive(buttons.freedraw)) {
        buttons.freedraw.click();
      }
      showNotification('Line tool deactivated');
    }
  }

  // Old line drawing mode functions removed - using JobTread's freedraw tool instead

  /**
   * Handle eraser tool click
   * Activates JobTread's delete mode by clicking their delete button
   */
  function handleEraserClick() {
    console.log('PDF Markup Tools: Eraser tool clicked');

    const eraserBtn = document.querySelector('[data-jt-tool="eraser"]');
    if (!eraserBtn) return;

    const wasActive = eraserBtn.classList.contains('active');

    if (!wasActive) {
      // Try to activate JobTread's delete button
      const buttons = findJobTreadButtons();

      if (buttons && buttons.delete) {
        console.log('PDF Markup Tools: Clicking JobTread delete button');
        buttons.delete.click();

        deactivateOtherTools('eraser');
        eraserBtn.classList.add('active');
        showNotification('Eraser mode active - Click annotations to delete them');
      } else {
        // Fallback if delete button not found
        console.warn('PDF Markup Tools: Delete button not found');
        showNotification('Select an annotation and press Delete key to erase', 'info');
        setTimeout(() => {
          eraserBtn.classList.remove('active');
        }, 100);
      }
    } else {
      // Deactivate
      eraserBtn.classList.remove('active');
      const buttons = findJobTreadButtons();
      if (buttons && buttons.delete) {
        // Click again to deactivate delete mode
        buttons.delete.click();
      }
      showNotification('Eraser mode deactivated');
    }
  }

  /**
   * Handle stamp tool click
   */
  function handleStampClick(e) {
    console.log('PDF Markup Tools: Stamp tool clicked');

    const stampBtn = document.querySelector('[data-jt-tool="stamp"]');
    const selector = document.getElementById('jt-stamp-selector');

    if (selector && selector.classList.contains('show')) {
      hideStampSelector();
      if (stampBtn) {
        stampBtn.classList.remove('active');
      }
    } else {
      showStampSelector(stampBtn);
      if (stampBtn) {
        stampBtn.classList.add('active');
      }
    }
  }

  /**
   * Inject tools into the PDF toolbar
   */
  function injectTools(toolbar) {
    if (!toolbar) return;
    if (toolbarEnhancements.has(toolbar)) return; // Already injected

    console.log('PDF Markup Tools: Injecting tools into toolbar');

    // Find the container where tools are added
    const toolContainer = toolbar.querySelector('.relative.grow > .absolute.inset-0 > .flex.flex-col');
    if (!toolContainer) {
      console.warn('PDF Markup Tools: Could not find tool container');
      return;
    }

    // Create separator
    const separator = document.createElement('div');
    separator.className = 'jt-tool-separator';

    // Create our tools
    const highlightBtn = createToolButton(
      createHighlightIcon(),
      'Highlight Tool (JT Enhanced)',
      handleHighlightClick
    );
    highlightBtn.setAttribute('data-jt-tool', 'highlight');

    const stampBtn = createToolButton(
      createStampIcon(),
      'Custom Stamps (JT Enhanced)',
      handleStampClick
    );
    stampBtn.setAttribute('data-jt-tool', 'stamp');
    stampBtn.style.position = 'relative';

    const lineBtn = createToolButton(
      createLineIcon(),
      'Line Tool (JT Enhanced)',
      handleLineClick
    );
    lineBtn.setAttribute('data-jt-tool', 'line');

    const eraserBtn = createToolButton(
      createEraserIcon(),
      'Eraser Tool (JT Enhanced)',
      handleEraserClick
    );
    eraserBtn.setAttribute('data-jt-tool', 'eraser');

    // Create stamp selector and append to body
    const stampSelector = createStampSelector();
    document.body.appendChild(stampSelector);

    // Append tools to toolbar
    toolContainer.appendChild(separator);
    toolContainer.appendChild(highlightBtn);
    toolContainer.appendChild(stampBtn);
    toolContainer.appendChild(lineBtn);
    toolContainer.appendChild(eraserBtn);

    // Track injected elements
    toolbarEnhancements.set(toolbar, {
      separator,
      highlightBtn,
      stampBtn,
      lineBtn,
      eraserBtn,
      stampSelector
    });

    injectedTools.push({ toolbar, separator, highlightBtn, stampBtn, lineBtn, eraserBtn, stampSelector });

    console.log('PDF Markup Tools: Tools injected successfully');
  }

  /**
   * Find and enhance PDF toolbars on the page
   */
  function findAndEnhanceToolbars() {
    // Look for PDF toolbar containers
    // Based on the HTML structure you provided:
    // <div class="flex relative shadow-line-left p-1">
    const toolbars = document.querySelectorAll('.flex.relative.shadow-line-left.p-1');

    console.log(`PDF Markup Tools: Found ${toolbars.length} potential PDF toolbars`);

    toolbars.forEach(toolbar => {
      // Verify it's actually a PDF toolbar by checking for tool buttons
      const hasTools = toolbar.querySelector('[role="button"] svg');
      if (hasTools) {
        injectTools(toolbar);
      }
    });
  }

  /**
   * Remove all injected tools
   */
  function removeInjectedTools() {
    injectedTools.forEach(({ separator, highlightBtn, stampBtn, lineBtn, eraserBtn, stampSelector }) => {
      separator?.remove();
      highlightBtn?.remove();
      stampBtn?.remove();
      lineBtn?.remove();
      eraserBtn?.remove();
      stampSelector?.remove();
    });

    injectedTools = [];
    toolbarEnhancements = new WeakMap();
  }

  /**
   * Handle clicks outside stamp selector to close it
   */
  function handleDocumentClick(e) {
    const stampSelector = document.getElementById('jt-stamp-selector');
    const stampBtn = document.querySelector('[data-jt-tool="stamp"]');

    if (!stampSelector || !stampSelector.classList.contains('show')) return;

    // Check if click is outside both selector and stamp button
    if (!stampSelector.contains(e.target) && e.target !== stampBtn && !stampBtn.contains(e.target)) {
      hideStampSelector();
      if (stampBtn) {
        stampBtn.classList.remove('active');
      }
    }
  }

  /**
   * Handle Delete key press to remove selected annotations
   */
  function handleDeleteKey(e) {
    // Only handle Delete/Backspace keys
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;

    // Don't interfere with input fields
    const target = e.target;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    const svg = getActiveSVG();
    if (!svg) return;

    // Find selected annotation (look for elements with certain attributes or classes that indicate selection)
    // JobTread might mark selected items differently - we'll try a few approaches
    const selectedAnnotation = svg.querySelector('[data-selected="true"]') ||
                               svg.querySelector('.selected') ||
                               svg.querySelector('[aria-selected="true"]');

    if (selectedAnnotation) {
      console.log('PDF Markup Tools: Deleting selected annotation via Delete key');
      e.preventDefault();

      // Try to trigger JobTread's delete button
      const buttons = findJobTreadButtons();
      if (buttons && buttons.delete) {
        buttons.delete.click();
      } else {
        // Fallback: directly remove the element (may not persist)
        selectedAnnotation.remove();
        showNotification('Annotation deleted');
      }
    }
  }

  /**
   * Initialize the feature
   */
  function init() {
    if (isActive) {
      console.log('PDF Markup Tools: Already initialized');
      return;
    }

    console.log('PDF Markup Tools: Initializing...');
    isActive = true;

    try {
      // Inject CSS
      injectCSS();

      // Find and enhance existing toolbars
      findAndEnhanceToolbars();

      // Watch for new toolbars (PDF pages loaded dynamically)
      observer = new MutationObserver(() => {
        findAndEnhanceToolbars();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      // Handle clicks outside stamp selector
      document.addEventListener('click', handleDocumentClick, true);

      // Handle Delete key for removing annotations
      document.addEventListener('keydown', handleDeleteKey);

      console.log('PDF Markup Tools: Feature loaded successfully');
    } catch (error) {
      console.error('PDF Markup Tools: Error during initialization:', error);
      isActive = false;
      throw error;
    }
  }

  /**
   * Cleanup the feature
   */
  function cleanup() {
    if (!isActive) {
      console.log('PDF Markup Tools: Not active, nothing to cleanup');
      return;
    }

    console.log('PDF Markup Tools: Cleaning up...');
    isActive = false;

    // Deactivate all our tools
    deactivateOtherTools(null);

    // Remove injected tools
    removeInjectedTools();

    // Disconnect observer
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    // Remove event listeners
    document.removeEventListener('click', handleDocumentClick, true);
    document.removeEventListener('keydown', handleDeleteKey);

    // Remove injected CSS
    if (styleElement) {
      styleElement.remove();
      styleElement = null;
    }

    // Clear button cache
    jtNativeButtons = null;

    console.log('PDF Markup Tools: Cleanup complete');
  }

  /**
   * Check if feature is active
   */
  function isFeatureActive() {
    return isActive;
  }

  // Public API
  return {
    init,
    cleanup,
    isActive: isFeatureActive
  };
})();

// Expose to window for content script orchestrator
window.PDFMarkupToolsFeature = PDFMarkupToolsFeature;
