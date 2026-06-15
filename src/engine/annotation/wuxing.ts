// ============================================================
// 五行生克工具函数
// ============================================================

/** 五行相生: 金→水→木→火→土→金 */
export const WUXING_SHENG: Record<string, string> = {
  '金': '水', '水': '木', '木': '火', '火': '土', '土': '金',
}

/** 五行相克: 金→木→土→水→火→金 */
export const WUXING_KE: Record<string, string> = {
  '金': '木', '木': '土', '土': '水', '水': '火', '火': '金',
}

/** 谁生我（反向查相生） */
export function whoShengMe(wx: string): string[] {
  const r: string[] = []
  for (const [k, v] of Object.entries(WUXING_SHENG)) {
    if (v === wx) r.push(k)
  }
  return r
}

/** 谁克我（反向查相克） */
export function whoKeMe(wx: string): string[] {
  const r: string[] = []
  for (const [k, v] of Object.entries(WUXING_KE)) {
    if (v === wx) r.push(k)
  }
  return r
}

/** 我克谁（正查） */
export function meKe(wx: string): string {
  return WUXING_KE[wx] ?? ''
}

/** 我生谁（正查） */
export function meSheng(wx: string): string {
  return WUXING_SHENG[wx] ?? ''
}

/** 五行关系（返回: 生我/我生/克我/我克/同） */
export function getWuXingRelation(from: string, to: string): '生我' | '我生' | '克我' | '我克' | '同' {
  if (from === to) return '同'
  if (WUXING_SHENG[from] === to) return '我生'
  if (WUXING_SHENG[to] === from) return '生我'
  if (WUXING_KE[from] === to) return '我克'
  if (WUXING_KE[to] === from) return '克我'
  return '同'
}

/** 天干十神判断 */
export function getShiShenName(
  dayMasterWx: string,
  dayMasterYy: '阳' | '阴',
  targetWx: string,
  targetYy: '阳' | '阴',
): string {
  const rel = getWuXingRelation(targetWx, dayMasterWx)
  const sameYy = dayMasterYy === targetYy
  switch (rel) {
    case '同': return sameYy ? '比肩' : '劫财'
    case '我生': return sameYy ? '食神' : '伤官'
    case '生我': return sameYy ? '偏印' : '正印'
    case '我克': return sameYy ? '偏财' : '正财'
    case '克我': return sameYy ? '偏官' : '正官'
    default: return '比肩'
  }
}

/** 地支藏干主气（第一位） */
export const DI_ZHI_MAIN_QI: Record<string, string> = {
  '子': '癸', '丑': '己', '寅': '甲', '卯': '乙',
  '辰': '戊', '巳': '丙', '午': '丁', '未': '己',
  '申': '庚', '酉': '辛', '戌': '戊', '亥': '壬',
}

/** 十二长生表（五行在地支的长生状态） */
export const CHANG_SHENG: Record<string, Record<string, string>> = {
  '木': {'亥':'长生','子':'沐浴','丑':'冠带','寅':'临官','卯':'帝旺','辰':'衰','巳':'病','午':'死','未':'墓','申':'绝','酉':'胎','戌':'养'},
  '火': {'寅':'长生','卯':'沐浴','辰':'冠带','巳':'临官','午':'帝旺','未':'衰','申':'病','酉':'死','戌':'墓','亥':'绝','子':'胎','丑':'养'},
  '土': {'申':'长生','酉':'沐浴','戌':'冠带','亥':'临官','子':'帝旺','丑':'衰','寅':'病','卯':'死','辰':'墓','巳':'绝','午':'胎','未':'养'},
  '金': {'巳':'长生','午':'沐浴','未':'冠带','申':'临官','酉':'帝旺','戌':'衰','亥':'病','子':'死','丑':'墓','寅':'绝','卯':'胎','辰':'养'},
  '水': {'申':'长生','酉':'沐浴','戌':'冠带','亥':'临官','子':'帝旺','丑':'衰','寅':'病','卯':'死','辰':'墓','巳':'绝','午':'胎','未':'养'},
}

/** 月令旺衰表（五行在各月令的旺衰状态） */
export const MONTH_POWER: Record<string, Record<number, string>> = {
  '木': {1:'旺',2:'旺',3:'余气',4:'休',5:'休',6:'休',7:'囚',8:'囚',9:'囚',10:'相',11:'相',12:'相'},
  '火': {1:'相',2:'相',3:'相',4:'旺',5:'旺',6:'余气',7:'休',8:'休',9:'休',10:'囚',11:'囚',12:'囚'},
  '金': {1:'囚',2:'囚',3:'囚',4:'相',5:'相',6:'相',7:'旺',8:'旺',9:'余气',10:'休',11:'休',12:'休'},
  '水': {1:'休',2:'休',3:'休',4:'囚',5:'囚',6:'囚',7:'相',8:'相',9:'相',10:'旺',11:'旺',12:'余气'},
  '土': {1:'余气',2:'休',3:'休',4:'囚',5:'囚',6:'相',7:'相',8:'相',9:'休',10:'休',11:'余气',12:'旺'},
}

/** 节气→月支对应表 (approx) */
export const JIE_QI_MONTH_BRANCH: [string, string, number][] = [
  // [节气名, 月支, 大致公历日]
  ['立春', '寅', 2], ['惊蛰', '卯', 3], ['清明', '辰', 4],
  ['立夏', '巳', 5], ['芒种', '午', 6], ['小暑', '未', 7],
  ['立秋', '申', 8], ['白露', '酉', 9], ['寒露', '戌', 10],
  ['立冬', '亥', 11], ['大雪', '子', 12], ['小寒', '丑', 1],
]

/** 每个地支的本气 */
export const DI_ZHI_BEN_QI_WUXING: Record<string, string> = {
  '子': '水', '丑': '土', '寅': '木', '卯': '木',
  '辰': '土', '巳': '火', '午': '火', '未': '土',
  '申': '金', '酉': '金', '戌': '土', '亥': '水',
}
