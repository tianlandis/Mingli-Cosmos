// ============================================================
// Phase 4A — 数据库种子数据
// 文件：src/server/db/seed.ts
// 职责：首次运行时写入默认配置（从 .env 兜底）+ 默认 Provider
// ============================================================

import { setConfig, getConfig } from './repositories/app-configs'
import { listApiKeys, createApiKey } from './repositories/api-keys'
import { createKnowledgeAsset, getKnowledgeAssetByKey } from './repositories/knowledge-assets'

export function seedDefaults() {
  // 仅首次运行时写入（config 表为空时触发）
  const hasConfigs = getConfig('default_llm_provider')
  if (hasConfigs) return

  const defaultProvider = process.env.LLM_PROVIDER || 'local'

  setConfig('default_llm_provider', defaultProvider, '默认 LLM 厂商', '当前使用的 LLM Provider', 'string', 'llm')
  setConfig('default_llm_model', process.env.LLM_MODEL || process.env.OPENAI_MODEL || 'qwen2.5:7b', '默认模型', 'LLM 模型名称', 'string', 'llm')
  setConfig('default_temperature', process.env.LLM_TEMPERATURE || '0.7', '默认温度', '生成温度 0-2', 'string', 'llm')
  setConfig('max_chat_messages', '10', '对话窗口大小', '滑动窗口最大消息数', 'number', 'general')
  setConfig('max_retries', '1', 'LLM 重试次数', '失败后最大重试次数', 'number', 'llm')
  setConfig('llm_timeout_ms', '30000', 'LLM 超时(ms)', '单次请求超时时间', 'number', 'llm')

  console.log('[DB] seed: default configs written')
}

/**
 * 插入默认 Local Provider（首次启动）
 */
export function seedLocalProvider() {
  // 检查是否已有 provider
  const existing = listApiKeys()
  if (existing.length > 0) return

  createApiKey({
    provider: 'local',
    label: 'Qwen2.5-Coder-7B (本地)',
    apiKey: 'ollama',
    baseUrl: process.env.LLM_BASE_URL || 'http://localhost:11434/v1',
    model: process.env.LLM_MODEL || 'qwen2.5:7b',
    temperature: 0.7,
    maxTokens: 2048,
    isActive: 1,
    sortOrder: 0,
    supportedTools: '["solar_term_calc","calendar_lookup","classic_search"]',
    testStatus: 'untested',
    testLatency: null,
    testedAt: null,
  } as any)

  console.log('[DB] seed: default local provider created')
}

// ═══════════════════════════════════════
// Phase 4b + 4c — 命理知识资产种子
// ═══════════════════════════════════════

/** 
 * 知识资产种子总入口。
 * 所有种子函数始终运行，writeSeedAsset 按 key 幂等去重。
 */
export function seedKnowledgeAssets() {
  seedBaziAssets()
  seedShenshaAssets()
  seedPersonalityAssets()
  seedPatternAssets()
  seedClassicsAssets()
}

// ═══════════════════════════════════════
// Phase 4b — 地支关系 12 项
// ═══════════════════════════════════════

function seedBaziAssets() {
  const assets: Array<{
    category: string; key: string; value: unknown
    description: string; sortOrder: number
  }> = [
    {
      category: 'bazi', key: 'chong_map', sortOrder: 10,
      description: '地支六冲 | 渊海子平 | Record<DiZhi,DiZhi> | 子午冲、丑未冲、寅申冲、卯酉冲、辰戌冲、巳亥冲',
      value: {
        '子': '午', '午': '子', '丑': '未', '未': '丑',
        '寅': '申', '申': '寅', '卯': '酉', '酉': '卯',
        '辰': '戌', '戌': '辰', '巳': '亥', '亥': '巳',
      },
    },
    {
      category: 'bazi', key: 'he_map', sortOrder: 20,
      description: '地支六合 | 渊海子平 | Record<DiZhi,DiZhi[]> | 子丑合、寅亥合、卯戌合、辰酉合、巳申合、午未合',
      value: {
        '子': ['丑'], '丑': ['子'], '寅': ['亥'], '亥': ['寅'],
        '卯': ['戌'], '戌': ['卯'], '辰': ['酉'], '酉': ['辰'],
        '巳': ['申'], '申': ['巳'], '午': ['未'], '未': ['午'],
      },
    },
    {
      category: 'bazi', key: 'he_hua_wuxing', sortOrder: 21,
      description: '六合化五行 | 渊海子平 | Record<string,string>',
      value: {
        '子丑': '土', '丑子': '土', '寅亥': '木', '亥寅': '木',
        '卯戌': '火', '戌卯': '火', '辰酉': '金', '酉辰': '金',
        '巳申': '水', '申巳': '水', '午未': '土', '未午': '土',
      },
    },
    {
      category: 'bazi', key: 'san_he', sortOrder: 30,
      description: '地支三合局 | 三命通会 | SanHe[]',
      value: [
        { branches: ['申', '子', '辰'], result: '水', name: '申子辰合水局' },
        { branches: ['寅', '午', '戌'], result: '火', name: '寅午戌合火局' },
        { branches: ['亥', '卯', '未'], result: '木', name: '亥卯未合木局' },
        { branches: ['巳', '酉', '丑'], result: '金', name: '巳酉丑合金局' },
      ],
    },
    {
      category: 'bazi', key: 'ban_he', sortOrder: 40,
      description: '半合局 | 三命通会 | BanHe[] | 12种半合组合',
      value: [
        { branches: ['申', '辰'], result: '水', name: '申辰半合水局' },
        { branches: ['子', '申'], result: '水', name: '子申半合水局' },
        { branches: ['子', '辰'], result: '水', name: '子辰半合水局' },
        { branches: ['寅', '戌'], result: '火', name: '寅戌半合火局' },
        { branches: ['午', '寅'], result: '火', name: '午寅半合火局' },
        { branches: ['午', '戌'], result: '火', name: '午戌半合火局' },
        { branches: ['亥', '未'], result: '木', name: '亥未半合木局' },
        { branches: ['卯', '亥'], result: '木', name: '卯亥半合木局' },
        { branches: ['卯', '未'], result: '木', name: '卯未半合木局' },
        { branches: ['巳', '丑'], result: '金', name: '巳丑半合金局' },
        { branches: ['酉', '巳'], result: '金', name: '酉巳半合金局' },
        { branches: ['酉', '丑'], result: '金', name: '酉丑半合金局' },
      ],
    },
    {
      category: 'bazi', key: 'san_hui', sortOrder: 50,
      description: '地支三会局 | 渊海子平 | SanHui[]',
      value: [
        { branches: ['亥', '子', '丑'], result: '水', name: '亥子丑会北方水局' },
        { branches: ['寅', '卯', '辰'], result: '木', name: '寅卯辰会东方木局' },
        { branches: ['巳', '午', '未'], result: '火', name: '巳午未会南方火局' },
        { branches: ['申', '酉', '戌'], result: '金', name: '申酉戌会西方金局' },
      ],
    },
    {
      category: 'bazi', key: 'xing_map', sortOrder: 60,
      description: '地支相刑 | 渊海子平 | Record<DiZhi,DiZhi[]>',
      value: {
        '子': ['卯'], '卯': ['子'],
        '寅': ['巳', '申'], '巳': ['寅', '申'], '申': ['寅', '巳'],
        '丑': ['戌', '未'], '戌': ['丑', '未'], '未': ['丑', '戌'],
        '辰': ['辰'], '午': ['午'], '酉': ['酉'], '亥': ['亥'],
      },
    },
    {
      category: 'bazi', key: 'zi_xing', sortOrder: 61,
      description: '自刑 | 渊海子平 | Set<DiZhi> | 辰午酉亥',
      value: { set: ['辰', '午', '酉', '亥'] },
    },
    {
      category: 'bazi', key: 'po_map', sortOrder: 70,
      description: '地支相破 | 渊海子平 | Record<DiZhi,DiZhi[]>',
      value: {
        '子': ['酉'], '酉': ['子'], '丑': ['辰'], '辰': ['丑'],
        '寅': ['亥'], '亥': ['寅'], '午': ['卯'], '卯': ['午'],
        '未': ['戌'], '戌': ['未'], '巳': ['申'], '申': ['巳'],
      },
    },
    {
      category: 'bazi', key: 'hai_map', sortOrder: 80,
      description: '地支六害 | 渊海子平 | Record<DiZhi,DiZhi[]>',
      value: {
        '子': ['未'], '未': ['子'], '丑': ['午'], '午': ['丑'],
        '寅': ['巳'], '巳': ['寅'], '卯': ['辰'], '辰': ['卯'],
        '申': ['亥'], '亥': ['申'], '酉': ['戌'], '戌': ['酉'],
      },
    },
    {
      category: 'bazi', key: 'kong_wang_xun', sortOrder: 90,
      description: '六甲旬空亡 | 渊海子平 | 数组',
      value: [
        { stem: '甲', branchStart: '子', kongWang: ['戌', '亥'] },
        { stem: '甲', branchStart: '戌', kongWang: ['申', '酉'] },
        { stem: '甲', branchStart: '申', kongWang: ['午', '未'] },
        { stem: '甲', branchStart: '午', kongWang: ['辰', '巳'] },
        { stem: '甲', branchStart: '辰', kongWang: ['寅', '卯'] },
        { stem: '甲', branchStart: '寅', kongWang: ['子', '丑'] },
      ],
    },
    {
      category: 'bazi', key: 'jia_zi_order', sortOrder: 100,
      description: '六十甲子 | 基础命理 | string[] | 甲子至癸亥共六十组',
      value: [
        '甲子', '乙丑', '丙寅', '丁卯', '戊辰', '己巳', '庚午', '辛未', '壬申', '癸酉',
        '甲戌', '乙亥', '丙子', '丁丑', '戊寅', '己卯', '庚辰', '辛巳', '壬午', '癸未',
        '甲申', '乙酉', '丙戌', '丁亥', '戊子', '己丑', '庚寅', '辛卯', '壬辰', '癸巳',
        '甲午', '乙未', '丙申', '丁酉', '戊戌', '己亥', '庚子', '辛丑', '壬寅', '癸卯',
        '甲辰', '乙巳', '丙午', '丁未', '戊申', '己酉', '庚戌', '辛亥', '壬子', '癸丑',
        '甲寅', '乙卯', '丙辰', '丁巳', '戊午', '己未', '庚申', '辛酉', '壬戌', '癸亥',
      ],
    },
    // ── Phase 4d：藏干 & 五行表 5 项 ──
    {
      category: 'bazi', key: 'hidden_stems', sortOrder: 110,
      description: '地支藏干表 | 渊海子平 | Record<DiZhi,string[]> | 余气→中气→本气顺序',
      value: {
        '子': ['癸'], '丑': ['癸', '辛', '己'], '寅': ['戊', '丙', '甲'], '卯': ['乙'],
        '辰': ['乙', '癸', '戊'], '巳': ['戊', '庚', '丙'], '午': ['丁'], '未': ['丁', '乙', '己'],
        '申': ['戊', '壬', '庚'], '酉': ['辛'], '戌': ['辛', '丁', '戊'], '亥': ['戊', '甲', '壬'],
      },
    },
    {
      category: 'bazi', key: 'hidden_stems_days', sortOrder: 120,
      description: '藏干天数分段表 | V2.0规则 | Record<DiZhi,{stem,days}[]> | 月令分金刻度尺，余气→中气→本气',
      value: {
        '子': [{ stem: '癸', days: 30 }],
        '丑': [{ stem: '癸', days: 9 }, { stem: '辛', days: 6 }, { stem: '己', days: 15 }],
        '寅': [{ stem: '戊', days: 4 }, { stem: '丙', days: 6 }, { stem: '甲', days: 20 }],
        '卯': [{ stem: '乙', days: 30 }],
        '辰': [{ stem: '乙', days: 9 }, { stem: '癸', days: 6 }, { stem: '戊', days: 15 }],
        '巳': [{ stem: '戊', days: 4 }, { stem: '庚', days: 6 }, { stem: '丙', days: 20 }],
        '午': [{ stem: '丁', days: 30 }],
        '未': [{ stem: '丁', days: 9 }, { stem: '乙', days: 6 }, { stem: '己', days: 15 }],
        '申': [{ stem: '戊', days: 4 }, { stem: '壬', days: 6 }, { stem: '庚', days: 20 }],
        '酉': [{ stem: '辛', days: 30 }],
        '戌': [{ stem: '辛', days: 9 }, { stem: '丁', days: 6 }, { stem: '戊', days: 15 }],
        '亥': [{ stem: '戊', days: 2 }, { stem: '甲', days: 7 }, { stem: '壬', days: 21 }],
      },
    },
    {
      category: 'bazi', key: 'chang_sheng', sortOrder: 130,
      description: '十二长生表 | 三命通会 | Record<Wuxing,Record<DiZhi,ChangSheng>> | 五行在地支的12种生命周期',
      value: {
        '木': { '亥': '长生', '子': '沐浴', '丑': '冠带', '寅': '临官', '卯': '帝旺', '辰': '衰', '巳': '病', '午': '死', '未': '墓', '申': '绝', '酉': '胎', '戌': '养' },
        '火': { '寅': '长生', '卯': '沐浴', '辰': '冠带', '巳': '临官', '午': '帝旺', '未': '衰', '申': '病', '酉': '死', '戌': '墓', '亥': '绝', '子': '胎', '丑': '养' },
        '土': { '申': '长生', '酉': '沐浴', '戌': '冠带', '亥': '临官', '子': '帝旺', '丑': '衰', '寅': '病', '卯': '死', '辰': '墓', '巳': '绝', '午': '胎', '未': '养' },
        '金': { '巳': '长生', '午': '沐浴', '未': '冠带', '申': '临官', '酉': '帝旺', '戌': '衰', '亥': '病', '子': '死', '丑': '墓', '寅': '绝', '卯': '胎', '辰': '养' },
        '水': { '申': '长生', '酉': '沐浴', '戌': '冠带', '亥': '临官', '子': '帝旺', '丑': '衰', '寅': '病', '卯': '死', '辰': '墓', '巳': '绝', '午': '胎', '未': '养' },
      },
    },
    {
      category: 'bazi', key: 'month_power', sortOrder: 140,
      description: '月令旺衰表 | 三命通会 | Record<Wuxing,Record<number,powers>> | 五行在12月令的旺相休囚死',
      value: {
        '木': { 1: '旺', 2: '旺', 3: '余气', 4: '休', 5: '休', 6: '休', 7: '囚', 8: '囚', 9: '囚', 10: '相', 11: '相', 12: '相' },
        '火': { 1: '相', 2: '相', 3: '相', 4: '旺', 5: '旺', 6: '余气', 7: '休', 8: '休', 9: '休', 10: '囚', 11: '囚', 12: '囚' },
        '金': { 1: '囚', 2: '囚', 3: '囚', 4: '相', 5: '相', 6: '相', 7: '旺', 8: '旺', 9: '余气', 10: '休', 11: '休', 12: '休' },
        '水': { 1: '休', 2: '休', 3: '休', 4: '囚', 5: '囚', 6: '囚', 7: '相', 8: '相', 9: '相', 10: '旺', 11: '旺', 12: '余气' },
        '土': { 1: '余气', 2: '休', 3: '休', 4: '囚', 5: '囚', 6: '相', 7: '相', 8: '相', 9: '休', 10: '休', 11: '余气', 12: '旺' },
      },
    },
    {
      category: 'bazi', key: 'di_zhi_ben_qi_wuxing', sortOrder: 150,
      description: '地支本气五行 | 基础命理 | Record<DiZhi,Wuxing> | 每地支主要五行属性',
      value: {
        '子': '水', '丑': '土', '寅': '木', '卯': '木',
        '辰': '土', '巳': '火', '午': '火', '未': '土',
        '申': '金', '酉': '金', '戌': '土', '亥': '水',
      },
    },
  ]
  for (const a of assets) { writeSeedAsset(a) }
  console.log(`[DB] seed: ${assets.length} bazi assets written`)
}

// ═══════════════════════════════════════
// Phase 4c — 神煞字典 9 项（category: shensha）
// ═══════════════════════════════════════

function seedShenshaAssets() {
  const assets: Array<{
    category: string; key: string; value: unknown
    description: string; sortOrder: number
  }> = [
    {
      category: 'shensha', key: 'lu_map', sortOrder: 10,
      description: '禄位映射 | 渊海子平 | Record<string,string> | 天干→禄位地支（甲禄寅、乙禄卯…）',
      value: {
        '甲': '寅', '乙': '卯', '丙': '巳', '丁': '午',
        '戊': '巳', '己': '午', '庚': '申', '辛': '酉',
        '壬': '亥', '癸': '子',
      },
    },
    {
      category: 'shensha', key: 'wang_map', sortOrder: 20,
      description: '帝旺位映射 | 渊海子平 | Record<string,string> | 天干→帝旺地支（阳刃位）',
      value: {
        '甲': '卯', '乙': '寅', '丙': '午', '丁': '巳',
        '戊': '午', '己': '巳', '庚': '酉', '辛': '申',
        '壬': '子', '癸': '亥',
      },
    },
    {
      category: 'shensha', key: 'tian_yi_map', sortOrder: 30,
      description: '天乙贵人 | 渊海子平 | Record<string,[string,string]> | 口诀：甲戊庚牛羊，乙己鼠猴乡…',
      value: {
        '甲': ['丑', '未'], '戊': ['丑', '未'], '庚': ['丑', '未'],
        '乙': ['子', '申'], '己': ['子', '申'],
        '丙': ['亥', '酉'], '丁': ['亥', '酉'],
        '壬': ['卯', '巳'], '癸': ['卯', '巳'],
        '辛': ['午', '寅'],
      },
    },
    {
      category: 'shensha', key: 'wen_chang_map', sortOrder: 40,
      description: '文昌贵人 | 渊海子平 | Record<string,string> | 口诀：甲巳乙午报君知…',
      value: {
        '甲': '巳', '乙': '午', '丙': '申', '丁': '酉',
        '戊': '申', '己': '酉', '庚': '亥', '辛': '子',
        '壬': '寅', '癸': '卯',
      },
    },
    {
      category: 'shensha', key: 'tao_hua_san_he', sortOrder: 50,
      description: '桃花三合局组 | 渊海子平 | [string,string,string][] | 寅午戌/申子辰/巳酉丑/亥卯未',
      value: [
        ['寅', '午', '戌'],
        ['申', '子', '辰'],
        ['巳', '酉', '丑'],
        ['亥', '卯', '未'],
      ],
    },
    {
      category: 'shensha', key: 'tao_hua_result', sortOrder: 51,
      description: '桃花结果 | 渊海子平 | string[] | 对应三合局组的子卯午酉位置（寅午戌→卯…）',
      value: ['卯', '酉', '午', '子'],
    },
    {
      category: 'shensha', key: 'yi_ma_result', sortOrder: 60,
      description: '驿马 | 渊海子平 | string[] | 寅午戌马在申，申子辰马在寅…',
      value: ['申', '寅', '亥', '巳'],
    },
    {
      category: 'shensha', key: 'hua_gai_result', sortOrder: 70,
      description: '华盖 | 渊海子平 | string[] | 寅午戌见戌，申子辰见辰…',
      value: ['戌', '辰', '丑', '未'],
    },
    {
      category: 'shensha', key: 'jin_yu_map', sortOrder: 80,
      description: '金舆 | 三命通会 | Record<string,string> | 口诀：甲龙乙蛇丙戊羊…',
      value: {
        '甲': '辰', '乙': '巳', '丙': '未', '丁': '申',
        '戊': '未', '己': '申', '庚': '戌', '辛': '亥',
        '壬': '丑', '癸': '寅',
      },
    },
  ]
  for (const a of assets) { writeSeedAsset(a) }
  console.log(`[DB] seed: ${assets.length} shensha assets written`)
}

// ═══════════════════════════════════════
// Phase 4c — 16人格映射 1 项（category: personality）
// ═══════════════════════════════════════

function seedPersonalityAssets() {
  const assets: Array<{
    category: string; key: string; value: unknown
    description: string; sortOrder: number
  }> = [
    {
      category: 'personality', key: 'shishen_mbti_function', sortOrder: 10,
      description: '十神→MBTI主导功能 | 三阶精修版 | Record<string,{dominant,auxiliary,mbtiTypes}> | 8种十神各映射认知功能组合',
      value: {
        '正官': { dominant: 'Te', auxiliary: 'Si/Ni', mbtiTypes: ['ESTJ', 'INTJ'] },
        '七杀': { dominant: 'Ti', auxiliary: 'Ne/Se', mbtiTypes: ['INTP', 'ESTP'] },
        '正印': { dominant: 'Ne', auxiliary: 'Fi/Ti', mbtiTypes: ['ENFP', 'ENTP'] },
        '偏印': { dominant: 'Ni', auxiliary: 'Te/Fe', mbtiTypes: ['INTJ', 'INFJ'] },
        '正财': { dominant: 'Se', auxiliary: 'Te/Fi', mbtiTypes: ['ESTP', 'ESFP'] },
        '偏财': { dominant: 'Si', auxiliary: 'Te/Fe', mbtiTypes: ['ESTJ', 'ISFJ'] },
        '食神': { dominant: 'Fi', auxiliary: 'Ne/Se', mbtiTypes: ['INFP', 'ISFP'] },
        '伤官': { dominant: 'Fe', auxiliary: 'Ni/Se', mbtiTypes: ['INFJ', 'ESFJ'] },
      },
    },
  ]
  for (const a of assets) { writeSeedAsset(a) }
  console.log(`[DB] seed: ${assets.length} personality assets written`)
}

// ═══════════════════════════════════════
// Phase 4c — 格局映射 3 项（category: pattern）
// ═══════════════════════════════════════

function seedPatternAssets() {
  const assets: Array<{
    category: string; key: string; value: unknown
    description: string; sortOrder: number
  }> = [
    {
      category: 'pattern', key: 'combination_mbti_map', sortOrder: 10,
      description: '格局组合→MBTI画像 | 三阶精修版 | Record<string,MBTIProfile> | 10种格局组合的认知功能与典型类型',
      value: {
        '官印相生': {
          combinationName: '官印相生',
          cognitiveFunctions: 'Te + Ne',
          typicalTypes: ['ENTJ', 'ENTP'],
          traits: '规则建筑者 + 宏观构想家',
          portrait: '有理想且懂规则，计划性与创造力并重。既善于在体制内制定长远战略，也能在创业中开辟蓝海。',
        },
        '煞印相生': {
          combinationName: '煞印相生',
          cognitiveFunctions: 'Ti + Ni',
          typicalTypes: ['INTJ', 'INFJ'],
          traits: '逻辑分析家 + 深度洞察家',
          portrait: '深谋远虑，在压力下爆发。将深度逻辑与内在洞察结合，成为铁腕政治家或战略军事家。',
        },
        '财官相生': {
          combinationName: '财官相生',
          cognitiveFunctions: 'Se + Te',
          typicalTypes: ['ESTJ', 'ENTJ'],
          traits: '现实控制者 + 规则建筑者',
          portrait: '务实高效的执行者，善于管理、运营。将资源控制与规则执行结合，适合大型企业或政府管理部门。',
        },
        '食神生财': {
          combinationName: '食神生财',
          cognitiveFunctions: 'Fi + Se',
          typicalTypes: ['ISFP', 'ESFP'],
          traits: '内在价值守护者 + 现实控制者',
          portrait: '用才华和技术服务社会，将内心审美外化为具体作品或服务，以"艺"安身立命，快乐赚钱。',
        },
        '伤官生财': {
          combinationName: '伤官生财',
          cognitiveFunctions: 'Fe + Se',
          typicalTypes: ['ESFJ', 'ESTP'],
          traits: '情感连接者 + 现实控制者',
          portrait: '情绪饱满，善于社交和连接资源。将情感力量转化为市场影响力，适合销售、公关、娱乐领域。',
        },
        '伤官佩印': {
          combinationName: '伤官佩印',
          cognitiveFunctions: 'Fe + Ne',
          typicalTypes: ['ENFJ', 'ENFP'],
          traits: '情感连接者 + 宏观构想家',
          portrait: '才华横溢且有思想深度。用理性(印)驾驭感性(伤官)，成为创意领袖、教育家或心理咨询师。',
        },
        '纯印格': {
          combinationName: '纯印格（无官杀）',
          cognitiveFunctions: 'Ne/Ni + Fi/Ti',
          typicalTypes: ['INFP', 'INFJ'],
          traits: '灵感丰沛但缺执行力',
          portrait: '灵感丰沛但缺乏结构化执行力（缺官杀）。需要补足思维（官杀）才能将天赋最大化。',
        },
        '纯财格': {
          combinationName: '纯财格（无食伤）',
          cognitiveFunctions: 'Se/Si + Te/Fe',
          typicalTypes: ['ESTJ', 'ISFJ'],
          traits: '务实稳健缺创造力',
          portrait: '务实稳健，但缺乏才华（食伤）的源头活水。容易"死赚钱"，需要引入食伤来激发创造性和收入渠道。',
        },
        '禄格': {
          combinationName: '禄格',
          cognitiveFunctions: 'Si + Ne',
          typicalTypes: ['ISFJ', 'INFP'],
          traits: '安稳的顺局者',
          portrait: '安稳的顺局者。依赖稳定环境，需关注透干十神，顺势而为。',
        },
        '羊刃格': {
          combinationName: '羊刃格',
          cognitiveFunctions: 'Se + Te',
          typicalTypes: ['ESTP', 'ENTJ'],
          traits: '冲突与动荡的制造者或解决者',
          portrait: '能量极强，必须被有效制化（食神/官杀），否则易成"悍匪"。',
        },
      },
    },
    {
      category: 'pattern', key: 'industry_matches', sortOrder: 20,
      description: '行业适配建议 | 三阶精修版 | Record<string,IndustryMatch> | 5种格局的行业方向与风险提示',
      value: {
        '伤官格': {
          combination: '伤官格（ENFP/ENFJ）',
          industries: ['新媒体运营', '创意策划', '心理咨询'],
          mbtiAdvantage: 'Ne+Fe 优势',
          riskWarning: '需警惕"伤官见官"流年，强化逻辑(Ti)以避免情绪化决策',
        },
        '七杀格': {
          combination: '七杀格（ISTJ/INTJ）',
          industries: ['数据分析', '风险管理'],
          mbtiAdvantage: 'Te+Si/Ni 优势',
          riskWarning: '需警惕"财星滋杀"运势，避免过度冒险，并增强Fi(人文关怀)防止控制欲过强',
        },
        '官印相生': {
          combination: '官印相生（ENTJ/ENTP）',
          industries: ['战略规划', '企业管理'],
          mbtiAdvantage: 'Te+Ne 优势',
          riskWarning: '需警惕"财星破印"运势，避免被短期利益动摇长远理想',
        },
        '煞印相生': {
          combination: '煞印相生（INTJ/INFJ）',
          industries: ['军政谋略', '尖端科研'],
          mbtiAdvantage: 'Ni+Ti/Fe 优势',
          riskWarning: '需警惕自我封闭，主动引入Se(外倾感觉)以保持与现实连接',
        },
        '食神生财': {
          combination: '食神生财（ISFP/ESFP）',
          industries: ['艺术创作', '自由职业', '技术研发'],
          mbtiAdvantage: 'Fi+Se 优势',
          riskWarning: '需警惕"枭神夺食"大运，补充Te(外倾思维)进行财务规划',
        },
      },
    },
    {
      category: 'pattern', key: 'energy_adjustments', sortOrder: 30,
      description: '能量调整策略 | 三阶精修版 | EnergyAdjustment[] | 4种格局缺陷的MBTI补益方向',
      value: [
        {
          initialState: '印格无官杀',
          weakness: '缺乏结构化执行力',
          mbtiDirection: '向 ENTJ（Te+Ni）靠拢',
          practicalMethods: ['学习项目管理', '逻辑推演训练', '将灵感程序化'],
        },
        {
          initialState: '财格无食伤',
          weakness: '缺乏创造力和才华源头',
          mbtiDirection: '向 ESFP（Se+Fi）靠拢',
          practicalMethods: ['培养艺术爱好', '发展副业技能', '让赚钱模式多样化'],
        },
        {
          initialState: '官格（顺境）',
          weakness: '缺乏宏观战略眼光',
          mbtiDirection: '向 INTJ（Ni+Te）靠拢',
          practicalMethods: ['加强深度思考', '研究未来趋势', '制定长期战略'],
        },
        {
          initialState: '官格（逆境）',
          weakness: '缺乏灵活破局能力',
          mbtiDirection: '向 ENTP（Ne+Ti）靠拢',
          practicalMethods: ['寻找规则漏洞', '探索新的可能性', '提升灵活应变能力'],
        },
      ],
    },
    // ── Phase 4d：格局吉凶 1 项 ──
    {
      category: 'pattern', key: 'pattern_ji_xiong', sortOrder: 40,
      description: '格局吉凶分类 | 子平真诠 | Record<PatternName,{type,desc}> | 10种核心格局的吉凶与取用提要',
      value: {
        '正官格': { type: '吉', desc: '喜生扶，忌克制、混杂' },
        '正印格': { type: '吉', desc: '喜生扶，忌财星破印' },
        '偏印格': { type: '吉', desc: '喜生扶，忌财星破印' },
        '食神格': { type: '吉', desc: '喜生扶，忌偏印倒食' },
        '正财格': { type: '吉', desc: '喜生扶，忌比劫夺财' },
        '偏财格': { type: '吉', desc: '喜生扶，忌比劫夺财' },
        '七杀格': { type: '凶', desc: '喜制化（食神制杀/印化杀），忌财星滋杀' },
        '伤官格': { type: '凶', desc: '喜制化（伤官配印/伤官生财），忌见官星' },
        '羊刃格': { type: '凶', desc: '喜制化（官杀制刃/食伤泄刃），忌财星党杀' },
        '建禄格': { type: '中性', desc: '喜顺局（财官印食引导），忌冲禄、禄刃交汇' },
      },
    },
  ]
  for (const a of assets) { writeSeedAsset(a) }
  console.log(`[DB] seed: ${assets.length} pattern assets written`)
}

// ═══════════════════════════════════════
// Phase 4d — 经典专题模板 4 项（category: classics）
// ═══════════════════════════════════════

function seedClassicsAssets() {
  const assets: Array<{
    category: string; key: string; value: unknown
    description: string; sortOrder: number
  }> = [
    {
      category: 'classics', key: 'wuxing_personality', sortOrder: 10,
      description: '五行性格特征 | 渊海子平 | Record<Wuxing,string[]> | 金木水火土的性格画像',
      value: {
        '木': ['仁慈正直', '有上进心', '注重成长', '有时固执'],
        '火': ['热情开朗', '行动力强', '急躁冲动', '富有感染力'],
        '土': ['诚信稳重', '包容力强', '保守谨慎', '脚踏实地'],
        '金': ['刚毅果断', '讲义气', '追求完美', '有时冷酷'],
        '水': ['聪明灵活', '善变适应', '深沉内敛', '有时善变'],
      },
    },
    {
      category: 'classics', key: 'shishen_personality', sortOrder: 20,
      description: '十神性格特征 | 渊海子平 | Record<ShiShen,string> | 10种十神的主导性格描述',
      value: {
        '正官': '正直守规，责任心强，有领导力',
        '偏官': '果敢进取，魄力十足，但易冲动',
        '正印': '仁慈好学，智慧内敛，重视精神生活',
        '偏印': '思维独特，有创造力，但可能孤僻',
        '比肩': '独立自主，自尊心强，朋友缘佳',
        '劫财': '社交能力强，行动力足，但竞争心重',
        '食神': '温和宽厚，有艺术天赋，享受生活',
        '伤官': '聪明才华，表现欲强，不拘一格',
        '正财': '踏实务实，善于理财，注重物质',
        '偏财': '慷慨大方，善于投资，人缘佳',
      },
    },
    {
      category: 'classics', key: 'wuxing_health', sortOrder: 30,
      description: '五行健康映射 | 黄帝内经 | Record<Wuxing,string> | 五行→对应器官系统',
      value: {
        '木': '肝胆、筋骨',
        '火': '心血管、眼目',
        '土': '脾胃、消化系统',
        '金': '肺、呼吸道、皮肤',
        '水': '肾脏、泌尿系统',
      },
    },
    {
      category: 'classics', key: 'industry_map', sortOrder: 40,
      description: '日主五行→行业方向 | 三命通会 | Record<Wuxing,string> | 各五行命主适配行业建议',
      value: {
        '木': '教育、医疗、文化、环保',
        '火': '传媒、能源、餐饮、科技',
        '土': '房地产、建筑、农业、金融',
        '金': '金融、法律、机械、军警',
        '水': '物流、贸易、旅游、咨询',
      },
    },
  ]
  for (const a of assets) { writeSeedAsset(a) }
  console.log(`[DB] seed: ${assets.length} classics assets written`)
}

// ═══════════════════════════════════════
// 种子写入工具
// ═══════════════════════════════════════

function writeSeedAsset(a: {
  category: string; key: string; value: unknown
  description: string; sortOrder: number
}) {
  const existing = getKnowledgeAssetByKey(a.category, a.key)
  if (existing) return
  createKnowledgeAsset({
    category: a.category,
    key: a.key,
    value: JSON.stringify(a.value),
    description: a.description,
    sortOrder: a.sortOrder,
  })
}
