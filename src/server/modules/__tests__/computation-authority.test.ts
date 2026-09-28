// ============================================================
// Phase 5 P5-3 — 计算权威测试（ADR-005）
// 文件：src/server/modules/__tests__/computation-authority.test.ts
//
// 覆盖：
//   chartHash 稳定性（键序无关 / 浮点归一化）
//   服务端权威 Chart 端点（落库 + 指纹）
//   数据源解析三分支：session / 重算校验 / 仅客户端
//   重算校验闸门 enforce → 不一致拒绝（409）
//   /api/chat 未校验来源在 enforce 下拒绝（不触发 LLM）
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Hono } from 'hono'
import { route as chartRoute } from '@/server/modules-public/chart'
import { chatRoute } from '@/server/api/chat'
import { initDb, closeDb, getSession, setConfig, deleteConfig } from '@/server/db'
import { calculateBazi, generateAnnotation } from '@/engine'
import { chartHash, stableStringify, looksLikeChart, firstDifference } from '@/server/lib/chart-hash'
import { resolveChartSource } from '@/server/lib/chart-source'
import type { BaZiResult } from '@/engine'

const VERIFY_KEY = 'chart_verify_mode'

let app: Hono

beforeAll(() => {
  process.env.DB_PATH = ':memory:'
  initDb()
  app = new Hono()
  app.route('/api/v1/app/chart', chartRoute)
  app.route('/', chatRoute)
})

afterAll(() => {
  deleteConfig(VERIFY_KEY)
  closeDb()
  delete process.env.DB_PATH
})

// ═══════════════════════════════════════
// A. 指纹稳定性
// ═══════════════════════════════════════

describe('P5-3 A — chartHash 稳定性', () => {
  it('同一对象哈希一致', async () => {
    const chart = await calculateBazi(1990, 6, 15, 12, 30, '男')
    expect(chartHash(chart)).toBe(chartHash(chart))
    expect(chartHash(chart)).toMatch(/^v1:[0-9a-f]{64}$/)
  })

  it('键插入顺序不同 → 哈希相同（规范化生效）', async () => {
    const chart = await calculateBazi(1985, 3, 3, 8, 0, '女')
    const reordered: Record<string, unknown> = {}
    for (const k of Object.keys(chart).reverse()) {
      reordered[k] = (chart as unknown as Record<string, unknown>)[k]
    }
    expect(chartHash(reordered)).toBe(chartHash(chart))
  })

  it('浮点尾差被归一化 → 哈希相同', () => {
    const a = { fiveElements: { 木: 0.30000000000000004 } }
    const b = { fiveElements: { 木: 0.3 } }
    expect(chartHash(a)).toBe(chartHash(b))
    expect(stableStringify(a)).toBe(stableStringify(b))
  })

  it('内容不同 → 哈希不同', async () => {
    const c1 = await calculateBazi(1990, 6, 15, 12, 30, '男')
    const c2 = await calculateBazi(1990, 6, 15, 13, 30, '男')
    expect(chartHash(c1)).not.toBe(chartHash(c2))
  })

  it('looksLikeChart 拒绝残缺对象', () => {
    expect(looksLikeChart({ yearPillar: {}, monthPillar: {}, dayPillar: {}, hourPillar: {}, dayMaster: '甲' })).toBe(true)
    expect(looksLikeChart({ dayMaster: '甲' })).toBe(false)
    expect(looksLikeChart(null)).toBe(false)
  })

  it('firstDifference 定位首个差异路径', async () => {
    const c1 = await calculateBazi(1990, 6, 15, 12, 30, '男')
    const c2 = JSON.parse(JSON.stringify(c1)) as BaZiResult
    c2.gender = '女'
    expect(firstDifference(c1, c2)).toContain('gender')
  })
})

// ═══════════════════════════════════════
// B. 服务端权威 Chart 端点
// ═══════════════════════════════════════

describe('P5-3 B — POST /api/v1/app/chart', () => {
  it('合法生辰 → 200 且返回 sessionId + 指纹 + 完整数据', async () => {
    const res = await app.request('/api/v1/app/chart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: 1990, month: 6, day: 15, hour: 12, minute: 30, gender: '男', calendarType: 'solar',
      }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.success).toBe(true)
    expect(body.data.sessionId).toMatch(/^sess_/)
    expect(body.data.chartHash).toMatch(/^v1:/)
    expect(body.data.engineVersion).toBeTruthy()
    expect(body.data.chart.dayMaster).toBeTruthy()
    expect(body.data.annotation.overview).toBeTruthy()

    // 已落库（权威锚点）
    const row = getSession(body.data.sessionId)
    expect(row).toBeTruthy()
    expect(row!.chartHash).toBe(body.data.chartHash)
  })

  it('负数月份等非法输入 → 400', async () => {
    const res = await app.request('/api/v1/app/chart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: 1990, month: 13, day: 1, hour: 1, gender: '男' }),
    })
    expect(res.status).toBe(400)
  })

  it('农历排盘可用', async () => {
    const res = await app.request('/api/v1/app/chart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: 1990, month: 5, day: 23, hour: 12, gender: '女', calendarType: 'lunar',
      }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.data.chart.dayMaster).toBeTruthy()
  })
})

// ═══════════════════════════════════════
// C. 数据源解析三分支
// ═══════════════════════════════════════

describe('P5-3 C — resolveChartSource', () => {
  it('session 分支 → verified=true / source=session', async () => {
    const created = await app.request('/api/v1/app/chart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: 1988, month: 8, day: 8, hour: 8, gender: '男' }),
    })
    const sid = ((await created.json()) as any).data.sessionId
    const r = await resolveChartSource({ sessionId: sid })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.verified).toBe(true)
      expect(r.data.source).toBe('session')
      expect(r.data.sessionId).toBe(sid)
    }
  })

  it('session 不存在 → SESSION_NOT_FOUND', async () => {
    const r = await resolveChartSource({ sessionId: 'sess_nope' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('SESSION_NOT_FOUND')
  })

  it('birth 重算一致 → verified=true / source=recomputed', async () => {
    const chart = await calculateBazi(1995, 5, 5, 5, 5, '女')
    const r = await resolveChartSource({
      chart,
      annotation: generateAnnotation(chart),
      birth: { year: 1995, month: 5, day: 5, hour: 5, minute: 5, gender: '女' },
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.verified).toBe(true)
      expect(r.data.source).toBe('recomputed')
    }
  })

  it('birth 重算不一致 + off → 放行但采用服务端重算结果 + 告警', async () => {
    setConfig(VERIFY_KEY, 'off')
    const realChart = await calculateBazi(1995, 5, 5, 5, 5, '女')
    const forged = JSON.parse(JSON.stringify(realChart)) as BaZiResult
    forged.dayMaster = '戊' // 伪造日主

    const r = await resolveChartSource({
      chart: forged,
      annotation: generateAnnotation(realChart),
      birth: { year: 1995, month: 5, day: 5, hour: 5, minute: 5, gender: '女' },
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.warnings.some(w => w.includes('CHART_MISMATCH_WARN'))).toBe(true)
      // 采用服务端权威结果，而非伪造内容
      expect(r.data.chart.dayMaster).toBe(realChart.dayMaster)
    }
  })

  it('birth 重算不一致 + enforce → CHART_MISMATCH', async () => {
    setConfig(VERIFY_KEY, 'enforce')
    const realChart = await calculateBazi(1995, 5, 5, 5, 5, '女')
    const forged = JSON.parse(JSON.stringify(realChart)) as BaZiResult
    forged.dayMaster = '戊'

    const r = await resolveChartSource({
      chart: forged,
      annotation: generateAnnotation(realChart),
      birth: { year: 1995, month: 5, day: 5, hour: 5, minute: 5, gender: '女' },
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe('CHART_MISMATCH')
      expect(r.detail).toContain('dayMaster')
    }
    deleteConfig(VERIFY_KEY)
  })

  it('仅客户端 chart + off → 放行但 verified=false', async () => {
    deleteConfig(VERIFY_KEY)
    const chart = await calculateBazi(2000, 1, 1, 0, 0, '男')
    const r = await resolveChartSource({ chart, annotation: generateAnnotation(chart) })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.verified).toBe(false)
      expect(r.data.source).toBe('client')
    }
  })

  it('仅客户端 chart + enforce → 拒绝', async () => {
    setConfig(VERIFY_KEY, 'enforce')
    const chart = await calculateBazi(2000, 1, 1, 0, 0, '男')
    const r = await resolveChartSource({ chart, annotation: generateAnnotation(chart) })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('CHART_MISMATCH')
    deleteConfig(VERIFY_KEY)
  })
})

// ═══════════════════════════════════════
// D. /api/chat 闸门前置拦截（不触发 LLM）
// ═══════════════════════════════════════

describe('P5-3 D — /api/chat 权威前置校验', () => {
  it('未知 sessionId → 404（未触达 LLM）', async () => {
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'sess_missing', messages: [{ role: 'user', content: '你好' }] }),
    })
    expect(res.status).toBe(404)
    const body = await res.json() as any
    expect(body.error).toBe('SESSION_NOT_FOUND')
  })

  it('缺少 chart/annotation 且无 session → 400', async () => {
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: '你好' }] }),
    })
    expect(res.status).toBe(400)
  })

  it('enforce 下伪造 chart（无 birth/session）→ 409', async () => {
    setConfig(VERIFY_KEY, 'enforce')
    const chart = await calculateBazi(1993, 3, 3, 3, 3, '男')
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chart,
        annotation: generateAnnotation(chart),
        messages: [{ role: 'user', content: '你好' }],
      }),
    })
    expect(res.status).toBe(409)
    const body = await res.json() as any
    expect(body.error).toBe('CHART_MISMATCH')
    deleteConfig(VERIFY_KEY)
  })
})
