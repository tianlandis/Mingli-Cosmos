#!/usr/bin/env tsx
// ============================================================
// [ADR-012] 知识资产种子导入（软件本体数据 · 可迁移）
// 文件：scripts/seed-import.mts
// 用法：npm run db:seed
//
// 读取 seeds/knowledge/*.json（跳过 *.sample.json），
// 按 (category, key) 幂等 upsert 到 knowledge_assets 表。
//
// 设计原则：
//   1. 幂等 —— 可反复执行，已存在则更新（version 自增）；
//   2. 不删除 —— 种子中移除的条目不会被自动删（避免误删后台手工数据）；
//   3. 与爬虫解耦 —— 爬虫产出 JSON 文件，本脚本负责入库。
// ============================================================

import 'dotenv/config'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  initDb,
  closeDb,
  getKnowledgeAssetByKey,
  createKnowledgeAsset,
  updateKnowledgeAsset,
} from '../src/server/db/index'

const SEEDS_DIR = join(process.cwd(), 'seeds', 'knowledge')

interface SeedItem {
  key: string
  value: unknown
  description?: string
  sortOrder?: number
}

interface SeedFile {
  category: string
  items: SeedItem[]
}

function main() {
  if (!existsSync(SEEDS_DIR)) {
    console.error(`[Seed] ✗ 目录不存在：${SEEDS_DIR}`)
    process.exit(2)
  }

  const files = readdirSync(SEEDS_DIR)
    .filter(f => f.endsWith('.json') && !f.endsWith('.sample.json'))
    .sort()

  if (files.length === 0) {
    console.log('[Seed] 没有可导入的种子文件（seeds/knowledge/*.json），跳过。')
    return
  }

  initDb()

  let created = 0
  let updated = 0
  let skipped = 0

  for (const file of files) {
    const full = join(SEEDS_DIR, file)
    let parsed: SeedFile
    try {
      parsed = JSON.parse(readFileSync(full, 'utf-8')) as SeedFile
    } catch (e) {
      console.error(`[Seed] ✗ ${file} 解析失败：${(e as Error).message}`)
      skipped++
      continue
    }

    if (!parsed.category || !Array.isArray(parsed.items)) {
      console.error(`[Seed] ✗ ${file} 缺少 category 或 items 字段`)
      skipped++
      continue
    }

    for (const item of parsed.items) {
      if (!item.key || item.value === undefined) {
        console.warn(`[Seed] ⚠ ${file} 有条目缺少 key/value，已跳过`)
        skipped++
        continue
      }
      const value = JSON.stringify(item.value)
      const existing = getKnowledgeAssetByKey(parsed.category, item.key)
      if (existing) {
        updateKnowledgeAsset(existing.id, {
          value,
          description: item.description,
          sortOrder: item.sortOrder,
        })
        updated++
      } else {
        createKnowledgeAsset({
          category: parsed.category,
          key: item.key,
          value,
          description: item.description,
          sortOrder: item.sortOrder,
        })
        created++
      }
    }

    console.log(`[Seed] ✓ ${file}（category=${parsed.category}，${parsed.items.length} 条）`)
  }

  console.log(`\n[Seed] 完成：新增 ${created} ｜ 更新 ${updated} ｜ 跳过 ${skipped}`)
  closeDb()
}

main()
