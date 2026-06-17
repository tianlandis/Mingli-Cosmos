// ============================================================
// 名人报告验证测试 — celebrity-reports.test.ts
// 文件：tests/celebrity-reports.test.ts
// 验证 5 个名人 fixture → 完整报告 → sections 结构完整性
// ============================================================
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { assembleReport } from '@/server/workflows/step-assemble'
import type { BaZiResult, AnnotationResult } from '@/engine/index'
import type { ReportResult, ReportSection } from '@/server/lib/types'

// ─── fixture 列表 ───
const FIXTURE_DIR = path.resolve(__dirname, '../src/server/workflows/__tests__/fixtures')
const REPORT_DIR = path.resolve(__dirname, '../reports/celebrity')

interface CelebrityCase {
  id: string
  name: string
  pattern: string
  file: string
}

const CELEBRITY_CASES: CelebrityCase[] = [
  { id: 'case-01-qianlong',      name: '乾隆帝',   pattern: '正官格',      file: 'case-01-qianlong.json' },
  { id: 'case-02-zhugeliang',    name: '诸葛亮',   pattern: '食神制杀格',  file: 'case-02-zhugeliang.json' },
  { id: 'case-06-zhu-yuanzhang', name: '朱元璋',   pattern: '正印化杀格',  file: 'case-06-zhu-yuanzhang.json' },
  { id: 'case-07-zeng-guofan',   name: '曾国藩',   pattern: '正官佩印格',  file: 'case-07-zeng-guofan.json' },
  { id: 'case-08-li-bai',        name: '李白',     pattern: '食伤泄秀格',  file: 'case-08-li-bai.json' },
]

// ─── 加载 fixture ───
function loadCase(id: string, file: string): { chart: BaZiResult; annotation: AnnotationResult } {
  const raw = fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf-8')
  return JSON.parse(raw)
}

// ─── 测试套件 1：fixture 结构校验 ───
describe('名人 fixture 结构校验', () => {
  for (const c of CELEBRITY_CASES) {
    it(`${c.name} (${c.id}) fixture 结构完整`, () => {
      const data = loadCase(c.id, c.file)

      // chart 必填字段
      expect(data.chart.dayMaster).toBeTruthy()
      expect(data.chart.yearPillar.ganZhi).toBeTruthy()
      expect(data.chart.monthPillar.ganZhi).toBeTruthy()
      expect(data.chart.dayPillar.ganZhi).toBeTruthy()
      expect(data.chart.hourPillar.ganZhi).toBeTruthy()
      expect(Object.keys(data.chart.fiveElements).length).toBe(5)

      // annotation 必填字段
      expect(data.annotation.overview.summary).toBeTruthy()
      expect(data.annotation.patternAnalysis.patternName).toBeTruthy()
      expect(data.annotation.strengthAnalysis.strength).toBeTruthy()
      expect(data.annotation.wuXingBalance.length).toBe(5)
      expect(data.annotation.specialTopics.personality.length).toBeGreaterThan(0)
      expect(data.annotation.specialTopics.career.length).toBeGreaterThan(0)
      expect(data.annotation.specialTopics.wealth.length).toBeGreaterThan(0)
      expect(data.annotation.specialTopics.marriage.length).toBeGreaterThan(0)
      expect(data.annotation.specialTopics.health.length).toBeGreaterThan(0)
      expect(data.annotation.specialTopics.children.length).toBeGreaterThan(0)
      expect(data.annotation.disclaimer).toContain('仅供文化娱乐参考')
    })
  }
})

// ─── 测试套件 2：格局名称匹配 ───
describe('名人格局匹配', () => {
  for (const c of CELEBRITY_CASES) {
    it(`${c.name} 格局 = ${c.pattern}`, () => {
      const data = loadCase(c.id, c.file)
      expect(data.annotation.patternAnalysis.patternName).toBe(c.pattern)
    })
  }
})

// ─── 测试套件 3：报告组装输出 ───
describe('名人报告组装', () => {
  for (const c of CELEBRITY_CASES) {
    describe(c.name, () => {
      let report: ReportResult
      let chartData: { chart: BaZiResult; annotation: AnnotationResult }

      beforeAll(() => {
        chartData = loadCase(c.id, c.file)
        const mockPersonality = {
          overview: `## 性格分析\n\n${chartData.annotation.patternAnalysis.description}`,
          mbtiProfile: `**MBTI**：${chartData.annotation.patternAnalysis.mbti.typicalTypes.join('/')}\n\n${chartData.annotation.patternAnalysis.mbti.portrait}`,
        }
        const mockLuck = {
          trend: `## 运势分析\n\n${chartData.annotation.luckAnalysis.daYunList.map(d => d.interpretation).join('\n\n')}`,
          highlights: chartData.annotation.comprehensiveAdvice.join('；'),
        }
        report = assembleReport(chartData.chart, chartData.annotation, mockPersonality, mockLuck)
      })

      it('report 非空有 markdown + sections', () => {
        expect(report.markdown.length).toBeGreaterThan(200)
        expect(report.sections.length).toBe(5)
      })

      it('sections 包含 5 个标准 id', () => {
        const ids = report.sections.map(s => s.id)
        expect(ids).toContain('seal')
        expect(ids).toContain('personality')
        expect(ids).toContain('luck')
        expect(ids).toContain('topics')
        expect(ids).toContain('disclaimer')
      })

      it('seal section 含 命书 标题', () => {
        const seal = report.sections.find(s => s.id === 'seal')!
        expect(seal.content).toContain('命书')
      })

      it('markdown 含四柱表格', () => {
        expect(report.markdown).toContain('| 柱位 | 天干 | 地支 | 干支 | 五行 |')
        expect(report.markdown).toContain(chartData.chart.dayMaster)
      })

      it('markdown 含免责声明', () => {
        expect(report.markdown).toContain('仅供文化娱乐参考')
      })

      it('markdown 含 dayMaster', () => {
        expect(report.markdown).toContain(chartData.annotation.overview.dayMaster)
      })
    })
  }
})

// ─── 测试套件 4：已生成报告文件校验 ───
describe('已生成 Markdown 报告文件', () => {
  for (const c of CELEBRITY_CASES) {
    it(`${c.name} 报告文件存在且有内容`, () => {
      const filePath = path.join(REPORT_DIR, `${c.id}.md`)
      expect(fs.existsSync(filePath)).toBe(true)
      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content.length).toBeGreaterThan(500)
      expect(content).toContain('数字命书')
      expect(content).toContain(c.name)
    })
  }

  it('汇总 JSON 存在', () => {
    const summaryPath = path.join(REPORT_DIR, 'celebrity-reports.json')
    expect(fs.existsSync(summaryPath)).toBe(true)
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'))
    const ids = Object.keys(summary)
    expect(ids.length).toBe(5)
    for (const c of CELEBRITY_CASES) {
      expect(ids).toContain(c.id)
    }
  })
})

// ─── 测试套件 5：报告区分度验证 ───
describe('名人报告区分度', () => {
  it('5 个命例 markdown 互不相同', () => {
    const contents = CELEBRITY_CASES.map(c => {
      const filePath = path.join(REPORT_DIR, `${c.id}.md`)
      return fs.readFileSync(filePath, 'utf-8')
    })

    for (let i = 0; i < contents.length; i++) {
      for (let j = i + 1; j < contents.length; j++) {
        expect(contents[i]).not.toBe(contents[j])
      }
    }
  })

  it('5 个命例 dayMaster 各不相同或有区分', () => {
    const dayMasters = CELEBRITY_CASES.map(c => {
      const data = loadCase(c.id, c.file)
      return { name: c.name, dm: data.annotation.overview.dayMaster }
    })

    // 所有 dayMaster 都应定义
    for (const d of dayMasters) {
      expect(d.dm).toBeTruthy()
    }

    // 至少应有 2 种以上不同 dayMaster（庚/丙/丁/己/乙）
    const uniqueDMs = new Set(dayMasters.map(d => d.dm))
    expect(uniqueDMs.size).toBeGreaterThanOrEqual(2)
  })

  it('5 个命例格局各不相同', () => {
    const patterns = CELEBRITY_CASES.map(c => c.pattern)
    const unique = new Set(patterns)
    expect(unique.size).toBe(5)
  })
})
