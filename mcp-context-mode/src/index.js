/**
 * index.js — Context-mode integration for the JobTread MCP Server.
 *
 * This module provides middleware and utilities to enhance the existing
 * Cloudflare Workers MCP server with context-mode capabilities:
 *
 * 1. Smart truncation — Large responses are intelligently trimmed (60/40 head/tail)
 * 2. Intent filtering — When intent is provided, responses are indexed and filtered
 * 3. Knowledge base — FTS5 BM25-ranked search via Cloudflare D1
 * 4. Batch execution — Multiple tool calls in one request
 * 5. Context stats — Track context consumption per tool
 * 6. Session continuity — Survive context compaction with resume snapshots
 *
 * Integration pattern:
 *   import { createContextMode } from './mcp-context-mode/src/index.js';
 *   const ctx = createContextMode(env.CONTEXT_DB, env.CONTEXT_KV);
 *   // Register ctx tools alongside existing MCP tools
 *
 * Adapted from context-mode (github.com/mksglu/context-mode) for Cloudflare Workers.
 */

import { ContentStore } from './store.js';
import { SessionStore, EventPriority } from './session.js';
import { ContextStats, withStats } from './stats.js';
import { applyIntentFilter } from './intent-filter.js';
import { getContextToolDefinitions, createContextToolHandlers } from './context-tools.js';
import { smartTruncate, truncateJSON, capBytes, byteLength } from './truncate.js';

// ─────────────────────────────────────────────────────────
// Main Factory
// ─────────────────────────────────────────────────────────

/**
 * Create a context-mode instance for the current request.
 *
 * @param {D1Database} db - Cloudflare D1 binding (for knowledge base + sessions)
 * @param {KVNamespace} [kv] - Cloudflare KV binding (for resume snapshots)
 * @returns {ContextMode}
 */
export function createContextMode(db, kv) {
  return new ContextMode(db, kv);
}

class ContextMode {
  /** @type {ContentStore} */
  store;
  /** @type {SessionStore} */
  session;
  /** @type {ContextStats} */
  stats;

  /**
   * @param {D1Database} db
   * @param {KVNamespace} [kv]
   */
  constructor(db, kv) {
    this.store = new ContentStore(db);
    this.session = new SessionStore(db, kv);
    this.stats = new ContextStats();
  }

  /**
   * Initialize database schemas. Call once during Worker setup or migration.
   */
  async initialize() {
    await this.store.initSchema();
    await this.session.initSchema();
  }

  /**
   * Get MCP tool definitions to register alongside existing tools.
   * @returns {Array<{name: string, description: string, inputSchema: object}>}
   */
  getToolDefinitions() {
    return getContextToolDefinitions();
  }

  /**
   * Create bound tool handlers for the current request context.
   *
   * @param {object} opts
   * @param {string} opts.orgId - Organization ID (from auth)
   * @param {string} opts.sessionId - Session ID (from request header or generated)
   * @param {Function} opts.callTool - Function to call existing MCP tools
   * @returns {Record<string, Function>}
   */
  createHandlers({ orgId, sessionId, callTool }) {
    // Ensure session exists
    this.session.ensureSession(sessionId, orgId).catch(() => {});

    return createContextToolHandlers({
      store: this.store,
      session: this.session,
      stats: this.stats,
      orgId,
      sessionId,
      callTool,
    });
  }

  /**
   * Wrap an existing tool handler with context-mode enhancements:
   * - Smart truncation for large responses
   * - Intent-driven filtering when intent parameter is provided
   * - Context stats tracking
   * - Session event recording
   *
   * @param {string} toolName
   * @param {Function} handler - Original tool handler: (params) => response
   * @param {object} opts
   * @param {string} opts.orgId
   * @param {string} opts.sessionId
   * @param {number} [opts.maxResponseBytes=10240] - Max response bytes before truncation
   * @returns {Function} Enhanced handler
   */
  wrapTool(toolName, handler, { orgId, sessionId, maxResponseBytes = 10240 }) {
    const { store, session, stats } = this;

    return async (params) => {
      const startMs = Date.now();
      const intent = params?.intent;

      // Remove intent from params before forwarding to original handler
      if (intent) {
        const { intent: _, ...cleanParams } = params;
        params = cleanParams;
      }

      try {
        const response = await handler(params);
        const durationMs = Date.now() - startMs;
        const responseStr = typeof response === 'string' ? response : JSON.stringify(response);
        const rawBytes = byteLength(responseStr);

        let result;

        // Apply intent filtering for large responses
        if (intent && rawBytes > 5 * 1024) {
          const filtered = await applyIntentFilter({
            response: responseStr,
            intent,
            toolName,
            orgId,
            store,
          });
          result = filtered.filtered;
          stats.record(toolName, rawBytes, byteLength(result), durationMs);
        } else {
          // Smart truncation
          result = smartTruncate(responseStr, maxResponseBytes);
          stats.record(toolName, rawBytes, byteLength(result), durationMs);
        }

        // Record tool call
        await session.recordToolCall(sessionId, orgId, toolName, byteLength(result), durationMs);

        return result;
      } catch (error) {
        const durationMs = Date.now() - startMs;
        await session.recordError(sessionId, orgId, `${toolName}: ${error.message}`);
        stats.record(toolName, 0, byteLength(error.message), durationMs);
        throw error;
      }
    };
  }

  /**
   * Build a resume snapshot for the current session.
   * Call this before context compaction (PreCompact hook equivalent).
   *
   * @param {string} sessionId
   * @param {string} orgId
   * @returns {Promise<string>} XML snapshot
   */
  async buildSnapshot(sessionId, orgId) {
    return this.session.buildResumeSnapshot(sessionId, orgId);
  }

  /**
   * Get a resume snapshot for session restoration.
   * Call this at session start (SessionStart hook equivalent).
   *
   * @param {string} sessionId
   * @returns {Promise<string|null>}
   */
  async getSnapshot(sessionId) {
    return this.session.getResumeSnapshot(sessionId);
  }
}

// ─────────────────────────────────────────────────────────
// Re-exports for direct use
// ─────────────────────────────────────────────────────────

export { ContentStore } from './store.js';
export { SessionStore, EventPriority } from './session.js';
export { ContextStats, withStats } from './stats.js';
export { applyIntentFilter } from './intent-filter.js';
export { smartTruncate, truncateJSON, capBytes, byteLength } from './truncate.js';
export { getContextToolDefinitions, createContextToolHandlers } from './context-tools.js';
