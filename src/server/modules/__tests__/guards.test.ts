// ============================================================
// Phase 4a-R1 — L3 护栏热生效闭环测试
// 文件：src/server/modules/__tests__/guards.test.ts
//
// 验证链路（端到端）：
//   管理后台 GuardPanel PUT /prompts/guards
//     → 写入 app_configs['anti_hallucination_rules']
//     → buildAntiHallucinationPromptDynamic() / getRejectMessage() 实时读取
//     → 下一轮对话的 System Prompt 与 L2 拦截话术立刻变化
//   DB 缺失或数据损坏 → 回退硬编码常量（兜底）
//
// 隔离约定：singleFork 共享进程，本文件自建 :memory: 库
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Hono } from 'hono'
import fs from 'node:fs'
import path from 'node:path'
import { route as promptsRoute } from '@/server/modules/prompts'
import { initDb, closeDb, getConfig, setConfig, deleteConfig } from '@/server/db'
import { signToken, createSession } from '@/server/core/middleware/auth'
import {
  buildAntiHallucinationPromptDynamic,
  getRejectMessage,
  detectPaipanAttempt,
  REJECT_PAIPAN_MESSAGE,
} from '@/server/lib/anti-hallucination'
import type { BaZiResult } from '@/engine/types'
import type { AnnotationResult } from '@/engine/annotation/types'

// ═══════════════════════════════════════
// 测试装置
// ═══════════════════════════════════════

const GUARD_KEY = 'anti_hallucination_rules'

interface TestFixture {
  chart: BaZiResult
  annotation: AnnotationResult
}

function loadFixture(): TestFixture {
  const raw = fs.readFileSync(
    path.resolve(__dirname, '../../workflows/__tests__/fixtures/case-01-qianlong.json'),
    'utf-8',
  )
  return JSON.parse(raw) as TestFixture
}

/** 构造带管理员身份的测试 App */
function makeApp(): Hono {
  const app = new Hono()
  app.route('/api/v1/admin/prompts', promptsRoute)
  return app
}

let authHeaders: Record<string, string>
let fixture: TestFixture

/** 8 条规则的最小合法 payload（内容自定义，用于断言热生效） */
function customPayload(overrides?: { style?: string; reject?: string }) {
  const names = [
    'corePositioning', 'toolAuthorization',
    'rule0_noPaipan', 'rule1_dataLock', 'rule2_noAbsolute',
    'rule3_safety', 'rule4_style', 'rule5_topicBoundary',
  ] as const
  return {
    l1Rules: names.map(name => ({
      name,
      label: `标签-${name}`,
      content: name === 'rule4_style'
        ? (overrides?.style ?? '自定义风格：结尾附「本回复由护栏测试注入」。')
        : `内容-${name}`,
    })),
    l1RejectMessage: overrides?.reject ?? '自定义拒绝话术：请回到排盘表单。',
  }
}

beforeAll(() => {
  process.env.DB_PATH = ':memory:'
  initDb()
  deleteConfig(GUARD_KEY)

  const { token, jti, expiresAt } = signToken('guard-tester')
  createSession({ tokenJti: jti, username: 'guard-tester', expiresAt })
  authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  fixture = loadFixture()
})

afterAll(() => {
  deleteConfig(GUARD_KEY)
  closeDb()
  delete process.env.DB_PATH
})

// ═══════════════════════════════════════
// A. 未配置时：回退内置默认
// ═══════════════════════════════════════

describe('R1-A — 未配置护栏时回退内置默认', () => {
  it('GET /guards → source=builtin 且返回 8 条规则', async () => {
    deleteConfig(GUARD_KEY)
    const res = await makeApp().request('/api/v1/admin/prompts/guards', {
      headers: authHeaders,
    })
    expect(res.status).toBe(200)

    const body = await res.json() as any
    expect(body.success).toBe(true)
    expect(body.source).toBe('builtin')
    expect(body.data.l1Rules).toHaveLength(8)
    expect(body.data.l1RejectMessage).toBe(REJECT_PAIPAN_MESSAGE)
  })

  it('运行时：getRejectMessage() 返回硬编码话术', () => {
    expect(getRejectMessage()).toBe(REJECT_PAIPAN_MESSAGE)
  })

  it('运行时：System Prompt 使用硬编码规则（含内置免责声明）', () => {
    const prompt = buildAntiHallucinationPromptDynamic(fixture.chart, fixture.annotation)
    expect(prompt).toContain('以上分析仅供参考，祝您生活愉快。')
    expect(prompt).toContain('防越权规则')
  })
})

// ═══════════════════════════════════════
// B. 保存护栏：写入 DB 并热生效
// ═══════════════════════════════════════

describe('R1-B — 保存护栏后热生效', () => {
  const STYLE = '自定义风格：结尾附「本回复由护栏测试注入」。'
  const REJECT = '自定义拒绝话术：请回到排盘表单。'

  it('PUT /guards 非法 payload（缺规则）→ 400', async () => {
    const res = await makeApp().request('/api/v1/admin/prompts/guards', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ l1Rules: [], l1RejectMessage: 'x' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('PUT /guards 合法 payload → 200 且落库', async () => {
    const res = await makeApp().request('/api/v1/admin/prompts/guards', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify(customPayload({ style: STYLE, reject: REJECT })),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.success).toBe(true)
    expect(body.message).toContain('下一轮对话')

    const row = getConfig(GUARD_KEY)
    expect(row).toBeTruthy()
    expect(row!.value).toContain(REJECT)
  })

  it('GET /guards → source=db 且回显自定义内容', async () => {
    const res = await makeApp().request('/api/v1/admin/prompts/guards', {
      headers: authHeaders,
    })
    const body = await res.json() as any
    expect(body.source).toBe('db')
    expect(body.data.l1RejectMessage).toBe(REJECT)
    expect(body.updatedAt).toBeTruthy()
  })

  it('运行时：System Prompt 立即携带自定义规则（无需重启）', () => {
    const prompt = buildAntiHallucinationPromptDynamic(fixture.chart, fixture.annotation)
    expect(prompt).toContain(STYLE)
    expect(prompt).toContain(REJECT)
    expect(prompt).not.toContain('以上分析仅供参考，祝您生活愉快。')
  })

  it('运行时：L2 拒绝话术同步热更新', () => {
    expect(getRejectMessage()).toBe(REJECT)

    const verdict = detectPaipanAttempt('帮我算一下 1990年1月1日 的八字')
    expect(verdict.blocked).toBe(true)
    if (verdict.blocked) expect(verdict.message).toBe(REJECT)
  })

  it('审计日志记录了本次护栏更新', async () => {
    // PUT 成功即写审计；此处复核 DB 中确实存在 config/update 记录
    const { listAuditLogs } = await import('@/server/db')
    const logs = listAuditLogs(50)
    expect(logs.some(l => l.resource === 'config' && l.action === 'update')).toBe(true)
  })
})

// ═══════════════════════════════════════
// C. DB 数据损坏 → 兜底回退
// ═══════════════════════════════════════

describe('R1-C — DB 数据损坏时兜底回退', () => {
  it('JSON 损坏 → 运行时回退硬编码常量', () => {
    setConfig(GUARD_KEY, '{ 这不是合法 JSON')

    expect(getRejectMessage()).toBe(REJECT_PAIPAN_MESSAGE)
    const prompt = buildAntiHallucinationPromptDynamic(fixture.chart, fixture.annotation)
    expect(prompt).toContain('以上分析仅供参考，祝您生活愉快。')
  })

  it('JSON 损坏 → GET 回退 builtin 而非 500', async () => {
    const res = await makeApp().request('/api/v1/admin/prompts/guards', {
      headers: authHeaders,
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.source).toBe('builtin')
  })

  it('删除配置 → 重新回退内置默认', () => {
    deleteConfig(GUARD_KEY)
    expect(getRejectMessage()).toBe(REJECT_PAIPAN_MESSAGE)
  })
})

// ═══════════════════════════════════════
// C2. 结构不完整 → 整体回退（R4 兜底）
// ═══════════════════════════════════════

describe('R4 — 护栏结构不完整时整体回退', () => {
  const cases: { name: string; payload: unknown }[] = [
    { name: '缺少一条规则', payload: { ...customPayload(), l1Rules: customPayload().l1Rules.slice(0, 7) } },
    { name: '规则内容为空', payload: { ...customPayload(), l1Rules: customPayload().l1Rules.map(r => r.name === 'rule3_safety' ? { ...r, content: '   ' } : r) } },
    { name: '拒绝话术为空', payload: { ...customPayload(), l1RejectMessage: '' } },
    { name: '规则名不在白名单', payload: { ...customPayload(), l1Rules: customPayload().l1Rules.map(r => r.name === 'rule4_style' ? { ...r, name: 'rule9_hack' } : r) } },
    { name: '规则名重复', payload: { ...customPayload(), l1Rules: customPayload().l1Rules.map(r => r.name === 'rule5_topicBoundary' ? { ...r, name: 'rule4_style' } : r) } },
    { name: 'l1Rules 不是数组', payload: { ...customPayload(), l1Rules: null } },
  ]

  for (const c of cases) {
    it(`${c.name} → 回退硬编码常量`, () => {
      setConfig(GUARD_KEY, JSON.stringify(c.payload))
      expect(getRejectMessage()).toBe(REJECT_PAIPAN_MESSAGE)
      const prompt = buildAntiHallucinationPromptDynamic(fixture.chart, fixture.annotation)
      expect(prompt).toContain('以上分析仅供参考，祝您生活愉快。')
    })
  }

  it('回退后 System Prompt 仍不含残缺的自定义内容', () => {
    setConfig(GUARD_KEY, JSON.stringify({ ...customPayload(), l1RejectMessage: '' }))
    const prompt = buildAntiHallucinationPromptDynamic(fixture.chart, fixture.annotation)
    expect(prompt).not.toContain('自定义拒绝话术')
    deleteConfig(GUARD_KEY)
  })
})

// ═══════════════════════════════════════
// D. 内置默认值一致性（防前后端漂移）
// ═══════════════════════════════════════

describe('R1-D — 内置默认与硬编码常量保持一致', () => {
  it('后端 buildDefaultGuards() 的拒绝话术 === REJECT_PAIPAN_MESSAGE', async () => {
    deleteConfig(GUARD_KEY)
    const res = await makeApp().request('/api/v1/admin/prompts/guards', {
      headers: authHeaders,
    })
    const body = await res.json() as any
    expect(body.data.l1RejectMessage).toBe(REJECT_PAIPAN_MESSAGE)
  })

  it('后端 buildDefaultGuards() 的 rule4_style 含内置免责声明', async () => {
    const res = await makeApp().request('/api/v1/admin/prompts/guards', {
      headers: authHeaders,
    })
    const body = await res.json() as any
    const style = body.data.l1Rules.find((r: any) => r.name === 'rule4_style')
    expect(style.content).toContain('以上分析仅供参考，祝您生活愉快。')
  })
})
