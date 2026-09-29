import { describe, it, expect } from 'vitest'
import {
  detectConflicts,
  scanMatrix,
  parseMbtiProfileKey,
  TRAIT_DIM_LEXICON,
} from '../corpus-consistency'

const MBTI_16 = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
] as const

const ALL_PROFILES: string[] = MBTI_16.flatMap((t) => [`${t}-A`, `${t}-T`])

/**
 * 「网络典型星座话术」——刻意收录主流星座文案里的高频人格断言词，
 * 用于验证：直接照搬星座语料会发生多大面积的矛盾。
 */
const AGGRESSIVE_ZODIAC: Record<string, string[]> = {
  白羊座: ['热情', '冲动', '果敢', '天生领袖', '爱当焦点', '直率'],
  金牛座: ['稳重', '务实', '固执', '慢热', '脚踏实地'],
  双子座: ['健谈', '好奇', '善变', '社交达人', '机智'],
  巨蟹座: ['体贴', '敏感', '顾家', '情绪化', '念旧'],
  狮子座: ['自信', '爱当焦点', '大方', '戏剧化', '天生领袖'],
  处女座: ['注重细节', '挑剔', '务实', '完美主义', '有条理'],
  天秤座: ['优雅', '爱社交', '犹豫不决', '体贴'],
  天蝎座: ['深情', '多疑', '意志力强', '爱恨分明', '敏感'],
  射手座: ['随性', '乐观', '直率', '爱冒险', '不拘小节'],
  摩羯座: ['自律', '事业心强', '保守', '有条理', '现实'],
  水瓶座: ['独立', '特立独行', '理性', '疏离', '前卫'],
  双鱼座: ['敏感', '浪漫', '共情力强', '逃避现实', '梦幻'],
}

/**
 * 合规星座语料——只描述「能量风格」，不做任何方向性人格断言
 * （不命中词表 = 与全部 32 档案相容）。
 */
const COMPLIANT_ZODIAC: Record<string, string[]> = {
  白羊座: ['开局的冲劲', '先锋气质', '探路型能量'],
  金牛座: ['持久的耐力', '慢而稳的节奏', '积累型能量'],
  双子座: ['信息捕捉力', '切换型思维', '灵活的注意力'],
  巨蟹座: ['守护型能量', '情绪记忆深', '圈内滋养'],
  狮子座: ['舞台型能量', '慷慨的表达', '光源气质'],
  处女座: ['校准型能量', '精修的功夫', '流程感'],
  天秤座: ['平衡感', '关系型能量', '审美的分寸'],
  天蝎座: ['深潜型能量', '洞察的耐性', '浓缩的情感强度'],
  射手座: ['远行的能量', '意义的探索', '坦荡的姿态'],
  摩羯座: ['登山的能量', '长线经营', '结构感'],
  水瓶座: ['抽离的视角', '重构的能量', '前沿的好奇'],
  双鱼座: ['渗透型能量', '边界的溶解感', '想象的容器'],
}

describe('corpus-consistency 语料相容性检测器', () => {
  it('词表完整性：每个词至少断言一个合法维度', () => {
    const legal = new Set(['E', 'I', 'S', 'N', 'T', 'F', 'J', 'P', 'ASSERT', 'TURB'])
    for (const [trait, dims] of Object.entries(TRAIT_DIM_LEXICON)) {
      expect(trait.length, `特质词 "${trait}" 不应为空`).toBeGreaterThan(0)
      expect(dims.length, `"${trait}" 应至少断言一个维度`).toBeGreaterThan(0)
      for (const d of dims) expect(legal.has(d), `"${trait}" 的维度 ${d} 非法`).toBe(true)
    }
  })

  it('档案键解析', () => {
    expect(parseMbtiProfileKey('INFP-T')?.identity).toBe('T')
    expect(parseMbtiProfileKey('ESTP-A')?.letters).toEqual(['E', 'S', 'T', 'P'])
    expect(parseMbtiProfileKey('XXFP-T')).toBeNull()
  })

  it('E 断言词与 I 档案冲突、与 E 档案相容', () => {
    expect(detectConflicts(['热情'], 'INTJ-A')).toHaveLength(1)
    expect(detectConflicts(['热情'], 'ENFP-T')).toHaveLength(0)
  })

  it('中性词不误报（直率/稳重/顾家不在词表）', () => {
    expect(detectConflicts(['直率', '稳重', '顾家'], 'INFP-T')).toHaveLength(0)
  })

  it('A/T 身份断言产生 tension 而非 conflict', () => {
    const t = detectConflicts(['果敢'], 'INFP-T')
    expect(t).toHaveLength(1)
    expect(t[0].severity).toBe('tension')
    expect(t[0].asserted).toBe('ASSERT')
    const a = detectConflicts(['果敢'], 'ESTP-A')
    expect(a).toHaveLength(0)
  })
})

describe('扫描结果：现有语料样例已含矛盾源', () => {
  // seeds/knowledge/zodiac.sample.json 的 traits
  const SAMPLE = {
    白羊座: ['热情', '果敢', '直率'],
    金牛座: ['稳重', '务实', '坚韧'],
  }

  it('官方样例语料 × 32 档案：热情(E) 与 务实(S) 各造成 16 个 conflict', () => {
    const { rows, summary } = scanMatrix(SAMPLE, ALL_PROFILES)
    expect(summary.pairs).toBe(64)
    // 热情→E：与 16 个 I 档案冲突；务实→S：与 16 个 N 档案冲突
    expect(summary.totalConflicts).toBe(32)
    const reNen = rows.find((r) => r.sign === '白羊座' && r.mbtiProfile === 'INTJ-A')
    expect(reNen?.conflicts.some((c) => c.trait === '热情')).toBe(true)
  })
})

describe('扫描结果：典型星座话术 × 32 档案全矩阵', () => {
  const { rows, summary } = scanMatrix(AGGRESSIVE_ZODIAC, ALL_PROFILES)

  it('12×32=384 组合全部参与扫描', () => {
    expect(summary.pairs).toBe(384)
  })

  it('矛盾大面积存在：conflict 总量 > 200，12 星座全部中招', () => {
    expect(summary.totalConflicts).toBeGreaterThan(200)
    expect(summary.signsAffected).toBe(12)
  })

  it('已知矛盾点逐一命中', () => {
    const ariesINFP = rows.find((r) => r.sign === '白羊座' && r.mbtiProfile === 'INFP-T')
    expect(ariesINFP?.conflicts.map((c) => c.trait)).toContain('热情')
    expect(ariesINFP?.conflicts.map((c) => c.trait)).toContain('天生领袖')

    const piscesESTP = rows.find((r) => r.sign === '双鱼座' && r.mbtiProfile === 'ESTP-A')
    expect(piscesESTP?.conflicts.map((c) => c.trait)).toContain('浪漫')
    expect(piscesESTP?.conflicts.map((c) => c.trait)).toContain('梦幻')

    const leoISFP = rows.find((r) => r.sign === '狮子座' && r.mbtiProfile === 'ISFP-T')
    expect(leoISFP?.conflicts.map((c) => c.trait)).toContain('爱当焦点')
  })

  it('矛盾分布打印（供人工审阅）', () => {
    console.log('[corpus-consistency] 矛盾统计:', JSON.stringify(summary, null, 2))
    const worst = rows.filter((r) => r.conflicts.length >= 5).slice(0, 5)
    for (const r of worst) {
      console.log(
        `[corpus-consistency] ${r.sign} × ${r.mbtiProfile}：` +
        r.conflicts.map((c) => `${c.trait}(${c.asserted}↔${c.opposite})`).join('、'),
      )
    }
    expect(worst.length).toBeGreaterThan(0)
  })
})

describe('扫描结果：合规语料（能量风格措辞）零矛盾', () => {
  it('12 星座 × 32 档案：0 conflict、0 tension', () => {
    const { summary } = scanMatrix(COMPLIANT_ZODIAC, ALL_PROFILES)
    expect(summary.totalConflicts).toBe(0)
    expect(summary.totalTensions).toBe(0)
    expect(summary.signsAffected).toBe(0)
  })
})
