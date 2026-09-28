// ============================================================
// B 模式 API — POST /api/report
// ============================================================

import { Hono } from 'hono'
import type { ReportRequest } from '../lib/types'
import { runReportPipeline } from '../workflows/index'
import { resolveChartSource } from '../lib/chart-source'

export const reportRoute = new Hono()

reportRoute.post('/api/report', async (c) => {
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

    console.log(`[Report] 开始生成命书，日主=${chart.dayMaster} 来源=${resolved.data.source}`)
    const result = await runReportPipeline({ chart, annotation })

    if (!result.ok) {
      console.error(`[Report] 流水线失败 [${result.step}]: ${result.error}`)
      return c.json({
        error: 'GENERATION_FAILED',
        message: `生成命书时出错（${result.step}），请稍后重试`,
        detail: result.error,
      }, 500)
    }

    console.log(`[Report] 命书生成成功，${result.data.sections.length} 章节`)
    return c.json({ ok: true, data: result.data })
  } catch (e) {
    console.error('[Report] 请求异常', e)
    return c.json({ error: 'INTERNAL_ERROR', message: '服务暂不可用，请稍后重试' }, 500)
  }
})
