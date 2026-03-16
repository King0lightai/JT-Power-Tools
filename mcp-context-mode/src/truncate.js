/**
 * truncate.js — Smart output truncation utilities for context-mode.
 *
 * Adapted from context-mode (github.com/mksglu/context-mode) for Cloudflare Workers.
 * Uses TextEncoder instead of Buffer for byte-length calculations.
 *
 * Key strategies:
 * - smartTruncate: 60% head + 40% tail (preserves initial context + final errors)
 * - truncateJSON: Binary-search for UTF-8 safe byte boundaries
 * - capBytes: Hard byte cap with ellipsis
 */

const encoder = new TextEncoder();

/**
 * Get byte length of a string (UTF-8).
 * @param {string} str
 * @returns {number}
 */
function byteLength(str) {
  return encoder.encode(str).byteLength;
}

/**
 * Truncate a string to at most maxChars characters.
 * @param {string} str
 * @param {number} maxChars
 * @returns {string}
 */
export function truncateString(str, maxChars) {
  if (str.length <= maxChars) return str;
  return str.slice(0, Math.max(0, maxChars - 3)) + '...';
}

/**
 * Smart truncation that keeps head (60%) and tail (40%) of output.
 * Preserves both initial context and final error messages.
 * Snaps to line boundaries.
 *
 * @param {string} raw - Raw output string
 * @param {number} maxBytes - Soft cap in bytes
 * @returns {string}
 */
export function smartTruncate(raw, maxBytes) {
  if (byteLength(raw) <= maxBytes) return raw;

  const lines = raw.split('\n');
  const headBudget = Math.floor(maxBytes * 0.6);
  const tailBudget = maxBytes - headBudget;

  // Collect head lines
  const headLines = [];
  let headBytes = 0;
  for (const line of lines) {
    const lineBytes = byteLength(line) + 1; // +1 for \n
    if (headBytes + lineBytes > headBudget) break;
    headLines.push(line);
    headBytes += lineBytes;
  }

  // Collect tail lines (from end)
  const tailLines = [];
  let tailBytes = 0;
  for (let i = lines.length - 1; i >= headLines.length; i--) {
    const lineBytes = byteLength(lines[i]) + 1;
    if (tailBytes + lineBytes > tailBudget) break;
    tailLines.unshift(lines[i]);
    tailBytes += lineBytes;
  }

  const skippedLines = lines.length - headLines.length - tailLines.length;
  const skippedBytes = byteLength(raw) - headBytes - tailBytes;

  const separator =
    `\n\n... [${skippedLines} lines / ${(skippedBytes / 1024).toFixed(1)}KB truncated` +
    ` — showing first ${headLines.length} + last ${tailLines.length} lines] ...\n\n`;

  return headLines.join('\n') + separator + tailLines.join('\n');
}

/**
 * Serialize a value to JSON, then truncate to maxBytes.
 * Result is NOT guaranteed to be valid JSON after truncation.
 *
 * @param {*} value - Any JSON-serializable value
 * @param {number} maxBytes - Maximum byte length
 * @param {number} [indent=2] - JSON indentation
 * @returns {string}
 */
export function truncateJSON(value, maxBytes, indent = 2) {
  const serialized = JSON.stringify(value, null, indent) ?? 'null';
  if (byteLength(serialized) <= maxBytes) return serialized;

  const marker = '... [truncated]';
  const markerBytes = byteLength(marker);
  const budget = maxBytes - markerBytes;

  // Binary-search for the right character count
  let lo = 0;
  let hi = serialized.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (byteLength(serialized.slice(0, mid)) <= budget) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  return serialized.slice(0, lo) + marker;
}

/**
 * Return str unchanged if it fits within maxBytes, otherwise return a
 * byte-safe slice with an ellipsis appended.
 *
 * @param {string} str
 * @param {number} maxBytes
 * @returns {string}
 */
export function capBytes(str, maxBytes) {
  if (byteLength(str) <= maxBytes) return str;
  const marker = '...';
  const markerBytes = byteLength(marker);
  const budget = maxBytes - markerBytes;

  let lo = 0;
  let hi = str.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (byteLength(str.slice(0, mid)) <= budget) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  return str.slice(0, lo) + marker;
}

/**
 * Escape a string for safe embedding in XML.
 * @param {string} str
 * @returns {string}
 */
export function escapeXML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export { byteLength };
