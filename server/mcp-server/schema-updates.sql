-- Schema updates for jobtread-extension-users D1 database
-- Run with: wrangler d1 execute jobtread-extension-users --file=./schema-updates.sql

-- ============================================================================
-- Add tier column to users table
-- ============================================================================

-- Add tier column (default to power_user for existing users)
ALTER TABLE users ADD COLUMN tier TEXT DEFAULT 'power_user'
  CHECK (tier IN ('essential', 'pro', 'power_user'));

-- ============================================================================
-- MCP Tool Usage Tracking
-- Tracks every tool call for analytics and billing
-- ============================================================================

CREATE TABLE IF NOT EXISTS mcp_tool_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_id TEXT NOT NULL,
  user_id TEXT,
  tool_name TEXT NOT NULL,
  client_name TEXT, -- claude, chatgpt, gemini, cursor, etc.
  success INTEGER DEFAULT 1,
  error_message TEXT,
  latency_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mcp_usage_license ON mcp_tool_usage(license_id);
CREATE INDEX IF NOT EXISTS idx_mcp_usage_tool ON mcp_tool_usage(tool_name);
CREATE INDEX IF NOT EXISTS idx_mcp_usage_date ON mcp_tool_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_mcp_usage_client ON mcp_tool_usage(client_name);

-- ============================================================================
-- MCP Connection Tracking
-- Tracks connection sessions for analytics
-- ============================================================================

CREATE TABLE IF NOT EXISTS mcp_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_id TEXT NOT NULL,
  user_id TEXT,
  client_name TEXT,
  connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  disconnected_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_mcp_conn_license ON mcp_connections(license_id);
CREATE INDEX IF NOT EXISTS idx_mcp_conn_date ON mcp_connections(connected_at);
