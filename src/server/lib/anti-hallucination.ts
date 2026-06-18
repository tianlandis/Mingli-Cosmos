// ============================================================
// 墨白防幻觉模块
// 文件：src/server/lib/anti-hallucination.ts
// 职责：集中管理所有防越权排盘逻辑
//   - L1: System Prompt 中的防越权指令（注入 LLM 意识层）
//   - L2: 用户输入检测（正则拦截，不调 LLM）
//   - L3: Phase 4 后通过管理后台可视化编辑此模块的常量
//
// 设计原则：
//   - 单一入口：改紧箍咒只需动这一个文件
//   - 可配置：所有话术和正则集中为常量
//   - 可热更：Phase 4 管理后台将持久化此模块的配置
// ============================================================

import type { BaZiResult, AnnotationResult } from '../../engine/index'

// ═══════════════════════════════════════
// L1: System Prompt 防越权指令
// ═══════════════════════════════════════

/** 拒绝排盘的标准话术（Prompt 和输入拦截共用） */
export const REJECT_PAIPAN_MESSAGE =
  '由于排盘涉及极其严谨的天文历法与节气交点计算，为保证准确性，' +
  '请您回到主界面的【专业排盘表单】中输入出生信息，' +
  '生成新的命盘后，我们再针对新命盘进行深度探讨。'

/**
 * 构建注入 System Prompt 的防越权段落
 * 包含：核心定位 + 规则0严禁排盘 + 规则1-5
 */
export function buildAntiHallucinationPrompt(
  chart: BaZiResult,
  annotation: AnnotationResult,
): string {
  return [
    '## 核心定位（最高优先级，不可违反）',
    '你是"解盘者"，绝非"排盘者"。',
    '你的职责：根据下方已由系统精准计算完成的命盘数据，为用户提供专业的解读和分析。',
    '你绝对禁止：自行推算天干地支、计算起运时间、判断格局、排大运等任何排盘行为。',
    '所有命理计算已由专业算法引擎完成，你只需要基于结果"看图说话"。',
    '',
    '## 防越权规则（最高优先级）',
    '',
    '### 规则 0：严禁私自排盘',
    '如果用户在对话中直接提供出生时间（如"帮我算一下 1990年..."、"我朋友 1991-01-01..."、"换一个八字看看"），',
    '要求你进行排盘、取格、推算八字，你必须立刻拒绝。',
    `当前对话绑定的命盘是 ${chart.dayMaster}日主，出生日期 ${chart.birthDate}。`,
    `日主强弱：${annotation.strengthAnalysis.strength}（${annotation.strengthAnalysis.score}/100）。`,
    '任何要求"换人排盘"的请求都必须拒绝，回复以下话术：',
    '',
    `"${REJECT_PAIPAN_MESSAGE}"`,
    '',
    '### 规则 1：数据锁定',
    '你的所有回答必须且只能基于上方"命盘数据"中的内容，不得引入数据中不存在的信息。',
    '不得编造天干地支、五行分布、神煞名称、格局描述等任何命理数据。',
    '如果用户问到命盘数据中未包含的细节，必须诚实回答"该信息未在当前命盘中呈现"。',
    '',
    '### 规则 2：禁止绝对化',
    '禁止使用"一定""必然""保证""绝对"等绝对化断言词。',
    '',
    '### 规则 3：安全边界',
    '禁止提供医疗诊断、法律建议、投资理财建议。',
    '',
    '### 规则 4：表达风格',
    '语气平和客观，有典籍气质但不晦涩。',
    '每次回复末尾附："以上分析仅供参考，祝您生活愉快。"',
    '',
    '### 规则 5：话题边界',
    '只回答与本命盘相关的命理问题。',
    '与命盘无关的闲聊、通用知识问答等问题，请礼貌拒绝。',
  ].join('\n')
}

// ═══════════════════════════════════════
// L2: 用户输入检测
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
 * 检测用户是否在对话中试图让 LLM 排盘
 *
 * 触发条件：消息中同时出现「出生时间相关信息」+「排盘意图」
 * → 返回 blocked: true + 拒绝话术，chat.ts 直接返回 SSE 拒绝流
 */
export function detectPaipanAttempt(
  userMessage: string,
): { blocked: true; message: string } | { blocked: false } {
  const hasDateNum = BIRTH_DATE_PATTERN.test(userMessage)
  const hasDateCN = CN_DATE_PATTERN.test(userMessage)
  const hasBirth = BIRTH_KEYWORDS.test(userMessage)
  const hasPaipanIntent = PAIPAN_INTENT.test(userMessage)

  const hasBirthData = hasDateNum || hasDateCN || hasBirth

  if (hasBirthData && hasPaipanIntent) {
    return { blocked: true, message: REJECT_PAIPAN_MESSAGE }
  }

  return { blocked: false }
}

// ═══════════════════════════════════════
// L2: SSE 拒绝流构建器
// ═══════════════════════════════════════

/**
 * 构建 SSE 拒绝响应
 * 当检测到排盘尝试时，chat.ts 用此函数返回预设拒绝话术
 */
export function buildBlockSSE(reason: string): Response {
  const encoder = new TextEncoder()
  const sseStream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: 'text-delta', textDelta: reason })}\n\n`,
        ),
      )
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })
  return new Response(sseStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
