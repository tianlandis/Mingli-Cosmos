// ============================================================
// 生辰：类型定义与形态转换（纯逻辑，无 UI 依赖）
// 文件：src/lib/birth.ts
//
// 生辰在系统里有三种形态，本文件是它们之间唯一的转换点：
//   ① BirthValue    —— 界面值（gender 用「男/女」，字段名 year/month/day）
//   ② BirthPayload  —— 服务端载荷（gender 用 male/female，字段名 birthYear…）
//   ③ ChartInput    —— 排盘输入（/api/v1/app/chart，取 ② 的四个时间要素）
//
// 转换集中在一处，避免各组件各写一份映射导致 gender 映射或字段名写错。
// ============================================================

import type { ChartInput } from '../hooks/useBazi'

/** 时辰选项 */
export interface HourOption { label: string; hour: number; range: string }

/**
 * 时辰选项：0→24 时间顺序，共 13 个时辰。
 * 放在 lib 而非组件里，是为了让「组件文件只导出组件」（react-refresh 要求），
 * 同时 BirthForm 的卡头回显与 BirthFields 的按钮网格共用同一份定义。
 */
export const HOUR_OPTIONS: HourOption[] = [
  { label: '早子', hour: 0, range: '00:00–01:00' },
  { label: '丑', hour: 1, range: '01:00–03:00' },
  { label: '寅', hour: 3, range: '03:00–05:00' },
  { label: '卯', hour: 5, range: '05:00–07:00' },
  { label: '辰', hour: 7, range: '07:00–09:00' },
  { label: '巳', hour: 9, range: '09:00–11:00' },
  { label: '午', hour: 11, range: '11:00–13:00' },
  { label: '未', hour: 13, range: '13:00–15:00' },
  { label: '申', hour: 15, range: '15:00–17:00' },
  { label: '酉', hour: 17, range: '17:00–19:00' },
  { label: '戌', hour: 19, range: '19:00–21:00' },
  { label: '亥', hour: 21, range: '21:00–23:00' },
  { label: '晚子', hour: 23, range: '23:00–24:00' },
]

/** 界面值（与 BirthFields 受控值一致） */
export interface BirthValue {
  calendarType: 'solar' | 'lunar'
  year: number
  month: number
  day: number
  hour: number
  minute: number
  gender: '男' | '女'
  isLeapMonth: boolean
}

/** 服务端生辰载荷（/user/register 的 birth、/user/birth-profiles 的请求体） */
export interface BirthPayload {
  calendarType: 'solar' | 'lunar'
  birthYear: number
  birthMonth: number
  birthDay: number
  birthHour: number
  birthMinute: number
  isLeapMonth: boolean
  gender: 'male' | 'female'
}

/** 生辰档案（服务端 DTO，与 repositories/birth-profiles.ts::toBirthProfileDto 对应） */
export interface BirthProfileDto {
  id: number
  label: string | null
  calendarType: 'solar' | 'lunar'
  birthYear: number
  birthMonth: number
  birthDay: number
  birthHour: number | null
  birthMinute: number | null
  isLeapMonth: boolean
  gender: 'male' | 'female' | null
  isDefault: boolean
  createdAt: string | null
  updatedAt: string | null
}

/** 当前时刻的默认生辰值（排盘页初始态） */
export function createDefaultBirthValue(): BirthValue {
  const now = new Date()
  return {
    calendarType: 'solar',
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: 11,
    minute: 0,
    gender: '男',
    isLeapMonth: false,
  }
}

/** 某历法下该年该月的天数上限（公历按真实月长，农历按 30 天） */
export function daysInMonth(calendarType: 'solar' | 'lunar', year: number, month: number): number {
  return calendarType === 'solar' ? new Date(year, month, 0).getDate() : 30
}

/** 界面值 → 服务端载荷 */
export function toBirthPayload(v: BirthValue): BirthPayload {
  return {
    calendarType: v.calendarType,
    birthYear: v.year,
    birthMonth: v.month,
    birthDay: v.day,
    birthHour: v.hour,
    birthMinute: v.minute,
    isLeapMonth: v.calendarType === 'lunar' ? v.isLeapMonth : false,
    gender: v.gender === '男' ? 'male' : 'female',
  }
}

/** 服务端载荷 → 排盘输入 */
export function birthPayloadToChartInput(b: BirthPayload): ChartInput {
  return {
    year: b.birthYear,
    month: b.birthMonth,
    day: b.birthDay,
    hour: b.birthHour,
    minute: b.birthMinute,
    gender: b.gender === 'male' ? '男' : '女',
    calendarType: b.calendarType,
    isLeapMonth: b.calendarType === 'lunar' ? b.isLeapMonth : undefined,
  }
}

/** 生辰档案 → 排盘输入（「登录自动出盘」用；服务端载荷是档案形状，故先转再复用） */
export function profileToChartInput(p: BirthProfileDto): ChartInput {
  return birthPayloadToChartInput({
    calendarType: p.calendarType,
    birthYear: p.birthYear,
    birthMonth: p.birthMonth,
    birthDay: p.birthDay,
    birthHour: p.birthHour ?? 11,
    birthMinute: p.birthMinute ?? 0,
    isLeapMonth: p.isLeapMonth,
    gender: p.gender === 'female' ? 'female' : 'male',
  })
}

/** 生辰可读文本，如「1990-06-15 午时」 */
export function formatBirth(p: {
  calendarType: 'solar' | 'lunar'
  birthYear: number
  birthMonth: number
  birthDay: number
  birthHour: number | null
}): string {
  const p2 = (n: number) => String(n).padStart(2, '0')
  const cal = p.calendarType === 'lunar' ? '农历' : '公历'
  const h = p.birthHour
  const hourText = h === null || h === undefined ? '时辰未填' : `${p2(h)}:00`
  return `${cal} ${p.birthYear}-${p2(p.birthMonth)}-${p2(p.birthDay)} ${hourText}`
}

/** 生辰档案 → ChartInput 的性别文案（列表展示用） */
export function genderText(g: 'male' | 'female' | null): string {
  return g === 'female' ? '女' : '男'
}
