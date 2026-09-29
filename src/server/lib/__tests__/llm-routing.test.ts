// ============================================================
// LLM 模型分级 + 降级 + 刹车 —— 回归测试
// 文件：src/server/lib/__tests__/llm-routing.test.ts
//
// 锁定四条不变量：
//   1. 分级：fast / deep 各自取到 role 专属供应商；未配置时回落全局默认
//   2. 降级：候选链按 role 专属 → 全局默认排列，同端点自动去重
//   3. 思考型模型识别：r1 / qwq / reasoner 命中，普通模型不误伤
//   4. 自言自语截断：命中角色标签即从该处切断，正常行文不误伤
//
// 全程不触碰真实 LLM（只构造模型实例，不发起生成请求）。
// ============================================================

process.env.DB_PATH = ':memory:'

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { initDb, closeDb } from '@/server/db'
import { createApiKey, getApiKeyByRole } from '@/server/db/repositories/api-keys'
import { reloadConfig } from '@/server/config'
import {
  isThinkingModel,
  resolveRoutes,
  pickAvailableRoute,
  loadConfig,
  findSelfTalkIndex,
  truncateSelfTalk,
} from '@/server/lib/llm'

// ── 测试夹具 ────────────────────────────────────────────────
const LOCAL_FAST = {
  provider: 'local',
  label: '本机 ollama qwen2.5:7b',
  apiKey: 'ollama',
  baseUrl: 'http://127.0.0.1:11434/v1',
  model: 'qwen2.5:7b',
  isActive: 1,
  isDefault: 0,
  role: 'fast',
}

const CLOUD_DEEP = {
  provider: 'deepseek',
  label: '云端 DeepSeek-V3',
  apiKey: 'sk-test-deep',
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  isActive: 1,
  isDefault: 0,
  role: 'deep',
}

const GLOBAL_DEFAULT = {
  provider: 'siliconflow',
  label: '全局默认 SiliconFlow',
  apiKey: 'sk-test-sf',
  baseUrl: 'https://api.siliconflow.cn/v1',
  model: 'Qwen/Qwen3.5-122B-A10B',
  isActive: 1,
  isDefault: 1,
}

beforeAll(() => {
  initDb()
})

afterAll(() => {
  closeDb()
})

beforeEach(() => {
  // 清掉 60s 配置缓存，保证每次都重新读 DB
  reloadConfig()
})

// ════════════════════════════════════════════════════════════
// 1. 仓储层：按 role 查询供应商
// ════════════════════════════════════════════════════════════

describe('[仓储] getApiKeyByRole', () => {
  it('能按 role 取到专属供应商，且不匹配全局默认', () => {
    createApiKey({ ...LOCAL_FAST, label: 'fast-A' })
    createApiKey({ ...CLOUD_DEEP, label: 'deep-A' })
    createApiKey({ ...GLOBAL_DEFAULT, label: 'default-A' })

    const fast = getApiKeyByRole('fast')
    const deep = getApiKeyByRole('deep')

    expect(fast?.model).toBe('qwen2.5:7b')
    expect(fast?.role).toBe('fast')
    expect(deep?.provider).toBe('deepseek')

    // 全局默认没有 role，不应被 role 查询命中
    expect(fast?.label).not.toBe('default-A')
  })

  it('未配置的 role 返回 undefined（由上层回落全局默认）', () => {
    const none = getApiKeyByRole('nonexistent-role')
    expect(none).toBeUndefined()
  })

  it('role 匹配但被下线（isActive=0）的供应商不参与分级', () => {
    createApiKey({ ...LOCAL_FAST, label: 'fast-offline', isActive: 0, model: 'offline-model' })
    const fast = getApiKeyByRole('fast')
    expect(fast?.model).not.toBe('offline-model')
  })
})

// ════════════════════════════════════════════════════════════
// 2. 配置层：loadConfig(role) 分级与回落
// ════════════════════════════════════════════════════════════

describe('[分级] loadConfig(role)', () => {
  it('fast 角色取到本地快模型', () => {
    const cfg = loadConfig('fast')
    expect(cfg.provider).toBe('local')
    expect(cfg.model).toBe('qwen2.5:7b')
    expect(cfg.baseUrl).toBe('http://127.0.0.1:11434/v1')
  })

  it('deep 角色取到云端强模型', () => {
    const cfg = loadConfig('deep')
    expect(cfg.provider).toBe('deepseek')
    expect(cfg.model).toBe('deepseek-chat')
  })

  it('未配置时回落全局默认（siliconflow），行为与不传 role 一致', () => {
    const fallback = loadConfig('nonexistent-role' as 'fast')
    expect(fallback.provider).toBe('siliconflow')
    expect(fallback.model).toBe('Qwen/Qwen3.5-122B-A10B')
  })
})

// ════════════════════════════════════════════════════════════
// 3. 候选链：构建与去重
// ════════════════════════════════════════════════════════════

describe('[降级] resolveRoutes', () => {
  it('role 专属 + 全局默认 → 两条候选，专属在前', () => {
    const routes = resolveRoutes('fast')
    expect(routes.length).toBe(2)
    expect(routes[0].role).toBe('fast')
    expect(routes[0].config.model).toBe('qwen2.5:7b')
    expect(routes[1].config.provider).toBe('siliconflow') // 兜底
    expect(routes[1].role).toBeUndefined()
  })

  it('不传 role → 只有一条候选（全局默认）', () => {
    const routes = resolveRoutes()
    expect(routes.length).toBe(1)
  })

  it('role 专属就是全局默认时自动去重，避免重复探测', () => {
    // 把 fast 指向与全局默认完全相同的端点 + 模型
    createApiKey({
      ...GLOBAL_DEFAULT,
      label: 'fast-same-as-default',
      isDefault: 0,
      role: 'fast',
      sortOrder: 999, // 排序最高，确保被 getApiKeyByRole 选中
    })
    reloadConfig()

    const routes = resolveRoutes('fast')
    expect(routes.length).toBe(1)
    expect(routes[0].config.baseUrl).toBe('https://api.siliconflow.cn/v1')
  })

  it('每个候选都带可用的模型实例', () => {
    const routes = resolveRoutes('deep')
    for (const r of routes) {
      expect(r.model).toBeTruthy()
      expect(typeof r.model).toBe('object')
    }
  })
})

// ════════════════════════════════════════════════════════════
// 4. 可达性探测：全部不可达时保留首选（不掩盖原始错误）
// ════════════════════════════════════════════════════════════

describe('[降级] pickAvailableRoute', () => {
  it('单候选直接返回，不做探测', async () => {
    const routes = resolveRoutes()
    const picked = await pickAvailableRoute(routes)
    expect(picked).toBe(routes[0])
  })

  it('所有候选都不可达时返回首选（错误原样暴露，便于排障）', async () => {
    const unreachable = [
      {
        role: 'fast' as const,
        config: {
          provider: 'local' as const,
          apiKey: 'x',
          baseUrl: 'http://127.0.0.1:1/v1', // 必然 refused
          model: 'dead-model',
        },
        model: {} as never,
      },
      {
        config: {
          provider: 'openai' as const,
          apiKey: 'x',
          baseUrl: 'http://127.0.0.1:2/v1',
          model: 'dead-model-2',
        },
        model: {} as never,
      },
    ]
    const picked = await pickAvailableRoute(unreachable)
    expect(picked).toBe(unreachable[0])
  }, 15_000)
})

// ════════════════════════════════════════════════════════════
// 5. 思考型模型识别（reasoning_content 适配的前置判定）
// ════════════════════════════════════════════════════════════

describe('[适配] isThinkingModel', () => {
  it.each([
    ['deepseek-r1:7b', true],
    ['deepseek-r1', true],
    ['qwq:32b', true],
    ['deepseek-reasoner', true],
    ['some-thinking-model', true],
  ])('识别思考型模型：%s', (model, expected) => {
    expect(isThinkingModel(model)).toBe(expected)
  })

  it.each([
    ['qwen2.5:7b', false],
    ['qwen3:latest', false],
    ['gemma2:latest', false],
    ['qwen3_coder_8b_cot_un', false],
    ['deepseek-chat', false],
  ])('普通模型不误伤：%s', (model, expected) => {
    expect(isThinkingModel(model)).toBe(expected)
  })

  it('空值安全，不抛异常', () => {
    expect(isThinkingModel(undefined)).toBe(false)
    expect(isThinkingModel('')).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════
// 6. 自言自语刹车（结果级兜底）
// ════════════════════════════════════════════════════════════

describe('[刹车] 自言自语截断', () => {
  it('干净文本原样返回，trimmed=false', () => {
    const src = '你出生在1990年，日主庚金偏强。祝你生活愉快。'
    const { text, trimmed } = truncateSelfTalk(src)
    expect(trimmed).toBe(false)
    expect(text).toBe(src)
    expect(findSelfTalkIndex(src)).toBe(-1)
  })

  it('命中英文角色标签即从该处截断', () => {
    const src = '第一句回答。\nHuman: 我想知道我的格局'
    const idx = findSelfTalkIndex(src)
    expect(idx).toBeGreaterThan(0)
    const { text, trimmed } = truncateSelfTalk(src)
    expect(trimmed).toBe(true)
    expect(text).toBe('第一句回答。')
    expect(text).not.toContain('Human')
  })

  it('命中中文角色标签（全角冒号）同样截断', () => {
    const src = '好的，以下是分析。\n用户：那我的财运呢？'
    const { text, trimmed } = truncateSelfTalk(src)
    expect(trimmed).toBe(true)
    expect(text).toBe('好的，以下是分析。')
  })

  it('正常行文提到 AI/助手不误伤', () => {
    const src = '这个结论来自规则引擎，AI助手只是润色表达。'
    expect(findSelfTalkIndex(src)).toBe(-1)
    const { trimmed } = truncateSelfTalk(src)
    expect(trimmed).toBe(false)
  })

  it('幂等：已截断的文本再次截断结果不变', () => {
    const once = truncateSelfTalk('回答内容。\nAssistant: 再来一轮')
    const twice = truncateSelfTalk(once.text)
    expect(twice.trimmed).toBe(false)
    expect(twice.text).toBe(once.text)
  })
})
