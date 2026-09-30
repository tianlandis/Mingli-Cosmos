// ============================================================
// 知识资产清单生成器（给《项目结构与资料清单》用）
// 文件：scripts/kb-inventory.mjs
//
// 作用：读数据库 knowledge_assets 表，按分类列出全部资料
//       （key + 说明 + 启用状态），用于核对/更新文档里的「资料清单」。
//
// 用法：
//   npm run kb:list
//   node scripts/kb-inventory.mjs --db data/mingli.db
//
// 环境变量 MINGLI_DB 可指定数据库路径，默认 data/mingli.db
// ============================================================

import { DatabaseSync } from 'node:sqlite'
import { existsSync } from 'node:fs'

const argv = process.argv.slice(2)
const dbFlagIdx = argv.indexOf('--db')
const dbPath =
  dbFlagIdx >= 0
    ? argv[dbFlagIdx + 1]
    : process.env.MINGLI_DB || 'data/mingli.db'

if (!dbPath || !existsSync(dbPath)) {
  console.error(`✗ 找不到数据库文件：${dbPath ?? '(未指定)'}`)
  console.error('  用法：npm run kb:list  或  node scripts/kb-inventory.mjs --db <路径>')
  process.exit(1)
}

let rows
try {
  const db = new DatabaseSync(dbPath)
  rows = db
    .prepare(
      `SELECT category, key, description, is_active
         FROM knowledge_assets
        ORDER BY category, sort_order, key`,
    )
    .all()
  db.close()
} catch (err) {
  console.error(`✗ 读取失败：${err.message}`)
  process.exit(1)
}

/** 按分类聚合 */
const byCat = new Map()
for (const r of rows) {
  if (!byCat.has(r.category)) byCat.set(r.category, [])
  byCat.get(r.category).push(r)
}

const line = (s) => console.log(s)

line(`# 知识资产清单（共 ${rows.length} 条 / ${byCat.size} 类）`)
line('')
line(`> 来源：${dbPath} · 表 knowledge_assets`)
line(`> 生成时间：${new Date().toISOString().slice(0, 19).replace('T', ' ')}`)
line('')

for (const [cat, list] of byCat) {
  line(`## ${cat}（${list.length} 条）`)
  line('')
  line('| key | 说明 | 状态 |')
  line('|:--|:--|:--:|')
  for (const r of list) {
    const desc = (r.description ?? '')
      .replace(/\|/g, '/')
      .replace(/\s+/g, ' ')
      .slice(0, 80)
    line(`| \`${r.key}\` | ${desc || '-'} | ${r.is_active ? '启用' : '停用'} |`)
  }
  line('')
}

line('---')
line('> 对照《项目结构与资料清单》第二部分的分类条数，数字变大即说明有新资料落库，需同步更新该文档。')
