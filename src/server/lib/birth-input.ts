// ============================================================
// 生辰输入校验（共享规则）
// 文件：src/server/lib/birth-input.ts
//
// 为什么抽出来：生辰在**两个入口**都被采集 ——
//   ① 注册（POST /user/register 的 birth 字段）
//   ② 生辰档案 CRUD（/user/birth-profiles）
// 若各写一份 schema，迟早漂移成「注册能过、建档报错」这类不一致。
// 故字段与日期存在性校验只有这一份定义。
//
// 口径约定：gender 用 'male' | 'female'（与 users/birth_profiles 表一致），
// 前端负责把界面上的「乾·男 / 坤·女」映射过来。
// ============================================================

import { z } from 'zod'

export type CalendarType = 'solar' | 'lunar'

/** 公历某年某月的实际天数（用于拒绝 2 月 30 日这类不存在的日期） */
export function solarDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/** 生辰日期三要素 */
export interface BirthDateParts {
  calendarType: CalendarType
  birthYear: number
  birthMonth: number
  birthDay: number
}

/**
 * 日期存在性校验：公历按真实月长；农历按 30 天上限
 * （农历大小月需查历，交由引擎侧精算，此处只拦明显非法值）。
 */
export function checkRealDate(v: BirthDateParts, ctx: z.RefinementCtx): void {
  const max = v.calendarType === 'solar'
    ? solarDaysInMonth(v.birthYear, v.birthMonth)
    : 30
  if (v.birthDay > max) {
    ctx.addIssue({
      code: 'custom',
      path: ['birthDay'],
      message: `${v.birthMonth} 月最多 ${max} 天`,
    })
  }
}

/** 生辰字段（纯字段级校验，不含跨字段日期存在性） */
export const birthFieldsObject = z.object({
  calendarType: z.enum(['solar', 'lunar'], { message: '历法只能是 solar 或 lunar' }),
  birthYear: z.number().int('年份必须是整数').min(1900, '年份需在 1900 年之后').max(2100, '年份超出范围'),
  birthMonth: z.number().int('月份必须是整数').min(1, '月份需在 1-12').max(12, '月份需在 1-12'),
  birthDay: z.number().int('日期必须是整数').min(1, '日期需在 1-31').max(31, '日期需在 1-31'),
  birthHour: z.number().int().min(0).max(23).nullish(),
  birthMinute: z.number().int().min(0).max(59).optional(),
  isLeapMonth: z.boolean().optional(),
  gender: z.enum(['male', 'female']).nullish(),
})

/** 完整生辰：字段级 + 日期存在性 */
export const birthInputSchema = birthFieldsObject.superRefine(checkRealDate)

export type BirthInput = z.infer<typeof birthInputSchema>

// ═══════════════════════════════════════
// 关系标签（档案专属，非生辰字段）
// ═══════════════════════════════════════

/**
 * 关系标签：这条档案与本人是什么关系。
 *
 * 为什么不用 label 文本代替：label 是**显示名**（用户可写「老妈」「我家老大」），
 * relation 是**语义**（下拉结构化）。未来「关系合盘」需要按关系选规则——
 * 夫妻看日支夫妻宫 + 日干相合，亲子看子女宫 + 食伤，合伙人看财官互补——
 * 靠 label 文本猜关系不可靠，两者必须分工。
 *
 * ⚠️ 前端 src/lib/birth.ts 的 RELATION_OPTIONS 必须与此保持一致
 * （有测试锁定，改任一侧另一侧会对不上）。
 */
export const RELATION_VALUES = [
  'self',      // 本人
  'father',    // 父亲
  'mother',    // 母亲
  'spouse',    // 配偶
  'child',     // 子女
  'sibling',   // 兄弟姐妹
  'friend',    // 朋友
  'classmate', // 同学
  'colleague', // 同事
  'other',     // 其他
] as const

export type RelationValue = (typeof RELATION_VALUES)[number]

export const relationSchema = z.enum(RELATION_VALUES, { message: '关系标签不合法' })
