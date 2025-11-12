// Date Changer Module
// Orchestrates the process of changing a task's date by manipulating the sidebar

const DateChanger = (() => {
  /**
   * Main function to attempt changing a task's date
   * @param {HTMLElement} element - The dragged element
   * @param {string} newDateNumber - The new day number
   * @param {HTMLElement} targetCell - The target cell that was dropped on
   * @param {Object} providedDateInfo - The full date info {day, month, year}
   * @param {Object} sourceDateInfo - The source date info from drag start
   * @param {Function} onDateChangeComplete - Callback when date change is complete
   * @param {boolean} changeEndDate - If true, change End date instead of Start date (Alt key)
   * @returns {Promise} Resolves when date change is complete
   */
  function attemptDateChange(element, newDateNumber, targetCell, providedDateInfo, sourceDateInfo, onDateChangeComplete, changeEndDate = false) {
    console.log('DateChanger: ==========================================');
    console.log('DateChanger: attemptDateChange - *** START ***');
    console.log('DateChanger: changeEndDate?', changeEndDate, '(Alt key pressed)');
    console.log('DateChanger: ==========================================');

    try {
      console.log('DateChanger: attemptDateChange - element:', element);
      console.log('DateChanger: attemptDateChange - newDateNumber:', newDateNumber);
      console.log('DateChanger: attemptDateChange - providedDateInfo:', JSON.stringify(providedDateInfo));

      const dateInfo = providedDateInfo || (window.DateUtils && window.DateUtils.extractFullDateInfo(targetCell, sourceDateInfo));

      if (!dateInfo) {
        console.error('DateChanger: attemptDateChange - Failed to get dateInfo');
        if (window.UIUtils) {
          window.UIUtils.showNotification('Error: Could not extract date information');
        }
        return;
      }

      console.log('DateChanger: attemptDateChange - Using dateInfo:', JSON.stringify(dateInfo));

      // Close any open sidebar first to prevent conflicts
      if (window.SidebarManager) {
        const hadOpenSidebar = window.SidebarManager.closeAnySidebar();
        if (hadOpenSidebar) {
          console.log('DateChanger: Closed existing sidebar, waiting before opening new one...');
          // Wait a bit for the sidebar to close
          setTimeout(() => continueWithDateChange(), 300);
          return;
        }
      }

      continueWithDateChange();

      function continueWithDateChange() {
        console.log('DateChanger: Continuing with date change operation...');

        // Inject CSS to hide sidebar
        const hideStyle = window.SidebarManager ? window.SidebarManager.injectHideSidebarCSS() : null;

        // Failsafe: Remove CSS after 5 seconds no matter what
        const failsafeTimeout = setTimeout(() => {
          if (window.SidebarManager) {
            window.SidebarManager.removeSidebarCSS();
            console.log('DateChanger: Failsafe removed hiding CSS');
          }
        }, 5000);

        // Click to open sidebar
        if (window.SidebarManager) {
          window.SidebarManager.openSidebar(element);
        } else {
          element.click();
        }

        // Wait for sidebar and process
        setTimeout(() => {
          const sidebar = document.querySelector('div.overflow-y-auto.overscroll-contain.sticky');

          if (sidebar) {
            console.log('DateChanger: attemptDateChange - Sidebar found, processing date change...');

            // Determine which field to change based on Alt key
            const fieldType = changeEndDate ? 'End' : 'Start';
            console.log(`DateChanger: Looking for "${fieldType}" date field`);

            // Find date field (Start or End)
            const fieldResult = window.SidebarManager
              ? window.SidebarManager.findDateField(sidebar, sourceDateInfo, fieldType)
              : { startDateParent: null, sidebarSourceYear: null, sidebarSourceMonth: null, fieldTexts: [] };

            const { startDateParent, sidebarSourceYear, sidebarSourceMonth, fieldTexts } = fieldResult;

            // Show notification about which date is being changed
            if (window.UIUtils) {
              const formattedNewDate = `${dateInfo.month} ${dateInfo.day}, ${dateInfo.year}`;
              window.UIUtils.showNotification(`Changing ${fieldType} date to ${formattedNewDate}`);
            }

            // If we found year and month in sidebar, recalculate target year
            if (sidebarSourceYear && sidebarSourceMonth && providedDateInfo && window.DateUtils) {
              console.log(`DateChanger: attemptDateChange - *** USING SIDEBAR DATA FOR YEAR CALCULATION ***`);
              console.log(`DateChanger: attemptDateChange - Sidebar source: ${sidebarSourceMonth} ${sidebarSourceYear}`);
              console.log(`DateChanger: attemptDateChange - Original target: ${dateInfo.month} ${dateInfo.year}`);

              const monthMap = window.DateUtils.MONTH_MAP;
              const sourceMonthIndex = monthMap[sidebarSourceMonth];
              const targetMonthIndex = monthMap[dateInfo.month];

              // Apply year boundary logic using ACTUAL source year from sidebar
              if (sourceMonthIndex === targetMonthIndex) {
                // Same month - use source year
                dateInfo.year = sidebarSourceYear;
                console.log(`DateChanger: attemptDateChange - ✓ Same month, corrected target year to: ${dateInfo.year}`);
              } else if (sourceMonthIndex === 11 && targetMonthIndex === 0) {
                // Dec → Jan: next year
                dateInfo.year = sidebarSourceYear + 1;
                console.log(`DateChanger: attemptDateChange - ✓ Dec→Jan transition, corrected target year to: ${dateInfo.year}`);
              } else if (sourceMonthIndex === 0 && targetMonthIndex === 11) {
                // Jan → Dec: previous year
                dateInfo.year = sidebarSourceYear - 1;
                console.log(`DateChanger: attemptDateChange - ✓ Jan→Dec transition, corrected target year to: ${dateInfo.year}`);
              } else {
                // Other month change - use source year
                dateInfo.year = sidebarSourceYear;
                console.log(`DateChanger: attemptDateChange - ✓ Different month, corrected target year to: ${dateInfo.year}`);
              }
            }

            if (startDateParent) {
              const formattedDate = window.DateUtils
                ? window.DateUtils.formatDateForInput(dateInfo, sidebarSourceMonth)
                : `${dateInfo.month} ${dateInfo.day} ${dateInfo.year}`;

              console.log('DateChanger: attemptDateChange - Formatted date for input:', formattedDate);

              // Check update checkboxes
              if (window.SidebarManager) {
                window.SidebarManager.checkUpdateCheckboxes(sidebar);
              }

              console.log('DateChanger: attemptDateChange - Clicking start date parent to open date picker');
              startDateParent.click();

              setTimeout(() => {
                console.log('DateChanger: attemptDateChange - Looking for date input method...');

                // PRIORITY 1: Try to find a date input field to type into
                const inputField = window.SidebarManager
                  ? window.SidebarManager.findInputField(sidebar)
                  : null;

                // If we found an input field, use the typing method (most reliable)
                if (inputField) {
                  typeIntoDateField(inputField, formattedDate, dateInfo, failsafeTimeout, onDateChangeComplete);
                } else {
                  // PRIORITY 2: Fallback to calendar dropdown manipulation
                  useCalendarPicker(dateInfo, failsafeTimeout, onDateChangeComplete);
                }
              }, 400);
            } else {
              console.error('DateChanger: attemptDateChange - *** ERROR *** Could not find start date field');
              console.error(`DateChanger: attemptDateChange - Checked ${fieldResult.fieldTexts.length} fields in sidebar`);
              console.error('DateChanger: attemptDateChange - Field texts found:', JSON.stringify(fieldTexts));
              if (window.UIUtils) {
                window.UIUtils.showNotification('Could not find date field. Check console for details.');
              }
              if (window.SidebarManager) {
                window.SidebarManager.closeSidebar(failsafeTimeout, onDateChangeComplete);
              }
            }
          } else {
            console.error('DateChanger: attemptDateChange - *** ERROR *** Sidebar did not open after clicking element');
            if (window.UIUtils) {
              window.UIUtils.showNotification('Sidebar did not open. Please try manually.');
            }
            if (window.SidebarManager) {
              window.SidebarManager.closeSidebar(failsafeTimeout, onDateChangeComplete);
            }
          }
        }, 500);

        console.log('DateChanger: attemptDateChange - END (async operations still running)');
      }  // End of continueWithDateChange function

    } catch (error) {
      console.error('DateChanger: *** EXCEPTION IN attemptDateChange ***');
      console.error('DateChanger: Error name:', error.name);
      console.error('DateChanger: Error message:', error.message);
      console.error('DateChanger: Error stack:', error.stack);
      if (window.UIUtils) {
        window.UIUtils.showNotification('Error during date change. Check console for details.');
      }

      // Notify completion even on error
      if (onDateChangeComplete) {
        onDateChangeComplete();
      }

      // Try to clean up CSS even on error
      if (window.SidebarManager) {
        window.SidebarManager.removeSidebarCSS();
      }
    }
  }

  /**
   * Click Save button if in availability view
   * In availability view, date changes must be saved explicitly
   * The Save button is on the main page, not in the sidebar
   * This should be called AFTER the sidebar closes
   * @returns {Promise} Resolves when save is complete (or immediately if not needed)
   */
  function clickSaveButtonIfNeeded() {
    return new Promise((resolve) => {
      // Check if we're in availability view
      const isAvailabilityView = window.ViewDetector && window.ViewDetector.isAvailabilityView();

      if (!isAvailabilityView) {
        console.log('DateChanger: Not in availability view, skipping Save button');
        resolve();
        return;
      }

      console.log('DateChanger: In availability view, looking for Save button on main page...');

      // Look for the Save button on the main page (not in sidebar)
      // <div role="button" ... class="... bg-blue-500 border-blue-600 ...">
      //   <svg>...</svg> Save
      // </div>
      const buttons = document.querySelectorAll('div[role="button"]');
      let saveButton = null;

      for (const button of buttons) {
        const text = button.textContent.trim();
        const classes = button.className || '';

        // Check if this is the blue Save button
        if (text.includes('Save') &&
            (classes.includes('bg-blue-500') || classes.includes('bg-blue-600'))) {
          saveButton = button;
          console.log('DateChanger: Found Save button on main page:', text);
          break;
        }
      }

      if (saveButton) {
        console.log('DateChanger: Clicking Save button...');
        saveButton.click();

        // Wait a bit for the save to complete
        setTimeout(() => {
          console.log('DateChanger: Save button clicked, date should be saved');
          resolve();
        }, 300);
      } else {
        console.warn('DateChanger: Save button not found on main page');
        resolve();
      }
    });
  }

  /**
   * Type the date into an input field (most reliable method)
   */
  function typeIntoDateField(inputField, formattedDate, dateInfo, failsafeTimeout, onDateChangeComplete) {
    console.log('DateChanger: Using typing method');
    console.log(`DateChanger: Current input value: "${inputField.value}"`);
    console.log(`DateChanger: Will set to: "${formattedDate}"`);
    console.log(`DateChanger: Note: Year ${dateInfo.year} tracked internally but JobTread infers from calendar`);

    inputField.value = '';
    inputField.focus();
    inputField.value = formattedDate;
    console.log(`DateChanger: Input value set to: "${inputField.value}"`);

    // Dispatch input event
    inputField.dispatchEvent(new Event('input', { bubbles: true }));
    console.log('DateChanger: Dispatched input event');

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
    console.log('DateChanger: Dispatched Enter keydown event');

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
    console.log('DateChanger: Dispatched Enter keyup event');

    // Dispatch change and blur events
    inputField.dispatchEvent(new Event('change', { bubbles: true }));
    inputField.dispatchEvent(new Event('blur', { bubbles: true }));
    console.log('DateChanger: Dispatched change and blur events');

    console.log('DateChanger: Date typed and Enter key simulated - COMPLETE');

    setTimeout(() => {
      // Close the sidebar first
      if (window.SidebarManager) {
        window.SidebarManager.closeSidebar(failsafeTimeout, async () => {
          // After sidebar closes, click Save button if in availability view
          await clickSaveButtonIfNeeded();

          // Then notify completion
          if (onDateChangeComplete) {
            onDateChangeComplete();
          }
        });
      }
    }, 500);
  }

  /**
   * Use calendar dropdown method (fallback when no input field found)
   */
  function useCalendarPicker(dateInfo, failsafeTimeout, onDateChangeComplete) {
    console.log('DateChanger: No input field found, trying calendar dropdown method...');

    const sidebar = document.querySelector('div.overflow-y-auto.overscroll-contain.sticky');
    let monthSelect = null;
    let yearSelect = null;

    // Strategy 1: Look for selects inside a popup container
    const popups = document.querySelectorAll('div.block, div[style*="position"], div.absolute, div.fixed');
    for (const popup of popups) {
      const popupMonthSelect = popup.querySelector('select option[value="1"]')?.closest('select');
      const popupYearSelect = popup.querySelector('select option[value="2026"]')?.closest('select');

      if (popupMonthSelect && popupYearSelect) {
        // Verify this is a date picker (has 12 month options)
        const monthOptions = popupMonthSelect.querySelectorAll('option');
        if (monthOptions.length === 12) {
          monthSelect = popupMonthSelect;
          yearSelect = popupYearSelect;
          console.log('DateChanger: Found date picker in popup container');
          break;
        }
      }
    }

    // Strategy 2: Look inside the sidebar itself
    if (!monthSelect || !yearSelect) {
      const sidebarMonthSelect = sidebar?.querySelector('select option[value="1"]')?.closest('select');
      const sidebarYearSelect = sidebar?.querySelector('select option[value="2026"]')?.closest('select');

      if (sidebarMonthSelect && sidebarYearSelect) {
        const monthOptions = sidebarMonthSelect.querySelectorAll('option');
        if (monthOptions.length === 12) {
          monthSelect = sidebarMonthSelect;
          yearSelect = sidebarYearSelect;
          console.log('DateChanger: Found date picker in sidebar');
        }
      }
    }

    if (monthSelect && yearSelect) {
      setDatePickerAndClickDay(monthSelect, yearSelect, dateInfo, failsafeTimeout, onDateChangeComplete);
    } else {
      console.error('DateChanger: *** ERROR *** No input field or calendar picker found');
      if (window.UIUtils) {
        window.UIUtils.showNotification('Could not find date input method. Please try manually.');
      }
      setTimeout(() => {
        if (window.SidebarManager) {
          window.SidebarManager.closeSidebar(failsafeTimeout, onDateChangeComplete);
        }
      }, 500);
    }
  }

  /**
   * Set the date picker dropdowns and click the day
   */
  function setDatePickerAndClickDay(monthSelect, yearSelect, dateInfo, failsafeTimeout, onDateChangeComplete) {
    console.log('DateChanger: Found date picker with month and year selects');

    // Map month names to select values (1-12, JobTread's select format)
    const monthMap = {
      'Jan': '1', 'Feb': '2', 'Mar': '3', 'Apr': '4', 'May': '5', 'Jun': '6',
      'Jul': '7', 'Aug': '8', 'Sep': '9', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };

    const targetMonthValue = monthMap[dateInfo.month];
    const targetYearValue = dateInfo.year.toString();

    console.log(`DateChanger: Setting date picker to: ${dateInfo.month} (${targetMonthValue}) ${dateInfo.year}`);

    // Set year AND month rapidly in succession
    console.log(`DateChanger: Setting year to: ${targetYearValue}`);
    yearSelect.value = targetYearValue;
    yearSelect.dispatchEvent(new Event('change', { bubbles: true }));
    yearSelect.dispatchEvent(new Event('input', { bubbles: true }));

    console.log(`DateChanger: Immediately setting month to: ${targetMonthValue}`);
    monthSelect.value = targetMonthValue;
    monthSelect.dispatchEvent(new Event('change', { bubbles: true }));
    monthSelect.dispatchEvent(new Event('input', { bubbles: true }));

    console.log(`DateChanger: Both year (${targetYearValue}) and month (${targetMonthValue}) set`);
    console.log(`DateChanger: Waiting for React to render calendar with both changes...`);

    // Retry mechanism to ensure dropdowns stay set correctly
    let retryCount = 0;
    const maxRetries = 5;

    function verifyAndRetry() {
      setTimeout(() => {
        retryCount++;
        console.log(`DateChanger: Verification attempt ${retryCount}/${maxRetries}`);

        try {
          if (monthSelect && yearSelect) {
            console.log(`DateChanger: VERIFY: Month=${monthSelect.value}, Year=${yearSelect.value}`);
            console.log(`DateChanger: Expected: Month=${targetMonthValue}, Year=${targetYearValue}`);

            if (monthSelect.value !== targetMonthValue || yearSelect.value !== targetYearValue) {
              if (retryCount < maxRetries) {
                console.warn(`DateChanger: Dropdowns reverted! Retry ${retryCount}/${maxRetries}`);
                // Re-set both rapidly
                yearSelect.value = targetYearValue;
                yearSelect.dispatchEvent(new Event('change', { bubbles: true }));
                yearSelect.dispatchEvent(new Event('input', { bubbles: true }));
                monthSelect.value = targetMonthValue;
                monthSelect.dispatchEvent(new Event('change', { bubbles: true }));
                monthSelect.dispatchEvent(new Event('input', { bubbles: true }));
                // Try again
                verifyAndRetry();
                return;
              } else {
                console.error(`DateChanger: Max retries (${maxRetries}) reached, dropdowns still incorrect!`);
                if (window.UIUtils) {
                  window.UIUtils.showNotification('Date picker not responding correctly. Please try manually.');
                }
                if (window.SidebarManager) {
                  window.SidebarManager.closeSidebar(failsafeTimeout, onDateChangeComplete);
                }
                return;
              }
            }
          }

          // Dropdowns are correct, proceed with clicking
          console.log('DateChanger: Dropdowns verified correct, proceeding...');
          clickDayInCalendar(dateInfo, failsafeTimeout, onDateChangeComplete);

        } catch (error) {
          console.error('DateChanger: Error during verification:', error);
          if (window.UIUtils) {
            window.UIUtils.showNotification('Error during date picker verification: ' + error.message);
          }
          if (window.SidebarManager) {
            window.SidebarManager.closeSidebar(failsafeTimeout, onDateChangeComplete);
          }
        }
      }, retryCount === 0 ? 400 : 300);
    }

    // Start verification process
    verifyAndRetry();
  }

  /**
   * Find and click the day in the calendar
   */
  function clickDayInCalendar(dateInfo, failsafeTimeout, onDateChangeComplete) {
    try {
      // Find calendar table
      let calendarTable = null;

      // Strategy 1: Look for table in the date picker popup
      const popupTables = document.querySelectorAll('div.p-1 table');
      console.log(`DateChanger: Found ${popupTables.length} tables in date picker popups`);

      if (popupTables.length > 0) {
        calendarTable = popupTables[popupTables.length - 1];
        console.log('DateChanger: Using last found table');
      }

      // Strategy 2: Find by the thead with S M T W T F S header
      if (!calendarTable) {
        const allTables = document.querySelectorAll('table');
        for (const table of allTables) {
          const headers = table.querySelectorAll('thead th');
          if (headers.length === 7 && headers[0].textContent.trim() === 'S') {
            calendarTable = table;
            console.log('DateChanger: Found table by day headers');
            break;
          }
        }
      }

      console.log('DateChanger: Calendar table:', calendarTable);

      if (calendarTable) {
        // VERIFY: Log what month/year the calendar is showing
        const calendarCells = calendarTable.querySelectorAll('td');
        const sampleCells = Array.from(calendarCells).slice(0, 10).map(c => c.textContent.trim());
        console.log(`DateChanger: Calendar showing days: ${sampleCells.join(', ')}`);

        const dayCells = calendarTable.querySelectorAll('td');
        let targetDayCell = null;
        const candidateCells = [];

        // Find ALL cells matching the day number
        for (const cell of dayCells) {
          const cellText = cell.textContent.trim();
          if (cellText === dateInfo.day) {
            const classes = cell.className;
            const computedStyle = window.getComputedStyle(cell);
            const color = computedStyle.color;
            const opacity = computedStyle.opacity;

            candidateCells.push({
              cell,
              classes,
              color,
              opacity,
              isGrayed: classes.includes('text-gray') || parseFloat(opacity) < 1
            });

            console.log(`DateChanger: Candidate day ${dateInfo.day}: classes="${classes}", color="${color}", opacity="${opacity}", grayed=${classes.includes('text-gray') || parseFloat(opacity) < 1}`);
          }
        }

        console.log(`DateChanger: Found ${candidateCells.length} cells with day ${dateInfo.day}`);

        // Select the FIRST non-grayed cell
        for (const candidate of candidateCells) {
          if (!candidate.isGrayed) {
            targetDayCell = candidate.cell;
            console.log(`DateChanger: Selected non-grayed cell for day ${dateInfo.day}`);
            break;
          }
        }

        // Fallback if all are grayed
        if (!targetDayCell && candidateCells.length > 0) {
          console.error(`DateChanger: All ${candidateCells.length} cells for day ${dateInfo.day} appear grayed out!`);
          targetDayCell = candidateCells[0].cell;
          console.log('DateChanger: Using first cell as fallback');
        }

        if (targetDayCell) {
          console.log(`DateChanger: Final selected cell classes: ${targetDayCell.className}`);
          targetDayCell.click();
          console.log('DateChanger: Day clicked, waiting for JobTread to process...');

          console.log('DateChanger: Date picker selection COMPLETE');

          setTimeout(() => {
            // Close the sidebar first
            if (window.SidebarManager) {
              window.SidebarManager.closeSidebar(failsafeTimeout, async () => {
                // After sidebar closes, click Save button if in availability view
                await clickSaveButtonIfNeeded();

                // Then notify completion
                if (onDateChangeComplete) {
                  onDateChangeComplete();
                }
              });
            }
          }, 500);
        } else {
          console.error(`DateChanger: Could not find day ${dateInfo.day} in calendar`);
          if (window.UIUtils) {
            window.UIUtils.showNotification('Could not find target day in calendar');
          }
          if (window.SidebarManager) {
            window.SidebarManager.closeSidebar(failsafeTimeout, onDateChangeComplete);
          }
        }
      } else {
        console.error('DateChanger: Could not find calendar table');
        if (window.UIUtils) {
          window.UIUtils.showNotification('Could not find calendar');
        }
        if (window.SidebarManager) {
          window.SidebarManager.closeSidebar(failsafeTimeout, onDateChangeComplete);
        }
      }

    } catch (error) {
      console.error('DateChanger: *** EXCEPTION in clickDayInCalendar ***');
      console.error('DateChanger: Error:', error.name, error.message);
      console.error('DateChanger: Stack:', error.stack);
      if (window.UIUtils) {
        window.UIUtils.showNotification('Error during day selection. Check console.');
      }
      if (window.SidebarManager) {
        window.SidebarManager.closeSidebar(failsafeTimeout, onDateChangeComplete);
      }
    }
  }

  // Public API
  return {
    attemptDateChange
  };
})();

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.DateChanger = DateChanger;
}
