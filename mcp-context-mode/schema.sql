-- ============================================================
-- Context-Mode D1 Schema for JobTread MCP Server
-- ============================================================
-- Run this against your Cloudflare D1 database to set up the
-- context-mode tables. These are additive — they won't affect
-- existing tables.
--
-- Usage:
--   wrangler d1 execute CONTEXT_DB --file=./mcp-context-mode/schema.sql
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- Knowledge Base: Sources
-- ──────────────────────────────────────────────────────────
-- Tracks indexed content sources (documents, API responses, etc.)

CREATE TABLE IF NOT EXISTS ctx_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id TEXT NOT NULL,
  label TEXT NOT NULL,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  code_chunk_count INTEGER NOT NULL DEFAULT 0,
  indexed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ctx_sources_org ON ctx_sources(org_id);
CREATE INDEX IF NOT EXISTS idx_ctx_sources_label ON ctx_sources(org_id, label);

-- ──────────────────────────────────────────────────────────
-- Knowledge Base: FTS5 Chunks (Porter stemming)
-- ──────────────────────────────────────────────────────────
-- Full-text search with BM25 ranking. Porter stemmer handles
-- word variations (running -> run, tasks -> task).

CREATE VIRTUAL TABLE IF NOT EXISTS ctx_chunks USING fts5(
  title,
  content,
  source_id UNINDEXED,
  org_id UNINDEXED,
  content_type UNINDEXED,
  tokenize='porter unicode61'
);

-- ──────────────────────────────────────────────────────────
-- Knowledge Base: Vocabulary
-- ──────────────────────────────────────────────────────────
-- Stores distinctive terms per org for fuzzy correction
-- (Levenshtein distance matching for typo tolerance).

CREATE TABLE IF NOT EXISTS ctx_vocabulary (
  org_id TEXT NOT NULL,
  word TEXT NOT NULL,
  PRIMARY KEY (org_id, word)
);

-- ──────────────────────────────────────────────────────────
-- Session Events
-- ──────────────────────────────────────────────────────────
-- Tracks tool calls, errors, decisions, and other session
-- activity for resume snapshot generation.

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
);

CREATE INDEX IF NOT EXISTS idx_ctx_session_events_session
  ON ctx_session_events(session_id);
CREATE INDEX IF NOT EXISTS idx_ctx_session_events_type
  ON ctx_session_events(session_id, type);

-- ──────────────────────────────────────────────────────────
-- Session Metadata
-- ──────────────────────────────────────────────────────────
-- Tracks session lifecycle: start time, event count,
-- compaction count for snapshot budget allocation.

CREATE TABLE IF NOT EXISTS ctx_session_meta (
  session_id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_event_at TEXT,
  event_count INTEGER NOT NULL DEFAULT 0,
  compact_count INTEGER NOT NULL DEFAULT 0
);
