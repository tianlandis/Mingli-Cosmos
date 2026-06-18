// ============================================================
// 护栏 & 安全设计
// 文件：src/server/lib/guardrail.ts
// 职责：输出校验 — 敏感词/医疗建议/免责声明
// 注意：输入护栏（防排盘请求）已迁移至 anti-hallucination.ts
// ============================================================

import type { GuardResult } from './types'

/** 建议句式模式：只有这些句式出现时才触发敏感词检测 */
const ADVICE_PATTERNS = /(你应该|建议你|去买|去查|服用|投资|买入|卖出)/

/** 禁止词：出现在建议句式中时拦截 */
const FORBIDDEN_TERMS = /(癌症|肿瘤|手术|自杀|毒品|违法)/

/** 医疗术语影子词：出现在建议句式中时拦截（避免提供医疗建议） */
const MEDICAL_SHADOW = /(处方|药品|剂量|治疗|诊断)/

/** 绝对化断言词 */
const ABSOLUTE_TERMS = /(一定|必然|保证|绝对会)/

/** 免责声明关键词 */
const DISCLAIMER_KEYWORD = '仅供参考'

/** 最大合理字数（超过则警告） */
const MAX_LENGTH = 2000

/**
 * 校验 LLM 输出
 *
 * 设计原则：
 * - 只在建议句式中检测敏感词（避免误杀正常命理讨论）
 * - "木主肝胆，土弱可能有消化问题" 不算医疗建议（不在建议句式中）
 * - 免责声明缺失时自动补全，而非拒绝
 */
export function validateResponse(text: string): GuardResult {
  // 1. 建议句式 + 禁止词 → 拦截
  const hasAdvice = ADVICE_PATTERNS.test(text)
  if (hasAdvice) {
    if (FORBIDDEN_TERMS.test(text)) {
      return { passed: false, reason: 'forbidden_advice' }
    }
    if (MEDICAL_SHADOW.test(text)) {
      return { passed: false, reason: 'medical_advice' }
    }
  }

  // 2. 绝对化断言 → 警告日志（不拦截，由 Prompt 层约束为主）
  if (ABSOLUTE_TERMS.test(text)) {
    console.warn('[Guardrail] absolute_terms detected in response')
  }

  // 3. 免责声明检查 → 自动补全
  if (!text.includes(DISCLAIMER_KEYWORD)) {
    return {
      passed: false,
      reason: 'missing_disclaimer',
      sanitized: text + '\n\n*以上分析仅供参考，祝您生活愉快。*',
    }
  }

  // 4. 长度异常 → 警告日志 + 放行
  if (text.length > MAX_LENGTH) {
    console.warn('[Guardrail] long_response:', text.length, 'chars')
  }

  return { passed: true }
}
