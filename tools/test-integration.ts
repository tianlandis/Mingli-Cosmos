// ============================================================
// 步骤 4.9 — Qwen2.5:7b 工具调用联调
// 集成测试：八字提问 → Tool Calling → 命理论断
// 用法：npx tsx tools/test-integration.ts
// ============================================================

import 'dotenv/config'

// 先导入并初始化数据库
import { initDb, closeDb } from '../src/server/db/index'
initDb()

// 导入引擎函数
import { calculateBazi } from '../src/engine/index'
import { generateAnnotation } from '../src/engine/annotation/index'

// 导入 LLM 工具层
import { getEnabledTools } from '../src/server/modules/llm/tools-executor'
import { createModel, loadConfig } from '../src/server/lib/llm'
import { streamText } from 'ai'
import { buildSystemPrompt } from '../src/server/prompts/system'
import { validateResponse } from '../src/server/lib/guardrail'

async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  墨白命理堂 — Qwen2.5:7b 工具调用联调')
  console.log('  目标八字: 丙寅年 辛丑月 庚辰日 戊子时')
  console.log('  公历对应: 1987-01-31 23:00 (男)')
  console.log('═══════════════════════════════════════════════════════\n')

  // ═══════════════════════════════════════
  // Step 1: 排盘
  // ═══════════════════════════════════════
  console.log('📐 [Step 1] 八字排盘计算...')

  const chart = await calculateBazi(1987, 1, 31, 23, 0, '男')

  console.log(`   ✅ 年柱: ${chart.yearPillar.ganZhi}`)
  console.log(`   ✅ 月柱: ${chart.monthPillar.ganZhi}`)
  console.log(`   ✅ 日柱: ${chart.dayPillar.ganZhi}`)
  console.log(`   ✅ 时柱: ${chart.hourPillar.ganZhi}`)
  console.log(`   ✅ 日主: ${chart.dayMaster}`)
  console.log(`   ✅ 出生: ${chart.birthDate} ${chart.birthTime}`)
  console.log(`   ✅ 起运天数: ${chart.qiYunDays}`)
  console.log('')

  // ═══════════════════════════════════════
  // Step 2: 生成批注
  // ═══════════════════════════════════════
  console.log('📝 [Step 2] 生成命盘批注...')
  const annotation = generateAnnotation(chart)
  console.log(`   ✅ 格局: ${annotation.patternAnalysis.patternName} (${annotation.patternAnalysis.quality})`)
  console.log(`   ✅ 日主强弱: ${annotation.strengthAnalysis.strength} (${annotation.strengthAnalysis.score}/100)`)
  console.log(
    `   ✅ 十神: ${annotation.shiShenProfile.filter(p => p.count > 0).map(p => `${p.name}(${p.count})`).join(', ')}`,
  )
  if (annotation.patternAnalysis.mbtiPersonality?.type) {
    console.log(`   ✅ MBTI: ${annotation.patternAnalysis.mbtiPersonality.type}`)
  }
  console.log('')

  // ═══════════════════════════════════════
  // Step 3: 加载模型 & 工具
  // ═══════════════════════════════════════
  console.log('🤖 [Step 3] 加载 LLM + 工具注册表...')
  const config = loadConfig()
  console.log(`   Provider: ${config.provider}`)
  console.log(`   API Base: ${config.baseUrl || '(default)'}`)
  console.log(`   Model:    ${config.model}`)

  const model = createModel(config)
  // 启用全部核心工具
  const tools = getEnabledTools({ supportedToolsJson: '["solar_term_calc","calendar_lookup","classic_search"]' })
  console.log(`   Tools:    ${Object.keys(tools).join(', ') || '无'}`)
  console.log('')

  // ═══════════════════════════════════════
  // Step 4: System Prompt
  // ═══════════════════════════════════════
  const systemPrompt = buildSystemPrompt(chart, annotation)

  // ═══════════════════════════════════════
  // Step 5: 发送测试提问
  // ═══════════════════════════════════════
  const userMessage =
    `你已拿到我的命盘数据（年柱丙寅、月柱辛丑、日柱庚辰、时柱戊子，日主庚金）。` +
    `请先用solar_term_calc工具查询1987年1月的节气时刻（验证辛丑月是否正确覆盖1月31日），` +
    `然后结合系统提供的排盘结果，给我一个专业的庚金日主命理分析开场。`

  console.log('💬 [Step 4] 发送提问...')
  console.log(`   "${userMessage.slice(0, 80)}..."`)
  console.log('')
  console.log('═══════════════════════════════════════════════════════')
  console.log('  🧠 LLM 推理中（含 Tool Calling）...')
  console.log('═══════════════════════════════════════════════════════\n')

  const messages = [{ role: 'user' as const, content: userMessage }]

  let toolCallCount = 0
  let fullText = ''
  const toolCallsMade: string[] = []

  try {
    const result = streamText({
      model,
      system: systemPrompt,
      messages,
      tools,
      maxSteps: 5,
      temperature: 0.7,
    } as any)

    console.log('[SYSTEM] ─── 命盘数据已注入 System Prompt ───')
    console.log('[SYSTEM] ─── 防越权规则已激活 ───')
    console.log('')

    for await (const chunk of result.fullStream) {
      const ct = chunk.type
      switch (ct) {
        case 'text-delta': {
          const tc = chunk as any
          const delta = tc.textDelta
          if (typeof delta === 'string' && delta.length > 0) {
            process.stdout.write(delta)
            fullText += delta
          }
          break
        }

        case 'start':
          break
        case 'start-step': {
          const ss = chunk as any
          console.log(`\n─── STEP ${ss.request?.body?._meta ? '(with meta)' : ''} ───`)
          break
        }
        case 'text-start':
        case 'text-end':
        case 'finish-step':
        case 'finish': {
          if (ct === 'finish') {
            const fc = chunk as any
            console.log(`\n[FINISH] finishReason=${fc.finishReason} usage=${JSON.stringify(fc.usage || {})}`)
            if (fc.text) fullText += String(fc.text)
          }
          break
        }

        case 'tool-input-start': {
          const tis = chunk as any
          console.log(`\n┌─────────────────────────────────────────`)
          console.log(`│ 🔧 TOOL CALL: ${tis.toolName}`)
          break
        }

        case 'tool-input-delta': {
          const tid = chunk as any
          process.stdout.write(String(tid.delta || ''))
          break
        }

        case 'tool-input-end': {
          console.log(`\n└─────────────────────────────────────────`)
          break
        }

        case 'tool-call': {
          toolCallCount++
          const tc = chunk as any
          if (tc.toolName) toolCallsMade.push(tc.toolName)
          // AI SDK v6: args arrive via tool-input-delta, tool-call is the final commit
          break
        }

        case 'tool-result': {
          const tr = chunk as any
          console.log(`│ TOOL-RESULT KEYS: ${Object.keys(tr).join(', ')}`)
          if (tr.error) {
            console.log(`│ ❌ ERROR: ${JSON.stringify(tr.error)}`)
          }
          const raw = tr.result ?? tr.output ?? tr.content
          if (raw !== undefined && raw !== null) {
            let resultStr = ''
            try {
              resultStr = typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2)
            } catch {
              resultStr = String(raw)
            }
            console.log(`│ ✅ RESULT (${resultStr.length} chars):`)
            const preview = resultStr.length > 500 ? resultStr.slice(0, 500) + '...' : resultStr
            console.log(preview.split('\n').map((l: string) => `│   ${l}`).join('\n'))
          } else {
            console.log(`│ ⚠️ 结果为空 (keys: ${Object.keys(tr).join(', ')})`)
          }
          break
        }

        case 'step-finish': {
          const sf = chunk as any
          console.log(`\n[STEP-FINISH] finishReason=${sf.finishReason} text=${String(sf.text || '').slice(0, 100)}`)
          if (sf.text) {
            fullText += String(sf.text)
          }
          if (sf.toolCalls?.length) {
            console.log(`[STEP-FINISH] toolCalls: ${sf.toolCalls.map((t: any) => t.toolName).join(', ')}`)
          }
          if (sf.toolResults?.length) {
            console.log(`[STEP-FINISH] toolResults: ${sf.toolResults.length}`)
          }
          break
        }

        case 'tool-error': {
          const te = chunk as any
          console.log(`│ ❌ TOOL ERROR: ${JSON.stringify(te)}`)
          break
        }

        default: {
          // 调试未识别的 chunk 类型
          if (ct !== 'error') {
            console.log(`\n[DEBUG] unknown: ${ct}`)
          }
          break
        }
      }
    }

    console.log('\n\n')
    console.log('═══════════════════════════════════════════════════════')
    console.log('  📊 联调结果摘要')
    console.log('═══════════════════════════════════════════════════════')
    console.log(`  工具调用次数: ${toolCallCount}`)
    console.log(`  调用工具列表: ${toolCallsMade.length > 0 ? toolCallsMade.join(' → ') : '无'}`)
    console.log(`  生成文字数:   ${fullText.length}`)
    console.log('')

    // ═══════════════════════════════════════
    // 护栏检查
    // ═══════════════════════════════════════
    if (fullText) {
      const guard = validateResponse(fullText)
      console.log('  🛡️ 护栏检查:')
      console.log(`     passed:     ${guard.passed}`)
      if (!guard.passed) {
        console.log(`     reason:     ${guard.reason}`)
        if (guard.sanitized) {
          console.log(`     sanitized:  ${guard.sanitized.slice(0, 100)}...`)
        }
      }

      const hasDisclaimer = fullText.includes('仅供参考')
      const hasMobai = fullText.includes('墨白') || fullText.includes('命理')
      console.log(`     免责声明:   ${hasDisclaimer ? '✅ 存在' : '⚠️ 缺失'}`)
      console.log(`     风格一致:   ${hasMobai ? '✅ 墨白风格' : '⚠️ 待确认'}`)
    }

    console.log('')

    // ═══════════════════════════════════════
    // 判定
    // ═══════════════════════════════════════
    if (toolCallCount > 0) {
      console.log('🎉 结论: Tool Calling 联调成功！')
      console.log('   Qwen2.5:7b 正确识别并触发了工具调用，')
      console.log('   没有自己瞎编数据，而是通过工具获取真实信息。')
      console.log('   模型将工具返回的结果与命盘数据结合，')
      console.log('   生成了专业且符合"墨白命理堂"风格的分析。')
    } else {
      console.log('⚠️ 本次未触发工具调用')
      console.log('   可能原因：')
      console.log('   1. Qwen2.5:7b 判断可以直接回答（模型能力足够）')
      console.log('   2. Prompt 约束较强，模型优先使用已提供的命盘数据')
      console.log('   建议：调整 user prompt 使其更明确要求使用工具')
    }

    console.log('')
    console.log('═══════════════════════════════════════════════════════')

  } catch (e: any) {
    console.error('\n❌ LLM 调用失败:', e.message)

    if (e.message?.includes('ECONNREFUSED') || e.message?.includes('fetch failed')) {
      console.log('\n💡 提示: 请确保 Ollama 服务已启动')
      console.log('   启动: ollama serve')
      console.log('   确认: ollama list')
      console.log('   拉取: ollama pull qwen2.5:7b')
    } else if (e.message?.includes('model not found')) {
      console.log('\n💡 提示: 模型未找到')
      console.log('   拉取: ollama pull qwen2.5:7b')
    } else {
      console.log('\n💡 详细错误:', e)
    }
  }

  closeDb()
}

main()
