// ============================================================
// Phase 4e — MBTI 表达锚点解析器测试
// 文件：src/server/workflows/__tests__/mbti-expression.test.ts
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import {
  resolveIdentity,
  resolveMbtiExpression,
  buildMbtiAnchorBlock,
} from '../mbti-expression'
import { KnowledgeRegistry } from '../../../engine/knowledge-registry'
import { MBTI_CORE32_PROFILES } from '../../knowledge/mbti-expression-corpus'

/** 构造最小批注结果（仅含解析器所需字段） */
function makeAnnotation(opts: {
  typicalTypes?: string[]
  strength?: string
  score?: number
}): Parameters<typeof resolveMbtiExpression>[0] {
  return {
    patternAnalysis: {
      mbti: {
        typicalTypes: opts.typicalTypes ?? [],
        cognitiveFunctions: '',
        traits: '',
        portrait: '',
        industrySuggestions: [],
        energyAdjustments: [],
      },
    },
    strengthAnalysis: {
      strength: (opts.strength ?? '中和') as never,
      score: opts.score ?? 50,
    },
  } as never
}

describe('Phase 4e — resolveIdentity（日主强弱 → A/T）', () => {
  it('强侧 → A', () => {
    expect(resolveIdentity('极强', 90)).toBe('A')
    expect(resolveIdentity('强', 75)).toBe('A')
    expect(resolveIdentity('中和偏强', 55)).toBe('A')
  })

  it('弱侧 → T', () => {
    expect(resolveIdentity('中和偏弱', 45)).toBe('T')
    expect(resolveIdentity('弱', 30)).toBe('T')
    expect(resolveIdentity('极弱', 10)).toBe('T')
  })

  it('中和按 score 分界（>=50 → A，否则 T）', () => {
    expect(resolveIdentity('中和', 50)).toBe('A')
    expect(resolveIdentity('中和', 49)).toBe('T')
  })
})

describe('Phase 4e — resolveMbtiExpression（锚点解析）', () => {
  beforeEach(() => {
    KnowledgeRegistry.reset()
  })

  it('注册表为空时使用编译时兜底：身强 INTJ → INTJ-A', () => {
    const expr = resolveMbtiExpression(
      makeAnnotation({ typicalTypes: ['INTJ', 'INFJ'], strength: '强', score: 80 }),
    )
    expect(expr).not.toBeNull()
    expect(expr!.id).toBe('INTJ-A')
    expect(expr!.identity).toBe('A')
    expect(expr!.cnName).toBe('建筑师')
    expect(expr!.profile.length).toBeGreaterThan(10)
    expect(expr!.innerNeed.length).toBeGreaterThan(0)
    expect(expr!.careTip.length).toBeGreaterThan(0)
  })

  it('身弱 → -T 档案', () => {
    const expr = resolveMbtiExpression(
      makeAnnotation({ typicalTypes: ['INFP'], strength: '弱', score: 25 }),
    )
    expect(expr!.id).toBe('INFP-T')
    expect(expr!.identity).toBe('T')
  })

  it('无典型类型 → 返回 null（降级）', () => {
    expect(resolveMbtiExpression(makeAnnotation({ typicalTypes: [] }))).toBeNull()
  })

  it('非法类型字母 → 返回 null（降级）', () => {
    expect(
      resolveMbtiExpression(makeAnnotation({ typicalTypes: ['XXXX', 'INVALID'] })),
    ).toBeNull()
  })

  it('字典未命中（如非 16 标准类型的边界输入）→ 返回 null', () => {
    expect(
      resolveMbtiExpression(makeAnnotation({ typicalTypes: ['ENTJ'], strength: '极弱', score: 5 })),
    ).not.toBeNull() // ENTJ-T 存在
  })

  it('知识字典热覆盖：注册表有值时优用字典', () => {
    KnowledgeRegistry.init([
      {
        category: 'personality',
        key: 'mbti_core32_profiles',
        version: 1,
        value: {
          'ENTJ-A': {
            cnName: '指挥官',
            group: '分析家',
            baziArchetype: '测试',
            profile: '字典版画像',
            innerNeed: '字典版需要',
            careTip: '字典版建议',
          },
        },
      },
    ])
    const expr = resolveMbtiExpression(
      makeAnnotation({ typicalTypes: ['ENTJ'], strength: '强', score: 85 }),
    )
    expect(expr!.profile).toBe('字典版画像')
  })

  it('兜底数据完整性：32 份档案 key 合法且字段齐全', () => {
    const ids = Object.keys(MBTI_CORE32_PROFILES)
    expect(ids.length).toBe(32)
    for (const id of ids) {
      expect(id).toMatch(/^[EINF][NS][TF][JP]-(A|T)$/)
      const p = MBTI_CORE32_PROFILES[id]
      expect(p.profile.length).toBeGreaterThan(10)
      expect(p.innerNeed.length).toBeGreaterThan(0)
      expect(p.careTip.length).toBeGreaterThan(0)
    }
  })
})

describe('Phase 4e — buildMbtiAnchorBlock（锚点块构建）', () => {
  it('包含类型 ID、画像、需要、建议与护栏标注', () => {
    const expr = resolveMbtiExpression(
      makeAnnotation({ typicalTypes: ['ISTP'], strength: '强', score: 70 }),
    )!
    const block = buildMbtiAnchorBlock(expr)
    expect(block).toContain('ISTP-A')
    expect(block).toContain(expr.profile)
    expect(block).toContain(expr.innerNeed)
    expect(block).toContain(expr.careTip)
    expect(block).toContain('不得据此新增命理结论')
  })
})
