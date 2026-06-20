// ============================================================
// Phase 4A — 数据库模块集成测试
// 文件：tests/db.test.ts
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getDb, initDb, closeDb } from '@/server/db'
import { createApiKey, listApiKeys, getApiKey, updateApiKey, deleteApiKey } from '@/server/db'
import { createPrompt, listPrompts, getPromptByName, updatePrompt, deletePrompt } from '@/server/db'
import { setConfig, getConfigValue, listConfigs, deleteConfig } from '@/server/db'
import { upsertSession, getSession, deleteSession } from '@/server/db'
import { createAuditLog, listAuditLogs } from '@/server/db'

// Use in-memory SQLite for testing
beforeAll(() => {
  process.env.DB_PATH = ':memory:'
  initDb()
})

afterAll(() => {
  closeDb()
})

describe('API Keys CRUD', () => {
  it('创建 API Key', () => {
    const row = createApiKey({
      provider: 'siliconflow',
      label: '测试 Key',
      apiKey: 'sk-test-123',
      baseUrl: 'https://api.siliconflow.cn/v1',
      model: 'deepseek-ai/DeepSeek-V3',
    })
    expect(row.id).toBeGreaterThan(0)
    expect(row.provider).toBe('siliconflow')
    expect(row.label).toBe('测试 Key')
  })

  it('查询 API Keys', () => {
    const rows = listApiKeys()
    expect(rows.length).toBeGreaterThanOrEqual(1)
  })

  it('按 ID 查询', () => {
    const row = getApiKey(1)
    expect(row).toBeTruthy()
    expect(row!.label).toBe('测试 Key')
  })

  it('更新 API Key', () => {
    const updated = updateApiKey(1, { label: '改名后的 Key', model: 'Pro/deepseek-ai/DeepSeek-V3' })
    expect(updated!.label).toBe('改名后的 Key')
    expect(updated!.model).toContain('DeepSeek-V3')
  })

  it('删除 API Key', () => {
    deleteApiKey(1)
    const row = getApiKey(1)
    expect(row).toBeUndefined()
  })
})

describe('Prompt Templates CRUD', () => {
  it('创建 Prompt 模板', () => {
    const row = createPrompt({
      name: 'anti-hallucination',
      displayName: '防幻觉指令',
      content: '你是解盘者，绝非排盘者。',
      variables: JSON.stringify(['chart.dayMaster', 'chart.birthDate']),
    })
    expect(row.id).toBeGreaterThan(0)
    expect(row.version).toBe(1)
  })

  it('按名称查询激活的模板', () => {
    const row = getPromptByName('anti-hallucination')
    expect(row).toBeTruthy()
    expect(row!.content).toContain('解盘者')
  })

  it('更新 Prompt（版本号不变，手动管理）', () => {
    const updated = updatePrompt(1, {
      content: '你是解盘者，绝非排盘者。（加强版）',
    })
    expect(updated!.content).toContain('加强版')
  })

  it('删除 Prompt', () => {
    deletePrompt(1)
    const rows = listPrompts()
    expect(rows.length).toBe(0)
  })
})

describe('App Configs CRUD', () => {
  it('设置配置项', () => {
    setConfig('test_key', 'test_value', '测试键', '这是一个测试')
    expect(getConfigValue('test_key')).toBe('test_value')
  })

  it('覆盖已有配置', () => {
    setConfig('test_key', 'new_value')
    expect(getConfigValue('test_key')).toBe('new_value')
  })

  it('列出所有配置', () => {
    setConfig('another_key', 'another_value')
    const rows = listConfigs()
    expect(rows.length).toBeGreaterThanOrEqual(2)
  })

  it('删除配置', () => {
    deleteConfig('test_key')
    expect(getConfigValue('test_key')).toBeUndefined()
  })
})

describe('Sessions CRUD', () => {
  it('创建或更新会话', () => {
    const session = upsertSession({
      id: 'test-session-1',
      chart: JSON.stringify({ dayMaster: '甲' }),
      annotation: JSON.stringify({ strengthAnalysis: { strength: '中和' } }),
      messageCount: 1,
    })
    expect(session.id).toBe('test-session-1')
  })

  it('查询会话', () => {
    const session = getSession('test-session-1')
    expect(session).toBeTruthy()
    const chart = JSON.parse(session!.chart)
    expect(chart.dayMaster).toBe('甲')
  })

  it('删除会话', () => {
    deleteSession('test-session-1')
    expect(getSession('test-session-1')).toBeUndefined()
  })
})

describe('Audit Logs', () => {
  it('创建审计日志', () => {
    const row = createAuditLog({
      action: 'create',
      resource: 'api_key',
      resourceId: 1,
      detail: JSON.stringify({ provider: 'siliconflow' }),
    })
    expect(row.id).toBeGreaterThan(0)
  })

  it('查询审计日志', () => {
    const rows = listAuditLogs(10)
    expect(rows.length).toBeGreaterThanOrEqual(1)
    expect(rows[0].action).toBe('create')
  })
})
