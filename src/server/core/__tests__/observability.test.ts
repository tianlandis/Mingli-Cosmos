// ============================================================
// Phase 5 P5-2 — 可观测性基线测试（ADR-007）
// 文件：src/server/core/__tests__/observability.test.ts
//
// 覆盖：
//   指标注册表（计数器 / 直方图 / Prometheus 渲染）
//   追踪中间件（traceId 生成 / 透传 / 回写响应头）
//   分维度归类（admin vs app —— 支撑 ADR-001 拆分决策）
//   深度健康检查（DB 探测 / LLM 跳过语义）
//   集成：/api/health/deep 与 /api/metrics 已挂载
// ============================================================

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { Hono as HonoType } from 'hono'
import { createApp } from '@/server/core/app'
import { initDb, closeDb } from '@/server/db'
import { observabilityMiddleware, scopeOfPath, newTraceId, TRACE_HEADER } from '@/server/lib/trace'
import {
  incCounter,
  observeHistogram,
  renderPrometheus,
  metricsSnapshot,
  resetMetrics,
} from '@/server/lib/metrics'
import { deepHealthcheck } from '@/server/lib/health'

// ═══════════════════════════════════════
// A. 指标注册表
// ═══════════════════════════════════════

describe('P5-2 A — 指标注册表', () => {
  beforeEach(() => resetMetrics())

  it('计数器累加并支持标签', () => {
    incCounter('t_total', { scope: 'app', status: '200' })
    incCounter('t_total', { scope: 'app', status: '200' })
    incCounter('t_total', { scope: 'admin', status: '500' }, 3)

    const snap = metricsSnapshot()
    expect(snap.counters.t_total['{scope="app",status="200"}']).toBe(2)
    expect(snap.counters.t_total['{scope="admin",status="500"}']).toBe(3)
  })

  it('直方图统计 count / sum / avg', () => {
    observeHistogram('t_dur_ms', 10)
    observeHistogram('t_dur_ms', 30)
    const h = metricsSnapshot().histograms.t_dur_ms[0]
    expect(h.count).toBe(2)
    expect(h.sum).toBe(40)
    expect(h.avg).toBe(20)
  })

  it('Prometheus 文本渲染含 TYPE / 分桶 / +Inf', () => {
    incCounter('mingli_http_requests_total', { scope: 'app' }, 1, 'help text')
    observeHistogram('mingli_http_request_duration_ms', 12, { scope: 'app' })

    const text = renderPrometheus()
    expect(text).toContain('# TYPE mingli_http_requests_total counter')
    expect(text).toContain('# TYPE mingli_http_request_duration_ms histogram')
    expect(text).toContain('mingli_http_request_duration_ms_bucket{scope="app",le="+Inf"} 1')
    expect(text).toContain('mingli_http_request_duration_ms_count{scope="app"} 1')
  })

  it('标签中的引号被转义（防止 exposition 注入）', () => {
    incCounter('t_evil', { bad: 'a"b\\c' })
    const text = renderPrometheus()
    expect(text).toContain('a\\"b\\\\c')
  })
})

// ═══════════════════════════════════════
// B. 追踪 + 分维度归类
// ═══════════════════════════════════════

describe('P5-2 B — 追踪中间件与维度归类', () => {
  it('scopeOfPath：admin 与 app 分开归类', () => {
    expect(scopeOfPath('/api/v1/admin/users')).toBe('admin')
    expect(scopeOfPath('/api/admin/auth/login')).toBe('admin')
    expect(scopeOfPath('/api/v1/app/user/me')).toBe('app')
    expect(scopeOfPath('/api/chat')).toBe('app')
    expect(scopeOfPath('/api/report')).toBe('app')
    expect(scopeOfPath('/api/health')).toBe('core')
    expect(scopeOfPath('/')).toBe('other')
  })

  it('newTraceId 生成唯一且带时间前缀', () => {
    const a = newTraceId()
    const b = newTraceId()
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[a-z0-9]+-[0-9a-f]{8}$/)
  })

  it('自动生成 traceId 并回写响应头 + 记录分维度指标', async () => {
    resetMetrics()
    const app = new Hono()
    app.use('*', observabilityMiddleware())
    app.get('/api/v1/app/ping', (c) => c.json({ ok: true }))

    const res = await app.request('/api/v1/app/ping')
    expect(res.status).toBe(200)
    const traceId = res.headers.get('X-Trace-Id')
    expect(traceId).toBeTruthy()

    const snap = metricsSnapshot()
    // 标签按 key 排序序列化：class < method < scope < status
    const key = `{class="2xx",method="GET",scope="app",status="200"}`
    expect(snap.counters.mingli_http_requests_total[key]).toBe(1)
    expect(snap.histograms.mingli_http_request_duration_ms[0].count).toBe(1)
  })

  it('透传上游 traceId（链路续接）', async () => {
    const app = new Hono()
    app.use('*', observabilityMiddleware())
    app.get('/api/v1/app/ping', (c) => c.json({ ok: true }))

    const res = await app.request('/api/v1/app/ping', {
      headers: { [TRACE_HEADER]: 'upstream-abc123' },
    })
    expect(res.headers.get('X-Trace-Id')).toBe('upstream-abc123')
  })

  it('非法 traceId 不被透传（防头部注入）', async () => {
    const app = new Hono()
    app.use('*', observabilityMiddleware())
    app.get('/api/v1/app/ping', (c) => c.json({ ok: true }))

    const res = await app.request('/api/v1/app/ping', {
      headers: { [TRACE_HEADER]: 'bad id with spaces!' },
    })
    expect(res.headers.get('X-Trace-Id')).not.toBe('bad id with spaces!')
  })
})

// ═══════════════════════════════════════
// C. 深度健康检查
// ═══════════════════════════════════════

describe('P5-2 C — 深度健康检查', () => {
  beforeAll(() => {
    process.env.DB_PATH = ':memory:'
    initDb()
  })
  afterAll(() => {
    closeDb()
    delete process.env.DB_PATH
  })

  it('DB 可读 → database=ok', async () => {
    const r = await deepHealthcheck({ includeLlm: false })
    const db = r.checks.find(c => c.name === 'database')
    expect(db?.status).toBe('ok')
    expect(r.dbReady).toBe(true)
  })

  it('关闭 LLM 探活 → llm=skipped（不产生噪音）', async () => {
    const r = await deepHealthcheck({ includeLlm: false })
    expect(r.checks.find(c => c.name === 'llm')?.status).toBe('skipped')
    expect(r.status).toBe('ok')
  })

  it('未配置真实 Key → LLM 探活 skipped，整体仍 ok', async () => {
    const r = await deepHealthcheck({ includeLlm: true })
    const llm = r.checks.find(c => c.name === 'llm')
    expect(['skipped', 'degraded']).toContain(llm?.status)
    // LLM 不可用不应让整体 down（进程与 DB 才是硬依赖）
    expect(r.status).not.toBe('down')
  })
})

// ═══════════════════════════════════════
// D. 集成：端点已挂载
// ═══════════════════════════════════════

describe('P5-2 D — 端点集成', () => {
  let app: HonoType

  beforeAll(async () => {
    process.env.DB_PATH = ':memory:'
    initDb()
    app = await createApp({ isProduction: false, logEnabled: false })
  })
  afterAll(() => {
    closeDb()
    delete process.env.DB_PATH
  })

  it('GET /api/health 仍为轻量进程级', async () => {
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.status).toBe('ok')
    expect(body.uptime_seconds).toBeGreaterThanOrEqual(0)
  })

  it('GET /api/health/deep 返回分级结果', async () => {
    const res = await app.request('/api/health/deep')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.checks.some((c: any) => c.name === 'database')).toBe(true)
    expect(['ok', 'degraded']).toContain(body.status)
  })

  it('GET /api/metrics 返回 Prometheus 文本', async () => {
    await app.request('/api/health')
    const res = await app.request('/api/metrics')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/plain')
    const text = await res.text()
    expect(text).toContain('mingli_http_requests_total')
  })

  it('所有响应都带 X-Trace-Id', async () => {
    const res = await app.request('/api/health')
    expect(res.headers.get('X-Trace-Id')).toBeTruthy()
  })
})
