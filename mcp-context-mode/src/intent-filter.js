/**
 * intent-filter.js — Intent-driven response filtering.
 *
 * When a tool response exceeds a threshold and the caller provides
 * an intent (e.g., "find overdue tasks"), this module auto-indexes
 * the full response into the knowledge base and returns only the
 * sections relevant to the intent.
 *
 * This is the core context-saving mechanism: instead of dumping
 * 50KB of budget data into context, return 2KB of relevant sections
 * with search vocabulary for follow-up queries.
 */

import { byteLength, smartTruncate } from './truncate.js';

// Threshold above which intent filtering kicks in (5 KB)
const INTENT_FILTER_THRESHOLD = 5 * 1024;

// Max bytes to return after intent filtering
const FILTERED_RESPONSE_MAX = 3 * 1024;

/**
 * Apply intent-driven filtering to a tool response.
 *
 * @param {object} opts
 * @param {string} opts.response - The raw tool response (string or JSON)
 * @param {string} opts.intent - What the user/AI is looking for
 * @param {string} opts.toolName - Name of the tool that produced the response
 * @param {string} opts.orgId - Organization ID
 * @param {import('./store.js').ContentStore} opts.store - Knowledge base store
 * @returns {Promise<{filtered: string, rawBytes: number, indexed: boolean}>}
 */
export async function applyIntentFilter({ response, intent, toolName, orgId, store }) {
  const responseStr = typeof response === 'string' ? response : JSON.stringify(response, null, 2);
  const rawBytes = byteLength(responseStr);

  // Below threshold or no intent — return as-is (with smart truncation as fallback)
  if (rawBytes <= INTENT_FILTER_THRESHOLD || !intent) {
    return {
      filtered: smartTruncate(responseStr, FILTERED_RESPONSE_MAX * 2),
      rawBytes,
      indexed: false,
    };
  }

  // Index the full response into the knowledge base
  const label = `${toolName}:${Date.now()}`;

  // Detect content type and index accordingly
  let indexResult;
  try {
    JSON.parse(responseStr);
    indexResult = await store.indexJSON(orgId, responseStr, label);
  } catch {
    // Not JSON — try markdown, then fall back to plain text
    if (responseStr.includes('#') || responseStr.includes('```')) {
      indexResult = await store.index(orgId, responseStr, label);
    } else {
      indexResult = await store.indexPlainText(orgId, responseStr, label);
    }
  }

  // Search for sections matching the intent
  const results = await store.searchWithFallback(orgId, intent, 3, label);

  if (results.length === 0) {
    // No relevant sections found — return smart-truncated version
    return {
      filtered: smartTruncate(responseStr, FILTERED_RESPONSE_MAX),
      rawBytes,
      indexed: true,
    };
  }

  // Build filtered response with section previews
  const sections = results.map(r => {
    const preview = r.content.length > 500
      ? r.content.slice(0, 400) + '...\n[Use ctx_search to see full section]'
      : r.content;
    return `### ${r.title}\n${preview}`;
  });

  // Extract searchable vocabulary for follow-up queries
  const allContent = results.map(r => r.content).join(' ');
  const vocab = extractSearchableTerms(allContent);

  const filtered = [
    `**Intent:** ${intent}`,
    `**Source:** ${toolName} (${(rawBytes / 1024).toFixed(1)} KB indexed → ${indexResult.totalChunks} chunks)`,
    `**Showing:** ${results.length} relevant sections`,
    '',
    ...sections,
    '',
    `**Searchable vocabulary:** ${vocab}`,
    `**To explore further:** Use \`ctx_search\` with queries like: ${generateSuggestedQueries(intent, results)}`,
  ].join('\n');

  return {
    filtered,
    rawBytes,
    indexed: true,
  };
}

/**
 * Extract distinctive searchable terms from content.
 * @param {string} content
 * @returns {string}
 */
function extractSearchableTerms(content) {
  const words = content
    .toLowerCase()
    .split(/[^a-z0-9_-]+/)
    .filter(w => w.length >= 4)
    .reduce((acc, w) => {
      acc.set(w, (acc.get(w) || 0) + 1);
      return acc;
    }, new Map());

  // Sort by frequency, take top 15
  const sorted = [...words.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) => word);

  return sorted.join(', ');
}

/**
 * Generate suggested follow-up search queries.
 * @param {string} intent
 * @param {Array} results
 * @returns {string}
 */
function generateSuggestedQueries(intent, results) {
  const titles = results.map(r => `"${r.title}"`);
  return titles.slice(0, 3).join(', ');
}

export { INTENT_FILTER_THRESHOLD, FILTERED_RESPONSE_MAX };
