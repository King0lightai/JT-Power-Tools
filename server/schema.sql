-- JobTread Tools Pro D1 Database Schema
-- Run with: wrangler d1 execute jobtread-extension-users --file=./schema.sql

-- Users table (one per Gumroad license)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT,
  gumroad_license_key TEXT UNIQUE NOT NULL,
  gumroad_product_id TEXT,
  license_valid BOOLEAN DEFAULT true,
  jobtread_grant_key TEXT,
  jobtread_org_id TEXT,
  jobtread_org_name TEXT,
  org_locked BOOLEAN DEFAULT false,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Authorized devices (many per license)
CREATE TABLE IF NOT EXISTS authorized_devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  device_name TEXT,
  verified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, device_id)
);

-- Usage tracking for analytics
CREATE TABLE IF NOT EXISTS api_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  cached BOOLEAN DEFAULT false,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_license ON users(gumroad_license_key);
CREATE INDEX IF NOT EXISTS idx_users_org ON users(jobtread_org_id);
CREATE INDEX IF NOT EXISTS idx_devices_user ON authorized_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_device ON authorized_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_usage_user ON api_usage(user_id, created_at);
