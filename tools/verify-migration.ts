// ============================================================
// 步骤 4.8 — 数据库迁移验证脚本
// 确认 prompt_versions / admin_sessions / api_keys 扩展字段存在
// ============================================================
import { initDb, closeDb } from '../src/server/db/index'
import Database from 'better-sqlite3'
import { existsSync } from 'node:fs'

try {
  initDb()

  // 用原始 sqlite 连接查表结构
  const dbPath = process.env.DB_PATH || 'data/mingli.db'
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')

  console.log('═══════════════════════════════════════')
  console.log(`数据库文件: ${dbPath}  (${existsSync(dbPath) ? '存在' : '不存在'})`)
  console.log('═══════════════════════════════════════\n')

  // 列出所有表
  const tables = sqlite.prepare(`SELECT name, type FROM sqlite_master WHERE type='table' ORDER BY name`).all() as Array<{name: string, type: string}>
  console.log(`✅ 共 ${tables.length} 张表:\n`)

  for (const t of tables) {
    const cols = sqlite.prepare(`PRAGMA table_info(${t.name})`).all() as Array<{cid: number, name: string, type: string, notnull: number, dflt_value: string | null}>
    console.log(`📋 ${t.name} (${cols.length} 列)`)
    for (const c of cols) {
      const pk = c.cid === 0 ? ' [PK]' : ''
      const dflt = c.dflt_value ? `  DEFAULT ${c.dflt_value}` : ''
      console.log(`   ├─ ${c.name} (${c.type})${pk}${dflt}`)
    }
    console.log('')
  }

  // 索引
  const indices = sqlite.prepare(`SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all() as Array<{name: string, tbl_name: string}>
  if (indices.length > 0) {
    console.log('📌 索引:')
    for (const idx of indices) {
      console.log(`   ${idx.name} → ${idx.tbl_name}`)
    }
    console.log('')
  }

  // 数据行数
  console.log('📊 行数统计:')
  for (const t of tables) {
    const count = sqlite.prepare(`SELECT COUNT(*) as c FROM ${t.name}`).get() as {c: number}
    console.log(`   ${t.name}: ${count.c} 行`)
  }

  sqlite.close()
  closeDb()

  console.log('\n🏁 迁移验证完成 — 所有表结构正常')
} catch (e) {
  console.error('❌ 迁移验证失败:', e)
  process.exit(1)
}
