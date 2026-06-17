// ============================================================
// 真实 LLM 调用验证脚本
// 用法: npx tsx tools/test-real-llm.ts
// ============================================================

// 从项目根加载 .env（dotenv 自动向上查找）
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runReportPipeline } from '../src/server/workflows/index'
import type { ReportRequest } from '../src/server/lib/types'
import type { BaZiResult, AnnotationResult } from '../src/engine/index'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const FIXTURE_PATH = path.resolve(__dirname, '../src/server/workflows/__tests__/fixtures/case-01-qianlong.json')

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('  八字排盘 — 真实 LLM 调用验证')
  console.log('═══════════════════════════════════════════')

  // 1. 读取环境变量
  const provider = process.env.LLM_PROVIDER ?? 'local'
  const baseUrl = process.env.LLM_BASE_URL ?? 'http://localhost:11434/v1'
  const model = process.env.LLM_MODEL ?? 'qwen2.5:7b'
  console.log(`\n📋 当前配置:`)
  console.log(`   Provider : ${provider}`)
  console.log(`   Base URL : ${baseUrl}`)
  console.log(`   Model    : ${model}`)

  // 2. 检查基础连通性
  console.log(`\n🔌 测试 API 连通性...`)
  try {
    const healthResp = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${process.env.LLM_API_KEY ?? 'ollama'}` },
    })
    if (healthResp.ok) {
      const data = await healthResp.json()
      const models = Array.isArray(data?.data) ? data.data.map((m: any) => m.id).join(', ') : 'unknown'
      console.log(`   ✅ API 可达 — 可用模型: ${models}`)
    } else {
      console.log(`   ⚠️  /models 返回 ${healthResp.status}，继续尝试生成...`)
    }
  } catch (e: any) {
    console.log(`   ⚠️  无法连接 ${baseUrl}: ${e.message}`)
    console.log(`   请确认 Ollama / LM Studio 已启动，且 BASE_URL 正确`)
    process.exit(1)
  }

  // 3. 读取命例
  console.log(`\n📄 加载命例: case-01-qianlong (乾隆帝)`)
  const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8')) as {
    chart: BaZiResult
    annotation: AnnotationResult
  }

  console.log(`   日主: ${fixture.chart.dayMaster}`)
  console.log(`   格局: ${fixture.annotation.patternAnalysis.patternType}「${fixture.annotation.patternAnalysis.patternName}」`)

  // 4. 运行流水线
  console.log(`\n🚀 运行命书生成流水线 (Step 1→2→3)...`)
  const startTime = Date.now()

  const result = await runReportPipeline(fixture as ReportRequest)

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`   耗时: ${elapsed}s`)

  if (!result.ok) {
    console.log(`\n❌ 流水线失败!`)
    console.log(`   Step : ${result.step}`)
    console.log(`   Error: ${result.error}`)
    process.exit(1)
  }

  // 5. 输出结果
  console.log(`\n✅ 流水线成功!`)
  console.log(`   章节数: ${result.data.sections.length}`)
  for (const s of result.data.sections) {
    console.log(`   - ${s.id}: ${s.title} (${s.content.length} chars)`)
  }

  // 6. 保存报告
  const outputDir = path.resolve(__dirname, '../reports/real-llm-test')
  fs.mkdirSync(outputDir, { recursive: true })
  const outputPath = path.join(outputDir, 'case-01-qianlong.md')
  fs.writeFileSync(outputPath, result.data.markdown, 'utf-8')
  console.log(`\n📝 报告已保存: ${outputPath}`)

  // 7. 预览前 500 字
  console.log(`\n═══════════════════════════════════════════`)
  console.log(`  报告预览（前 600 字）`)
  console.log(`═══════════════════════════════════════════`)
  console.log(result.data.markdown.slice(0, 600))
  if (result.data.markdown.length > 600) console.log('  ...')

  console.log(`\n═══════════════════════════════════════════`)
  console.log(`  ✅ 真实 LLM 调用验证通过!`)
  console.log(`═══════════════════════════════════════════`)
}

main().catch((e) => {
  console.error('\n❌ 未预期的错误:', e)
  process.exit(1)
})
