// ============================================================
// Step 2 Prompt Builder — 近三年运势趋势
// ============================================================

import type { AnnotationResult } from '../../engine/index'

const SYSTEM = `你是八字命理分析师。基于给定的结构化数据撰写运势分析，不得编造数据之外的内容。
风格：命理术语 + 白话解释结合，易懂不失专业，不使用绝对化断言。

输出格式：严格只输出一个 JSON 对象，不要有任何其他文字。
{"trend": "近三年运势趋势分析（~200字）", "highlights": "重点关注年份与事项（~100字）"}`

/**
 * 构建 Step 2（运势趋势）的 LLM 消息
 */
export function buildLuckPrompt(
  annotation: AnnotationResult,
  personalitySummary: string,
): { system: string; prompt: string } {
  const { luckAnalysis, overview } = annotation
  const { daYunList, currentYear, milestones } = luckAnalysis

  // 当前大运
  const currentDaYun = daYunList.find(d => d.quality !== undefined) ?? daYunList[0]
  const daYunInfo = currentDaYun
    ? `${currentDaYun.ganZhi}（${currentDaYun.startAge}-${currentDaYun.endAge}岁）— 运势${currentDaYun.quality}：${currentDaYun.interpretation}`
    : '暂未起运'

  // 当前流年
  const yearInfo = `当前流年：${currentYear.ganZhi}，解读：${currentYear.interpretation}，关注：${currentYear.focus.join('、')}`

  // 近三年（取 daYunList 里当年的解读 + flow 年）
  const nextYears = daYunList.slice(0, 3).map(d =>
    `${d.ganZhi}（${d.startAge}-${d.endAge}岁）— ${d.quality}：${d.interpretation}`,
  )

  // 人生节点
  const milestoneText = milestones.length > 0
    ? milestones.map(m => `${m.age}岁(${m.year}年) ${m.event}：${m.reason}`).join('；')
    : '暂无'

  const prompt = `请分析以下命盘数据：

命局背景：${personalitySummary}
日主：${overview.dayMaster}（${overview.strength}）

当前大运：${daYunInfo}
${yearInfo}

近三年运势：
${nextYears.map((y, i) => `  ${i + 1}. ${y}`).join('\n')}

人生关键节点：
${milestoneText}

要求：
1. 结合命局强弱，分析当前大运对命主的总体影响
2. 点出未来三年中值得关注的年份（好坏都提）
3. 语言风格：命理术语 + 白话解释，易懂不失专业
4. 字数控制在 trend ~200字、highlights ~100字`

  return { system: SYSTEM, prompt }
}
