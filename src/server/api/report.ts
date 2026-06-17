// ============================================================
// B 模式 API — POST /api/report
// ============================================================

import { Hono } from 'hono'
import type { ReportRequest } from '../lib/types'
import { runReportPipeline } from '../workflows/index'

export const reportRoute = new Hono()

reportRoute.post('/api/report', async (c) => {
  try {
    const body = await c.req.json() as ReportRequest

    // 基础校验
    if (!body.chart || !body.annotation) {
      return c.json({ error: 'BAD_REQUEST', message: '缺少 chart 或 annotation 字段' }, 400)
    }

    console.log(`[Report] 开始生成命书，日主=${body.chart.dayMaster}`)
    const result = await runReportPipeline(body)

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
