// ============================================================
// Phase 5 P5-3 — 排盘结果稳定哈希（ADR-005 计算权威 SSOT）
// 文件：src/server/lib/chart-hash.ts
// 职责：为 BaZiResult 生成**跨端稳定**的指纹，用于「重算校验闸门」。
//
// 为什么不用 JSON.stringify(chart) 直接哈希：
//   1. 对象键顺序在不同构造路径下可能不同 → 必须先排序；
//   2. 浮点（fiveElements 权重）在不同精度下可能产生尾差 → 统一归一化；
//   3. 将来引擎升级需要能识别「口径变化」→ 哈希带版本号（ADR-005 复审触发条件）。
// ============================================================

import { createHash } from 'node:crypto'
import type { BaZiResult } from '../../engine/index'

/** 哈希口径版本（归一化规则变化时递增；与引擎版本解耦） */
export const CHART_HASH_VERSION = '1'

/**
 * 引擎口径版本
 * ⚠️ 引擎升级（算法/典籍数据变更）会改变 chart 输出，进而改变 chartHash——
 *    跨版本比对必须带此版本号，否则会误报「不一致」。
 */
export const ENGINE_VERSION = 'v4.1.0'

/** 浮点归一化精度（消除尾差，保留 6 位小数足够命理权重表达） */
const FLOAT_PRECISION = 1e6

function normalize(value: unknown): unknown {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return Math.round(value * FLOAT_PRECISION) / FLOAT_PRECISION
  }
  if (Array.isArray(value)) return value.map(normalize)
  if (typeof value === 'object') {
    const src = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(src).sort()) {
      out[key] = normalize(src[key])
    }
    return out
  }
  return value
}

/** 稳定序列化（键排序 + 浮点归一化） */
export function stableStringify(value: unknown): string {
  return JSON.stringify(normalize(value))
}

/** 排盘指纹：`v1:<sha256hex>` */
export function chartHash(chart: unknown): string {
  const payload = stableStringify(chart)
  const digest = createHash('sha256').update(payload).digest('hex')
  return `v${CHART_HASH_VERSION}:${digest}`
}

/** 校验指纹是否匹配（恒定时间比较非必需，指纹非机密） */
export function verifyChartHash(chart: unknown, expected: string | undefined | null): boolean {
  if (!expected) return false
  return chartHash(chart) === expected
}

/**
 * 简易相似度诊断：当校验失败时，定位第一处差异路径（便于排障，不参与判定）
 */
export function firstDifference(a: unknown, b: unknown, path = '$'): string | null {
  const na = normalize(a)
  const nb = normalize(b)
  if (na === null && nb === null) return null
  if (typeof na !== typeof nb) return `${path}（类型 ${typeof na} ≠ ${typeof nb}）`
  if (typeof na !== 'object') {
    return na === nb ? null : `${path}（${String(na)} ≠ ${String(nb)}）`
  }
  if (Array.isArray(na) || Array.isArray(nb)) {
    if (!Array.isArray(na) || !Array.isArray(nb)) return `${path}（数组与否不一致）`
    const len = Math.max(na.length, nb.length)
    for (let i = 0; i < len; i++) {
      const diff = firstDifference(na[i], nb[i], `${path}[${i}]`)
      if (diff) return diff
    }
    return null
  }
  const keys = new Set([
    ...Object.keys(na as object),
    ...Object.keys(nb as object),
  ])
  for (const key of [...keys].sort()) {
    const diff = firstDifference(
      (na as Record<string, unknown>)[key],
      (nb as Record<string, unknown>)[key],
      `${path}.${key}`,
    )
    if (diff) return diff
  }
  return null
}

/** 类型守卫：形状是否像一份排盘结果（用于外部输入快速拒绝） */
export function looksLikeChart(value: unknown): value is BaZiResult {
  if (!value || typeof value !== 'object') return false
  const c = value as Record<string, unknown>
  return Boolean(
    c.yearPillar && c.monthPillar && c.dayPillar && c.hourPillar && c.dayMaster,
  )
}
