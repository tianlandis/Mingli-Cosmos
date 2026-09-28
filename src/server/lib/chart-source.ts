// ============================================================
// Phase 5 P5-3 — 计算权威数据源解析（ADR-005）
// 文件：src/server/lib/chart-source.ts
//
// 统一回答「这次请求的 chart / annotation 从哪来、可不可信」：
//   A. 传了 sessionId        → 从权威库读取（可信，verified=true）
//   B. 传了 birth（生辰）    → 服务端重算并比对 chartHash（重算校验闸门）
//   C. 只传 chart + annotation → 兼容旧客户端（可信度低，按 verifyMode 处置）
//
// verifyMode（db 配置 chart_verify_mode，env CHART_VERIFY_MODE 兜底）：
//   off     → 不一致仅告警（不影响可用性，灰度默认）
//   warn    → 不一致记 warning + 响应头标记，但仍放行
//   enforce → 不一致直接拒绝（409 CHART_MISMATCH）
// ============================================================

import { calculateBazi, calculateBaziFromLunar, generateAnnotation } from '../../engine'
import type { BaZiResult, AnnotationResult } from '../../engine'
import { getSession, getConfig, isDbReady } from '../db'
import { chartHash, firstDifference, looksLikeChart, ENGINE_VERSION } from './chart-hash'
import type { BirthInput } from './types'

export type { BirthInput }

export type ChartVerifyMode = 'off' | 'warn' | 'enforce'

export interface ResolvedChart {
  chart: BaZiResult
  annotation: AnnotationResult
  /** 是否经过服务端可信来源校验（session 权威 或 重算一致） */
  verified: boolean
  source: 'session' | 'recomputed' | 'client'
  chartHash: string
  engineVersion: string
  /** session 路径下的权威 sessionId */
  sessionId?: string
}

export type ResolveResult =
  | { ok: true; data: ResolvedChart; warnings: string[] }
  | { ok: false; code: 'BAD_REQUEST' | 'SESSION_NOT_FOUND' | 'CHART_MISMATCH'; message: string; detail?: string; hint?: string }

/** 读取校验模式（DB > env > 默认 off，保持向后兼容） */
export function getChartVerifyMode(): ChartVerifyMode {
  const normalize = (v: string | undefined): ChartVerifyMode | null => {
    const s = (v ?? '').trim().toLowerCase()
    return s === 'off' || s === 'warn' || s === 'enforce' ? s : null
  }
  try {
    if (isDbReady()) {
      const fromDb = normalize(getConfig('chart_verify_mode')?.value)
      if (fromDb) return fromDb
    }
  } catch {
    // ignore → env
  }
  return normalize(process.env.CHART_VERIFY_MODE) ?? 'off'
}

function parseJson<T>(raw: string | null | undefined): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/**
 * 解析请求的排盘数据源
 */
export async function resolveChartSource(input: {
  sessionId?: string
  chart?: unknown
  annotation?: unknown
  birth?: BirthInput
  verifyMode?: ChartVerifyMode
}): Promise<ResolveResult> {
  const warnings: string[] = []
  const mode = input.verifyMode ?? getChartVerifyMode()

  // ── A. 权威 session ──
  if (input.sessionId) {
    const row = getSession(input.sessionId)
    if (!row) {
      return { ok: false, code: 'SESSION_NOT_FOUND', message: '排盘会话不存在或已过期，请重新排盘', hint: 'POST /api/v1/app/chart' }
    }
    const chart = parseJson<BaZiResult>(row.chart)
    const annotation = parseJson<AnnotationResult>(row.annotation)
    if (!chart || !annotation || !looksLikeChart(chart)) {
      return { ok: false, code: 'SESSION_NOT_FOUND', message: '排盘会话数据损坏，请重新排盘' }
    }
    return {
      ok: true,
      warnings,
      data: {
        chart,
        annotation,
        verified: true,
        source: 'session',
        chartHash: row.chartHash ?? chartHash(chart),
        engineVersion: row.engineVersion ?? ENGINE_VERSION,
        sessionId: row.id,
      },
    }
  }

  // ── C 前置：客户端数据必须存在且形状正确 ──
  if (!input.chart || !input.annotation || !looksLikeChart(input.chart)) {
    return {
      ok: false,
      code: 'BAD_REQUEST',
      message: '缺少 chart 或 annotation 字段',
      hint: '请先调用 POST /api/v1/app/chart 获取权威数据，或传入 birth 生辰由服务端重算',
    }
  }
  const clientChart = input.chart as BaZiResult
  const clientAnnotation = input.annotation as AnnotationResult

  // ── B. 重算校验闸门 ──
  if (input.birth) {
    const b = input.birth
    let recomputed: BaZiResult
    try {
      recomputed = b.calendarType === 'lunar'
        ? await calculateBaziFromLunar(b.year, b.month, b.day, b.hour, b.minute ?? 0, b.gender, b.isLeapMonth ?? false)
        : await calculateBazi(b.year, b.month, b.day, b.hour, b.minute ?? 0, b.gender)
    } catch (e) {
      return {
        ok: false,
        code: 'BAD_REQUEST',
        message: `生辰参数非法，服务端重算失败：${e instanceof Error ? e.message : String(e)}`,
      }
    }

    const expected = chartHash(recomputed)
    const actual = chartHash(clientChart)
    if (expected !== actual) {
      const diff = firstDifference(recomputed, clientChart) ?? '未知差异'
      const detail = `服务端重算指纹 ${expected} ≠ 客户端指纹 ${actual}；首个差异：${diff}`
      if (mode === 'enforce') {
        return { ok: false, code: 'CHART_MISMATCH', message: '排盘结果校验失败（数据不一致）', detail }
      }
      warnings.push('CHART_MISMATCH_WARN: ' + detail)
      return {
        ok: true,
        warnings,
        data: {
          // 采用服务端重算结果作为权威（不信任客户端）
          chart: recomputed,
          annotation: generateAnnotation(recomputed),
          verified: true,
          source: 'recomputed',
          chartHash: expected,
          engineVersion: ENGINE_VERSION,
        },
      }
    }

    return {
      ok: true,
      warnings,
      data: {
        chart: recomputed,
        annotation: generateAnnotation(recomputed),
        verified: true,
        source: 'recomputed',
        chartHash: expected,
        engineVersion: ENGINE_VERSION,
      },
    }
  }

  // ── C. 兼容旧客户端：无 sessionId / 无 birth，只能信任 ──
  if (mode === 'enforce') {
    return {
      ok: false,
      code: 'CHART_MISMATCH',
      message: '服务端要求提供权威排盘来源（sessionId 或 birth），拒绝未校验的 chart',
      hint: 'POST /api/v1/app/chart 获取 sessionId',
    }
  }
  warnings.push('UNVERIFIED_CHART: 客户端直传 chart 未校验（建议改用 sessionId）')
  return {
    ok: true,
    warnings,
    data: {
      chart: clientChart,
      annotation: clientAnnotation,
      verified: false,
      source: 'client',
      chartHash: chartHash(clientChart),
      engineVersion: ENGINE_VERSION,
    },
  }
}
