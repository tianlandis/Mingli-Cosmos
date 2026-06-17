// ============================================================
// 护栏正则测试 — guardrail.test.ts
// 文件：src/server/workflows/__tests__/guardrail.test.ts
// ============================================================
import { describe, it, expect } from 'vitest'
import { validateResponse } from '@/server/lib/guardrail'

// ─── ADVICE_PATTERNS: /(你应该|建议你|去买|去查|服用|投资|买入|卖出)/g
// ─── FORBIDDEN_TERMS: /(癌症|肿瘤|手术|自杀|毒品|违法)/g
// ─── MEDICAL_SHADOW:   /(处方|药品|剂量|治疗|诊断)/g

describe('validateResponse — 建议句式 + 敏感词检测', () => {
  // ─── 正常命理讨论不触发 ───
  it('✅ 正常命理讨论（无建议句式）', () => {
    const r = validateResponse('木主肝胆，土弱可能有消化问题。以上分析仅供参考。')
    expect(r.passed).toBe(true)
    expect(r.reason).toBeUndefined()
  })

  it('✅ 正常建议句式 + 无禁止词', () => {
    const r = validateResponse('你应该多注意休息，保养身体。以上分析仅供参考。')
    expect(r.passed).toBe(true)
  })

  // ─── forbidden_advice — FORBIDDEN_TERMS 组合 ───
  it('❌ 建议句式 + 禁止词（癌症）→ forbidden_advice', () => {
    const r = validateResponse('建议你去查一下癌症指标。仅供参考。')
    expect(r.passed).toBe(false)
    expect(r.reason).toBe('forbidden_advice')
  })

  it('❌ 建议句式 + 禁止词（违法）→ forbidden_advice', () => {
    const r = validateResponse('你应该试试这个违法操作。仅供参考。')
    expect(r.passed).toBe(false)
    expect(r.reason).toBe('forbidden_advice')
  })

  // ─── medical_advice — MEDICAL_SHADOW 组合 ───
  it('❌ 建议句式 + 医疗词（治疗）→ medical_advice', () => {
    const r = validateResponse('我建议你去接受XX治疗。以上分析仅供参考。')
    expect(r.passed).toBe(false)
    expect(r.reason).toBe('medical_advice')
  })

  it('❌ 建议句式 + 医疗词（处方）→ medical_advice', () => {
    const r = validateResponse('我建议你服用XX处方来改善。仅供参考。')
    expect(r.passed).toBe(false)
    expect(r.reason).toBe('medical_advice')
  })

  // ─── missing_disclaimer ───
  it('⚠️ 正常内容无免责声明 → missing_disclaimer（自动补上）', () => {
    const r = validateResponse('您的命局中木旺火相，性格温和而坚定。')
    expect(r.passed).toBe(false)
    expect(r.reason).toBe('missing_disclaimer')
    expect(r.sanitized).toContain('以上分析仅供参考')
    expect(r.sanitized).toContain('您的命局中木旺火相，性格温和而坚定。')
  })

  // ─── 绝对化断言 ───
  it('⚡ 绝对化断言：警告但放行', () => {
    const r = validateResponse('你一定会发财的，五行调和必然带来好运。以上分析仅供参考。')
    expect(r.passed).toBe(true)
  })

  // ─── 长文本 ───
  it('📏 超长文本：警告但放行', () => {
    const base = '以上分析仅供参考。'
    const longContent = base + '命理分析内容。'.repeat(250)
    const r = validateResponse(longContent)
    expect(r.passed).toBe(true)
  })

  // ─── Edge cases ───
  it('空字符串 → missing_disclaimer', () => {
    const r = validateResponse('')
    expect(r.passed).toBe(false)
    expect(r.reason).toBe('missing_disclaimer')
  })

  it('仅有免责声明', () => {
    const r = validateResponse('以上分析仅供参考，祝您生活愉快。')
    expect(r.passed).toBe(true)
  })

  it('禁止词 + 无建议句式 → 放行', () => {
    expect(validateResponse('火为忌神，仅供参考。').passed).toBe(true)
  })
})
