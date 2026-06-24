// ============================================================
// 八字命理神煞规则（非择日神煞）
// 以日干/年干/日支/年支为基准推演
// 来源：八字取格判断规则引导词（V2.0）+ 经典命理口诀
//
// Phase 4c：神煞字典全面剥离至 knowledge_assets（category: shensha）
//   - export let 实现 ES Module live binding 热更新
//   - reloadShenShaRules() 从 KnowledgeRegistry 动态接管
//   - _PRIVATE 常量保留硬编码兜底，确保 DB 故障时引擎不死机
// ============================================================

import type { BaZiResult } from '../types'
import type { ShenShaItem, ShenShaAnalysis } from '../annotation/types'
import { KnowledgeRegistry } from '../knowledge-registry'

// ═══════════════════════════════════════
// _PRIVATE 硬编码兜底（仅 DB 故障时使用）
// ═══════════════════════════════════════

/** 禄位映射（天干→地支） */
const _LU_MAP: Record<string, string> = {
  '甲': '寅', '乙': '卯', '丙': '巳', '丁': '午',
  '戊': '巳', '己': '午', '庚': '申', '辛': '酉',
  '壬': '亥', '癸': '子',
}

/** 帝旺位映射（天干→地支） */
const _WANG_MAP: Record<string, string> = {
  '甲': '卯', '乙': '寅', '丙': '午', '丁': '巳',
  '戊': '午', '己': '巳', '庚': '酉', '辛': '申',
  '壬': '子', '癸': '亥',
}

/** 天乙贵人（口诀：甲戊庚牛羊，乙己鼠猴乡，丙丁猪鸡位，壬癸兔蛇藏，六辛逢马虎） */
const _TIAN_YI_MAP: Record<string, [string, string]> = {
  '甲': ['丑', '未'], '戊': ['丑', '未'], '庚': ['丑', '未'],
  '乙': ['子', '申'], '己': ['子', '申'],
  '丙': ['亥', '酉'], '丁': ['亥', '酉'],
  '壬': ['卯', '巳'], '癸': ['卯', '巳'],
  '辛': ['午', '寅'],
}

/** 文昌贵人（口诀：甲巳乙午报君知，丙戊申宫丁己鸡，庚猪辛鼠壬逢虎，癸人见兔入云梯） */
const _WEN_CHANG_MAP: Record<string, string> = {
  '甲': '巳', '乙': '午', '丙': '申', '丁': '酉',
  '戊': '申', '己': '酉', '庚': '亥', '辛': '子',
  '壬': '寅', '癸': '卯',
}

/** 桃花/咸池（寅午戌见卯，申子辰见酉，巳酉丑见午，亥卯未见子） */
const _TAO_HUA_SAN_HE: [string, string, string][] = [
  ['寅', '午', '戌'],
  ['申', '子', '辰'],
  ['巳', '酉', '丑'],
  ['亥', '卯', '未'],
]
/** 桃花结果（对应上面四组的子、卯、午、酉位置） */
const _TAO_HUA_RESULT: string[] = ['卯', '酉', '午', '子']

/** 驿马（口诀同上三合局，寅午戌马在申，申子辰马在寅，巳酉丑马在亥，亥卯未马在巳） */
const _YI_MA_RESULT: string[] = ['申', '寅', '亥', '巳']

/** 华盖（口诀同上，寅午戌见戌，申子辰见辰，巳酉丑见丑，亥卯未见未） */
const _HUA_GAI_RESULT: string[] = ['戌', '辰', '丑', '未']

/** 金舆（口诀：甲龙乙蛇丙戊羊，丁己猴歌庚犬方，辛猪壬牛癸逢虎） */
const _JIN_YU_MAP: Record<string, string> = {
  '甲': '辰', '乙': '巳', '丙': '未', '丁': '申',
  '戊': '未', '己': '申', '庚': '戌', '辛': '亥',
  '壬': '丑', '癸': '寅',
}


// ═══════════════════════════════════════
// export let — ES Module live binding（Phase 4c）
// ═══════════════════════════════════════

export let LU_MAP: Record<string, string> = _LU_MAP
export let WANG_MAP: Record<string, string> = _WANG_MAP
export let TIAN_YI_MAP: Record<string, [string, string]> = _TIAN_YI_MAP
export let WEN_CHANG_MAP: Record<string, string> = _WEN_CHANG_MAP
export let TAO_HUA_SAN_HE: [string, string, string][] = _TAO_HUA_SAN_HE
export let TAO_HUA_RESULT: string[] = _TAO_HUA_RESULT
export let YI_MA_RESULT: string[] = _YI_MA_RESULT
export let HUA_GAI_RESULT: string[] = _HUA_GAI_RESULT
export let JIN_YU_MAP: Record<string, string> = _JIN_YU_MAP


// ═══════════════════════════════════════
// Phase 4c — 从 KnowledgeRegistry 动态接管
// ═══════════════════════════════════════

/**
 * 从 Registry 重新加载全部神煞字典。
 * 由 KnowledgeProvider.bootKnowledgeRegistry() 在启动/热更新时调用。
 */
export function reloadShenShaRules(): void {
  LU_MAP = KnowledgeRegistry.getOrFallback<Record<string, string>>('shensha.lu_map', _LU_MAP)
  WANG_MAP = KnowledgeRegistry.getOrFallback<Record<string, string>>('shensha.wang_map', _WANG_MAP)
  TIAN_YI_MAP = KnowledgeRegistry.getOrFallback<Record<string, [string, string]>>('shensha.tian_yi_map', _TIAN_YI_MAP)
  WEN_CHANG_MAP = KnowledgeRegistry.getOrFallback<Record<string, string>>('shensha.wen_chang_map', _WEN_CHANG_MAP)
  TAO_HUA_SAN_HE = KnowledgeRegistry.getOrFallback<[string, string, string][]>('shensha.tao_hua_san_he', _TAO_HUA_SAN_HE)
  TAO_HUA_RESULT = KnowledgeRegistry.getOrFallback<string[]>('shensha.tao_hua_result', _TAO_HUA_RESULT)
  YI_MA_RESULT = KnowledgeRegistry.getOrFallback<string[]>('shensha.yi_ma_result', _YI_MA_RESULT)
  HUA_GAI_RESULT = KnowledgeRegistry.getOrFallback<string[]>('shensha.hua_gai_result', _HUA_GAI_RESULT)
  JIN_YU_MAP = KnowledgeRegistry.getOrFallback<Record<string, string>>('shensha.jin_yu_map', _JIN_YU_MAP)
}


// ── 查找三合局下标 ──

function getSanHeIndex(zhi: string): number {
  for (let i = 0; i < TAO_HUA_SAN_HE.length; i++) {
    if (TAO_HUA_SAN_HE[i].includes(zhi)) return i
  }
  return -1
}


// ── 单项神煞检查 ──

interface PillarInfo {
  name: string      // 年柱/月柱/日柱/时柱
  stem: string      // 天干
  branch: string    // 地支
}

function getPillarInfo(bazi: BaZiResult, key: 'year' | 'month' | 'day' | 'hour'): PillarInfo {
  const p = bazi[`${key}Pillar` as keyof BaZiResult] as { stem: string; branch: string }
  const nameMap = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' }
  return { name: nameMap[key], stem: p.stem, branch: p.branch }
}


/**
 * 分析八字神煞
 */
export function analyzeShenSha(bazi: BaZiResult): ShenShaAnalysis {
  const items: ShenShaItem[] = []

  const dayStem = bazi.dayMaster
  const yearStem = bazi.yearPillar.stem
  const yearBranch = bazi.yearPillar.branch

  const pillars: PillarInfo[] = [
    getPillarInfo(bazi, 'year'),
    getPillarInfo(bazi, 'month'),
    getPillarInfo(bazi, 'day'),
    getPillarInfo(bazi, 'hour'),
  ]

  // ── 1. 天乙贵人（以日干/年干为主） ──
  const tianYiDay = TIAN_YI_MAP[dayStem]
  const tianYiYear = TIAN_YI_MAP[yearStem]
  for (const p of pillars) {
    if (tianYiDay?.includes(p.branch)) {
      items.push({
        name: '天乙贵人', type: '吉',
        description: `日干${dayStem}见${p.branch}为天乙贵人，逢凶化吉，贵人扶持`,
        pillar: p.name, classicRef: '《渊海子平》：「甲戊庚牛羊，乙己鼠猴乡」',
      })
    }
    if (tianYiYear?.includes(p.branch) && p.stem !== dayStem) {
      items.push({
        name: '天乙贵人', type: '吉',
        description: `年干${yearStem}见${p.branch}为天乙贵人，得长辈贵人助力`,
        pillar: p.name, classicRef: '《三命通会》：「天乙贵人乃天上之神，所至之处一切凶煞隐然而避」',
      })
    }
  }

  // ── 2. 文昌贵人（以日干为主） ──
  const wenChang = WEN_CHANG_MAP[dayStem]
  for (const p of pillars) {
    if (p.branch === wenChang) {
      items.push({
        name: '文昌贵人', type: '吉',
        description: `日干${dayStem}见${p.branch}为文昌星，主聪明好学，文采出众`,
        pillar: p.name, classicRef: '《渊海子平》：「文昌入命，聪明过人」',
      })
    }
  }

  // ── 3. 桃花/咸池（以年支/日支为主） ──
  const yrIdx = getSanHeIndex(yearBranch)
  const dayBranch = bazi.dayPillar.branch
  const drIdx = getSanHeIndex(dayBranch)
  for (const p of pillars) {
    if (yrIdx >= 0 && p.branch === TAO_HUA_RESULT[yrIdx]) {
      items.push({
        name: '桃花', type: '中性',
        description: `年支${yearBranch}见${p.branch}为桃花，主异性缘佳，社交能力强`,
        pillar: p.name, classicRef: '《渊海子平》：「咸池为桃花煞，主酒色」',
      })
    }
    if (drIdx >= 0 && p.branch === TAO_HUA_RESULT[drIdx] && p.branch !== TAO_HUA_RESULT[yrIdx]) {
      items.push({
        name: '桃花', type: '中性',
        description: `日支${dayBranch}见${p.branch}为桃花，主配偶有魅力`,
        pillar: p.name, classicRef: '《滴天髓》：「咸池者，沐浴之宫」',
      })
    }
  }

  // ── 4. 驿马（以年支/日支为主） ──
  for (const p of pillars) {
    if (yrIdx >= 0 && p.branch === YI_MA_RESULT[yrIdx]) {
      items.push({
        name: '驿马', type: '吉',
        description: `年支${yearBranch}见${p.branch}为驿马，主奔波、迁移、走动多`,
        pillar: p.name, classicRef: '《渊海子平》：「寅午戌马在申，申子辰马在寅」',
      })
    }
    if (drIdx >= 0 && p.branch === YI_MA_RESULT[drIdx] && p.branch !== YI_MA_RESULT[yrIdx]) {
      items.push({
        name: '驿马', type: '吉',
        description: `日支${dayBranch}见${p.branch}为驿马，主事业多动`,
        pillar: p.name, classicRef: '《三命通会》：「马主迁动」',
      })
    }
  }

  // ── 5. 禄（以日干为主） ──
  const lu = LU_MAP[dayStem]
  for (const p of pillars) {
    if (p.branch === lu) {
      const isDay = p.name === '日柱'
      items.push({
        name: '日禄', type: '吉',
        description: isDay ? `日干${dayStem}坐禄地${lu}，为建禄格，自身力量充足` : `日干${dayStem}之禄在${p.name}，根基稳固`,
        pillar: p.name, classicRef: '《渊海子平》：「禄者，爵禄也，得之则享」',
      })
    }
  }

  // ── 6. 羊刃（以日干为主） ──
  const wang = WANG_MAP[dayStem]
  for (const p of pillars) {
    if (p.branch === wang) {
      const isDay = p.name === '日柱'
      items.push({
        name: '羊刃', type: '凶',
        description: isDay ? `日干${dayStem}坐帝旺${wang}，为阳刃格，刚强果决但需谨防冲动` : `${p.name}为日主帝旺之地，羊刃在身`,
        pillar: p.name, classicRef: '《渊海子平》：「羊刃者，禄前一位也，刚暴之煞」',
      })
    }
  }

  // ── 7. 华盖（以年支/日支为主） ──
  for (const p of pillars) {
    if (yrIdx >= 0 && p.branch === HUA_GAI_RESULT[yrIdx]) {
      items.push({
        name: '华盖', type: '中性',
        description: `年支${yearBranch}见${p.branch}为华盖，主智慧超群，喜孤独，有艺术天赋`,
        pillar: p.name, classicRef: '《渊海子平》：「华盖者，喻如宝盖，主文章艺术」',
      })
    }
  }

  // ── 8. 金舆（以日干为主） ──
  const jinYu = JIN_YU_MAP[dayStem]
  for (const p of pillars) {
    if (p.branch === jinYu) {
      items.push({
        name: '金舆', type: '吉',
        description: `日干${dayStem}见${p.branch}为金舆，主富贵得车马之福`,
        pillar: p.name, classicRef: '《三命通会》：「金舆者，金车之象，君子居官得禄」',
      })
    }
  }

  // ── 汇总 ──
  const jiItems = items.filter(i => i.type === '吉')
  const xiongItems = items.filter(i => i.type === '凶')
  const summary: string[] = []

  if (jiItems.length > 0) {
    summary.push(`命带${[...new Set(jiItems.map(i => i.name))].join('、')}，吉神护佑，多有助力`)
  }
  if (xiongItems.length > 0) {
    summary.push(`命带${[...new Set(xiongItems.map(i => i.name))].join('、')}，需注意相应方面`)
  }
  if (items.length === 0) {
    summary.push('本命未查出明显神煞')
  }

  // 去重
  const seen = new Set<string>()
  const uniqueItems = items.filter(i => {
    const key = `${i.name}+${i.pillar}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return { summary, items: uniqueItems }
}
