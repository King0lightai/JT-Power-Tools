/**
 * stats.js — Context consumption tracking for MCP tools.
 *
 * Tracks how much context each MCP tool consumes per session,
 * enabling AI clients to understand their context budget usage.
 *
 * Runs in-memory per request with periodic D1 persistence.
 */

import { byteLength } from './truncate.js';

// ─────────────────────────────────────────────────────────
// ContextStats
// ─────────────────────────────────────────────────────────

export class ContextStats {
  /** @type {Map<string, {calls: number, totalBytes: number, totalMs: number, savedBytes: number}>} */
  #tools = new Map();

  /** @type {number} */
  #sessionStartMs = Date.now();

  /**
   * Record a tool call with response metrics.
   * @param {string} toolName
   * @param {number} rawBytes - Original response size before truncation
   * @param {number} returnedBytes - Actual bytes returned to context
   * @param {number} durationMs
   */
  record(toolName, rawBytes, returnedBytes, durationMs) {
    const existing = this.#tools.get(toolName) || {
      calls: 0,
      totalBytes: 0,
      totalMs: 0,
      savedBytes: 0,
    };

    existing.calls++;
    existing.totalBytes += returnedBytes;
    existing.totalMs += durationMs;
    existing.savedBytes += Math.max(0, rawBytes - returnedBytes);

    this.#tools.set(toolName, existing);
  }

  /**
   * Get stats summary for all tools.
   * @returns {{tools: Array, totals: object, sessionDurationMs: number}}
   */
  getSummary() {
    const tools = [];
    let totalCalls = 0;
    let totalBytes = 0;
    let totalSaved = 0;
    let totalMs = 0;

    for (const [name, stats] of this.#tools) {
      tools.push({
        name,
        calls: stats.calls,
        bytesReturned: stats.totalBytes,
        bytesSaved: stats.savedBytes,
        avgMs: Math.round(stats.totalMs / stats.calls),
        contextSavings: stats.savedBytes > 0
          ? `${((stats.savedBytes / (stats.totalBytes + stats.savedBytes)) * 100).toFixed(1)}%`
          : '0%',
      });
      totalCalls += stats.calls;
      totalBytes += stats.totalBytes;
      totalSaved += stats.savedBytes;
      totalMs += stats.totalMs;
    }

    // Sort by bytes returned (highest consumers first)
    tools.sort((a, b) => b.bytesReturned - a.bytesReturned);

    const estimatedTokens = Math.ceil(totalBytes / 4); // rough estimate

    return {
      tools,
      totals: {
        calls: totalCalls,
        bytesReturned: totalBytes,
        kbReturned: (totalBytes / 1024).toFixed(1),
        bytesSaved: totalSaved,
        kbSaved: (totalSaved / 1024).toFixed(1),
        estimatedTokens,
        contextSavings: totalSaved > 0
          ? `${((totalSaved / (totalBytes + totalSaved)) * 100).toFixed(1)}%`
          : '0%',
      },
      sessionDurationMs: Date.now() - this.#sessionStartMs,
    };
  }

  /**
   * Format stats as a concise text report.
   * @returns {string}
   */
  formatReport() {
    const { tools, totals, sessionDurationMs } = this.getSummary();
    const durationMin = (sessionDurationMs / 60000).toFixed(1);

    const lines = [
      '## Context Mode Stats',
      '',
      `Session: ${durationMin} min | ${totals.calls} calls | ~${totals.estimatedTokens} tokens`,
      `Context used: ${totals.kbReturned} KB | Saved: ${totals.kbSaved} KB (${totals.contextSavings})`,
      '',
      '| Tool | Calls | Returned | Saved | Avg ms |',
      '|------|-------|----------|-------|--------|',
    ];

    for (const tool of tools) {
      lines.push(
        `| ${tool.name} | ${tool.calls} | ${(tool.bytesReturned / 1024).toFixed(1)} KB | ${(tool.bytesSaved / 1024).toFixed(1)} KB | ${tool.avgMs} ms |`
      );
    }

    return lines.join('\n');
  }
}

/**
 * Middleware to wrap a tool handler with context stats tracking.
 * @param {ContextStats} stats
 * @param {string} toolName
 * @param {Function} handler - async (params) => response
 * @returns {Function}
 */
export function withStats(stats, toolName, handler) {
  return async (params) => {
    const startMs = Date.now();

    const response = await handler(params);

    const durationMs = Date.now() - startMs;
    const responseStr = typeof response === 'string' ? response : JSON.stringify(response);
    const returnedBytes = byteLength(responseStr);

    // rawBytes is the same as returnedBytes unless truncation was applied
    // The handler should set response.__rawBytes if it truncated
    const rawBytes = response?.__rawBytes || returnedBytes;

    stats.record(toolName, rawBytes, returnedBytes, durationMs);

    return response;
  };
}
