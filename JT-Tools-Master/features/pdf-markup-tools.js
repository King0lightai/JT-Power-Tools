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

  // Store references to injected elements for cleanup
  const toolbarEnhancements = new WeakMap();

  // Cache for JobTread's native tool buttons
  let jtNativeButtons = null;

  // Stamp library - using clear text abbreviations for markup/redlining
  // These are universally readable without special fonts
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
      // Doors & Windows - clear abbreviations
      { name: 'DOOR', icon: '🚪', color: '#374151', textColor: '#fff', copyText: 'DOOR' },
      { name: 'SLIDING_DOOR', icon: '⟺', color: '#374151', textColor: '#fff', copyText: 'SLIDER' },
      { name: 'BIFOLD_DOOR', icon: '⋈', color: '#374151', textColor: '#fff', copyText: 'BIFOLD' },
      { name: 'POCKET_DOOR', icon: '⊏', color: '#374151', textColor: '#fff', copyText: 'POCKET' },
      { name: 'WINDOW', icon: '⬜', color: '#374151', textColor: '#fff', copyText: 'WIN' },
      { name: 'FRENCH_DOOR', icon: '⧈', color: '#374151', textColor: '#fff', copyText: 'FRENCH DR' },
      // Electrical - industry standard abbreviations
      { name: 'OUTLET', icon: '⊙', color: '#f59e0b', textColor: '#fff', copyText: 'OUTLET' },
      { name: 'SWITCHED_OUTLET', icon: '⊛', color: '#f59e0b', textColor: '#fff', copyText: 'SW OUTLET' },
      { name: 'GFI_OUTLET', icon: '⊚', color: '#f59e0b', textColor: '#fff', copyText: 'GFI' },
      { name: '220V_OUTLET', icon: '⦿', color: '#f59e0b', textColor: '#fff', copyText: '220V' },
      { name: 'SWITCH', icon: 'S', color: '#f59e0b', textColor: '#fff', copyText: 'SW' },
      { name: '3_WAY_SWITCH', icon: 'S₃', color: '#f59e0b', textColor: '#fff', copyText: '3-WAY SW' },
      { name: 'DIMMER', icon: 'D', color: '#f59e0b', textColor: '#fff', copyText: 'DIMMER' },
      { name: 'LIGHT', icon: '💡', color: '#f59e0b', textColor: '#fff', copyText: 'LIGHT' },
      { name: 'CEILING_FAN', icon: '⌀', color: '#f59e0b', textColor: '#fff', copyText: 'FAN' },
      { name: 'RECESSED_LIGHT', icon: '◎', color: '#f59e0b', textColor: '#fff', copyText: 'RECESS' },
      { name: 'SMOKE_DETECTOR', icon: '◉', color: '#ef4444', textColor: '#fff', copyText: 'SMOKE DET' },
      { name: 'THERMOSTAT', icon: 'T', color: '#f59e0b', textColor: '#fff', copyText: 'TSTAT' },
      // Plumbing - clear abbreviations
      { name: 'TOILET', icon: '🚽', color: '#0ea5e9', textColor: '#fff', copyText: 'WC' },
      { name: 'BATHTUB', icon: '🛁', color: '#0ea5e9', textColor: '#fff', copyText: 'TUB' },
      { name: 'SHOWER', icon: '🚿', color: '#0ea5e9', textColor: '#fff', copyText: 'SHWR' },
      { name: 'SINK', icon: '○', color: '#0ea5e9', textColor: '#fff', copyText: 'SINK' },
      { name: 'DOUBLE_SINK', icon: '○○', color: '#0ea5e9', textColor: '#fff', copyText: 'DBL SINK' },
      { name: 'WATER_HEATER', icon: '⬡', color: '#0ea5e9', textColor: '#fff', copyText: 'WH' },
      { name: 'DISHWASHER', icon: '▣', color: '#0ea5e9', textColor: '#fff', copyText: 'DW' },
      { name: 'WASHER', icon: 'W', color: '#0ea5e9', textColor: '#fff', copyText: 'WASH' },
      { name: 'DRYER', icon: 'D', color: '#0ea5e9', textColor: '#fff', copyText: 'DRY' },
      // Appliances
      { name: 'RANGE', icon: '▦', color: '#6b7280', textColor: '#fff', copyText: 'RANGE' },
      { name: 'REFRIGERATOR', icon: '▯', color: '#6b7280', textColor: '#fff', copyText: 'REF' },
      { name: 'MICROWAVE', icon: '▢', color: '#6b7280', textColor: '#fff', copyText: 'MW' },
      // HVAC
      { name: 'SUPPLY_AIR', icon: '↑', color: '#10b981', textColor: '#fff', copyText: 'SUPPLY' },
      { name: 'RETURN_AIR', icon: '↓', color: '#10b981', textColor: '#fff', copyText: 'RETURN' },
      { name: 'HVAC_UNIT', icon: '⬢', color: '#10b981', textColor: '#fff', copyText: 'HVAC' },
      // Markup callouts
      { name: 'NOTE', icon: '📝', color: '#dc2626', textColor: '#fff', copyText: 'NOTE:' },
      { name: 'VERIFY', icon: '❓', color: '#dc2626', textColor: '#fff', copyText: 'VERIFY' },
      { name: 'REVISION', icon: '△', color: '#dc2626', textColor: '#fff', copyText: 'REV' },
      { name: 'ADD', icon: '+', color: '#22c55e', textColor: '#fff', copyText: 'ADD' },
      { name: 'REMOVE', icon: '−', color: '#ef4444', textColor: '#fff', copyText: 'REMOVE' },
      { name: 'RELOCATE', icon: '→', color: '#8b5cf6', textColor: '#fff', copyText: 'RELOCATE' }
    ],
    custom: [] // User-created stamps stored in Chrome storage
  };

  /**
   * Inject CSS styles for our new tools
   * Includes dark mode and RGB theme compatibility
   */
  function injectCSS() {
    if (styleElement) return;

    const css = `
      /* PDF Markup Tools Enhancement Styles */

      /* ========== BASE STYLES ========== */
      /* PDF toolbar has dark bg (gray-800), so buttons need to match */
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
        background-color: transparent;
        color: #9ca3af;
        border: none;
        text-align: center;
        flex-shrink: 0;
        border-radius: 0.125rem;
        margin-top: 0.5rem;
      }

      .jt-pdf-tool-btn:hover {
        background-color: #4b5563;
        color: #fff;
      }

      .jt-pdf-tool-btn:active {
        opacity: 0.9;
      }

      /* Active state - matches JT's active button style */
      .jt-pdf-tool-btn.active {
        background-color: #374151;
        color: #fff;
      }

      .jt-pdf-tool-btn.active:hover {
        background-color: #4b5563;
      }

      .jt-pdf-tool-btn svg {
        display: inline-block;
        overflow: visible;
        height: 1em;
        width: 1em;
        vertical-align: -0.125em;
      }

      /* Highlight tool indicator */
      .jt-highlight-icon {
        fill: #fbbf24;
        stroke: #f59e0b;
      }

      /* Separator line between tool groups - for dark toolbar */
      .jt-tool-separator {
        height: 1px;
        background: #4b5563;
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

      /* Stamp quick-select base styles - dark theme to match modal */
      .jt-stamp-quick-select {
        background-color: #1f2937;
        border-color: #374151;
      }

      .jt-stamp-btn {
        background-color: #374151;
        color: #e5e7eb;
        border-color: #4b5563;
      }

      .jt-stamp-btn:hover {
        background-color: #4b5563;
      }

      .jt-stamp-tab {
        background-color: #374151;
        color: #e5e7eb;
        border-color: #4b5563;
      }

      .jt-stamp-tab.active {
        background-color: #6b7280;
        color: #fff;
        border-color: #6b7280;
      }

      /* ========== DARK MODE STYLES ========== */
      /* Note: PDF toolbar buttons don't need dark mode overrides since the PDF toolbar
         is always dark (bg-gray-800) and base styles are already designed for dark bg */

      body.jt-dark-mode .jt-pdf-notification {
        background-color: #1e40af !important;
      }

      body.jt-dark-mode .jt-pdf-notification.error {
        background-color: #991b1b !important;
      }

      /* Dark mode stamp quick-select - modal is always dark, so no overrides needed */
      /* Base styles already use dark theme colors */

      /* ========== RGB/CUSTOM THEME STYLES ========== */
      body.jt-custom-theme .jt-pdf-tool-btn {
        background-color: var(--jt-theme-background, #fff);
        color: var(--jt-theme-text, #4b5563);
        border-color: var(--jt-theme-border, #e5e7eb);
      }

      body.jt-custom-theme .jt-pdf-tool-btn:hover {
        background-color: var(--jt-theme-background-subtle, #f9fafb);
      }

      body.jt-custom-theme .jt-pdf-tool-btn.active {
        background-color: var(--jt-theme-primary, #3b82f6);
        color: var(--jt-theme-primary-text, #fff);
        border-color: var(--jt-theme-primary, #3b82f6);
      }

      body.jt-custom-theme .jt-pdf-tool-btn.active:hover {
        background-color: var(--jt-theme-primary-hover, #2563eb);
      }

      body.jt-custom-theme .jt-tool-separator {
        background: var(--jt-theme-border, #e5e7eb);
      }

      body.jt-custom-theme .jt-pdf-notification {
        background-color: var(--jt-theme-primary, #3b82f6) !important;
        color: var(--jt-theme-primary-text, #fff) !important;
      }

      /* RGB theme stamp quick-select - modal is always dark, so no RGB overrides needed */
      /* Base styles already use dark theme colors that work for all themes */
    `;

    styleElement = document.createElement('style');
    styleElement.textContent = css;
    styleElement.id = 'jt-pdf-markup-tools-styles';
    document.head.appendChild(styleElement);
    console.log('PDF Markup Tools: CSS injected (with dark mode & RGB theme support)');
  }

  /**
   * Create SVG icon for highlight tool - simple filled rectangle
   */
  function createHighlightIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');

    // Simple rectangle with yellow fill to represent highlight
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '3');
    rect.setAttribute('y', '6');
    rect.setAttribute('width', '18');
    rect.setAttribute('height', '12');
    rect.setAttribute('rx', '2');
    rect.setAttribute('fill', '#fbbf24');
    rect.setAttribute('fill-opacity', '0.5');
    rect.setAttribute('stroke', '#f59e0b');
    svg.appendChild(rect);

    // Horizontal lines to suggest text being highlighted
    const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line1.setAttribute('x1', '6');
    line1.setAttribute('y1', '10');
    line1.setAttribute('x2', '18');
    line1.setAttribute('y2', '10');
    line1.setAttribute('stroke', '#92400e');
    line1.setAttribute('stroke-width', '1.5');
    svg.appendChild(line1);

    const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line2.setAttribute('x1', '6');
    line2.setAttribute('y1', '14');
    line2.setAttribute('x2', '14');
    line2.setAttribute('y2', '14');
    line2.setAttribute('stroke', '#92400e');
    line2.setAttribute('stroke-width', '1.5');
    svg.appendChild(line2);

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
    btn.className = 'jt-pdf-tool-btn mt-2';

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
   * Get the active SVG plan element
   */
  function getActiveSVG() {
    return document.querySelector('svg[cursor="crosshair"]');
  }

  /**
   * Find JobTread's native tool buttons
   * Returns object with button references keyed by button index/type
   *
   * JobTread toolbar layout (as of Jan 2026):
   * - Top group: Move (0), Select (1), Zoom In (2), Zoom Out (3)
   * - Drawing group: Freedraw/Pencil (4), Text (5), Arrow/Line (6), Rectangle (7), Circle (8), Connector (9)
   * - More options (10)
   */
  function findJobTreadButtons() {
    // Always refresh button references since toolbar can re-render
    jtNativeButtons = null;

    // Find buttons within the PDF toolbar specifically - try multiple toolbar structures
    let toolbar = document.querySelector('.flex.relative.shadow-line-left.p-1');

    // Try file viewer toolbar if first not found
    if (!toolbar) {
      toolbar = document.querySelector('.bg-gray-800 .relative .absolute.inset-0.flex');
    }

    if (!toolbar) {
      console.warn('PDF Markup Tools: Could not find PDF toolbar');
      return null;
    }

    // Get all native JT buttons (exclude our custom .jt-pdf-tool-btn buttons)
    const buttons = toolbar.querySelectorAll('[role="button"]:not(.jt-pdf-tool-btn)');

    if (buttons.length === 0) {
      console.warn('PDF Markup Tools: Could not find JobTread native buttons');
      return null;
    }

    console.log(`PDF Markup Tools: Found ${buttons.length} JobTread native buttons`);

    // Map buttons by their function based on SVG content analysis
    // We identify buttons by their SVG path content for reliability
    jtNativeButtons = {
      all: Array.from(buttons),
      move: null,
      select: null,
      zoomIn: null,
      zoomOut: null,
      freedraw: null,
      text: null,
      line: null,      // Arrow/line tool
      rectangle: null, // Rectangle tool (for highlights)
      circle: null,
      connector: null,
      more: null
    };

    // Identify each button by its SVG content
    buttons.forEach((btn, index) => {
      const svg = btn.querySelector('svg');
      if (!svg) return;

      const svgContent = svg.innerHTML;

      // Move tool - has multiple arrow paths
      if (svgContent.includes('M12 2v20') && svgContent.includes('M2 12h20')) {
        jtNativeButtons.move = btn;
      }
      // Select/pointer tool - cursor shape
      else if (svgContent.includes('M4.037 4.688')) {
        jtNativeButtons.select = btn;
      }
      // Zoom in - circle with + inside
      else if (svgContent.includes('M11 8v6') && svgContent.includes('M8 11h6')) {
        jtNativeButtons.zoomIn = btn;
      }
      // Zoom out - circle with - inside
      else if (svgContent.includes('M8 11h6') && !svgContent.includes('M11 8v6')) {
        jtNativeButtons.zoomOut = btn;
      }
      // Freedraw/Pencil - pen path
      else if (svgContent.includes('M21.174 6.812') || svgContent.includes('M13 21h8')) {
        jtNativeButtons.freedraw = btn;
      }
      // Text tool - T shape
      else if (svgContent.includes('M12 4v16') && svgContent.includes('M4 7V5')) {
        jtNativeButtons.text = btn;
      }
      // Arrow/Line tool - diagonal arrow
      else if (svgContent.includes('M13 5h6v6') && svgContent.includes('M19 5 5 19')) {
        jtNativeButtons.line = btn;
      }
      // Rectangle tool
      else if (svgContent.includes('<rect') && svgContent.includes('width="18" height="18"')) {
        jtNativeButtons.rectangle = btn;
      }
      // Circle tool
      else if (svgContent.includes('<circle') && svgContent.includes('r="10"') && !svgContent.includes('path')) {
        jtNativeButtons.circle = btn;
      }
      // Connector tool - multiple circles connected
      else if (svgContent.includes('r="2.5"')) {
        jtNativeButtons.connector = btn;
      }
      // More options - three dots
      else if (svgContent.includes('r="1"') && svgContent.includes('cx="19"')) {
        jtNativeButtons.more = btn;
      }
    });

    console.log('PDF Markup Tools: Button mapping:', {
      select: !!jtNativeButtons.select,
      line: !!jtNativeButtons.line,
      rectangle: !!jtNativeButtons.rectangle,
      freedraw: !!jtNativeButtons.freedraw,
      text: !!jtNativeButtons.text
    });

    return jtNativeButtons;
  }

  /**
   * Check if a JobTread button is active
   */
  function isJobTreadButtonActive(button) {
    if (!button) return false;
    // Check for active states in different toolbar variants
    // File viewer uses bg-gray-600, PDF annotation uses bg-gray-700
    return (button.classList.contains('bg-gray-700') || button.classList.contains('bg-gray-600')) &&
           button.classList.contains('text-white');
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

  // Note: Old setHighlightPresets() and setColorOnFirstSwatch() functions removed
  // Replaced by new configureHighlightSettings() workflow with proper line/fill/opacity control

  /**
   * Set the value of a color input and trigger React change events
   */
  function setColorInputValue(input, hexColor) {
    if (!input) return;

    // Set the value using native setter
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    ).set;

    nativeInputValueSetter.call(input, hexColor);

    // Dispatch events to trigger React's change detection
    const inputEvent = new Event('input', { bubbles: true });
    input.dispatchEvent(inputEvent);

    const changeEvent = new Event('change', { bubbles: true });
    input.dispatchEvent(changeEvent);

    console.log(`PDF Markup Tools: Set color to ${hexColor}`);
  }

  // Note: Old setOpacitySlider() and openMoreOptionsAndSetPresets() functions removed
  // Replaced by setSliderValue() and configureHighlightSettings()

  /**
   * Find and click JobTread's color picker to set a specific color
   * @deprecated Use setHighlightPresets() instead for highlight tool
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
   * Theme-aware - respects dark mode and RGB theme settings
   */
  function showNotification(message, type = 'info') {
    console.log(`PDF Markup Tools: ${message}`);

    // Detect current theme for fallback colors
    const isDarkMode = document.body.classList.contains('jt-dark-mode');
    const isCustomTheme = document.body.classList.contains('jt-custom-theme');

    // Get theme-appropriate colors
    let bgColor, textColor;
    if (type === 'error') {
      bgColor = isDarkMode ? '#991b1b' : '#ef4444';
      textColor = 'white';
    } else {
      // Info/default - use theme primary if available
      if (isCustomTheme) {
        // CSS will handle via .jt-pdf-notification class
        bgColor = ''; // Let CSS handle it
        textColor = '';
      } else if (isDarkMode) {
        bgColor = '#1e40af';
        textColor = 'white';
      } else {
        bgColor = '#3b82f6';
        textColor = 'white';
      }
    }

    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.className = 'jt-pdf-notification' + (type === 'error' ? ' error' : '');
    toast.textContent = message;

    // Base styles - colors applied via CSS classes for theme support
    let styleString = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 6px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 10000;
      font-size: 14px;
      font-weight: 500;
      max-width: 300px;
      animation: slideIn 0.3s ease-out;
    `;

    // Apply inline colors only if not using custom theme (CSS handles it)
    if (!isCustomTheme && bgColor) {
      styleString += `background: ${bgColor}; color: ${textColor};`;
    } else if (!isCustomTheme) {
      // Fallback for non-custom theme
      styleString += `background: ${isDarkMode ? '#1e40af' : '#3b82f6'}; color: white;`;
    }

    toast.style.cssText = styleString;

    document.body.appendChild(toast);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * Handle highlight tool click - activates JobTread's rectangle tool with yellow highlight presets
   * Workflow: Rectangle tool → Line/Fill swatches appear → Configure colors and opacity
   */
  function handleHighlightClick() {
    console.log('PDF Markup Tools: Highlight tool clicked');

    const highlightBtn = document.querySelector('[data-jt-tool="highlight"]');
    if (!highlightBtn) return;

    const wasActive = highlightBtn.classList.contains('active');

    if (!wasActive) {
      // Activate JobTread's rectangle tool
      const success = activateJobTreadTool('rectangle');

      if (success) {
        // Mark our button as active
        deactivateOtherTools('highlight');
        highlightBtn.classList.add('active');

        // After rectangle is activated, the line/fill swatches appear in the toolbar
        // Wait for them to render, then configure (need more time for DOM update)
        setTimeout(() => {
          console.log('PDF Markup Tools: Looking for line/fill swatches...');
          configureHighlightSettings();
        }, 500);

        showNotification('Highlight mode - configuring yellow highlight...');
      } else {
        console.error('PDF Markup Tools: Failed to activate highlight tool');
        showNotification('Could not activate highlight tool', 'error');
      }
    } else {
      // Deactivate - click select tool to exit drawing mode
      highlightBtn.classList.remove('active');
      const buttons = findJobTreadButtons();
      if (buttons && buttons.select) {
        buttons.select.click();
      }
      showNotification('Highlight mode deactivated');
    }
  }

  /**
   * Configure highlight settings in the toolbar
   * JobTread Workflow (after rectangle tool activated):
   * 1. Line swatch appears (w-7 h-7 border with background-color)
   * 2. Fill swatch appears below (w-7 h-7 with droplet SVG)
   * 3. Click LINE → color picker + thickness slider popover
   * 4. Click FILL → color picker popover, click again → opacity slider
   */
  function configureHighlightSettings() {
    console.log('PDF Markup Tools: Configuring highlight settings...');

    // Find the line swatch - it's a div with w-7 h-7 border and has a background-color or diagonal line
    // The line swatch is in a flex-col container
    let lineSwatch = null;
    let fillSwatch = null;

    // Method 1: Look for the swatch container (flex flex-col space-y-1)
    const swatchContainers = document.querySelectorAll('div.flex.flex-col.space-y-1');
    console.log(`PDF Markup Tools: Found ${swatchContainers.length} potential swatch containers`);

    for (const container of swatchContainers) {
      // Line swatch: div.w-7.h-7.border with style background-color or has diagonal SVG
      const possibleLine = container.querySelector('div.w-7.h-7.border');
      // Fill swatch: has the droplet SVG path
      const possibleFill = container.querySelector('svg path[d*="M12 22a7"]');

      if (possibleLine && possibleFill) {
        lineSwatch = possibleLine;
        // Fill swatch is the parent container of the SVG
        fillSwatch = possibleFill.closest('div.w-7.h-7');
        console.log('PDF Markup Tools: Found swatches in flex-col container');
        break;
      }
    }

    // Method 2: Search for swatches in toolbar area specifically
    if (!lineSwatch || !fillSwatch) {
      console.log('PDF Markup Tools: Using toolbar-specific swatch detection...');

      // Find the toolbar first
      const toolbar = document.querySelector('.flex.relative.shadow-line-left.p-1') ||
                     document.querySelector('.bg-gray-800 .relative');

      if (toolbar) {
        // Line swatch has border class
        lineSwatch = toolbar.querySelector('div.w-7.h-7.border');

        // Fill swatch has the droplet icon
        const dropletPath = toolbar.querySelector('svg path[d*="M12 22a7"]');
        if (dropletPath) {
          fillSwatch = dropletPath.closest('div.w-7.h-7');
        }

        if (lineSwatch && fillSwatch) {
          console.log('PDF Markup Tools: Found swatches in toolbar');
        }
      }
    }

    // Method 3: Fallback - search entire document
    if (!lineSwatch || !fillSwatch) {
      console.log('PDF Markup Tools: Using document-wide swatch detection...');

      // Line swatch has border-gray-300 class
      lineSwatch = document.querySelector('div.w-7.h-7.border.border-gray-300.cursor-pointer') ||
                   document.querySelector('div.w-7.h-7.border.cursor-pointer');

      // Fill swatch has the droplet icon
      const dropletPath = document.querySelector('svg path[d*="M12 22a7 7 0 0 0 7-7"]') ||
                         document.querySelector('svg path[d*="M12 22a7"]');
      if (dropletPath) {
        fillSwatch = dropletPath.closest('div.w-7.h-7');
      }
    }

    // Method 4: Final fallback - any w-7 h-7 elements that look like swatches
    if (!lineSwatch || !fillSwatch) {
      console.log('PDF Markup Tools: Using broad fallback...');
      const allSwatches = document.querySelectorAll('div.w-7.h-7.cursor-pointer');
      console.log(`PDF Markup Tools: Found ${allSwatches.length} potential swatch elements`);

      if (allSwatches.length >= 2) {
        // Typically line is first, fill is second
        lineSwatch = lineSwatch || allSwatches[0];
        fillSwatch = fillSwatch || allSwatches[1];
      }
    }

    if (!lineSwatch || !fillSwatch) {
      console.log('PDF Markup Tools: Could not find line/fill swatches');
      console.log('PDF Markup Tools: lineSwatch:', lineSwatch);
      console.log('PDF Markup Tools: fillSwatch:', fillSwatch);
      showNotification('Set colors manually: yellow fill, 50% opacity', 'info');
      return;
    }

    console.log('PDF Markup Tools: Found swatches, starting configuration...');
    console.log('PDF Markup Tools: lineSwatch:', lineSwatch);
    console.log('PDF Markup Tools: fillSwatch:', fillSwatch);
    configureWithSwatches(lineSwatch, fillSwatch);
  }

  /**
   * Configure highlight with found swatches
   */
  function configureWithSwatches(lineSwatch, fillSwatch) {
    // Step 1: Click LINE swatch to open color picker + thickness
    console.log('PDF Markup Tools: Step 1 - Clicking line swatch...');
    lineSwatch.click();

    setTimeout(() => {
      // Find the popover that appeared - try multiple selectors
      let linePopover = document.querySelector('div.z-50 div.bg-gray-700') ||
                       document.querySelector('div.z-50 div.bg-gray-600') ||
                       document.querySelector('div.z-50[style*="position"]');

      console.log('PDF Markup Tools: Line popover found:', !!linePopover);

      // Find color input (hidden, type="color") - search broadly
      const colorInput = document.querySelector('div.z-50 input[type="color"]') ||
                        document.querySelector('input[type="color"]');
      if (colorInput) {
        setColorInputValue(colorInput, '#FFFF00');
        console.log('PDF Markup Tools: Line color set to yellow');
      } else {
        console.log('PDF Markup Tools: No color input found for line');
      }

      // Find thickness slider (range input)
      const thicknessSlider = document.querySelector('div.z-50 input[type="range"]');
      if (thicknessSlider) {
        setSliderValue(thicknessSlider, 1); // Minimum thickness
        console.log('PDF Markup Tools: Line thickness set to minimum');
      } else {
        console.log('PDF Markup Tools: No thickness slider found');
      }

      // Step 2: Close line popover and click FILL swatch
      setTimeout(() => {
        console.log('PDF Markup Tools: Step 2 - Closing line popover, clicking fill swatch...');

        // Click elsewhere to close line popover first
        document.body.click();

        setTimeout(() => {
          // Now click fill swatch - this opens color picker immediately
          fillSwatch.click();
          console.log('PDF Markup Tools: Fill swatch clicked');

          setTimeout(() => {
            // Find color input in the new popover
            const fillColorInput = document.querySelector('div.z-50 input[type="color"]');
            if (fillColorInput) {
              setColorInputValue(fillColorInput, '#FFFF00');
              console.log('PDF Markup Tools: Fill color set to yellow');
            } else {
              console.log('PDF Markup Tools: No fill color input found');
            }

            // Step 3: Click fill swatch AGAIN to access opacity slider
            setTimeout(() => {
              console.log('PDF Markup Tools: Step 3 - Clicking fill swatch again for opacity...');
              fillSwatch.click();

              setTimeout(() => {
                // Find opacity slider in the new popover - try multiple selectors
                const opacitySlider = document.querySelector('div.z-50 input[type="range"]');

                if (opacitySlider) {
                  setSliderValue(opacitySlider, 5); // 50% opacity (5 out of 10)
                  console.log('PDF Markup Tools: Opacity set to 50%');
                } else {
                  console.log('PDF Markup Tools: No opacity slider found');
                }

                // Close the popover
                setTimeout(() => {
                  document.body.click();
                  showNotification('Highlight ready! Draw rectangles to highlight.');
                }, 200);
              }, 300);
            }, 300);
          }, 300);
        }, 200);
      }, 300);
    }, 350);
  }

  /**
   * Set a slider to a specific value
   */
  function setSliderValue(slider, value) {
    if (!slider) return;

    // Set the value using native setter
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    ).set;

    nativeInputValueSetter.call(slider, value);

    // Dispatch events to trigger React's change detection
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * Deactivate all other JT tools (visual state only)
   * JobTread's buttons manage their own state
   */
  function deactivateOtherTools(exceptTool) {
    const tools = ['highlight', 'eraser', 'line'];

    tools.forEach(toolName => {
      if (toolName === exceptTool) return;

      const btn = document.querySelector(`[data-jt-tool="${toolName}"]`);
      if (btn && btn.classList.contains('active')) {
        btn.classList.remove('active');

        // If deactivating eraser, also disable delete-on-click mode
        if (toolName === 'eraser') {
          disableDeleteOnClick();
        }
      }
    });
  }

  // Note: Old drawing mode functions removed - we now use JobTread's native tools
  // This eliminates event listener conflicts and ensures proper integration with
  // their save/undo system

  /**
   * Handle line tool click - activates JobTread's arrow/line tool for straight lines
   */
  function handleLineClick() {
    console.log('PDF Markup Tools: Line tool clicked');

    const lineBtn = document.querySelector('[data-jt-tool="line"]');
    if (!lineBtn) return;

    const wasActive = lineBtn.classList.contains('active');

    if (!wasActive) {
      // Activate JobTread's arrow/line tool (not freedraw)
      const success = activateJobTreadTool('line');

      if (success) {
        deactivateOtherTools('line');
        lineBtn.classList.add('active');
        showNotification('Line tool active - Click and drag to draw straight lines');
      } else {
        console.error('PDF Markup Tools: Failed to activate line tool');
        showNotification('Could not activate line tool', 'error');
      }
    } else {
      // Deactivate - click select tool to exit drawing mode
      lineBtn.classList.remove('active');
      const buttons = findJobTreadButtons();
      if (buttons && buttons.select) {
        buttons.select.click();
      }
      showNotification('Line tool deactivated');
    }
  }

  // Old line drawing mode functions removed - using JobTread's freedraw tool instead

  /**
   * Handle eraser tool click
   * Activates JobTread's select tool so user can click annotations to select them,
   * then press Delete key to remove them
   */
  function handleEraserClick() {
    console.log('PDF Markup Tools: Eraser tool clicked');

    const eraserBtn = document.querySelector('[data-jt-tool="eraser"]');
    if (!eraserBtn) return;

    const wasActive = eraserBtn.classList.contains('active');

    if (!wasActive) {
      // Activate JobTread's select tool for selecting annotations
      const success = activateJobTreadTool('select');

      if (success) {
        deactivateOtherTools('eraser');
        eraserBtn.classList.add('active');

        // Enable delete-on-click mode
        enableDeleteOnClick();

        showNotification('Eraser mode active - Click annotations to delete them');
      } else {
        console.error('PDF Markup Tools: Failed to activate eraser/select tool');
        showNotification('Could not activate eraser tool', 'error');
      }
    } else {
      // Deactivate
      eraserBtn.classList.remove('active');
      disableDeleteOnClick();
      showNotification('Eraser mode deactivated');
    }
  }

  // Track delete-on-click state
  let deleteOnClickEnabled = false;
  let deleteClickHandler = null;

  /**
   * Enable delete-on-click mode - clicking an annotation will select it and then click the delete button
   * The workflow is: click selects -> wait for delete button to appear -> click delete button
   */
  function enableDeleteOnClick() {
    if (deleteOnClickEnabled) return;
    deleteOnClickEnabled = true;

    deleteClickHandler = (e) => {
      // Check if eraser is still active
      const eraserBtn = document.querySelector('[data-jt-tool="eraser"]');
      if (!eraserBtn || !eraserBtn.classList.contains('active')) {
        disableDeleteOnClick();
        return;
      }

      // Check if we clicked on an SVG element (annotation)
      const target = e.target;
      const svgParent = target.closest('svg.h-full.object-contain');

      if (svgParent) {
        // Find the clicked element within the SVG
        const clickedElement = target.closest('path, rect, circle, line, polyline, polygon, text, g');

        if (clickedElement && clickedElement !== svgParent) {
          // Check if this is likely an annotation (not part of the base PDF)
          const isAnnotation = clickedElement.hasAttribute('data-annotation') ||
                              clickedElement.style.fill ||
                              clickedElement.style.stroke ||
                              clickedElement.getAttribute('stroke-width') ||
                              clickedElement.getAttribute('fill') ||
                              clickedElement.getAttribute('stroke');

          if (isAnnotation || clickedElement.tagName === 'path' || clickedElement.tagName === 'rect' ||
              clickedElement.tagName === 'circle' || clickedElement.tagName === 'line' ||
              clickedElement.tagName === 'text') {

            console.log('PDF Markup Tools: Annotation clicked, selecting and waiting for delete button...');

            // Let the click propagate first to select the element
            // Don't stop propagation - let JobTread's select tool handle the selection

            // Wait for the delete button to appear after selection, then click it
            setTimeout(() => {
              clickDeleteButton();
            }, 200); // Wait for selection UI to render
          }
        }
      }
    };

    // Add click listener - don't use capture so the selection happens first
    document.addEventListener('click', deleteClickHandler, false);
    console.log('PDF Markup Tools: Delete-on-click mode enabled');
  }

  /**
   * Find and click the delete button that appears when an annotation is selected
   * The delete button has a trash icon with paths: M10 11v6, M14 11v6, M19 6v14...
   */
  function clickDeleteButton() {
    // Look for the delete button by its trash icon SVG paths
    // The trash icon has distinctive paths: "M10 11v6" and "M14 11v6"
    const allButtons = document.querySelectorAll('div[role="button"]');

    for (const btn of allButtons) {
      const svg = btn.querySelector('svg');
      if (!svg) continue;

      const paths = svg.querySelectorAll('path');
      let hasTrashIcon = false;

      for (const path of paths) {
        const d = path.getAttribute('d') || '';
        // Check for the distinctive trash can paths
        if (d.includes('M10 11v6') || d.includes('M14 11v6') || d.includes('M19 6v14')) {
          hasTrashIcon = true;
          break;
        }
      }

      if (hasTrashIcon) {
        console.log('PDF Markup Tools: Found delete button with trash icon, clicking...');
        btn.click();
        console.log('PDF Markup Tools: Delete button clicked');
        return true;
      }
    }

    // Fallback: Look for red delete button (old selector)
    const redDeleteButton = document.querySelector('div[role="button"].text-red-500');
    if (redDeleteButton) {
      console.log('PDF Markup Tools: Found red delete button, clicking...');
      redDeleteButton.click();
      return true;
    }

    console.log('PDF Markup Tools: Delete button not found - annotation may not be selected');
    return false;
  }

  /**
   * Disable delete-on-click mode
   */
  function disableDeleteOnClick() {
    if (!deleteOnClickEnabled) return;
    deleteOnClickEnabled = false;

    if (deleteClickHandler) {
      document.removeEventListener('click', deleteClickHandler, false);
      deleteClickHandler = null;
    }
    console.log('PDF Markup Tools: Delete-on-click mode disabled');
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
      'Highlight Tool (JT Enhanced) - Yellow rectangle with 50% opacity',
      handleHighlightClick
    );
    highlightBtn.setAttribute('data-jt-tool', 'highlight');

    const eraserBtn = createToolButton(
      createEraserIcon(),
      'Eraser Tool (JT Enhanced)',
      handleEraserClick
    );
    eraserBtn.setAttribute('data-jt-tool', 'eraser');

    // Append tools to toolbar
    toolContainer.appendChild(separator);
    toolContainer.appendChild(highlightBtn);
    toolContainer.appendChild(eraserBtn);

    // Track injected elements
    toolbarEnhancements.set(toolbar, {
      separator,
      highlightBtn,
      eraserBtn
    });

    injectedTools.push({ toolbar, separator, highlightBtn, eraserBtn });

    console.log('PDF Markup Tools: Tools injected successfully');
  }

  /**
   * Find and enhance PDF toolbars on the page
   */
  function findAndEnhanceToolbars() {
    // Look for PDF toolbar containers - multiple possible structures
    // Structure 1: <div class="flex relative shadow-line-left p-1">
    const toolbars1 = document.querySelectorAll('.flex.relative.shadow-line-left.p-1');

    // Structure 2: File viewer toolbar with bg-gray-800
    // <div class="flex flex-wrap w-full right-0"> containing <div class="w-full bg-gray-800">
    const toolbars2 = document.querySelectorAll('.bg-gray-800 .relative .absolute.inset-0.flex');

    const allToolbars = [...toolbars1, ...toolbars2];

    console.log(`PDF Markup Tools: Found ${allToolbars.length} potential PDF toolbars`);

    allToolbars.forEach(toolbar => {
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
    injectedTools.forEach(({ separator, highlightBtn, eraserBtn }) => {
      separator?.remove();
      highlightBtn?.remove();
      eraserBtn?.remove();
    });

    injectedTools = [];
    toolbarEnhancements = new WeakMap();
  }

  /**
   * Inject stamp quick-select buttons into JobTread's "Input Text" modal
   * This is called when the modal appears
   * Supports dark mode and RGB theme via CSS classes
   */
  function injectStampButtonsIntoModal(modal) {
    // Check if we already injected
    if (modal.querySelector('.jt-stamp-quick-select')) return;

    // Find the textarea
    const textarea = modal.querySelector('textarea');
    if (!textarea) return;

    // Create stamp quick-select container - uses .jt-stamp-quick-select for theme styling
    const container = document.createElement('div');
    container.className = 'jt-stamp-quick-select';
    container.style.cssText = `
      padding: 8px;
      border-bottom-width: 1px;
      border-bottom-style: solid;
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      max-height: 120px;
      overflow-y: auto;
    `;

    // Add category tabs
    const tabsContainer = document.createElement('div');
    tabsContainer.style.cssText = `
      display: flex;
      gap: 4px;
      margin-bottom: 8px;
      width: 100%;
    `;

    const categories = [
      { key: 'architecture', label: '🏗️ Arch' },
      { key: 'approval', label: '✓ Approval' },
      { key: 'date', label: '📅 Date' }
    ];

    let activeCategory = 'architecture';

    const stampsContainer = document.createElement('div');
    stampsContainer.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      width: 100%;
    `;

    function renderStamps(category) {
      stampsContainer.innerHTML = '';
      const stamps = stampLibrary[category] || [];

      stamps.forEach(stamp => {
        const btn = document.createElement('button');
        btn.type = 'button';
        // Use CSS class for theme-aware styling
        btn.className = 'jt-stamp-btn';
        btn.style.cssText = `
          padding: 4px 8px;
          font-size: 11px;
          border-width: 1px;
          border-style: solid;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
          transition: background-color 0.15s ease;
        `;
        btn.innerHTML = `<span style="font-size: 14px;">${stamp.icon}</span> ${stamp.copyText || stamp.name.replace(/_/g, ' ')}`;

        // Hover is handled by CSS now via .jt-stamp-btn:hover

        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();

          // Get fresh reference to textarea in case modal was recreated
          const currentTextarea = modal.querySelector('textarea');
          if (!currentTextarea) {
            console.error('PDF Markup Tools: Could not find textarea in modal');
            return;
          }

          // Get the text to insert
          // All stamps include icon for visual consistency
          let text;
          if (stamp.includeDate) {
            const date = new Date().toLocaleDateString();
            text = stamp.icon + ' ' + stamp.name.replace(/_/g, ' ') + ' - ' + date;
          } else if (stamp.copyText) {
            // Architecture stamps: icon + abbreviation
            text = stamp.icon + ' ' + stamp.copyText;
          } else {
            // Approval stamps: icon + name
            text = stamp.icon + ' ' + stamp.name.replace(/_/g, ' ');
          }

          // Get current value and cursor position
          const currentValue = currentTextarea.value || '';
          const start = currentTextarea.selectionStart || currentValue.length;
          const end = currentTextarea.selectionEnd || currentValue.length;
          const newValue = currentValue.substring(0, start) + text + currentValue.substring(end);

          // Set value using native setter for React compatibility
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            'value'
          ).set;
          nativeInputValueSetter.call(currentTextarea, newValue);

          // Dispatch events
          currentTextarea.dispatchEvent(new Event('input', { bubbles: true }));
          currentTextarea.dispatchEvent(new Event('change', { bubbles: true }));

          // Focus and set cursor position
          currentTextarea.focus();
          currentTextarea.selectionStart = currentTextarea.selectionEnd = start + text.length;

          console.log(`PDF Markup Tools: Inserted "${text}" into text modal`);
        });

        stampsContainer.appendChild(btn);
      });
    }

    categories.forEach((cat, index) => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.textContent = cat.label;
      // Use CSS class for theme-aware styling
      tab.className = 'jt-stamp-tab' + (cat.key === activeCategory ? ' active' : '');
      tab.style.cssText = `
        padding: 4px 8px;
        font-size: 11px;
        border-width: 1px;
        border-style: solid;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.15s ease, color 0.15s ease;
      `;

      tab.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        activeCategory = cat.key;

        // Update tab classes for theme-aware styling
        tabsContainer.querySelectorAll('button').forEach((t, i) => {
          const isActive = categories[i].key === activeCategory;
          t.className = 'jt-stamp-tab' + (isActive ? ' active' : '');
        });

        renderStamps(activeCategory);
      });

      tabsContainer.appendChild(tab);
    });

    container.appendChild(tabsContainer);
    container.appendChild(stampsContainer);

    // Insert before the textarea's parent div
    const textareaParent = textarea.closest('.p-2');
    if (textareaParent) {
      textareaParent.parentNode.insertBefore(container, textareaParent);
    }

    // Render initial stamps
    renderStamps(activeCategory);

    console.log('PDF Markup Tools: Injected stamp buttons into Input Text modal (theme-aware)');
  }

  /**
   * Watch for the "Input Text" modal to appear
   */
  function checkForInputTextModal() {
    // Look for the modal with "Input Text" header
    const modals = document.querySelectorAll('.m-auto.shadow-lg.rounded-sm.bg-white.max-w-lg');

    modals.forEach(modal => {
      const header = modal.querySelector('.font-bold.text-cyan-500.uppercase');
      if (header && header.textContent.includes('Input Text')) {
        injectStampButtonsIntoModal(modal);
      }
    });
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

      // Watch for new toolbars and Input Text modals (PDF pages loaded dynamically)
      observer = new MutationObserver(() => {
        findAndEnhanceToolbars();
        checkForInputTextModal();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      // Also check immediately for any existing modals
      checkForInputTextModal();

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

    // Disable delete-on-click mode if active
    disableDeleteOnClick();

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
