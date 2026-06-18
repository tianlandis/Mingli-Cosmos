// ============================================================
// 自动迁移（Phase 4A — 简化版）
// 文件：src/server/db/migrate.ts
// 职责：在已有 SQLite 连接上执行建表 SQL
// ============================================================

import type Database from 'better-sqlite3'

export function runMigrations(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      label TEXT NOT NULL,
      api_key TEXT NOT NULL,
      base_url TEXT,
      model TEXT,
      temperature REAL DEFAULT 0.7,
      max_tokens INTEGER DEFAULT 2048,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS prompt_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      content TEXT NOT NULL,
      variables TEXT DEFAULT '[]',
      version INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      display_name TEXT,
      description TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      chart TEXT NOT NULL,
      annotation TEXT NOT NULL,
      message_count INTEGER DEFAULT 0,
      last_active TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      resource TEXT NOT NULL,
      resource_id INTEGER,
      detail TEXT,
      operator TEXT DEFAULT 'admin',
      ip TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `)
}
