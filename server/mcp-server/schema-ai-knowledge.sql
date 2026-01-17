-- JobTread AI Knowledge D1 Database Schema
-- Run with: wrangler d1 execute jobtread-ai-knowledge --file=./schema-ai-knowledge.sql

-- ============================================================================
-- Process Documents Table
-- Stores team SOPs, community best practices, and user-generated content
-- ============================================================================

CREATE TABLE IF NOT EXISTS process_documents (
  id TEXT PRIMARY KEY,

  -- Content
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  content_format TEXT DEFAULT 'markdown',

  -- Author
  author_id TEXT NOT NULL,
  author_name TEXT,
  author_org TEXT,
  org_id TEXT,

  -- Visibility: private (only author), team (org only), public (all subscribers)
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'public')),

  -- Categorization
  category TEXT CHECK (category IN ('estimating', 'scheduling', 'budgeting', 'invoicing', 'tasks', 'documents', 'general')),
  tags TEXT, -- JSON array as string
  jobtread_features TEXT, -- JSON array of relevant JT features

  -- Engagement
  save_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,

  -- Metadata
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  version INTEGER DEFAULT 1
);

-- Indexes for process_documents
CREATE INDEX IF NOT EXISTS idx_docs_visibility ON process_documents(visibility);
CREATE INDEX IF NOT EXISTS idx_docs_org ON process_documents(org_id);
CREATE INDEX IF NOT EXISTS idx_docs_author ON process_documents(author_id);
CREATE INDEX IF NOT EXISTS idx_docs_category ON process_documents(category);
CREATE INDEX IF NOT EXISTS idx_docs_saves ON process_documents(save_count DESC);

-- ============================================================================
-- Document Saves Table
-- Tracks which users have saved which documents to their library
-- ============================================================================

CREATE TABLE IF NOT EXISTS document_saves (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  saved_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (document_id) REFERENCES process_documents(id) ON DELETE CASCADE,
  UNIQUE(document_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_saves_user ON document_saves(user_id);
CREATE INDEX IF NOT EXISTS idx_saves_doc ON document_saves(document_id);

-- ============================================================================
-- Knowledge Cache Table
-- Caches Gemini responses to reduce API costs
-- ============================================================================

CREATE TABLE IF NOT EXISTS knowledge_cache (
  id TEXT PRIMARY KEY,
  query_hash TEXT UNIQUE NOT NULL,
  query_text TEXT NOT NULL,
  response TEXT NOT NULL,
  source TEXT DEFAULT 'gemini' CHECK (source IN ('gemini', 'manual', 'import')),
  hit_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_cache_hash ON knowledge_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON knowledge_cache(expires_at);

-- ============================================================================
-- Organization Users Table (for process docs)
-- Maps user IDs to organizations for document access control
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_users (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_name TEXT,
  user_email TEXT,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_org_users_org ON org_users(org_id);
CREATE INDEX IF NOT EXISTS idx_org_users_email ON org_users(user_email);
