// ============================================================
// Prompt Versions Repository
// 文件：src/server/db/repositories/prompt-versions.ts
// 职责：prompt_versions 表的 CRUD 操作
// ============================================================

import { getDb } from '../index'
import { promptVersions } from '../schema'
import { eq, and, desc } from 'drizzle-orm'

type VersionRow = typeof promptVersions.$inferSelect
type VersionInsert = typeof promptVersions.$inferInsert

/**
 * 列出某个 Prompt 的所有历史版本（按版本号降序）
 */
export function listPromptVersions(promptId: number): VersionRow[] {
  return getDb()
    .select()
    .from(promptVersions)
    .where(eq(promptVersions.promptId, promptId))
    .orderBy(desc(promptVersions.version))
    .all()
}

/**
 * 获取某个 Prompt 的指定版本号记录
 */
export function getPromptVersion(promptId: number, version: number): VersionRow | undefined {
  return getDb()
    .select()
    .from(promptVersions)
    .where(and(
      eq(promptVersions.promptId, promptId),
      eq(promptVersions.version, version),
    ))
    .get()
}

/**
 * 创建一条版本历史记录
 */
export function createPromptVersion(data: VersionInsert): VersionRow {
  return getDb().insert(promptVersions).values(data).returning().get()
}

/**
 * 获取某个 Prompt 的最新版本号
 */
export function getLatestVersion(promptId: number): number {
  const rows = getDb()
    .select({ version: promptVersions.version })
    .from(promptVersions)
    .where(eq(promptVersions.promptId, promptId))
    .orderBy(desc(promptVersions.version))
    .limit(1)
    .all()
  return rows[0]?.version ?? 0
}
