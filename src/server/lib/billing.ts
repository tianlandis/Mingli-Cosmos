// ============================================================
// 计费策略 —— 免费模式 + 统一额度成本读取
// 文件：src/server/lib/billing.ts
// 职责：把「每个功能扣多少额度」收敛到唯一入口，并支持后台一键全免费
//
// 设计要点：
//   - 全站免费开关（测试期）与单点成本解耦：free_mode 打开时所有成本视为 0；
//   - 成本配置一律来自 app_configs 表（后台可改，热生效，无需重启）；
//   - 任何异常/缺省都回落到内置默认值，绝不因配置损坏导致计费逻辑崩溃。
//
// 配置真值（app_configs 表，后台「计费设置」页可改）：
//   free_mode            '1' | 'true' → 全站免费（所有成本视为 0）
//   chart_quota_cost     排盘（默认 0，即天然免费）
//   report_quota_cost    命书（默认 1）
//   synastry_quota_cost  双人合盘（默认 1）
//   chat_quota_cost      AI 对话（默认 1）
//   new_user_quota       新用户注册时的初始额度（默认 5）
// ============================================================

import { getConfig, isDbReady } from '../db/index'

/** 可计费功能 */
export type BillableFeature = 'chart' | 'report' | 'synastry' | 'chat'

/** 内置默认成本（后台未配置时使用） */
export const QUOTA_DEFAULTS: Record<BillableFeature, number> = {
  chart: 0,
  report: 1,
  synastry: 1,
  chat: 1,
}

/** 中文标签（后台 UI 复用） */
export const BILLING_LABELS: Record<BillableFeature, string> = {
  chart: '排盘',
  report: '命书',
  synastry: '双人合盘',
  chat: 'AI 对话',
}

export const BILLABLE_FEATURES: BillableFeature[] = ['chart', 'report', 'synastry', 'chat']

/** 新用户初始额度的内置默认值（后台未配置时使用，与 schema 建表默认保持一致） */
export const NEW_USER_QUOTA_DEFAULT = 5

/**
 * 读取「新用户注册时获得的初始额度」。
 * 配置缺失/非法时回落内置默认值 5；配置为 0 表示新用户默认无额度。
 */
export function readNewUserQuota(): number {
  if (!isDbReady()) return NEW_USER_QUOTA_DEFAULT
  try {
    const raw = getConfig('new_user_quota')?.value
    if (raw === undefined || raw === null || raw === '') return NEW_USER_QUOTA_DEFAULT
    const n = Number(raw)
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : NEW_USER_QUOTA_DEFAULT
  } catch {
    return NEW_USER_QUOTA_DEFAULT
  }
}

/** 全站免费开关（测试期用）—— 缺省关闭 */
export function isBillingFree(): boolean {
  if (!isDbReady()) return false
  try {
    const raw = getConfig('free_mode')?.value
    return raw === '1' || raw === 'true'
  } catch {
    return false
  }
}

/**
 * 读取某功能**配置中的**额度成本（不受免费模式影响）。
 * 配置缺失或非法时回落内置默认值。
 */
export function readConfiguredCost(feature: BillableFeature): number {
  const fallback = QUOTA_DEFAULTS[feature]
  if (!isDbReady()) return fallback
  try {
    const raw = getConfig(`${feature}_quota_cost`)?.value
    if (raw === undefined || raw === null || raw === '') return fallback
    const n = Number(raw)
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback
  } catch {
    return fallback
  }
}

/**
 * 读取某功能**实际生效的**额度成本（计费调用点唯一入口）。
 * 免费模式开启时恒为 0（不扣费）。
 */
export function readQuotaCost(feature: BillableFeature): number {
  if (isBillingFree()) return 0
  return readConfiguredCost(feature)
}

export interface BillingSnapshot {
  /** 全站免费开关是否开启 */
  freeMode: boolean
  /** 后台**配置中**的成本（免费模式下仍显示真实配置，供管理员编辑） */
  costs: Record<BillableFeature, number>
  /** **当前实际生效**的成本（免费模式下全为 0） */
  effectiveCosts: Record<BillableFeature, number>
  /** 新用户注册时获得的初始额度 */
  newUserQuota: number
}

/** 后台设置页一次性读取：免费开关 + 配置成本 + 生效成本 + 新用户初始额度 */
export function getBillingSnapshot(): BillingSnapshot {
  const freeMode = isBillingFree()
  const costs = {} as Record<BillableFeature, number>
  const effectiveCosts = {} as Record<BillableFeature, number>
  for (const f of BILLABLE_FEATURES) {
    const configured = readConfiguredCost(f)
    costs[f] = configured
    effectiveCosts[f] = freeMode ? 0 : configured
  }
  return { freeMode, costs, effectiveCosts, newUserQuota: readNewUserQuota() }
}
