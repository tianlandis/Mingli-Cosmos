// ============================================================
// Phase 4A — 数据库统一入口
// 文件：src/server/db/index.ts
// 职责：初始化连接 + 统一导出 Schema + Repositories
// ============================================================

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import * as schema from './schema'
import { runMigrations } from './migrate'
import { seedDefaults, seedLocalProvider } from './seed'

let _db: ReturnType<typeof drizzle> | null = null
let _sqlite: Database.Database | null = null

/**
 * 获取数据库实例（单例）
 * 自动创建 data/ 目录
 */
export function getDb() {
  if (_db) return _db

  const dbPath = process.env.DB_PATH || 'data/mingli.db'
  const dir = dirname(dbPath)
  if (dir && dir !== '.' && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  _sqlite = new Database(dbPath)
  _sqlite.pragma('journal_mode = WAL')
  _sqlite.pragma('foreign_keys = ON')

  _db = drizzle(_sqlite, { schema })
  return _db
}

/**
 * 初始化数据库（创建表 + 种子数据）
 */
export function initDb() {
  getDb()
  runMigrations(_sqlite!)

  // 首次启动：写入默认配置 + 本地 Provider
  seedDefaults()
  seedLocalProvider()

  console.log(`[DB] initialized: ${process.env.DB_PATH || 'data/mingli.db'}`)
}

/** 关闭数据库连接 */
export function closeDb() {
  if (_sqlite) {
    _sqlite.close()
    _sqlite = null
    _db = null
  }
}

export { schema }
export * from './repositories/api-keys'
export * from './repositories/prompts'
export * from './repositories/prompt-versions'
export * from './repositories/app-configs'
export * from './repositories/sessions'
export * from './repositories/audit-logs'
