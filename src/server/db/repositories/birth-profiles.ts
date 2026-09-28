// ============================================================
// [ADR-012] 生辰档案 Repository（用户身份域 · 核心 PII）
// 文件：src/server/db/repositories/birth-profiles.ts
// 职责：用户生辰档案的增删改查 + 默认档案管理
//
// ⚠️ 合规：本表含核心 PII，删除时须清空；
//    必须纳入 GET /user/data/export 与 DELETE /user/data（ADR-006）。
// ============================================================

import { getDb, schema } from '../index'
import { eq, and, desc } from 'drizzle-orm'

const { birthProfiles } = schema

export type BirthProfileRow = typeof birthProfiles.$inferSelect

/**
 * DB 行 → 对外 DTO（0/1 转 boolean，不外泄内部列）。
 * 放在仓储层是为了让 `/user/birth-profiles` 与 `/user/me` 共用同一份形状定义，
 * 避免两处手写映射日后字段漂移。（与 sessions.ts 的 listChartSummariesByUser 同思路）
 */
export function toBirthProfileDto(p: BirthProfileRow) {
  return {
    id: p.id,
    label: p.label,
    calendarType: p.calendarType,
    birthYear: p.birthYear,
    birthMonth: p.birthMonth,
    birthDay: p.birthDay,
    birthHour: p.birthHour,
    birthMinute: p.birthMinute ?? 0,
    isLeapMonth: p.isLeapMonth === 1,
    gender: p.gender,
    isDefault: p.isDefault === 1,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }
}

export interface CreateBirthProfileInput {
  userId: number
  label?: string | null
  calendarType: 'solar' | 'lunar'
  birthYear: number
  birthMonth: number
  birthDay: number
  birthHour?: number | null
  birthMinute?: number | null
  isLeapMonth?: boolean
  gender?: 'male' | 'female' | null
  isDefault?: boolean
}

export type UpdateBirthProfilePatch = Partial<Omit<CreateBirthProfileInput, 'userId'>>

/** 列出某用户全部档案（默认档案优先） */
export function listBirthProfilesByUser(userId: number): BirthProfileRow[] {
  return getDb().select().from(birthProfiles)
    .where(eq(birthProfiles.userId, userId))
    .orderBy(desc(birthProfiles.isDefault), desc(birthProfiles.id))
    .all()
}

export function getBirthProfile(id: number): BirthProfileRow | undefined {
  return getDb().select().from(birthProfiles).where(eq(birthProfiles.id, id)).get()
}

/** 取用户默认档案（「登录自动排盘」用） */
export function getDefaultBirthProfile(userId: number): BirthProfileRow | undefined {
  return getDb().select().from(birthProfiles)
    .where(and(eq(birthProfiles.userId, userId), eq(birthProfiles.isDefault, 1)))
    .orderBy(desc(birthProfiles.id))
    .get()
}

/**
 * 设为默认档案：同一用户下先清空旧默认，再置新默认（事务保证互斥）
 */
export function setDefaultBirthProfile(userId: number, id: number): boolean {
  const db = getDb()
  return db.transaction((tx) => {
    const target = tx.select().from(birthProfiles)
      .where(and(eq(birthProfiles.id, id), eq(birthProfiles.userId, userId))).get()
    if (!target) return false
    tx.update(birthProfiles).set({ isDefault: 0 })
      .where(eq(birthProfiles.userId, userId)).run()
    tx.update(birthProfiles).set({ isDefault: 1, updatedAt: new Date().toISOString() })
      .where(eq(birthProfiles.id, id)).run()
    return true
  })
}

/**
 * 新建档案。若为该用户首个档案，或显式 isDefault，则自动置为默认。
 */
export function createBirthProfile(input: CreateBirthProfileInput): BirthProfileRow {
  const db = getDb()
  return db.transaction((tx) => {
    const existing = tx.select().from(birthProfiles)
      .where(eq(birthProfiles.userId, input.userId)).all()
    const shouldDefault = input.isDefault === true || existing.length === 0

    if (shouldDefault && existing.length > 0) {
      tx.update(birthProfiles).set({ isDefault: 0 })
        .where(eq(birthProfiles.userId, input.userId)).run()
    }

    const now = new Date().toISOString()
    return tx.insert(birthProfiles).values({
      userId: input.userId,
      label: input.label ?? null,
      calendarType: input.calendarType,
      birthYear: input.birthYear,
      birthMonth: input.birthMonth,
      birthDay: input.birthDay,
      birthHour: input.birthHour ?? null,
      birthMinute: input.birthMinute ?? 0,
      isLeapMonth: input.isLeapMonth ? 1 : 0,
      gender: input.gender ?? null,
      isDefault: shouldDefault ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    }).returning().get()
  })
}

export function updateBirthProfile(id: number, patch: UpdateBirthProfilePatch): BirthProfileRow | undefined {
  const set: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  if (patch.label !== undefined) set.label = patch.label
  if (patch.calendarType !== undefined) set.calendarType = patch.calendarType
  if (patch.birthYear !== undefined) set.birthYear = patch.birthYear
  if (patch.birthMonth !== undefined) set.birthMonth = patch.birthMonth
  if (patch.birthDay !== undefined) set.birthDay = patch.birthDay
  if (patch.birthHour !== undefined) set.birthHour = patch.birthHour
  if (patch.birthMinute !== undefined) set.birthMinute = patch.birthMinute
  if (patch.isLeapMonth !== undefined) set.isLeapMonth = patch.isLeapMonth ? 1 : 0
  if (patch.gender !== undefined) set.gender = patch.gender

  return getDb().update(birthProfiles).set(set).where(eq(birthProfiles.id, id)).returning().get()
}

export function deleteBirthProfile(id: number): boolean {
  const res = getDb().delete(birthProfiles).where(eq(birthProfiles.id, id)).run()
  return res.changes > 0
}

/** [PII 硬删] 删除某用户全部档案，返回删除条数 */
export function deleteBirthProfilesByUser(userId: number): number {
  const res = getDb().delete(birthProfiles).where(eq(birthProfiles.userId, userId)).run()
  return res.changes
}
