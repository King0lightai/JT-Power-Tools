/**
 * JobTread PDF Markup Tools Enhancement
 * Adds additional markup tools to JobTread's PDF viewer
 *
 * New Tools:
 * - Highlight tool
 * - Custom stamps library
 * - Plain line tool (without arrowhead)
 * - Eraser tool
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
   * Apply a stamp to the PDF
   */
  function applyStamp(stamp) {
    console.log('PDF Markup Tools: Applying stamp:', stamp);

    const svg = getActiveSVG();
    if (!svg) {
      console.warn('No active SVG found');
      return;
    }

    // Create SVG group for the stamp
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('jt-stamp-annotation');
    group.setAttribute('data-jt-tool', 'stamp');

    // Position at center of view (user can adjust)
    const viewBox = svg.viewBox.baseVal;
    const x = viewBox.width / 2;
    const y = viewBox.height / 2;

    // Create background rectangle
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x - 40);
    rect.setAttribute('y', y - 20);
    rect.setAttribute('width', '80');
    rect.setAttribute('height', '40');
    rect.setAttribute('fill', stamp.color);
    rect.setAttribute('stroke', '#000');
    rect.setAttribute('stroke-width', '2');
    rect.setAttribute('rx', '5');

    // Create text element
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', y + 5);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', stamp.textColor);
    text.setAttribute('font-size', '16');
    text.setAttribute('font-weight', 'bold');
    text.textContent = stamp.icon + ' ' + stamp.name.replace(/_/g, ' ');

    // Add date if needed
    if (stamp.includeDate) {
      const date = new Date().toLocaleDateString();
      const dateText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      dateText.setAttribute('x', x);
      dateText.setAttribute('y', y + 20);
      dateText.setAttribute('text-anchor', 'middle');
      dateText.setAttribute('fill', stamp.textColor);
      dateText.setAttribute('font-size', '10');
      dateText.textContent = date;
      group.appendChild(dateText);
    }

    group.appendChild(rect);
    group.appendChild(text);

    // Make draggable (simple implementation)
    makeDraggable(group);

    svg.appendChild(group);
    console.log('Stamp added to SVG');
  }

  /**
   * Make an SVG element draggable
   */
  function makeDraggable(element) {
    let isDragging = false;
    let startX, startY, initialX, initialY;

    element.style.cursor = 'move';

    element.addEventListener('mousedown', (e) => {
      isDragging = true;
      const svg = getActiveSVG();
      if (!svg) return;

      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());

      startX = svgPt.x;
      startY = svgPt.y;

      // Get current transform
      const transform = element.getAttribute('transform') || '';
      const match = transform.match(/translate\(([^,]+),([^)]+)\)/);
      initialX = match ? parseFloat(match[1]) : 0;
      initialY = match ? parseFloat(match[2]) : 0;

      e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const svg = getActiveSVG();
      if (!svg) return;

      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());

      const dx = svgPt.x - startX;
      const dy = svgPt.y - startY;

      element.setAttribute('transform', `translate(${initialX + dx}, ${initialY + dy})`);
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  /**
   * Handle highlight tool click - enables click-and-drag highlighting
   */
  function handleHighlightClick() {
    console.log('PDF Markup Tools: Highlight tool clicked');

    const highlightBtn = document.querySelector('[data-jt-tool="highlight"]');
    const svg = getActiveSVG();

    if (!svg || !highlightBtn) return;

    const isActive = highlightBtn.classList.toggle('active');

    if (isActive) {
      enableHighlightMode(svg);
    } else {
      disableHighlightMode(svg);
    }
  }

  /**
   * Enable highlight drawing mode
   */
  function enableHighlightMode(svg) {
    let isDrawing = false;
    let startPt = null;
    let currentRect = null;

    const onMouseDown = (e) => {
      isDrawing = true;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      startPt = pt.matrixTransform(svg.getScreenCTM().inverse());

      // Create highlight rectangle
      currentRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      currentRect.classList.add('jt-highlight-annotation');
      currentRect.setAttribute('data-jt-tool', 'highlight');
      currentRect.setAttribute('fill', '#FFFF00');
      currentRect.setAttribute('fill-opacity', '0.4');
      currentRect.setAttribute('stroke', '#FFD700');
      currentRect.setAttribute('stroke-width', '1');
      currentRect.setAttribute('x', startPt.x);
      currentRect.setAttribute('y', startPt.y);
      currentRect.setAttribute('width', '0');
      currentRect.setAttribute('height', '0');

      svg.appendChild(currentRect);
    };

    const onMouseMove = (e) => {
      if (!isDrawing || !currentRect) return;

      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const currentPt = pt.matrixTransform(svg.getScreenCTM().inverse());

      const width = currentPt.x - startPt.x;
      const height = currentPt.y - startPt.y;

      if (width < 0) {
        currentRect.setAttribute('x', currentPt.x);
        currentRect.setAttribute('width', Math.abs(width));
      } else {
        currentRect.setAttribute('width', width);
      }

      if (height < 0) {
        currentRect.setAttribute('y', currentPt.y);
        currentRect.setAttribute('height', Math.abs(height));
      } else {
        currentRect.setAttribute('height', height);
      }
    };

    const onMouseUp = () => {
      isDrawing = false;
      currentRect = null;
    };

    svg.addEventListener('mousedown', onMouseDown);
    svg.addEventListener('mousemove', onMouseMove);
    svg.addEventListener('mouseup', onMouseUp);

    // Store listeners for cleanup
    svg._jtHighlightListeners = { onMouseDown, onMouseMove, onMouseUp };
  }

  /**
   * Disable highlight drawing mode
   */
  function disableHighlightMode(svg) {
    if (svg._jtHighlightListeners) {
      const { onMouseDown, onMouseMove, onMouseUp } = svg._jtHighlightListeners;
      svg.removeEventListener('mousedown', onMouseDown);
      svg.removeEventListener('mousemove', onMouseMove);
      svg.removeEventListener('mouseup', onMouseUp);
      delete svg._jtHighlightListeners;
    }
  }

  /**
   * Handle line tool click
   */
  function handleLineClick() {
    console.log('PDF Markup Tools: Line tool clicked');

    const lineBtn = document.querySelector('[data-jt-tool="line"]');
    const svg = getActiveSVG();

    if (!svg || !lineBtn) return;

    const isActive = lineBtn.classList.toggle('active');

    if (isActive) {
      enableLineMode(svg);
    } else {
      disableLineMode(svg);
    }
  }

  /**
   * Enable line drawing mode
   */
  function enableLineMode(svg) {
    let isDrawing = false;
    let startPt = null;
    let currentLine = null;

    const onMouseDown = (e) => {
      isDrawing = true;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      startPt = pt.matrixTransform(svg.getScreenCTM().inverse());

      // Create line
      currentLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      currentLine.classList.add('jt-line-annotation');
      currentLine.setAttribute('data-jt-tool', 'line');
      currentLine.setAttribute('x1', startPt.x);
      currentLine.setAttribute('y1', startPt.y);
      currentLine.setAttribute('x2', startPt.x);
      currentLine.setAttribute('y2', startPt.y);
      currentLine.setAttribute('stroke', '#FF0000');
      currentLine.setAttribute('stroke-width', '3');

      svg.appendChild(currentLine);
    };

    const onMouseMove = (e) => {
      if (!isDrawing || !currentLine) return;

      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const currentPt = pt.matrixTransform(svg.getScreenCTM().inverse());

      currentLine.setAttribute('x2', currentPt.x);
      currentLine.setAttribute('y2', currentPt.y);
    };

    const onMouseUp = () => {
      isDrawing = false;
      currentLine = null;
    };

    svg.addEventListener('mousedown', onMouseDown);
    svg.addEventListener('mousemove', onMouseMove);
    svg.addEventListener('mouseup', onMouseUp);

    // Store listeners for cleanup
    svg._jtLineListeners = { onMouseDown, onMouseMove, onMouseUp };
  }

  /**
   * Disable line drawing mode
   */
  function disableLineMode(svg) {
    if (svg._jtLineListeners) {
      const { onMouseDown, onMouseMove, onMouseUp } = svg._jtLineListeners;
      svg.removeEventListener('mousedown', onMouseDown);
      svg.removeEventListener('mousemove', onMouseMove);
      svg.removeEventListener('mouseup', onMouseUp);
      delete svg._jtLineListeners;
    }
  }

  /**
   * Handle eraser tool click
   */
  function handleEraserClick() {
    console.log('PDF Markup Tools: Eraser tool clicked');

    const eraserBtn = document.querySelector('[data-jt-tool="eraser"]');
    const svg = getActiveSVG();

    if (!svg || !eraserBtn) return;

    const isActive = eraserBtn.classList.toggle('active');

    if (isActive) {
      enableEraserMode(svg);
    } else {
      disableEraserMode(svg);
    }
  }

  /**
   * Enable eraser mode - click on annotations to remove them
   */
  function enableEraserMode(svg) {
    const onClick = (e) => {
      const target = e.target;

      // Check if clicked element is a JT annotation
      if (target.classList.contains('jt-stamp-annotation') ||
          target.classList.contains('jt-highlight-annotation') ||
          target.classList.contains('jt-line-annotation') ||
          target.getAttribute('data-jt-tool')) {

        // If it's a child element, find the parent group
        let elementToRemove = target;
        if (target.tagName !== 'g' && target.parentElement.tagName === 'g') {
          elementToRemove = target.parentElement;
        }

        elementToRemove.remove();
        console.log('Annotation removed');
        e.stopPropagation();
      }
    };

    svg.addEventListener('click', onClick, true);
    svg.style.cursor = 'not-allowed';

    // Store listener for cleanup
    svg._jtEraserListener = onClick;
  }

  /**
   * Disable eraser mode
   */
  function disableEraserMode(svg) {
    if (svg._jtEraserListener) {
      svg.removeEventListener('click', svg._jtEraserListener, true);
      delete svg._jtEraserListener;
      svg.style.cursor = '';
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

    // Remove injected tools
    removeInjectedTools();

    // Disconnect observer
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    // Remove event listeners
    document.removeEventListener('click', handleDocumentClick, true);

    // Remove injected CSS
    if (styleElement) {
      styleElement.remove();
      styleElement = null;
    }

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
