// ============================================================
// B 模式 API — POST /api/report
//
// [2026-09-29 止血] 本接口原为「无鉴权 + 零额度 + 无缓存」，而它内部有
// 4 次大模型调用，是全站最贵的操作 —— 任何人可匿名无限刷。现补齐三件事：
//   1. 必须登录（401）
//   2. 幂等额度预留（cost 可配，默认 5），失败全额退款
//   3. 按 chartHash 缓存：命中**不扣额度也不烧 token**
// 顺序有讲究：先查缓存再预留额度，这样"重复看同一份命书"完全免费。
// ============================================================

import { Hono } from 'hono'
import type { ReportRequest } from '../lib/types'
import { runReportPipeline } from '../workflows/index'
import { resolveChartSource } from '../lib/chart-source'
import { chartHash } from '../lib/chart-hash'
import { getCachedReport, setCachedReport } from '../lib/report-cache'
import { extractBearerToken, verifyUserToken } from '../core/middleware/user-auth'
import { isDbReady, getConfig, reserveQuota, commitQuota, refundQuota } from '../db/index'
import type { ReserveFailReason } from '../db/index'
import { newTraceId } from '../lib/trace'

/** 命书额度门控配置项（显式 'false' 才关闭；未配置 = 扣费，堵漏洞） */
const QUOTA_FLAG = 'quota_enforce_report'

/** 命书消耗额度（可由后台 `report_quota_cost` 覆盖） */
const DEFAULT_COST = 1

function readCost(): number {
  if (!isDbReady()) return DEFAULT_COST
  try {
    const raw = getConfig('report_quota_cost')?.value
    const n = Number(raw)
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_COST
  } catch {
    return DEFAULT_COST
  }
}

/** 额度门控是否开启（默认开启：未配置也扣费，避免"配置缺失 = 免费"的老问题） */
function quotaEnforced(): boolean {
  if (!isDbReady()) return false
  try {
    return getConfig(QUOTA_FLAG)?.value !== 'false'
  } catch {
    return true
  }
}

export const reportRoute = new Hono()

reportRoute.post('/api/report', async (c) => {
  // ── 0. 鉴权：命书是最贵的操作，必须登录（原为匿名可刷）──
  let userId: number | null = null
  if (isDbReady()) {
    const token = extractBearerToken(c)
    const payload = token ? verifyUserToken(token) : null
    if (!payload) {
      return c.json({
        error: 'UNAUTHORIZED',
        code: 'UNAUTHORIZED',
        message: '生成命书需要登录',
      }, 401)
    }
    userId = payload.userId
  }

  // 提到 try 外：异常路径也要能退款（失败不计费）
  let reserveKey: string | null = null
  try {
    const body = await c.req.json() as ReportRequest

    // ── [P5-3 ADR-005] 权威数据源解析（session / 重算校验 / 兼容旧客户端）──
    const resolved = await resolveChartSource({
      sessionId: body.sessionId,
      chart: body.chart,
      annotation: body.annotation,
      birth: body.birth,
    })
    if (!resolved.ok) {
      const status = resolved.code === 'SESSION_NOT_FOUND' ? 404
        : resolved.code === 'CHART_MISMATCH' ? 409
          : 400
      return c.json({
        error: resolved.code,
        message: resolved.message,
        ...(resolved.detail ? { detail: resolved.detail } : {}),
        ...(resolved.hint ? { hint: resolved.hint } : {}),
      }, status)
    }
    c.header('X-Chart-Verified', String(resolved.data.verified))
    c.header('X-Chart-Source', resolved.data.source)
    for (const w of resolved.warnings) console.warn('[ChartSource]', w)

    const { chart, annotation } = resolved.data
    const fp = chartHash(chart)

    // ── 1. 缓存命中：直接返回，不扣额度、不烧 token ──
    const cached = getCachedReport(fp)
    if (cached !== undefined) {
      c.header('X-Report-Cache', 'hit')
      console.log(`[Report] 缓存命中，日主=${chart.dayMaster} 指纹=${fp.slice(0, 12)}`)
      return c.json({ ok: true, data: cached, cached: true })
    }
    c.header('X-Report-Cache', 'miss')

    // ── 2. 幂等额度预留（缓存未命中才扣）──
    if (userId !== null && quotaEnforced()) {
      const headerKey = c.req.header('x-idempotency-key')
      const key = headerKey && /^[\w.:-]{8,128}$/.test(headerKey)
        ? headerKey
        : `report_${userId}_${fp}_${newTraceId()}`

      const cost = readCost()
      const res = reserveQuota({
        userId,
        idempotencyKey: key,
        cost,
        reason: 'report',
        refKey: null,
      })
      if (!res.ok) {
        const map: Record<ReserveFailReason, { status: 402 | 403 | 401 | 409; code: string; message: string }> = {
          QUOTA_EXHAUSTED: {
            status: 402, code: 'QUOTA_EXHAUSTED',
            message: `生成命书需要 ${cost} 额度，当前余额不足，请充值或订阅套餐`,
          },
          ACCOUNT_DISABLED: { status: 403, code: 'ACCOUNT_DISABLED', message: '账号已被停用，请联系客服' },
          USER_NOT_FOUND: { status: 401, code: 'UNAUTHORIZED', message: '登录状态失效，请重新登录' },
          KEY_REFUNDED: { status: 409, code: 'IDEMPOTENCY_KEY_REFUNDED', message: '该幂等键已退款，请用新键重试' },
        }
        const m = map[res.reason ?? 'QUOTA_EXHAUSTED']
        return c.json({
          error: m.code,
          code: m.code,
          message: m.message,
          quotaRemaining: res.balanceAfter ?? 0,
        }, m.status)
      }
      reserveKey = key
    }

    console.log(`[Report] 开始生成命书，日主=${chart.dayMaster} 来源=${resolved.data.source} 用户=${userId}`)
    const result = await runReportPipeline({ chart, annotation })

    if (!result.ok) {
      console.error(`[Report] 流水线失败 [${result.step}]: ${result.error}`)
      // 失败不计费 —— 用户没拿到东西就不能扣（AI SDK v6 失败也可能走 error chunk）
      if (reserveKey) refundQuota(reserveKey)
      return c.json({
        error: 'GENERATION_FAILED',
        message: `生成命书时出错（${result.step}），请稍后重试`,
        detail: result.error,
      }, 500)
    }

    // ── 3. 成功：落缓存 + 结算额度 ──
    setCachedReport(fp, result.data)
    if (reserveKey) commitQuota(reserveKey)

    console.log(`[Report] 命书生成成功，${result.data.sections.length} 章节`)
    return c.json({ ok: true, data: result.data, cached: false })
  } catch (e) {
    console.error('[Report] 请求异常', e)
    if (reserveKey) refundQuota(reserveKey)
    return c.json({ error: 'INTERNAL_ERROR', message: '服务暂不可用，请稍后重试' }, 500)
  }
})
