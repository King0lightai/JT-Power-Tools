// JobTread Schedule Drag & Drop Feature Module
// Enables dragging schedule items between dates

const DragDropFeature = (() => {
  let draggedElement = null;
  let draggedItemData = null;
  let observer = null;
  let isActive = false;
  let shiftKeyAtDragStart = false; // Track Shift at drag start
  let sourceDateInfo = null; // Store source date from drag start
  let isDateChangeInProgress = false; // Prevent observer re-entry during date changes

  // Initialize the feature
  function init() {
    if (isActive) {
      console.log('DragDrop: Already initialized');
      return;
    }

    console.log('DragDrop: Initializing...');
    isActive = true;

    // Inject weekend styling
    injectWeekendCSS();

    // Initial setup
    setTimeout(() => {
      initDragAndDrop();
      console.log('DragDrop: Feature loaded');
    }, 1000);

    // Watch for DOM changes and re-initialize
    observer = new MutationObserver((mutations) => {
      // CRITICAL: Don't re-initialize while date change is in progress
      if (isDateChangeInProgress) {
        console.log('DragDrop: MutationObserver - Skipping re-init, date change in progress');
        return;
      }

      let shouldReinit = false;

      mutations.forEach(mutation => {
        if (mutation.addedNodes.length > 0) {
          shouldReinit = true;
        }
      });

      if (shouldReinit) {
        setTimeout(initDragAndDrop, 500);
      }
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Cleanup the feature
  function cleanup() {
    if (!isActive) {
      console.log('DragDrop: Not active, nothing to cleanup');
      return;
    }

    console.log('DragDrop: Cleaning up...');
    isActive = false;

    // Disconnect observer
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    // Remove draggable attributes and event listeners
    const scheduleItems = document.querySelectorAll('div.cursor-pointer[draggable="true"]');
    scheduleItems.forEach(item => {
      item.removeAttribute('draggable');
      item.style.cursor = '';
      // Note: We can't easily remove event listeners without references
      // But since we're likely reloading the page, this is acceptable
    });

    // Remove drop zone classes
    const dateCells = document.querySelectorAll('td.jt-drop-enabled');
    dateCells.forEach(cell => {
      cell.classList.remove('jt-drop-enabled');
      cell.classList.remove('jt-weekend-cell');
    });

    // Remove weekend CSS
    const weekendStyle = document.getElementById('jt-weekend-styling');
    if (weekendStyle) {
      weekendStyle.remove();
    }

    console.log('DragDrop: Cleanup complete');
  }

  // Inject CSS to grey out weekends
  function injectWeekendCSS() {
    if (document.getElementById('jt-weekend-styling')) return;

    const style = document.createElement('style');
    style.id = 'jt-weekend-styling';
    style.textContent = `
      /* Grey out weekend columns */
      td.jt-weekend-cell {
        background-color: rgba(0, 0, 0, 0.03) !important;
        opacity: 0.6;
      }

      /* Slightly darker on hover to show it's still interactive with Shift */
      td.jt-weekend-cell:hover {
        background-color: rgba(0, 0, 0, 0.05) !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Function to make schedule items draggable
  function makeScheduleItemsDraggable() {
    const scheduleItems = document.querySelectorAll('div.cursor-pointer[style*="background-color"]');

    scheduleItems.forEach(item => {
      if (!item.hasAttribute('draggable')) {
        item.setAttribute('draggable', 'true');
        item.style.cursor = 'grab';

        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
      }
    });
  }

  // Function to make date cells droppable
  function makeDateCellsDroppable() {
    const dateCells = document.querySelectorAll('td.group.text-xs');
    console.log(`DragDrop: makeDateCellsDroppable - Found ${dateCells.length} cells to make droppable`);

    let newCells = 0;
    dateCells.forEach((cell, index) => {
      if (!cell.classList.contains('jt-drop-enabled')) {
        cell.classList.add('jt-drop-enabled');
        newCells++;

        // Mark weekends
        if (isWeekendCell(cell)) {
          cell.classList.add('jt-weekend-cell');
        }

        cell.addEventListener('dragover', handleDragOver);
        cell.addEventListener('drop', handleDrop);
        cell.addEventListener('dragleave', handleDragLeave);
        cell.addEventListener('dragenter', handleDragEnter);

        // Log a sample of cells to verify they're in different months
        if (index < 3 || index > dateCells.length - 3) {
          const dateInfo = extractDateFromCell(cell);
          console.log(`DragDrop: makeDateCellsDroppable - Cell ${index}: day=${dateInfo}, classes=${cell.className}`);
        }
      }
    });
    console.log(`DragDrop: makeDateCellsDroppable - Attached listeners to ${newCells} new cells`);
  }

  // Check if a cell is a weekend
  function isWeekendCell(cell, providedDateInfo = null) {
    const dateInfo = providedDateInfo || extractFullDateInfo(cell);
    if (!dateInfo || !dateInfo.day || !dateInfo.month) return false;

    // Use the year from dateInfo (which now includes year from extraction)
    const year = dateInfo.year || new Date().getFullYear();

    // Parse the date
    const monthMap = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };

    const monthIndex = monthMap[dateInfo.month];
    if (monthIndex === undefined) return false;

    const date = new Date(year, monthIndex, parseInt(dateInfo.day));
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday

    return dayOfWeek === 0 || dayOfWeek === 6;
  }

  // Adjust date to skip weekends (move to next Monday)
  function adjustDateToSkipWeekend(dateInfo) {
    console.log('DragDrop: adjustDateToSkipWeekend - input:', JSON.stringify(dateInfo));

    const year = dateInfo.year || new Date().getFullYear();
    if (!dateInfo.year) {
      console.warn(`DragDrop: adjustDateToSkipWeekend - year missing, using current year: ${year}`);
    }

    const monthMap = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };

    const monthIndex = monthMap[dateInfo.month];
    const date = new Date(year, monthIndex, parseInt(dateInfo.day));
    const dayOfWeek = date.getDay();

    console.log(`DragDrop: adjustDateToSkipWeekend - original date: ${dateInfo.month} ${dateInfo.day}, ${year} (day of week: ${dayOfWeek})`);

    // If Saturday (6), add 2 days to get to Monday
    // If Sunday (0), add 1 day to get to Monday
    if (dayOfWeek === 6) {
      console.log('DragDrop: adjustDateToSkipWeekend - Saturday detected, adding 2 days');
      date.setDate(date.getDate() + 2);
    } else if (dayOfWeek === 0) {
      console.log('DragDrop: adjustDateToSkipWeekend - Sunday detected, adding 1 day');
      date.setDate(date.getDate() + 1);
    }

    // Convert back to month abbrev and day (year may have changed)
    const monthAbbrev = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const result = {
      day: date.getDate().toString(),
      month: monthAbbrev[date.getMonth()],
      year: date.getFullYear(),
      fullDisplay: `${monthAbbrev[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
    };

    console.log('DragDrop: adjustDateToSkipWeekend - output:', JSON.stringify(result));

    if (result.year !== year) {
      console.log(`DragDrop: adjustDateToSkipWeekend - *** YEAR CHANGED during weekend skip: ${year} -> ${result.year} ***`);
    }

    return result;
  }

  // Event handlers (same as original code)
  function handleDragStart(e) {
    draggedElement = this;
    this.style.cursor = 'grabbing';
    this.style.opacity = '0.5';

    // Capture Shift key state at drag start
    shiftKeyAtDragStart = e.shiftKey;

    const sourceCell = this.closest('td');
    sourceDateInfo = extractFullDateInfo(sourceCell); // Store globally for year calculation
    console.log('DragDrop: ==========================================');
    console.log('DragDrop: *** DRAG START ***');
    console.log('DragDrop: Source date:', JSON.stringify(sourceDateInfo));
    console.log('DragDrop: Shift key:', shiftKeyAtDragStart);
    console.log('DragDrop: ==========================================');

    draggedItemData = {
      element: this,
      html: this.innerHTML,
      originalParent: sourceCell
    };

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
  }

  function handleDragEnd(e) {
    console.log('DragDrop: *** DRAG END ***');
    this.style.opacity = '1';
    this.style.cursor = 'grab';

    document.querySelectorAll('.jt-drop-zone').forEach(cell => {
      cell.classList.remove('jt-drop-zone');
      cell.style.backgroundColor = '';
      cell.style.border = '';
    });
  }

  function handleDragOver(e) {
    if (e.preventDefault) {
      e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
  }

  function handleDragEnter(e) {
    const dateInfo = extractDateFromCell(this);
    console.log(`DragDrop: handleDragEnter - Entering cell with date: ${dateInfo}`);

    if (!this.classList.contains('jt-drop-zone')) {
      this.classList.add('jt-drop-zone');
      this.style.border = '2px dashed rgb(59, 130, 246)';
      this.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
    }
  }

  function handleDragLeave(e) {
    if (this.classList.contains('jt-drop-zone')) {
      this.classList.remove('jt-drop-zone');
      this.style.border = '';
      this.style.backgroundColor = '';
    }
  }

  function handleDrop(e) {
    // CRITICAL: Log at the very top to confirm function is called
    console.log('DragDrop: ========================================');
    console.log('DragDrop: ========== DROP EVENT START ==========');
    console.log('DragDrop: ========================================');

    try {
      if (e.stopPropagation) {
        e.stopPropagation();
      }
      e.preventDefault();
      console.log('DragDrop: Event handlers called successfully');

      this.classList.remove('jt-drop-zone');
      this.style.border = '';
      this.style.backgroundColor = '';
      console.log('DragDrop: Visual cleanup complete');

      console.log('DragDrop: Checking draggedElement:', !!draggedElement);
      console.log('DragDrop: Checking draggedItemData:', !!draggedItemData);

      if (draggedElement && draggedItemData) {
        const targetCell = this;
        const originalCell = draggedItemData.originalParent;
        console.log('DragDrop: Target cell:', targetCell);
        console.log('DragDrop: Original cell:', originalCell);

        if (targetCell === originalCell) {
          console.log('DragDrop: Drop on same cell, ignoring');
          return false;
        }

        console.log('DragDrop: Different cells confirmed, proceeding with date extraction');
        console.log('DragDrop: Extracting target date info...');
        let dateInfo = extractFullDateInfo(targetCell);
        console.log('DragDrop: Target date info extracted:', JSON.stringify(dateInfo));

        console.log('DragDrop: Extracting source date info...');
        const sourceDateInfo = extractFullDateInfo(originalCell);
        console.log('DragDrop: Source date info extracted:', JSON.stringify(sourceDateInfo));

        if (dateInfo) {
          console.log('DragDrop: Date info is valid, proceeding with year boundary checks');
          // Handle year transitions when dragging between months
          if (sourceDateInfo && sourceDateInfo.month && dateInfo.month) {
          const monthMap = {
            'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
            'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
          };
          const sourceMonth = monthMap[sourceDateInfo.month];
          const targetMonth = monthMap[dateInfo.month];

          console.log(`DragDrop: Year boundary check - Source: ${sourceDateInfo.month} ${sourceDateInfo.day}, ${sourceDateInfo.year} (month index: ${sourceMonth})`);
          console.log(`DragDrop: Year boundary check - Target: ${dateInfo.month} ${dateInfo.day}, ${dateInfo.year} (month index: ${targetMonth})`);

          // If source and target are the same month, use source year as baseline
          if (sourceMonth === targetMonth) {
            console.log(`DragDrop: Same month drag - using source year ${sourceDateInfo.year}`);
            dateInfo.year = sourceDateInfo.year;
          }
          // If dragging from December to January, increment year
          else if (sourceMonth === 11 && targetMonth === 0) {
            const originalYear = dateInfo.year;
            dateInfo.year = sourceDateInfo.year + 1;
            console.log(`DragDrop: *** YEAR TRANSITION (Dec → Jan) *** Changed year from ${originalYear} to ${dateInfo.year}`);
            console.log(`DragDrop: *** Target date will be: ${dateInfo.month} ${dateInfo.day}, ${dateInfo.year}`);
            showNotification(`Year transition: Moving to Jan ${dateInfo.year}`);
          }
          // If dragging from January to December, decrement year
          else if (sourceMonth === 0 && targetMonth === 11) {
            const originalYear = dateInfo.year;
            dateInfo.year = sourceDateInfo.year - 1;
            console.log(`DragDrop: *** YEAR TRANSITION (Jan → Dec) *** Changed year from ${originalYear} to ${dateInfo.year}`);
            console.log(`DragDrop: *** Target date will be: ${dateInfo.month} ${dateInfo.day}, ${dateInfo.year}`);
            showNotification(`Year transition: Moving to Dec ${dateInfo.year}`);
          }
          // For other month changes, use source year as baseline
          else {
            console.log(`DragDrop: Different month, same year - using source year ${sourceDateInfo.year}`);
            dateInfo.year = sourceDateInfo.year;
          }
        } else {
          if (!sourceDateInfo) {
            console.error('DragDrop: Failed to extract source date info - year transition detection skipped');
          } else if (!sourceDateInfo.month) {
            console.error('DragDrop: Source date info missing month - year transition detection skipped');
          } else if (!dateInfo.month) {
            console.error('DragDrop: Target date info missing month - year transition detection skipped');
          }
        }

        // Check Shift key at drop time (OR the state captured at drag start)
        const isShiftPressed = e.shiftKey || shiftKeyAtDragStart;
        console.log('DragDrop: Drop - Shift at drop:', e.shiftKey, 'Shift at start:', shiftKeyAtDragStart, 'Final:', isShiftPressed);

        // Check if dropping on weekend and Shift is NOT pressed
        if (!isShiftPressed && isWeekendCell(targetCell, dateInfo)) {
          console.log('DragDrop: Weekend detected, auto-skipping to Monday');
          const originalDate = `${dateInfo.month} ${dateInfo.day}, ${dateInfo.year}`;
          dateInfo = adjustDateToSkipWeekend(dateInfo);
          console.log(`DragDrop: Weekend skip - changed from ${originalDate} to ${dateInfo.month} ${dateInfo.day}, ${dateInfo.year}`);
          showNotification('Weekend detected - moved to Monday');
        } else if (isShiftPressed && isWeekendCell(targetCell, dateInfo)) {
          console.log('DragDrop: Shift held - allowing weekend drop');
        }

        console.log(`DragDrop: Final date before formatting: ${dateInfo.month} ${dateInfo.day}, ${dateInfo.year}`);
        console.log('DragDrop: About to call attemptDateChange...');
        attemptDateChange(draggedElement, dateInfo.day, targetCell, dateInfo);
        console.log('DragDrop: attemptDateChange called (async operations continuing)');
      } else {
        console.error('DragDrop: *** CRITICAL ERROR *** Could not determine target date');
        showNotification('Could not determine target date. Please try manually.');
      }
    } else {
      console.error('DragDrop: Drop handler called but draggedElement or draggedItemData is missing');
      if (!draggedElement) console.error('DragDrop: draggedElement is null/undefined');
      if (!draggedItemData) console.error('DragDrop: draggedItemData is null/undefined');
    }

    // Reset shift state
    shiftKeyAtDragStart = false;
    console.log('DragDrop: ========== DROP EVENT END ==========');

    return false;

    } catch (error) {
      console.error('DragDrop: *** EXCEPTION IN handleDrop ***');
      console.error('DragDrop: Error name:', error.name);
      console.error('DragDrop: Error message:', error.message);
      console.error('DragDrop: Error stack:', error.stack);
      showNotification('Error during drag & drop. Check console for details.');
      return false;
    }
  }

  // Helper functions (kept from original)
  function extractDateFromCell(cell) {
    if (!cell) return null;
    const dateDiv = cell.querySelector('div.font-bold');
    if (dateDiv) {
      return dateDiv.textContent.trim();
    }
    return null;
  }

  function extractFullDateInfo(cell) {
    if (!cell) {
      console.error('DragDrop: extractFullDateInfo - cell is null');
      return null;
    }

    const dateDiv = cell.querySelector('div.font-bold');
    if (!dateDiv) {
      console.error('DragDrop: extractFullDateInfo - no font-bold div found in cell');
      return null;
    }

    const dateNumber = dateDiv.textContent.trim();
    console.log(`DragDrop: extractFullDateInfo - extracted day number: "${dateNumber}"`);

    const monthAbbrev = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];

    let month = null;
    let year = null;

    // Search for month marker in table
    const table = cell.closest('table');
    if (table) {
      const allCells = table.querySelectorAll('td');
      const cellArray = Array.from(allCells);
      const currentCellIndex = cellArray.indexOf(cell);
      console.log(`DragDrop: extractFullDateInfo - searching ${currentCellIndex + 1} cells backwards for month/year`);

      for (let i = currentCellIndex; i >= 0; i--) {
        const cellToCheck = cellArray[i];
        const boldDivs = cellToCheck.querySelectorAll('div.font-bold');

        for (const div of boldDivs) {
          const text = div.textContent.trim();

          // Check for year (4 digits)
          const yearMatch = text.match(/\b(20\d{2})\b/);
          if (yearMatch && !year) {
            year = parseInt(yearMatch[1]);
            console.log(`DragDrop: extractFullDateInfo - found year: ${year} in cell ${i}`);
          }

          // Check for month name
          if (!month) {
            for (let m = 0; m < monthNames.length; m++) {
              if (text === monthNames[m]) {
                month = monthAbbrev[m];
                console.log(`DragDrop: extractFullDateInfo - found month: ${month} in cell ${i}`);
                break;
              }
            }
          }
        }
        // Continue searching until we have both month AND year, or reach the beginning
        if (month && year) break;
      }

      if (month && !year) {
        console.log('DragDrop: extractFullDateInfo - Found month in table but NO year - will search page');
      }
    } else {
      console.error('DragDrop: extractFullDateInfo - no table found for cell');
    }

    // If month or year not found in table, search the entire page
    if (!month || !year) {
      console.log('DragDrop: extractFullDateInfo - Searching entire page for month/year...');

      // Strategy 1: Look for calendar navigation/header elements with specific selectors
      const calendarHeaders = document.querySelectorAll('h1, h2, h3, h4, button, div[class*="header"], div[class*="nav"]');
      for (const header of calendarHeaders) {
        const text = header.textContent.trim();
        const match = text.match(/\b([A-Z][a-z]+)\s+(20\d{2})\b/);
        if (match) {
          const foundMonth = match[1];
          const foundYear = parseInt(match[2]);
          const monthIndex = monthNames.indexOf(foundMonth);

          if (monthIndex >= 0) {
            if (!month) {
              month = monthAbbrev[monthIndex];
              console.log(`DragDrop: extractFullDateInfo - Found month in calendar header: ${month}`);
            }
            if (!year) {
              year = foundYear;
              console.log(`DragDrop: extractFullDateInfo - Found year in calendar header: ${year}`);
            }
            if (month && year) break;
          }
        }
      }
    }

    // Strategy 2: Search all bold text on page for month/year patterns
    if (!month || !year) {
      const allBoldElements = document.querySelectorAll('div.font-bold, strong, b, [class*="bold"]');
      for (const elem of allBoldElements) {
        const text = elem.textContent.trim();
        const match = text.match(/\b([A-Z][a-z]+)\s+(20\d{2})\b/);
        if (match) {
          const foundMonth = match[1];
          const foundYear = parseInt(match[2]);
          const monthIndex = monthNames.indexOf(foundMonth);

          if (monthIndex >= 0) {
            if (!month) {
              month = monthAbbrev[monthIndex];
              console.log(`DragDrop: extractFullDateInfo - Found month in bold element: ${month}`);
            }
            if (!year) {
              year = foundYear;
              console.log(`DragDrop: extractFullDateInfo - Found year in bold element: ${year}`);
            }
            if (month && year) break;
          }
        }
      }
    }

    // Strategy 3: General page text search (last resort)
    if (!month || !year) {
      const pageText = document.body.innerText;
      const monthYearMatches = pageText.match(/\b([A-Z][a-z]+)\s+(20\d{2})\b/g);

      if (monthYearMatches && monthYearMatches.length > 0) {
        console.log('DragDrop: extractFullDateInfo - Found potential month/year patterns:', monthYearMatches.slice(0, 5));

        // Try each match to see if it's a valid month
        for (const match of monthYearMatches) {
          const parts = match.match(/\b([A-Z][a-z]+)\s+(20\d{2})\b/);
          if (parts && parts.length >= 3) {
            const foundMonth = parts[1];
            const foundYear = parseInt(parts[2]);

            // Check if it's a valid month name
            const monthIndex = monthNames.indexOf(foundMonth);
            if (monthIndex >= 0) {
              if (!month) {
                month = monthAbbrev[monthIndex];
                console.log(`DragDrop: extractFullDateInfo - Found month in page text: ${month}`);
              }
              if (!year) {
                year = foundYear;
                console.log(`DragDrop: extractFullDateInfo - Found year in page text: ${year}`);
              }
              if (month && year) break;
            }
          }
        }
      }
    }

    // Fallback to current month and year with smart year inference
    if (!month || !year) {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      if (!month) {
        month = monthAbbrev[currentMonth];
        console.warn(`DragDrop: extractFullDateInfo - month not found, using current month: ${month}`);
      }

      if (!year && month) {
        // Smart year inference based on current date
        const targetMonthIndex = monthAbbrev.indexOf(month);

        // If we're in Nov/Dec and the target is Jan/Feb, likely next year
        if (currentMonth >= 10 && targetMonthIndex <= 1) {
          year = currentYear + 1;
          console.warn(`DragDrop: extractFullDateInfo - year not found, inferred next year ${year} (current: ${monthAbbrev[currentMonth]}, target: ${month})`);
        }
        // If we're in Jan/Feb and the target is Nov/Dec, likely last year
        else if (currentMonth <= 1 && targetMonthIndex >= 10) {
          year = currentYear - 1;
          console.warn(`DragDrop: extractFullDateInfo - year not found, inferred previous year ${year} (current: ${monthAbbrev[currentMonth]}, target: ${month})`);
        }
        // Otherwise, assume current year
        else {
          year = currentYear;
          console.warn(`DragDrop: extractFullDateInfo - year not found, using current year: ${year}`);
        }
      }
    }

    const result = {
      day: dateNumber,
      month: month,
      year: year,
      monthYear: month,
      fullDisplay: `${month} ${dateNumber}, ${year}`
    };

    console.log('DragDrop: extractFullDateInfo - result:', JSON.stringify(result));
    return result;
  }

  function formatDateForInput(dateInfo) {
    console.log('DragDrop: formatDateForInput - input:', JSON.stringify(dateInfo));

    if (!dateInfo) {
      console.error('DragDrop: formatDateForInput - dateInfo is null/undefined');
      return '';
    }

    if (!dateInfo.day) {
      console.error('DragDrop: formatDateForInput - day is missing from dateInfo');
      return '';
    }

    let month = dateInfo.month || '';

    if (!month) {
      const monthAbbrev = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const now = new Date();
      month = monthAbbrev[now.getMonth()];
      console.warn(`DragDrop: formatDateForInput - month missing, using current: ${month}`);
    }

    // Return format WITHOUT year - JobTread infers year from calendar context
    // Year information is in dateInfo.year but JobTread's input doesn't accept it
    const formattedDate = `${month} ${dateInfo.day}`;
    console.log(`DragDrop: formatDateForInput - output: "${formattedDate}" (year ${dateInfo.year} tracked but not sent)`);

    return formattedDate;
  }

  function attemptDateChange(element, newDateNumber, targetCell, providedDateInfo = null) {
    console.log('DragDrop: ==========================================');
    console.log('DragDrop: attemptDateChange - *** START ***');
    console.log('DragDrop: ==========================================');

    // CRITICAL: Set flag to prevent observer from re-initializing during date changes
    isDateChangeInProgress = true;
    console.log('DragDrop: attemptDateChange - Set isDateChangeInProgress = true');

    try {
      console.log('DragDrop: attemptDateChange - element:', element);
      console.log('DragDrop: attemptDateChange - newDateNumber:', newDateNumber);
      console.log('DragDrop: attemptDateChange - providedDateInfo:', JSON.stringify(providedDateInfo));

      const dateInfo = providedDateInfo || extractFullDateInfo(targetCell);

      if (!dateInfo) {
        console.error('DragDrop: attemptDateChange - Failed to get dateInfo');
        showNotification('Error: Could not extract date information');
        return;
      }

      console.log('DragDrop: attemptDateChange - Using dateInfo:', JSON.stringify(dateInfo));

    // Inject CSS to make entire sidebar structure completely invisible
    const hideStyle = document.createElement('style');
    hideStyle.id = 'jt-hide-sidebar-temp';
    hideStyle.textContent = `
        /* Hide the outer sidebar container (the one with z-30) */
        div.z-30.absolute.top-0.bottom-0.right-0 {
            opacity: 0 !important;
            position: fixed !important;
            top: -9999px !important;
            left: -9999px !important;
            width: 1px !important;
            height: 1px !important;
            overflow: hidden !important;
            clip: rect(0, 0, 0, 0) !important;
            pointer-events: none !important;
        }
        /* Hide the white background layer */
        div.absolute.inset-0.bg-white.shadow-line-left {
            opacity: 0 !important;
            background: transparent !important;
        }
        /* Hide the inner sticky sidebar */
        div.overflow-y-auto.overscroll-contain.sticky {
            opacity: 0 !important;
        }
        /* Hide any fixed/absolute overlays and backdrops */
        body > div.fixed.inset-0:not(.jt-formatter-toolbar),
        div[style*="position: fixed"][style*="inset"],
        div[class*="backdrop"] {
            opacity: 0 !important;
            position: fixed !important;
            top: -9999px !important;
            left: -9999px !important;
            width: 1px !important;
            height: 1px !important;
            overflow: hidden !important;
        }
    `;
    document.head.appendChild(hideStyle);
    console.log('DragDrop: attemptDateChange - Sidebar hiding CSS injected');

    // Failsafe: Remove CSS after 5 seconds no matter what
    const failsafeTimeout = setTimeout(() => {
      const style = document.getElementById('jt-hide-sidebar-temp');
      if (style) {
        style.remove();
        console.log('DragDrop: Failsafe removed hiding CSS');
      }
    }, 5000);

    // Click to open sidebar
    console.log('DragDrop: attemptDateChange - Clicking element to open sidebar');
    element.click();

    // Wait for sidebar and process
    setTimeout(() => {
      const sidebar = document.querySelector('div.overflow-y-auto.overscroll-contain.sticky');

      if (sidebar) {
        console.log('DragDrop: attemptDateChange - Sidebar found, processing date change...');

        // Find start date field
        const allDateFields = sidebar.querySelectorAll('div.text-gray-700.truncate.leading-tight');
        console.log(`DragDrop: attemptDateChange - Found ${allDateFields.length} potential date fields`);

        let startDateParent = null;
        let sidebarSourceYear = null; // Extract year from sidebar's current date
        let sidebarSourceMonth = null; // Extract month from sidebar's current date
        const fieldTexts = []; // Collect all field texts for debugging

        for (const field of allDateFields) {
          const text = field.textContent.trim();
          fieldTexts.push(text);
          console.log(`DragDrop: attemptDateChange - Checking field text: "${text}"`);

          // Match formats:
          // 1. "Jan 1, 2026" (Month Day, Year)
          // 2. "Wed, Dec 31" (DayOfWeek, Month Day) - NEW format without year
          // 3. "Mon, January 15" (DayOfWeek, FullMonth Day) - legacy format
          // 4. "Today", "Tomorrow", "Yesterday"
          if (/^[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}$/.test(text)) {
            // Extract year and month from "Jan 1, 2026" format
            const match = text.match(/^([A-Z][a-z]{2})\s+\d{1,2},\s+(20\d{2})$/);
            if (match) {
              sidebarSourceMonth = match[1];
              sidebarSourceYear = parseInt(match[2]);
              console.log(`DragDrop: attemptDateChange - Extracted from sidebar: ${sidebarSourceMonth} ${sidebarSourceYear}`);
            }
            startDateParent = field.closest('div.group.items-center');
            console.log('DragDrop: attemptDateChange - Found start date field:', text);
            break;
          } else if (/^[A-Z][a-z]{2},\s+[A-Z][a-z]{2,}\s+\d{1,2}$/.test(text)) {
            // "Wed, Dec 31" or "Mon, January 15" format - extract month, get year from drag source
            const match = text.match(/^[A-Z][a-z]{2},\s+([A-Z][a-z]{2,})\s+\d{1,2}$/);
            if (match) {
              const fullOrShortMonth = match[1];
              // Convert full month names to 3-letter abbreviations
              const monthNameMap = {
                'January': 'Jan', 'February': 'Feb', 'March': 'Mar', 'April': 'Apr',
                'May': 'May', 'June': 'Jun', 'July': 'Jul', 'August': 'Aug',
                'September': 'Sep', 'October': 'Oct', 'November': 'Nov', 'December': 'Dec'
              };
              sidebarSourceMonth = monthNameMap[fullOrShortMonth] || fullOrShortMonth;

              // Use year from the drag source (stored during handleDragStart)
              if (sourceDateInfo && sourceDateInfo.year) {
                sidebarSourceYear = sourceDateInfo.year;
                console.log(`DragDrop: attemptDateChange - Using year from drag source: ${sidebarSourceYear}`);
              } else {
                // Fallback: use current year
                sidebarSourceYear = new Date().getFullYear();
                console.log(`DragDrop: attemptDateChange - No drag source year, using current year: ${sidebarSourceYear}`);
              }

              console.log(`DragDrop: attemptDateChange - Extracted month from sidebar: ${sidebarSourceMonth}, year from source: ${sidebarSourceYear}`);
            }
            startDateParent = field.closest('div.group.items-center');
            console.log('DragDrop: attemptDateChange - Found start date field:', text);
            break;
          } else if (/^(Today|Tomorrow|Yesterday)$/.test(text)) {
            startDateParent = field.closest('div.group.items-center');
            console.log('DragDrop: attemptDateChange - Found start date field:', text);
            break;
          }
        }

        // If we found year and month in sidebar, recalculate target year (this is the CORRECT year logic)
        if (sidebarSourceYear && sidebarSourceMonth && providedDateInfo) {
          console.log(`DragDrop: attemptDateChange - *** USING SIDEBAR DATA FOR YEAR CALCULATION ***`);
          console.log(`DragDrop: attemptDateChange - Sidebar source: ${sidebarSourceMonth} ${sidebarSourceYear}`);
          console.log(`DragDrop: attemptDateChange - Original target: ${dateInfo.month} ${dateInfo.year}`);

          const monthMap = {
            'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
            'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
          };

          const sourceMonthIndex = monthMap[sidebarSourceMonth];
          const targetMonthIndex = monthMap[dateInfo.month];

          // Apply year boundary logic using ACTUAL source year from sidebar
          if (sourceMonthIndex === targetMonthIndex) {
            // Same month - use source year
            dateInfo.year = sidebarSourceYear;
            console.log(`DragDrop: attemptDateChange - ✓ Same month, corrected target year to: ${dateInfo.year}`);
          } else if (sourceMonthIndex === 11 && targetMonthIndex === 0) {
            // Dec → Jan: next year
            dateInfo.year = sidebarSourceYear + 1;
            console.log(`DragDrop: attemptDateChange - ✓ Dec→Jan transition, corrected target year to: ${dateInfo.year}`);
          } else if (sourceMonthIndex === 0 && targetMonthIndex === 11) {
            // Jan → Dec: previous year
            dateInfo.year = sidebarSourceYear - 1;
            console.log(`DragDrop: attemptDateChange - ✓ Jan→Dec transition, corrected target year to: ${dateInfo.year}`);
          } else {
            // Other month change - use source year
            dateInfo.year = sidebarSourceYear;
            console.log(`DragDrop: attemptDateChange - ✓ Different month, corrected target year to: ${dateInfo.year}`);
          }
        }

        if (startDateParent) {
          const formattedDate = formatDateForInput(dateInfo);
          console.log('DragDrop: attemptDateChange - Formatted date for input:', formattedDate);
          console.log(`DragDrop: attemptDateChange - *** NOTE: Year ${dateInfo.year} is NOT included in formatted date ***`);

          // Look for and check any "notify" or "update linked" checkboxes
          const checkboxes = sidebar.querySelectorAll('input[type="checkbox"]');
          console.log('DragDrop: Found', checkboxes.length, 'checkboxes in sidebar');

          checkboxes.forEach((checkbox, index) => {
            // Look for labels or nearby text to identify the checkbox
            const label = checkbox.closest('label') || checkbox.parentElement;
            const labelText = label ? label.textContent.toLowerCase() : '';

            console.log(`DragDrop: Checkbox ${index}: "${labelText.substring(0, 50)}", checked=${checkbox.checked}`);

            // Check for keywords that suggest this checkbox should be checked
            const shouldCheck = labelText.includes('notify') ||
                               labelText.includes('linked') ||
                               labelText.includes('dependent') ||
                               labelText.includes('update') ||
                               labelText.includes('push') ||
                               labelText.includes('move');

            if (shouldCheck && !checkbox.checked) {
              console.log('DragDrop: Checking checkbox:', labelText.substring(0, 50));
              checkbox.click();
            }
          });

          console.log('DragDrop: attemptDateChange - Clicking start date parent to open date picker');
          startDateParent.click();

          setTimeout(() => {
            console.log('DragDrop: attemptDateChange - Looking for date picker...');

            // Look for the date picker popup with month/year selects
            const monthSelect = document.querySelector('select option[value="1"]')?.closest('select');
            const yearSelect = document.querySelector('select option[value="2026"]')?.closest('select');

            if (monthSelect && yearSelect) {
              console.log('DragDrop: attemptDateChange - Found date picker with month and year selects');

              // Map month names to select values (1-12)
              const monthMap = {
                'Jan': '1', 'Feb': '2', 'Mar': '3', 'Apr': '4', 'May': '5', 'Jun': '6',
                'Jul': '7', 'Aug': '8', 'Sep': '9', 'Oct': '10', 'Nov': '11', 'Dec': '12'
              };

              const targetMonthValue = monthMap[dateInfo.month];
              const targetYearValue = dateInfo.year.toString();

              console.log(`DragDrop: attemptDateChange - Setting date picker to: ${dateInfo.month} (${targetMonthValue}) ${dateInfo.year}`);

              // Set the year first
              yearSelect.value = targetYearValue;
              yearSelect.dispatchEvent(new Event('change', { bubbles: true }));
              yearSelect.dispatchEvent(new Event('input', { bubbles: true }));
              console.log(`DragDrop: attemptDateChange - Year select set to: ${targetYearValue}`);
              console.log(`DragDrop: attemptDateChange - Waiting for React to re-render calendar after year change...`);

              // IMPORTANT: Longer delay to let React re-render the calendar when year changes
              // When year changes, React destroys and recreates the calendar DOM
              setTimeout(() => {
                console.log(`DragDrop: attemptDateChange - React re-render complete, setting month...`);

                // Re-find both selects in case DOM was rebuilt
                console.log('DragDrop: attemptDateChange - Re-querying for month and year selects...');
                const newMonthSelect = document.querySelector('select option[value="1"]')?.closest('select');
                const newYearSelect = document.querySelector('select option[value="2025"], select option[value="2026"]')?.closest('select');

                console.log('DragDrop: attemptDateChange - newMonthSelect:', newMonthSelect);
                console.log('DragDrop: attemptDateChange - newYearSelect:', newYearSelect);

                if (!newMonthSelect) {
                  console.error('DragDrop: attemptDateChange - Month select disappeared after year change!');
                  showNotification('Date picker error: month selector not found after year change');
                  closeSidebar(failsafeTimeout);
                  return;
                }

                // Set the month
                console.log(`DragDrop: attemptDateChange - About to set month to: ${targetMonthValue}`);
                newMonthSelect.value = targetMonthValue;
                console.log(`DragDrop: attemptDateChange - Month value set, dispatching change event...`);
                newMonthSelect.dispatchEvent(new Event('change', { bubbles: true }));
                newMonthSelect.dispatchEvent(new Event('input', { bubbles: true }));
                console.log(`DragDrop: attemptDateChange - Month select set to: ${targetMonthValue}`);

                // Small delay to let month change process and update calendar
                setTimeout(() => {
                  // VERIFY: Check that the dropdowns are still set correctly before clicking
                  const verifyMonthSelect = document.querySelector('select option[value="1"]')?.closest('select');
                  const verifyYearSelect = document.querySelector('select option[value="2025"], select option[value="2026"]')?.closest('select');

                  if (verifyMonthSelect && verifyYearSelect) {
                    console.log(`DragDrop: attemptDateChange - VERIFY before clicking: Month=${verifyMonthSelect.value}, Year=${verifyYearSelect.value}`);
                    console.log(`DragDrop: attemptDateChange - Expected: Month=${targetMonthValue}, Year=${targetYearValue}`);

                    if (verifyMonthSelect.value !== targetMonthValue || verifyYearSelect.value !== targetYearValue) {
                      console.error('DragDrop: attemptDateChange - WARNING: Dropdowns changed! Re-setting...');
                      verifyYearSelect.value = targetYearValue;
                      verifyYearSelect.dispatchEvent(new Event('change', { bubbles: true }));
                      verifyMonthSelect.value = targetMonthValue;
                      verifyMonthSelect.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                  }

                  // Find and click the day in the calendar
                  // Try multiple strategies to find the calendar table
                  let calendarTable = null;

                  // Strategy 1: Look for table in the date picker popup that just opened
                  const popupTables = document.querySelectorAll('div.p-1 table');
                  console.log(`DragDrop: attemptDateChange - Found ${popupTables.length} tables in date picker popups`);

                  // Use the last table found (most recently opened)
                  if (popupTables.length > 0) {
                    calendarTable = popupTables[popupTables.length - 1];
                    console.log('DragDrop: attemptDateChange - Using last found table');
                  }

                  // Strategy 2: Find by the thead with S M T W T F S header
                  if (!calendarTable) {
                    const allTables = document.querySelectorAll('table');
                    for (const table of allTables) {
                      const headers = table.querySelectorAll('thead th');
                      if (headers.length === 7 && headers[0].textContent.trim() === 'S') {
                        calendarTable = table;
                        console.log('DragDrop: attemptDateChange - Found table by day headers');
                        break;
                      }
                    }
                  }

                  console.log('DragDrop: attemptDateChange - Calendar table:', calendarTable);

                  if (calendarTable) {
                    const dayCells = calendarTable.querySelectorAll('td');
                    let targetDayCell = null;

                    for (const cell of dayCells) {
                      const cellText = cell.textContent.trim();
                      // Match the day and make sure it's not grayed out (text-gray-300)
                      if (cellText === dateInfo.day && !cell.classList.contains('text-gray-300')) {
                        targetDayCell = cell;
                        break;
                      }
                    }

                    if (targetDayCell) {
                      console.log(`DragDrop: attemptDateChange - Clicking day ${dateInfo.day} in calendar`);
                      targetDayCell.click();
                      console.log('DragDrop: attemptDateChange - Date picker selection COMPLETE');

                      setTimeout(() => {
                        closeSidebar(failsafeTimeout);
                      }, 500);
                    } else {
                      console.error(`DragDrop: attemptDateChange - Could not find day ${dateInfo.day} in calendar`);
                      showNotification('Could not find target day in calendar');
                      closeSidebar(failsafeTimeout);
                    }
                  } else {
                    console.error('DragDrop: attemptDateChange - Could not find calendar table');
                    showNotification('Could not find calendar');
                    closeSidebar(failsafeTimeout);
                  }
                }, 500); // Increased to 500ms to let month change fully render
              }, 500);
            } else {
              console.log('DragDrop: attemptDateChange - Date picker not found, falling back to input field method');

              // Fall back to old input field method
              let inputField = null;
            const inputs = sidebar.querySelectorAll('input');
            console.log(`DragDrop: attemptDateChange - Found ${inputs.length} input fields in sidebar`);

            for (const input of inputs) {
              const placeholder = input.getAttribute('placeholder');
              const style = window.getComputedStyle(input);
              console.log(`DragDrop: attemptDateChange - Checking input with placeholder: "${placeholder}", display: ${style.display}, opacity: ${style.opacity}`);

              // The input field placeholder might be in various formats, so check broadly
              // We're looking for any input that looks like a date field
              if (placeholder && (
                  /^[A-Z][a-z]{2},\s+[A-Z][a-z]{2,}\s+\d{1,2}$/.test(placeholder) ||  // "Mon, January 15"
                  /^[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}$/.test(placeholder) ||           // "Jan 1, 2026"
                  /^[A-Z][a-z]{2}\s+\d{1,2}$/.test(placeholder)                       // "Jan 1"
              )) {
                if (style.display !== 'none' && style.opacity !== '0') {
                  inputField = input;
                  console.log('DragDrop: attemptDateChange - Found suitable date input field');
                  break;
                }
              }
            }

            if (!inputField) {
              console.log('DragDrop: attemptDateChange - No input in sidebar, checking for popup date picker');
              const datePickerPopup = document.querySelector('div.block.relative input[placeholder]');
              if (datePickerPopup) {
                inputField = datePickerPopup;
                console.log('DragDrop: attemptDateChange - Found date picker popup input');
              }
            }

            if (inputField) {
              console.log('DragDrop: attemptDateChange - Input field found, setting value');
              console.log(`DragDrop: attemptDateChange - Current input value: "${inputField.value}"`);
              console.log(`DragDrop: attemptDateChange - Will set to: "${formattedDate}"`);
              console.log(`DragDrop: attemptDateChange - Note: Year ${dateInfo.year} tracked internally but JobTread infers from calendar`);

              inputField.value = '';
              inputField.focus();
              inputField.value = formattedDate;
              console.log(`DragDrop: attemptDateChange - Input value set to: "${inputField.value}"`);

              // Dispatch input event
              inputField.dispatchEvent(new Event('input', { bubbles: true }));
              console.log('DragDrop: attemptDateChange - Dispatched input event');

              // Simulate pressing Enter key to trigger the full update
              const enterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true
              });
              inputField.dispatchEvent(enterEvent);
              console.log('DragDrop: attemptDateChange - Dispatched Enter keydown event');

              // Also dispatch keyup for Enter
              const enterUpEvent = new KeyboardEvent('keyup', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true
              });
              inputField.dispatchEvent(enterUpEvent);
              console.log('DragDrop: attemptDateChange - Dispatched Enter keyup event');

              // Dispatch change and blur events
              inputField.dispatchEvent(new Event('change', { bubbles: true }));
              inputField.dispatchEvent(new Event('blur', { bubbles: true }));
              console.log('DragDrop: attemptDateChange - Dispatched change and blur events');

              console.log('DragDrop: attemptDateChange - Date typed and Enter key simulated - COMPLETE');

              setTimeout(() => {
                closeSidebar(failsafeTimeout);
              }, 500);
            } else {
              console.error('DragDrop: attemptDateChange - *** ERROR *** Could not find input field');
              console.error('DragDrop: attemptDateChange - Checked sidebar inputs and popup date picker');
              showNotification('Could not find date input field. Please try manually.');
              // Cleanup CSS even on error
              setTimeout(() => {
                closeSidebar(failsafeTimeout);
              }, 500);
            }
            } // End of date picker fallback else block
          }, 400);
        } else {
          console.error('DragDrop: attemptDateChange - *** ERROR *** Could not find start date field');
          console.error(`DragDrop: attemptDateChange - Checked ${allDateFields.length} fields in sidebar`);
          console.error('DragDrop: attemptDateChange - Field texts found:', JSON.stringify(fieldTexts));
          console.error('DragDrop: attemptDateChange - Expected patterns:');
          console.error('  - Pattern 1: "[Month] [Day], [Year]" (e.g., "Jan 1, 2026")');
          console.error('  - Pattern 2: "[Day], [Month] [Date]" (e.g., "Mon, January 15")');
          console.error('  - Pattern 3: "Today" or "Tomorrow" or "Yesterday"');
          showNotification('Could not find date field. Check console for details.');
          // Cleanup CSS
          closeSidebar(failsafeTimeout);
        }
      } else {
        console.error('DragDrop: attemptDateChange - *** ERROR *** Sidebar did not open after clicking element');
        showNotification('Sidebar did not open. Please try manually.');
        // Cleanup CSS
        closeSidebar(failsafeTimeout);
      }
    }, 500);

    console.log('DragDrop: attemptDateChange - END (async operations still running)');

    } catch (error) {
      console.error('DragDrop: *** EXCEPTION IN attemptDateChange ***');
      console.error('DragDrop: Error name:', error.name);
      console.error('DragDrop: Error message:', error.message);
      console.error('DragDrop: Error stack:', error.stack);
      showNotification('Error during date change. Check console for details.');

      // CRITICAL: Clear the date change flag on error to re-enable observer
      isDateChangeInProgress = false;
      console.log('DragDrop: Exception handler - Set isDateChangeInProgress = false');

      // Try to clean up CSS even on error
      const hideStyle = document.getElementById('jt-hide-sidebar-temp');
      if (hideStyle) {
        hideStyle.remove();
        console.log('DragDrop: Removed hiding CSS after exception');
      }
    }
  }

  function closeSidebar(failsafeTimeout) {
    console.log('DragDrop: Attempting to close sidebar...');

    // CRITICAL: Clear the date change flag to re-enable observer
    isDateChangeInProgress = false;
    console.log('DragDrop: closeSidebar - Set isDateChangeInProgress = false');

    // Clear the failsafe timeout since we're handling cleanup now
    if (failsafeTimeout) {
      clearTimeout(failsafeTimeout);
      console.log('DragDrop: Cleared failsafe timeout');
    }

    const sidebar = document.querySelector('div.overflow-y-auto.overscroll-contain.sticky');

    if (sidebar) {
      // Find and click Close button (clicking day in calendar already saved the change)
      const closeButtons = sidebar.querySelectorAll('div[role="button"]');

      for (const button of closeButtons) {
        const text = button.textContent.trim();
        if (text.includes('Close')) {
          console.log('DragDrop: Found and clicking Close button');
          button.click();

          // Wait for sidebar to close BEFORE removing hiding CSS
          setTimeout(() => {
            const hideStyle = document.getElementById('jt-hide-sidebar-temp');
            if (hideStyle) {
              hideStyle.remove();
              console.log('DragDrop: Removed hiding CSS after sidebar closed');
            }
          }, 800);

          return;
        }
      }

      console.log('DragDrop: Could not find Close button, sidebar will remain open');
      // Still remove CSS even if close failed
      setTimeout(() => {
        const hideStyle = document.getElementById('jt-hide-sidebar-temp');
        if (hideStyle) {
          hideStyle.remove();
        }
      }, 800);
    } else {
      console.log('DragDrop: Sidebar not found during close');
      // Remove CSS anyway
      const hideStyle = document.getElementById('jt-hide-sidebar-temp');
      if (hideStyle) {
        hideStyle.remove();
        console.log('DragDrop: Removed hiding CSS');
      }
    }
  }

  function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgb(59, 130, 246);
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        max-width: 400px;
        font-size: 14px;
        font-weight: bold;
        animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;

    const style = document.createElement('style');
    style.textContent = `
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
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => notification.remove(), 300);
    }, 5000);
  }

  function initDragAndDrop() {
    makeScheduleItemsDraggable();
    makeDateCellsDroppable();
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
  window.DragDropFeature = DragDropFeature;
}
