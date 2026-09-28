// ============================================================
// Phase 5 P5-3 — 计算权威数据源解析（ADR-005）
// [ADR-011 阶段3] 泛化为 resolveContext(system, ...)；resolveChartSource 保留为
//                 bazi 薄封装（既有调用方/测试零改动，行为逐字等价）。
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
//
// [ADR-011] 体系维度：计算相关的 hash / 重算 / 形状守卫 / 差异描述
//           全部委托该体系的 SystemEngine（注册表），本文件不再直接依赖八字引擎。
// ============================================================

import type { BaZiResult, AnnotationResult } from '../../engine'
import { getSession, getConfig, isDbReady } from '../db'
import { requireSystemEngine, isKnownSystem, DEFAULT_SYSTEM } from '../systems/registry'
import type { BirthInput } from './types'

export type { BirthInput }

export type ChartVerifyMode = 'off' | 'warn' | 'enforce'

export interface ResolvedChart {
  /** 体系产物 payload（当前仅 bazi；列名保留，语义随 system 泛化） */
  chart: BaZiResult
  annotation: AnnotationResult
  /** 是否经过服务端可信来源校验（session 权威 或 重算一致） */
  verified: boolean
  source: 'session' | 'recomputed' | 'client'
  chartHash: string
  engineVersion: string
  /** [ADR-011] 体系标识（当前仅 'bazi'） */
  system: string
  /** session 路径下的权威 sessionId */
  sessionId?: string
}

export type ResolveResult =
  | { ok: true; data: ResolvedChart; warnings: string[] }
  | {
    ok: false
    code: 'BAD_REQUEST' | 'SESSION_NOT_FOUND' | 'CHART_MISMATCH' | 'UNKNOWN_SYSTEM'
    message: string
    detail?: string
    hint?: string
  }

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

/** resolveContext / resolveChartSource 的入参 */
export interface ResolveInput {
  /** [ADR-011] 体系 id，缺省 'bazi' */
  system?: string
  sessionId?: string
  chart?: unknown
  annotation?: unknown
  birth?: BirthInput
  verifyMode?: ChartVerifyMode
}

interface BaziBundleLike {
  chart: BaZiResult
  annotation: AnnotationResult
}

/**
 * [ADR-011 阶段3] 按体系解析请求上下文 —— 泛化入口。
 */
export async function resolveContext(system: string, input: ResolveInput): Promise<ResolveResult> {
  const warnings: string[] = []
  const mode = input.verifyMode ?? getChartVerifyMode()

  if (!isKnownSystem(system)) {
    return {
      ok: false,
      code: 'UNKNOWN_SYSTEM',
      message: `未知体系：${system}`,
      hint: `当前可用体系：${DEFAULT_SYSTEM}`,
    }
  }
  const engine = requireSystemEngine(system)

  // ── A. 权威 session ──
  if (input.sessionId) {
    const row = getSession(input.sessionId)
    if (!row) {
      return { ok: false, code: 'SESSION_NOT_FOUND', message: '排盘会话不存在或已过期，请重新排盘', hint: 'POST /api/v1/app/chart' }
    }
    // [ADR-011] 读路径先看 system 再解析 payload，杜绝「按列名猜语义」
    if ((row.system ?? DEFAULT_SYSTEM) !== system) {
      return { ok: false, code: 'SESSION_NOT_FOUND', message: '会话体系与请求体系不一致，请重新排盘' }
    }
    const chart = parseJson<BaZiResult>(row.chart)
    const annotation = parseJson<AnnotationResult>(row.annotation)
    const bundle: BaziBundleLike = { chart: chart as BaZiResult, annotation: annotation as AnnotationResult }
    if (!chart || !annotation || !engine.isValidResult(bundle)) {
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
        chartHash: row.chartHash ?? engine.hash(bundle),
        engineVersion: row.engineVersion ?? engine.version,
        system,
        sessionId: row.id,
      },
    }
  }

  // ── C 前置：客户端数据必须存在且形状正确 ──
  const clientBundle: BaziBundleLike = {
    chart: input.chart as BaZiResult,
    annotation: input.annotation as AnnotationResult,
  }
  if (!input.chart || !input.annotation || !engine.isValidResult(clientBundle)) {
    return {
      ok: false,
      code: 'BAD_REQUEST',
      message: '缺少 chart 或 annotation 字段',
      hint: '请先调用 POST /api/v1/app/chart 获取权威数据，或传入 birth 生辰由服务端重算',
    }
  }
  const clientChart = clientBundle.chart
  const clientAnnotation = clientBundle.annotation

  // ── B. 重算校验闸门 ──
  if (input.birth) {
    let recomputed: BaziBundleLike
    try {
      // [ADR-011] 重算委托体系引擎（bazi 引擎内部即为 calculateBazi* + generateAnnotation）
      recomputed = (await engine.compute(input.birth)) as BaziBundleLike
    } catch (e) {
      return {
        ok: false,
        code: 'BAD_REQUEST',
        message: `生辰参数非法，服务端重算失败：${e instanceof Error ? e.message : String(e)}`,
      }
    }

    const expected = engine.hash(recomputed)
    const actual = engine.hash(clientBundle)
    if (expected !== actual) {
      const diff = engine.firstDifference?.(recomputed, clientBundle) ?? '未知差异'
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
          chart: recomputed.chart,
          annotation: recomputed.annotation,
          verified: true,
          source: 'recomputed',
          chartHash: expected,
          engineVersion: engine.version,
          system,
        },
      }
    }

    return {
      ok: true,
      warnings,
      data: {
        chart: recomputed.chart,
        annotation: recomputed.annotation,
        verified: true,
        source: 'recomputed',
        chartHash: expected,
        engineVersion: engine.version,
        system,
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
      chartHash: engine.hash(clientBundle),
      engineVersion: engine.version,
      system,
    },
  }
}

/**
 * 排盘数据源解析（八字快捷入口，保持既有签名）。
 * 上游 /api/chat、/api/chat/route、/api/report 与回归测试零改动。
 */
export async function resolveChartSource(input: ResolveInput): Promise<ResolveResult> {
  return resolveContext(input.system ?? DEFAULT_SYSTEM, input)
}
