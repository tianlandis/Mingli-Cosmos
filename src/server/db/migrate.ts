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
  const colName = colDef.split(' ')[0]
  try {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${colDef}`)
    console.log(`[Migrate] ✅ ${table}.${colName}`)
  }
  catch (e: any) {
    if (e.message?.includes('duplicate column') || e.message?.includes('already exists')) {
      console.log(`[Migrate] ⏭️ ${table}.${colName} (已存在)`)
    } else {
      console.error(`[Migrate] ❌ ${table}.${colName} 失败:`, e.message)
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
  safeAlter(sqlite, 'api_keys', "tools TEXT DEFAULT '[]'")
  safeAlter(sqlite, 'api_keys', 'is_default INTEGER DEFAULT 0')
  safeAlter(sqlite, 'api_keys', 'top_p REAL')
  safeAlter(sqlite, 'api_keys', 'frequency_penalty REAL')
  safeAlter(sqlite, 'api_keys', 'stream_enabled INTEGER DEFAULT 1')
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

  // ═══════════════════════════════════════
  // Phase 4b M-6: C 端用户体系
  // ═══════════════════════════════════════
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      phone TEXT,
      email TEXT,
      password_hash TEXT NOT NULL,
      nickname TEXT,
      avatar_url TEXT,
      status TEXT DEFAULT 'active',
      role TEXT DEFAULT 'user',
      vip_level TEXT DEFAULT 'free',
      vip_expires_at TEXT,
      quota_total INTEGER DEFAULT 5,
      quota_used INTEGER DEFAULT 0,
      last_login_at TEXT,
      last_login_ip TEXT,
      register_ip TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
    CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

    CREATE TABLE IF NOT EXISTS user_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_jti TEXT NOT NULL UNIQUE,
      ip TEXT,
      user_agent TEXT,
      is_active INTEGER DEFAULT 1,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      logout_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_user_sessions_jti ON user_sessions(token_jti);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
  `)

  // ═══════════════════════════════════════
  // Phase 4b M-7: 订单与订阅
  // ═══════════════════════════════════════
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      duration_days INTEGER NOT NULL,
      quota_grant INTEGER DEFAULT 0,
      vip_level TEXT DEFAULT 'basic',
      features TEXT DEFAULT '[]',
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_id INTEGER REFERENCES plans(id) ON DELETE SET NULL,
      plan_name TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      pay_method TEXT,
      trade_no TEXT,
      paid_at TEXT,
      refunded_at TEXT,
      expired_at TEXT,
      remark TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_id INTEGER REFERENCES plans(id) ON DELETE SET NULL,
      order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
      vip_level TEXT NOT NULL,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      quota_granted INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_subs_user ON subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_subs_status ON subscriptions(status);
  `)

  // ═══════════════════════════════════════
  // Phase 4b M-8: 运营埋点
  // ═══════════════════════════════════════
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event TEXT NOT NULL,
      user_id INTEGER,
      session_id TEXT,
      payload TEXT DEFAULT '{}',
      ip TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics_events(event);
    CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at);
  `)

  // ═══════════════════════════════════════
  // Phase 5 P5-3/P5-6: sessions 扩展（计算权威锚点 + PII 归属）
  // ═══════════════════════════════════════
  safeAlter(sqlite, 'sessions', 'chart_hash TEXT')
  safeAlter(sqlite, 'sessions', 'engine_version TEXT')
  safeAlter(sqlite, 'sessions', 'user_id INTEGER')
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);`)

  // users 扩展：软删除
  safeAlter(sqlite, 'users', 'deleted_at TEXT')

  // ═══════════════════════════════════════
  // Phase 5 P5-4 (ADR-004): 额度追加式台账
  // ═══════════════════════════════════════
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS quota_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      idempotency_key TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      delta INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      ref_key TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_quota_ledger_user ON quota_ledger(user_id);
    CREATE INDEX IF NOT EXISTS idx_quota_ledger_key ON quota_ledger(idempotency_key);
    CREATE INDEX IF NOT EXISTS idx_quota_ledger_status ON quota_ledger(status);
  `)

  // ═══════════════════════════════════════
  // Phase 5 P5-6 (ADR-006): 告知同意留痕
  // ═══════════════════════════════════════
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS consent_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      version TEXT NOT NULL,
      agreed INTEGER DEFAULT 1,
      ip TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_consent_user ON consent_records(user_id);
    CREATE INDEX IF NOT EXISTS idx_consent_type ON consent_records(type);
  `)
}
