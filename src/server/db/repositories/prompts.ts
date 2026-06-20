// ============================================================
// Prompt Templates Repository
// 文件：src/server/db/repositories/prompts.ts
// ============================================================

import { getDb } from '../index'
import { promptTemplates } from '../schema'
import { eq, and } from 'drizzle-orm'

type PromptRow = typeof promptTemplates.$inferSelect
type PromptInsert = typeof promptTemplates.$inferInsert

export function listPrompts(): PromptRow[] {
  return getDb().select().from(promptTemplates).all()
}

export function getActivePrompts(): PromptRow[] {
  return getDb().select().from(promptTemplates).where(eq(promptTemplates.isActive, 1)).all()
}

export function getPrompt(id: number): PromptRow | undefined {
  return getDb().select().from(promptTemplates).where(eq(promptTemplates.id, id)).get()
}

export function getPromptByName(name: string): PromptRow | undefined {
  return getDb().select().from(promptTemplates)
    .where(and(eq(promptTemplates.name, name), eq(promptTemplates.isActive, 1)))
    .get()
}

export function createPrompt(data: PromptInsert): PromptRow {
  return getDb().insert(promptTemplates).values(data).returning().get()
}

export function updatePrompt(id: number, data: Partial<PromptInsert>): PromptRow | undefined {
  return getDb().update(promptTemplates).set({
    ...data,
    updatedAt: new Date().toISOString(),
  }).where(eq(promptTemplates.id, id)).returning().get()
}

export function deletePrompt(id: number): void {
  getDb().delete(promptTemplates).where(eq(promptTemplates.id, id)).run()
}
