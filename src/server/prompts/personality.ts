// ============================================================
// Step 1 Prompt Builder — 性格与格局总评
// ============================================================

import type { AnnotationResult } from '../../engine/index'

const SYSTEM = `你是八字命理分析师。基于给定的结构化数据撰写分析，不得编造数据之外的内容。
风格：平和客观，有典籍气质，不使用绝对化断言。

输出格式：严格只输出一个 JSON 对象，不要有任何其他文字。
{"overview": "格局解释与总评（~250字）", "mbtiProfile": "人格画像与MBTI映射（~150字）"}`

/**
 * 构建 Step 1（性格与格局总评）的 LLM 消息
 */
export function buildPersonalityPrompt(annotation: AnnotationResult): { system: string; prompt: string } {
  const { patternAnalysis, shiShenProfile, strengthAnalysis } = annotation

  // 十神列表
  const tenGodList = shiShenProfile
    .filter(p => p.count > 0)
    .map(p => `${p.name}(${p.count})`)
    .join('、')

  // MBTI 信息
  const mbtiInfo = patternAnalysis.mbti
    ? `MBTI映射：${patternAnalysis.mbti.typicalTypes?.join('/') ?? '暂无'}，特质：${patternAnalysis.mbti.portrait ?? '暂无'}`
    : ''

  const prompt = `请分析以下命盘数据：

格局类型：${patternAnalysis.patternType}「${patternAnalysis.patternName}」
格局品级：${patternAnalysis.quality}
格局描述：${patternAnalysis.description}
格局组合：${patternAnalysis.combination.name}（主格：${patternAnalysis.combination.dominantPattern}）
成格条件：${patternAnalysis.conditions.join('；')}
吉凶属性：${patternAnalysis.jiXiong}，${patternAnalysis.jiXiongDesc}

日主：${annotation.overview.dayMaster}
日主强弱：${strengthAnalysis.strength}（${strengthAnalysis.score}/100分）
判断依据：${strengthAnalysis.reasons.join('；')}

十神分布：${tenGodList}
${mbtiInfo}

要求：
1. 先解释格局名称的来源和含义
2. 结合十神分布描述性格特质
3. 如 MBTI 映射可用，自然融入人格画像
4. 字数控制在 overview ~250字、mbtiProfile ~150字
5. 结尾附"以上分析仅供参考"`

  return { system: SYSTEM, prompt }
}
