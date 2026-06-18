// ============================================================
// 护栏 & 安全设计（精确版）
// 文件：src/server/lib/guardrail.ts
// 职责：
//   - 输入校验：检测排盘请求，拒绝大模型越权计算
//   - 输出校验：敏感词/医疗建议/免责声明
// ============================================================

import type { GuardResult } from './types'

// ═══════════════════════════════════════
// 输入护栏：检测用户是否试图让 LLM 排盘
// ═══════════════════════════════════════

/** 出生日期模式：1990-01-01、1990年1月1日 等 */
const BIRTH_DATE_PATTERN = /\d{4}\s*[年\-\/\.]\s*\d{1,2}\s*[月\-\/\.]?\s*\d{0,2}/
/** 中文日期：1990年、农历、正月、子时等 */
const CN_DATE_PATTERN = /(\d{4}年|农历|阴历|公历|阳历|[一二三四五六七八九十廿卅]+月|[子丑寅卯辰巳午未申酉戌亥]时|时辰)/
/** 出生/八字关键词 */
const BIRTH_KEYWORDS = /(出生|生日|八字|排盘|算命|批命)/

/** 排盘意图关键词 */
const PAIPAN_INTENT = /(帮我算|给我算|算一下|排一下|批一下|排盘|算命|批命|帮我排|我的八字|他的八字|她的八字)/

/**
 * 输入护栏：检测用户是否在对话中要求排盘
 * @returns null 表示安全，字符串表示拒绝原因
 */
export function guardInput(
  lastUserMessage: string,
): { blocked: true; message: string } | { blocked: false } {
  const hasDateNum = BIRTH_DATE_PATTERN.test(lastUserMessage)
  const hasDateCN = CN_DATE_PATTERN.test(lastUserMessage)
  const hasBirth = BIRTH_KEYWORDS.test(lastUserMessage)
  const hasPaipanIntent = PAIPAN_INTENT.test(lastUserMessage)

  const hasBirthData = hasDateNum || hasDateCN || hasBirth

  if (hasBirthData && hasPaipanIntent) {
    return {
      blocked: true,
      message: '由于排盘涉及极其严谨的天文历法与节气交点计算，为保证准确性，' +
        '请您回到主界面的【专业排盘表单】中输入出生信息，' +
        '生成新的命盘后，我们再针对新命盘进行深度探讨。',
    }
  }
  return { blocked: false }
}

// ═══════════════════════════════════════
// 输出护栏
// ═══════════════════════════════════════

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
