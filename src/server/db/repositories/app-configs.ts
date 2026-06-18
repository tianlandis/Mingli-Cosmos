// ============================================================
// App Configs Repository
// 文件：src/server/db/repositories/app-configs.ts
// ============================================================

import { getDb } from '../index'
import { appConfigs } from '../schema'
import { eq } from 'drizzle-orm'

type ConfigRow = typeof appConfigs.$inferSelect
type ConfigInsert = typeof appConfigs.$inferInsert

export function listConfigs(): ConfigRow[] {
  return getDb().select().from(appConfigs).all()
}

export function getConfig(key: string): ConfigRow | undefined {
  return getDb().select().from(appConfigs).where(eq(appConfigs.key, key)).get()
}

export function getConfigValue(key: string): string | undefined {
  const row = getConfig(key)
  return row?.value
}

export function setConfig(key: string, value: string, displayName?: string, description?: string): ConfigRow {
  const existing = getConfig(key)
  if (existing) {
    return getDb().update(appConfigs)
      .set({ value, displayName, description, updatedAt: new Date().toISOString() })
      .where(eq(appConfigs.key, key))
      .returning().get()
  }
  return getDb().insert(appConfigs)
    .values({ key, value, displayName, description })
    .returning().get()
}

export function deleteConfig(key: string): void {
  getDb().delete(appConfigs).where(eq(appConfigs.key, key)).run()
}
