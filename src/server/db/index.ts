// ============================================================
// Phase 4A — 数据库统一入口
// 文件：src/server/db/index.ts
// 职责：初始化连接 + 统一导出 Schema + Repositories
// ============================================================

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import * as schema from './schema'
import { runMigrations } from './migrate'
import { seedDefaults, seedLocalProvider, seedKnowledgeAssets, seedDefaultPlans, seedPhase5Configs } from './seed'

let _db: ReturnType<typeof drizzle> | null = null
let _sqlite: Database.Database | null = null

/**
 * 启动自检：数据库若落在 git 工作树内，`git pull` / `git reset` 会覆盖运行中的库文件，
 * 应用则继续写被 unlink 的 inode，容器一重启即丢全部真实数据（2026-09-28 生产事故根因）。
 * 这里只做**显式告警**、不阻断启动（本地开发常在工作树内）。
 */
function warnIfDbInsideGitTree(dbPath: string) {
  if (dbPath === ':memory:' || dbPath.startsWith('file:')) return // 内存库 / URI，无文件路径
  const abs = resolve(dbPath)
  let dir = dirname(abs)
  for (;;) {
    if (existsSync(join(dir, '.git'))) {
      console.warn(
        `[DB][安全告警] 数据库位于 git 工作树内：${abs}\n` +
          `              git pull / git reset 可能覆盖运行中的库文件 → 容器重启会丢失真实数据。\n` +
          `              生产请将 docker-compose 的 HOST_DATA_DIR 指向仓库之外的绝对路径（如 /opt/mingli-data）。`
      )
      return
    }
    const parent = dirname(dir)
    if (parent === dir) return
    dir = parent
  }
}

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

  warnIfDbInsideGitTree(dbPath)

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

  // Phase 5：增量配置补齐（老库同样生效）
  seedPhase5Configs()

  // Phase 4b：写入命理基础数据种子（地支关系 12 项）
  seedKnowledgeAssets()

  // Phase 4b M-7：写入默认订阅套餐（体验包 / 月度 / 年度）
  seedDefaultPlans()

  console.log(`[DB] initialized: ${process.env.DB_PATH || 'data/mingli.db'}`)
}

/**
 * 数据库是否已完成初始化（连接 + 迁移）
 * 供「DB 可选增强」型逻辑判断：未初始化时走纯代码回退，避免误建真实库文件
 */
export function isDbReady(): boolean {
  return _db !== null
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
export * from './repositories/knowledge-assets'
// Phase 4b：C 端用户 / 订单订阅 / 运营埋点
export * from './repositories/users'
export * from './repositories/billing'
export * from './repositories/analytics'
// Phase 5：额度幂等台账（P5-4）/ 告知同意（P5-6）
export * from './repositories/quota'
export * from './repositories/consent'
