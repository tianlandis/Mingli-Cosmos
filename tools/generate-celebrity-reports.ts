// ============================================================
// 名人八字报告生成器
// 用法：npx tsx tools/generate-celebrity-reports.ts
// ============================================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assembleReport } from '../src/server/workflows/step-assemble'
import type { PersonalityOutput, LuckOutput, ReportResult } from '../src/server/lib/types'
import type { BaZiResult, AnnotationResult } from '../src/engine/index'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ─── 命例列表 ───
const CASES = [
  { id: 'case-01-qianlong',      name: '爱新觉罗·弘历（乾隆帝）', desc: '帝王之格·正官格' },
  { id: 'case-02-zhugeliang',    name: '诸葛亮',                  desc: '智谋超群·食神制杀格' },
  { id: 'case-06-zhu-yuanzhang', name: '朱元璋',                  desc: '草莽帝王·正印化杀格' },
  { id: 'case-07-zeng-guofan',   name: '曾国藩',                  desc: '文臣典范·正官佩印格' },
  { id: 'case-08-li-bai',        name: '李白',                    desc: '诗仙谪仙·食伤泄秀格' },
]

const PROJECT_ROOT = path.resolve(__dirname, '..')
const FIXTURE_DIR = path.join(PROJECT_ROOT, 'src/server/workflows/__tests__/fixtures')
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'reports/celebrity')

// ─── 基于 annotation 生成 mock PersonalityOutput ───
function makePersonalityOutput(a: AnnotationResult): PersonalityOutput {
  const { overview, patternAnalysis, strengthAnalysis } = a
  const mbti = patternAnalysis.mbti

  const overviewText = [
    `**日主**：${overview.dayMaster}，生于${strengthAnalysis.strength === '强' || strengthAnalysis.strength === '中和偏强' ? '得令' : '失令'}之地，${strengthAnalysis.reasons.join('；')}。`,
    `**格局**：${patternAnalysis.patternName}，${patternAnalysis.description}。`,
    `${patternAnalysis.jiXiongDesc}。`,
    `**经典参照**：${patternAnalysis.classicReference.join('、')}。`,
  ].join('\n\n')

  const mbtiProfileText = [
    `**MBTI 倾向**：${mbti.typicalTypes.join(' / ')}`,
    `**认知功能**：${mbti.cognitiveFunctions}`,
    `**人格画像**：${mbti.portrait}`,
    `**核心特质**：${mbti.traits}`,
    `**适配领域**：${mbti.industrySuggestions.join('、')}`,
    mbti.energyAdjustments.length > 0 ? `**能量调整建议**：${mbti.energyAdjustments.join('；')}` : '',
  ].filter(Boolean).join('\n\n')

  return { overview: overviewText, mbtiProfile: mbtiProfileText }
}

// ─── 基于 annotation 生成 mock LuckOutput ───
function makeLuckOutput(a: AnnotationResult): LuckOutput {
  const { luckAnalysis, patternAnalysis } = a
  const { daYunList, currentYear, milestones } = luckAnalysis

  const best = daYunList.filter(d => d.quality === '佳')
  const worst = daYunList.filter(d => d.quality === '不佳')

  const trendText = [
    `**一生运势总结**：${patternAnalysis.description}`,
    '',
    `**大运脉络**：`,
    ...daYunList.map(d =>
      `- ${d.startAge}-${d.endAge}岁 **${d.ganZhi}**（${d.quality}）：${d.interpretation}`
    ),
    '',
    best.length > 0 ? `**黄金运程**：${best.map(d => `${d.startAge}-${d.endAge}岁`).join('、')}` : '',
    worst.length > 0 ? `**低谷期需谨慎**：${worst.map(d => `${d.startAge}-${d.endAge}岁`).join('、')}` : '',
    '',
    `**当前流年**（${currentYear.ganZhi}）：${currentYear.interpretation}，重点关注：${currentYear.focus.join('、')}。`,
    '',
    milestones.length > 0
      ? `**关键人生节点**：\n${milestones.map(m => `- ${m.age}岁（${m.year}年 ${m.ganZhi}）：${m.event}，${m.reason}`).join('\n')}`
      : '',
  ].filter(Boolean).join('\n')

  const highlightsText = [
    `喜神：${a.wuXingBalance.filter(w => w.level === '偏弱' && w.name !== a.overview.dayMaster.replace(/[金木水火土]/g, '').replace('木火土金水','').slice(0,1)).map(w => w.name).join('、') || '依大运而变'}`,
    `忌神：${a.wuXingBalance.filter(w => w.level === '偏旺').map(w => w.name).join('、') || '无'}`,
    a.patternAnalysis.poGeRisks.length > 0
      ? `破格风险：${a.patternAnalysis.poGeRisks.map(r => `${r.type}（${r.severity}）`).join('、')}`
      : '无破格之虞',
    `综合建议：${a.comprehensiveAdvice.join('；')}`,
  ].join('\n\n')

  return { trend: trendText, highlights: highlightsText }
}

// ─── 主流程 ───
function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const reports: Record<string, ReportResult> = {}

  for (const c of CASES) {
    const fixturePath = path.join(FIXTURE_DIR, `${c.id}.json`)
    const raw = fs.readFileSync(fixturePath, 'utf-8')
    const data = JSON.parse(raw) as { chart: BaZiResult; annotation: AnnotationResult }

    const personality = makePersonalityOutput(data.annotation)
    const luck = makeLuckOutput(data.annotation)

    const report = assembleReport(data.chart, data.annotation, personality, luck)
    reports[c.id] = report

    // 写入 Markdown 文件
    const outPath = path.join(OUTPUT_DIR, `${c.id}.md`)
    const header = [
      `# 名人八字报告：${c.name}`,
      `> ${c.desc}`,
      `> 生成时间：${new Date().toISOString().split('T')[0]}`,
      '',
      '---',
      '',
    ].join('\n')

    fs.writeFileSync(outPath, header + report.markdown, 'utf-8')
    console.log(`✅ ${c.name} → ${path.relative(process.cwd(), outPath)}`)
  }

  // 写入汇总 JSON
  const summaryPath = path.join(OUTPUT_DIR, 'celebrity-reports.json')
  fs.writeFileSync(summaryPath, JSON.stringify(reports, null, 2), 'utf-8')
  console.log(`\n📦 汇总 JSON → ${path.relative(process.cwd(), summaryPath)}`)
  console.log(`📊 共生成 ${CASES.length} 份名人报告`)
}

main()
