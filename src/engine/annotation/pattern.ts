// ============================================================
// 格局判断模块（V2.0 修订版）
// 集成：V2.0取格规则 + 组合判定 + MBTI映射 + 破格风险
// ============================================================

import type { BaZiResult } from '../types'
import {
  determinePattern,
  determineCombination,
  detectPoGeRisks,
  getSchoolPreference,
  PATTERN_JI_XIONG,
  analyzeMBTI,
} from '../pattern'
import type { PatternAnalysis, PatternType } from './types'

/** 十神 → 格局名映射（兼容旧代码） */
const SHISHEN_TO_PATTERN: Record<string, string> = {
  '正官': '正官格', '偏官': '偏官格',
  '正印': '正印格', '偏印': '偏印格',
  '食神': '食神格', '伤官': '伤官格',
  '正财': '正财格', '偏财': '偏财格',
  '比肩': '建禄格', '劫财': '羊刃格',
}

/**
 * 主入口：格局判断
 *
 * V2.0 流程：
 * 1. V2.0 取格规则（四正月/透干/月令分金）
 * 2. 组合判定
 * 3. MBTI 映射
 * 4. 破格风险检测
 * 5. 从格/特殊格局作为备选
 */
export function analyzePattern(
  bazi: BaZiResult,
  dayMasterStrength: string,
): PatternAnalysis {
  // ─── 步骤1：V2.0 取格 ───
  const patternResult = determinePattern(bazi)

  if (!patternResult.found || !patternResult.patternName) {
    // 退路：取月令本气
    const mainQi = bazi.monthPillar.hiddenStems[0] || '?'
    const fallbackShiShen = '比肩'
    const fallbackName = '建禄格'
    return buildEmptyResult(fallbackName, '正格', fallbackShiShen, [])
  }

  const patternName = patternResult.patternName!
  const shiShen = patternResult.shiShen!
  const method = patternResult.method ?? '未知'
  const sourceStem = patternResult.sourceStem ?? '?'
  const conditions = patternResult.conditions ?? []

  // ─── 步骤2：组合判定 ───
  const combination = determineCombination(bazi, patternName, shiShen)

  // ─── 步骤3：格局质量 ───
  let quality: '上等' | '中等' | '平' = '平'
  let description = ''

  if (method === '透干取用') {
    quality = '上等'
    description = `格局${patternName}，月令藏干透出天干，格局清纯层次高。`
  } else if (method === '四正月') {
    quality = '上等'
    description = `格局${patternName}，四正月气最专一，格局明确。`
  } else if (method === '月令分金') {
    quality = '中等'
    description = `格局${patternName}，经月令分金精密推算得出，需大运配合方显。`
  }

  // 根据十神吉凶调整
  const jxInfo = PATTERN_JI_XIONG[patternName]
  if (jxInfo) {
    if (jxInfo.type === '凶') {
      quality = quality === '上等' ? '中等' : '平'
      description += jxInfo.desc
    }
  }

  // 组合对质量的影响
  if (combination.name === '官印相生' || combination.name === '煞印相生') {
    quality = quality === '上等' ? '上等' : '中等'
    description += `组合为${combination.name}，格局更佳。`
  }
  if (combination.isPure && combination.name.includes('纯')) {
    quality = quality === '上等' ? '中等' : '平'
    description += `为${combination.name}，格局稍欠配合。`
  }

  // 置信度
  let confidence = 0.6
  if (method === '透干取用') confidence = 0.9
  else if (method === '四正月') confidence = 0.85
  else if (method === '月令分金') confidence = 0.65
  confidence = Math.round(confidence * 100) / 100

  // ─── 步骤4：破格风险检测 ───
  const poGeRisks = detectPoGeRisks(bazi, patternName, combination)

  // ─── 步骤5：MBTI 分析 ───
  const mbtiAnalysis = analyzeMBTI(shiShen, combination, poGeRisks)

  // ─── 步骤6：经典引证 ───
  const classicRefs: string[] = []
  if (method === '透干取用') {
    classicRefs.push('《子平真诠》：「八字用神，专求月令」')
    classicRefs.push('《渊海子平》：「月令为提纲，四柱之至尊」')
  }
  if (method === '月令分金') {
    classicRefs.push('《渊海子平》：「阴阳顺逆，分金定位」')
  }
  if (patternName === '建禄格' || patternName === '羊刃格') {
    classicRefs.push('《渊海子平》：「建禄者，月建逢禄堂也」')
  }

  // ─── 步骤7：备选格局 ───
  const alternatives: { name: string; reason: string }[] = []

  // 月令不透时，提供透干方案作为备选
  if (method === '月令分金' && patternResult.method === '月令分金') {
    const hiddenStems = bazi.monthPillar.hiddenStems
    const allStems = [
      bazi.yearPillar.stem, bazi.monthPillar.stem, bazi.hourPillar.stem,
    ]
    for (const hs of hiddenStems) {
      if (allStems.includes(hs)) {
        // 这种情况理论上不应该出现(因为不透干才走分金)
        // 但如果有，作为备选
        const altName = SHISHEN_TO_PATTERN[shiShen] ?? shiShen + '格'
        if (altName !== patternName) {
          alternatives.push({ name: altName, reason: `月令藏干${hs}也透出，亦可取${altName}` })
        }
      }
    }
  }

  // 从格作为备选
  const isSuperWeak = dayMasterStrength === '极弱'
  if (isSuperWeak) {
    alternatives.push({ name: '从格', reason: '日主极弱无根，有从格倾向' })
  }

  // ─── 构建MBTI信息 ───
  const mbtiInfo = {
    cognitiveFunctions: mbtiAnalysis.cognitiveDescription,
    typicalTypes: mbtiAnalysis.recommendedTypes,
    traits: mbtiAnalysis.combinationProfile?.traits ?? '',
    portrait: mbtiAnalysis.combinationProfile?.portrait ?? '',
    industrySuggestions: mbtiAnalysis.industrySuggestions.slice(0, 3).map(
      m => `${m.combination}：${m.industries.join('、')}（${m.mbtiAdvantage}）`
    ),
    energyAdjustments: mbtiAnalysis.energyAdjustments.map(
      a => `${a.initialState} → ${a.mbtiDirection}：${a.practicalMethods.join('、')}`
    ),
  }

  // ─── 最终输出 ───
  const jiXiongType = (jxInfo?.type ?? '中性') as '吉' | '凶' | '中性'

  return {
    patternType: '正格',
    patternName,
    confidence,
    conditions,
    quality,
    description,
    alternatives,
    classicReference: classicRefs,

    // V2.0 新增
    method: `${method}（${getSchoolPreference(method)}）`,
    sourceStem,
    shiShen,
    jiXiong: jiXiongType,
    jiXiongDesc: jxInfo?.desc ?? '',
    combination,
    poGeRisks,
    mbti: mbtiInfo,
    fenJinDetail: patternResult.fenJinDetail,
  }
}

/** 构建空白结果（错误退路） */
function buildEmptyResult(
  fallbackName: string,
  fallbackType: PatternType,
  fallbackShiShen: string,
  fallbackConditions: string[],
): PatternAnalysis {
  return {
    patternType: fallbackType,
    patternName: fallbackName,
    confidence: 0.3,
    conditions: fallbackConditions,
    quality: '平',
    description: '格局计算异常，使用默认格局，请人工复核。',
    alternatives: [],
    classicReference: [],
    method: '异常退路',
    sourceStem: '?',
    shiShen: fallbackShiShen,
    jiXiong: '中性',
    jiXiongDesc: '',
    combination: { name: fallbackName, dominantPattern: fallbackName, keyCombination: '', keyStem: '', keyPosition: '', isPure: true },
    poGeRisks: [],
    mbti: { cognitiveFunctions: '', typicalTypes: [], traits: '', portrait: '', industrySuggestions: [], energyAdjustments: [] },
  }
}
