// ============================================================
// 八字格局引擎 — 统一导出
// ============================================================

export { determinePattern, determineCombination, detectPoGeRisks, getSchoolPreference } from './patternRules'
export type { PatternResult, PatternCombination, PoGeRisk } from './patternRules'
export { PATTERN_JI_XIONG } from './patternRules'

export { analyzeMBTI, SHISHEN_MBTI_FUNCTION } from './mbtiMapping'
export type { MBTIAnalysis, MBTIProfile, IndustryMatch, EnergyAdjustment } from './mbtiMapping'
