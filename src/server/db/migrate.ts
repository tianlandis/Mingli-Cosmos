// ============================================================
// 自动迁移（Phase 4 — 完整版）
// 文件：src/server/db/migrate.ts
// 职责：在已有 SQLite 连接上执行建表 SQL + 增量 ALTER
// ============================================================

import type Database from 'better-sqlite3'

/**
 * 安全 ALTER：忽略"列已存在"错误
 */
function safeAlter(sqlite: Database.Database, table: string, colDef: string) {
  try { sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${colDef}`) }
  catch (e: any) {
    if (!e.message?.includes('duplicate column') && !e.message?.includes('already exists')) {
      console.warn(`[Migrate] ALTER ${table} ADD ${colDef.split(' ')[0]} 失败:`, e.message)
    }
  }
}

export function runMigrations(sqlite: Database.Database) {
  // ═══════════════════════════════════════
  // 基础建表 (Phase 4A)
  // ═══════════════════════════════════════
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

  // ═══════════════════════════════════════
  // Phase 4 NEW: 增量 ALTER（已有表扩展）
  // ═══════════════════════════════════════

  // api_keys 扩展
  safeAlter(sqlite, 'api_keys', "supported_tools TEXT DEFAULT '[]'")
  safeAlter(sqlite, 'api_keys', 'tested_at TEXT')
  safeAlter(sqlite, 'api_keys', "test_status TEXT DEFAULT 'untested'")
  safeAlter(sqlite, 'api_keys', 'test_latency INTEGER')

  // prompt_templates 扩展
  safeAlter(sqlite, 'prompt_templates', "category TEXT DEFAULT 'custom'")
  safeAlter(sqlite, 'prompt_templates', 'is_builtin INTEGER DEFAULT 0')

  // app_configs 扩展
  safeAlter(sqlite, 'app_configs', "value_type TEXT DEFAULT 'string'")
  safeAlter(sqlite, 'app_configs', "category TEXT DEFAULT 'general'")

  // ═══════════════════════════════════════
  // Phase 7 NEW: 知识资产字典表
  // ═══════════════════════════════════════
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_assets(category);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_key ON knowledge_assets(category, key);
  `)

  // ═══════════════════════════════════════
  // Phase 4 NEW: 全新表
  // ═══════════════════════════════════════
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS prompt_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prompt_id INTEGER NOT NULL REFERENCES prompt_templates(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      content TEXT NOT NULL,
      change_note TEXT,
      created_by TEXT DEFAULT 'admin',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_prompt_versions_prompt_id ON prompt_versions(prompt_id);

    CREATE TABLE IF NOT EXISTS admin_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_jti TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      is_active INTEGER DEFAULT 1,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      logout_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token_jti);
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_active ON admin_sessions(is_active);
  `)
}
