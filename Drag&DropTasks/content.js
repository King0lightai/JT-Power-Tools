// Function to calculate relative luminance and return appropriate text color
function getContrastColor(rgbString) {
    // Extract RGB values from string like "rgb(230, 246, 230)"
    const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return null;
    
    const [, r, g, b] = match.map(Number);
    
    // Calculate relative luminance using WCAG formula
    const [rNorm, gNorm, bNorm] = [r, g, b].map(val => {
        val = val / 255;
        return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    
    const luminance = 0.2126 * rNorm + 0.7152 * gNorm + 0.0722 * bNorm;
    
    // Return white for dark backgrounds, black for light backgrounds
    return luminance > 0.5 ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)';
}

// Function to fix text contrast for a single element
function fixTextContrast(element) {
    const style = element.getAttribute('style');
    if (!style) return;

    // Check if element has both background-color and color in inline styles
    const bgColorMatch = style.match(/background-color:\s*rgb\([^)]+\)/);
    const textColorMatch = style.match(/color:\s*rgb\([^)]+\)/);

    if (bgColorMatch && textColorMatch) {
        const backgroundColor = bgColorMatch[0].split(':')[1].trim().replace(';', '');
        const contrastColor = getContrastColor(backgroundColor);

        if (contrastColor) {
            // Get current color
            const currentColor = window.getComputedStyle(element).color;

            // Only update if the color is different (prevents infinite loop)
            if (currentColor !== contrastColor) {
                // Override the color property
                const newStyle = style.replace(/color:\s*rgb\([^)]+\)/, `color: ${contrastColor}`);
                element.setAttribute('style', newStyle);

                // Also ensure child text elements inherit this color
                element.style.color = contrastColor;
            }
        }
    }
}

// Function to highlight current date with blue background
function highlightCurrentDate() {
    // Find all date cells with the blue background (current date indicator)
    const currentDateDivs = document.querySelectorAll('div.bg-blue-500.text-white');

    currentDateDivs.forEach(dateDiv => {
        // Find the parent td cell
        let tdCell = dateDiv.closest('td');

        if (tdCell && !tdCell.classList.contains('jt-current-date-enhanced')) {
            // Add a custom class to prevent re-processing
            tdCell.classList.add('jt-current-date-enhanced');

            // Fill the entire cell background with blue
            tdCell.style.backgroundColor = 'rgb(59, 130, 246)';
        }
    });
}

// Function to process all schedule items
function fixAllScheduleItems() {
    // Target the specific divs in schedule/calendar view that have inline background-color and color
    const scheduleItems = document.querySelectorAll('div[style*="background-color"][style*="color"]');

    scheduleItems.forEach(item => {
        // Make sure we're only targeting the calendar/schedule items (they have the cursor-pointer class)
        if (item.classList.contains('cursor-pointer')) {
            fixTextContrast(item);
        }
    });

    // Also highlight current date
    highlightCurrentDate();
}

// Run on initial load
fixAllScheduleItems();

// Debounce timer to prevent excessive processing
let debounceTimer = null;

// Watch for DOM changes (new tasks, view changes, etc.)
const observer = new MutationObserver((mutations) => {
    let shouldUpdate = false;

    mutations.forEach(mutation => {
        // Only process when new nodes are added (not when we modify attributes)
        if (mutation.addedNodes.length > 0) {
            shouldUpdate = true;
        }
    });

    if (shouldUpdate) {
        // Debounce to prevent excessive calls
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(() => {
            // Temporarily disconnect observer to prevent infinite loop
            observer.disconnect();

            fixAllScheduleItems();

            // Reconnect observer after a short delay
            setTimeout(() => {
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            }, 100);
        }, 250);
    }
});

// Start observing
observer.observe(document.body, {
    childList: true,
    subtree: true
});

console.log('JobTread Schedule Contrast Fix loaded');
