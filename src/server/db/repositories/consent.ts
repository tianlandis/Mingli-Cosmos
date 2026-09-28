// ============================================================
// Phase 5 P5-6 — 告知同意留痕 Repository（ADR-006）
// 文件：src/server/db/repositories/consent.ts
// 职责：隐私政策 / 用户协议的同意记录（时间 + 版本 + 来源）
// ============================================================

import { getDb, schema } from '../index'
import { eq, and, desc } from 'drizzle-orm'

const { consentRecords } = schema

export type ConsentRow = typeof consentRecords.$inferSelect

export type ConsentType = 'privacy_policy' | 'user_agreement'

export const CONSENT_TYPES: ConsentType[] = ['privacy_policy', 'user_agreement']

export interface RecordConsentInput {
  userId: number
  type: ConsentType
  version: string
  agreed?: boolean
  ip?: string | null
  userAgent?: string | null
}

export function recordConsent(input: RecordConsentInput): ConsentRow {
  return getDb().insert(consentRecords).values({
    userId: input.userId,
    type: input.type,
    version: input.version,
    agreed: input.agreed === false ? 0 : 1,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    createdAt: new Date().toISOString(),
  }).returning().get()
}

export function listConsentsByUser(userId: number, limit = 50): ConsentRow[] {
  return getDb().select().from(consentRecords)
    .where(eq(consentRecords.userId, userId))
    .orderBy(desc(consentRecords.id))
    .limit(limit)
    .all()
}

/** 某类协议的最新一次同意记录 */
export function getLatestConsent(userId: number, type: ConsentType): ConsentRow | undefined {
  return getDb().select().from(consentRecords)
    .where(and(eq(consentRecords.userId, userId), eq(consentRecords.type, type)))
    .orderBy(desc(consentRecords.id))
    .get()
}

/** 是否已同意某版本（用于排盘入口的合规门禁） */
export function hasAgreed(userId: number, type: ConsentType, version: string): boolean {
  const row = getLatestConsent(userId, type)
  return Boolean(row && row.agreed === 1 && row.version === version)
}
