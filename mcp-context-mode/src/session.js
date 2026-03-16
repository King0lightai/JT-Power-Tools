/**
 * session.js — Session continuity for MCP context-mode on Cloudflare Workers.
 *
 * Adapted from context-mode (github.com/mksglu/context-mode) for KV + D1.
 * Tracks MCP tool calls, decisions, errors, and context consumption per session.
 * Builds resume snapshots when context compaction occurs.
 *
 * Storage:
 * - D1: session_events, session_meta (persistent, queryable)
 * - KV: resume snapshots (fast read for session restore)
 */

import { escapeXML, truncateString, byteLength } from './truncate.js';

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

const MAX_EVENTS_PER_SESSION = 500;
const DEDUP_WINDOW = 5;
const DEFAULT_SNAPSHOT_BUDGET = 2048;
const MAX_ACTIVE_TOOLS = 15;
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/** Priority levels for session events. */
export const EventPriority = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  CRITICAL: 4,
};

// ─────────────────────────────────────────────────────────
// SessionStore (D1-based)
// ─────────────────────────────────────────────────────────

export class SessionStore {
  /** @type {D1Database} */
  #db;
  /** @type {KVNamespace|null} */
  #kv;

  /**
   * @param {D1Database} db - Cloudflare D1 database binding
   * @param {KVNamespace} [kv] - Cloudflare KV namespace for snapshots (optional)
   */
  constructor(db, kv = null) {
    this.#db = db;
    this.#kv = kv;
  }

  /**
   * Initialize session schema in D1.
   */
  async initSchema() {
    await this.#db.batch([
      this.#db.prepare(`
        CREATE TABLE IF NOT EXISTS ctx_session_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL,
          org_id TEXT NOT NULL,
          type TEXT NOT NULL,
          category TEXT NOT NULL,
          priority INTEGER NOT NULL DEFAULT 2,
          data TEXT NOT NULL,
          data_hash TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `),
      this.#db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_ctx_session_events_session
        ON ctx_session_events(session_id)
      `),
      this.#db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_ctx_session_events_type
        ON ctx_session_events(session_id, type)
      `),
      this.#db.prepare(`
        CREATE TABLE IF NOT EXISTS ctx_session_meta (
          session_id TEXT PRIMARY KEY,
          org_id TEXT NOT NULL,
          started_at TEXT NOT NULL DEFAULT (datetime('now')),
          last_event_at TEXT,
          event_count INTEGER NOT NULL DEFAULT 0,
          compact_count INTEGER NOT NULL DEFAULT 0
        )
      `),
    ]);
  }

  /**
   * Ensure a session metadata entry exists.
   * @param {string} sessionId
   * @param {string} orgId
   */
  async ensureSession(sessionId, orgId) {
    await this.#db.prepare(
      'INSERT OR IGNORE INTO ctx_session_meta (session_id, org_id) VALUES (?, ?)'
    ).bind(sessionId, orgId).run();
  }

  /**
   * Insert a session event with deduplication and FIFO eviction.
   * @param {string} sessionId
   * @param {string} orgId
   * @param {{type: string, category: string, data: string, priority: number}} event
   */
  async insertEvent(sessionId, orgId, event) {
    // Simple hash for deduplication
    const dataHash = await this.#hashData(event.data);

    // Check for duplicates in recent events
    const { results: recent } = await this.#db.prepare(`
      SELECT type, data_hash FROM ctx_session_events
      WHERE session_id = ? ORDER BY id DESC LIMIT ?
    `).bind(sessionId, DEDUP_WINDOW).all();

    const isDuplicate = (recent || []).some(
      r => r.type === event.type && r.data_hash === dataHash
    );
    if (isDuplicate) return;

    // Check event count for eviction
    const countRow = await this.#db.prepare(
      'SELECT COUNT(*) AS cnt FROM ctx_session_events WHERE session_id = ?'
    ).bind(sessionId).first();

    const statements = [];

    if (countRow && countRow.cnt >= MAX_EVENTS_PER_SESSION) {
      // Evict lowest priority, oldest event
      statements.push(
        this.#db.prepare(`
          DELETE FROM ctx_session_events WHERE id = (
            SELECT id FROM ctx_session_events WHERE session_id = ?
            ORDER BY priority ASC, id ASC LIMIT 1
          )
        `).bind(sessionId)
      );
    }

    // Insert the event
    statements.push(
      this.#db.prepare(`
        INSERT INTO ctx_session_events (session_id, org_id, type, category, priority, data, data_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(sessionId, orgId, event.type, event.category, event.priority, event.data, dataHash)
    );

    // Update meta
    statements.push(
      this.#db.prepare(`
        UPDATE ctx_session_meta
        SET last_event_at = datetime('now'), event_count = event_count + 1
        WHERE session_id = ?
      `).bind(sessionId)
    );

    await this.#db.batch(statements);
  }

  /**
   * Record an MCP tool call as a session event.
   * @param {string} sessionId
   * @param {string} orgId
   * @param {string} toolName
   * @param {number} responseBytes
   * @param {number} durationMs
   */
  async recordToolCall(sessionId, orgId, toolName, responseBytes, durationMs) {
    await this.insertEvent(sessionId, orgId, {
      type: 'mcp_tool_call',
      category: 'mcp',
      priority: EventPriority.NORMAL,
      data: JSON.stringify({ tool: toolName, bytes: responseBytes, ms: durationMs }),
    });
  }

  /**
   * Record a user decision or correction.
   * @param {string} sessionId
   * @param {string} orgId
   * @param {string} decision
   */
  async recordDecision(sessionId, orgId, decision) {
    await this.insertEvent(sessionId, orgId, {
      type: 'decision',
      category: 'decision',
      priority: EventPriority.HIGH,
      data: decision,
    });
  }

  /**
   * Record an error.
   * @param {string} sessionId
   * @param {string} orgId
   * @param {string} error
   */
  async recordError(sessionId, orgId, error) {
    await this.insertEvent(sessionId, orgId, {
      type: 'error',
      category: 'error',
      priority: EventPriority.HIGH,
      data: truncateString(error, 500),
    });
  }

  /**
   * Get all events for a session.
   * @param {string} sessionId
   * @param {{type?: string, minPriority?: number, limit?: number}} [opts]
   */
  async getEvents(sessionId, opts = {}) {
    const limit = opts.limit || 1000;
    let sql = 'SELECT * FROM ctx_session_events WHERE session_id = ?';
    const params = [sessionId];

    if (opts.type) {
      sql += ' AND type = ?';
      params.push(opts.type);
    }
    if (opts.minPriority !== undefined) {
      sql += ' AND priority >= ?';
      params.push(opts.minPriority);
    }

    sql += ' ORDER BY id ASC LIMIT ?';
    params.push(limit);

    const { results } = await this.#db.prepare(sql).bind(...params).all();
    return results || [];
  }

  /**
   * Get session stats/metadata.
   * @param {string} sessionId
   */
  async getSessionStats(sessionId) {
    return await this.#db.prepare(
      'SELECT * FROM ctx_session_meta WHERE session_id = ?'
    ).bind(sessionId).first();
  }

  /**
   * Build and store a resume snapshot for context compaction recovery.
   * @param {string} sessionId
   * @param {string} orgId
   * @param {number} [maxBytes]
   */
  async buildResumeSnapshot(sessionId, orgId, maxBytes = DEFAULT_SNAPSHOT_BUDGET) {
    const events = await this.getEvents(sessionId);
    const meta = await this.getSessionStats(sessionId);
    const compactCount = (meta?.compact_count || 0) + 1;

    // Increment compact count
    await this.#db.prepare(
      'UPDATE ctx_session_meta SET compact_count = compact_count + 1 WHERE session_id = ?'
    ).bind(sessionId).run();

    const snapshot = buildSnapshotXML(events, { maxBytes, compactCount });

    // Store in KV for fast retrieval (if KV available)
    if (this.#kv) {
      await this.#kv.put(
        `session:${sessionId}:resume`,
        snapshot,
        { expirationTtl: SESSION_TTL_SECONDS }
      );
    }

    return snapshot;
  }

  /**
   * Retrieve resume snapshot.
   * @param {string} sessionId
   */
  async getResumeSnapshot(sessionId) {
    if (this.#kv) {
      return await this.#kv.get(`session:${sessionId}:resume`);
    }
    return null;
  }

  /**
   * Delete all data for a session.
   * @param {string} sessionId
   */
  async deleteSession(sessionId) {
    await this.#db.batch([
      this.#db.prepare('DELETE FROM ctx_session_events WHERE session_id = ?').bind(sessionId),
      this.#db.prepare('DELETE FROM ctx_session_meta WHERE session_id = ?').bind(sessionId),
    ]);
    if (this.#kv) {
      await this.#kv.delete(`session:${sessionId}:resume`);
    }
  }

  /**
   * Simple hash for deduplication (SHA-256 first 16 hex chars).
   * @param {string} data
   * @returns {Promise<string>}
   */
  async #hashData(data) {
    const encoded = new TextEncoder().encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    const hashArray = new Uint8Array(hashBuffer);
    return Array.from(hashArray.slice(0, 8))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }
}

// ─────────────────────────────────────────────────────────
// Snapshot Builder (pure functions)
// ─────────────────────────────────────────────────────────

/**
 * Build a resume snapshot XML string from stored session events.
 * Priority-tiered budget allocation:
 *   P1 (50%): tool_usage, errors
 *   P2 (35%): decisions, search_queries
 *   P3 (15%): context_stats
 *
 * @param {Array} events
 * @param {{maxBytes?: number, compactCount?: number}} [opts]
 * @returns {string}
 */
function buildSnapshotXML(events, opts = {}) {
  const maxBytes = opts.maxBytes || DEFAULT_SNAPSHOT_BUDGET;
  const compactCount = opts.compactCount || 1;
  const now = new Date().toISOString();

  // Group events by category
  const mcpEvents = events.filter(e => e.category === 'mcp');
  const errorEvents = events.filter(e => e.category === 'error');
  const decisionEvents = events.filter(e => e.category === 'decision');
  const searchEvents = events.filter(e => e.type === 'search_query');

  // P1: tool usage + errors (50%)
  const p1Sections = [];
  const toolUsage = renderToolUsage(mcpEvents);
  if (toolUsage) p1Sections.push(toolUsage);
  const errors = renderErrors(errorEvents);
  if (errors) p1Sections.push(errors);

  // P2: decisions + searches (35%)
  const p2Sections = [];
  const decisions = renderDecisions(decisionEvents);
  if (decisions) p2Sections.push(decisions);
  const searches = renderSearchHistory(searchEvents);
  if (searches) p2Sections.push(searches);

  // P3: context stats summary (15%)
  const p3Sections = [];
  const statsSection = renderContextStatsSummary(mcpEvents);
  if (statsSection) p3Sections.push(statsSection);

  // Assemble with budget trimming
  const header = `<session_resume compact_count="${compactCount}" events="${events.length}" at="${now}">`;
  const footer = '</session_resume>';

  const tiers = [p1Sections, p2Sections, p3Sections];

  for (let dropFrom = tiers.length; dropFrom >= 0; dropFrom--) {
    const activeTiers = tiers.slice(0, dropFrom);
    const body = activeTiers.flat().join('\n');
    const xml = body ? `${header}\n${body}\n${footer}` : `${header}\n${footer}`;

    if (byteLength(xml) <= maxBytes) return xml;
  }

  return `${header}\n${footer}`;
}

function renderToolUsage(mcpEvents) {
  if (mcpEvents.length === 0) return '';

  const toolCounts = new Map();
  const toolBytes = new Map();

  for (const ev of mcpEvents) {
    try {
      const data = JSON.parse(ev.data);
      const tool = data.tool || 'unknown';
      toolCounts.set(tool, (toolCounts.get(tool) || 0) + 1);
      toolBytes.set(tool, (toolBytes.get(tool) || 0) + (data.bytes || 0));
    } catch { /* skip */ }
  }

  const lines = ['  <tool_usage>'];
  const sorted = [...toolCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_ACTIVE_TOOLS);

  for (const [tool, count] of sorted) {
    const bytes = toolBytes.get(tool) || 0;
    const kb = (bytes / 1024).toFixed(1);
    lines.push(`    <tool name="${escapeXML(tool)}" calls="${count}" kb="${kb}" />`);
  }

  lines.push('  </tool_usage>');
  return lines.join('\n');
}

function renderErrors(errorEvents) {
  if (errorEvents.length === 0) return '';
  const lines = ['  <errors>'];
  // Show last 5 errors
  for (const ev of errorEvents.slice(-5)) {
    lines.push(`    - ${escapeXML(truncateString(ev.data, 150))}`);
  }
  lines.push('  </errors>');
  return lines.join('\n');
}

function renderDecisions(decisionEvents) {
  if (decisionEvents.length === 0) return '';
  const seen = new Set();
  const lines = ['  <decisions>'];
  for (const ev of decisionEvents) {
    if (seen.has(ev.data)) continue;
    seen.add(ev.data);
    lines.push(`    - ${escapeXML(truncateString(ev.data, 200))}`);
  }
  lines.push('  </decisions>');
  return lines.join('\n');
}

function renderSearchHistory(searchEvents) {
  if (searchEvents.length === 0) return '';
  const lines = ['  <recent_searches>'];
  for (const ev of searchEvents.slice(-5)) {
    lines.push(`    - ${escapeXML(truncateString(ev.data, 100))}`);
  }
  lines.push('  </recent_searches>');
  return lines.join('\n');
}

function renderContextStatsSummary(mcpEvents) {
  if (mcpEvents.length === 0) return '';

  let totalBytes = 0;
  let totalCalls = 0;

  for (const ev of mcpEvents) {
    try {
      const data = JSON.parse(ev.data);
      totalBytes += data.bytes || 0;
      totalCalls++;
    } catch { /* skip */ }
  }

  const totalKB = (totalBytes / 1024).toFixed(1);
  return `  <context_stats total_calls="${totalCalls}" total_kb="${totalKB}" />`;
}

export { buildSnapshotXML };
