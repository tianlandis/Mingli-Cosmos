// ============================================================
// 调试样例命例 — samples.ts
// 文件：src/server/prompts/samples.ts
// 职责：为 Prompt 调试沙盒提供「真实命盘样例」，
//       使管理员能在沙盒中直接调试「运行时真实 System Prompt」，
//       而不是只调试编辑器里的模板文本（R3 闭环的关键一环）
//
// 数据来源：与 workflows/__tests__/fixtures 同源的历史命例快照
// 只读：不参与业务逻辑，仅供调试与预览
// ============================================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { BaZiResult } from '../../engine/types'
import type { AnnotationResult } from '../../engine/annotation/types'
import { buildSystemPrompt } from './system'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SAMPLES_DIR = path.resolve(__dirname, 'samples')

export interface SampleMeta {
  id: string
  label: string
  description: string
}

export interface SampleChart extends BaZiResult {}
export interface SampleAnnotation extends AnnotationResult {}

/** 样例清单（label 为人类可读名称，供管理后台下拉展示） */
const SAMPLE_LIST: SampleMeta[] = [
  { id: 'qianlong', label: '乾隆帝', description: '辛卯年 · 身强 · 经典帝王格，适合验证格局与用神表述' },
  { id: 'normal-male', label: '普通男命', description: '常规男命，适合验证性格与事业批注的普适表达' },
  { id: 'normal-female', label: '普通女命', description: '常规女命，适合验证婚姻与子女专题的表述边界' },
]

/**
 * 列出可用调试样例
 */
export function listSamples(): SampleMeta[] {
  return SAMPLE_LIST.map(s => ({ ...s }))
}

/**
 * 加载样例命盘与批注
 * @throws 样例不存在或文件损坏时抛错（由调用方转为 404）
 */
export function loadSample(id: string): { chart: BaZiResult; annotation: AnnotationResult } {
  const meta = SAMPLE_LIST.find(s => s.id === id)
  if (!meta) throw new Error(`SAMPLE_NOT_FOUND: ${id}`)

  const file = path.resolve(SAMPLES_DIR, `${id}.json`)
  if (!fs.existsSync(file)) throw new Error(`SAMPLE_FILE_MISSING: ${id}`)

  const raw = fs.readFileSync(file, 'utf-8')
  const parsed = JSON.parse(raw) as { chart: BaZiResult; annotation: AnnotationResult }
  if (!parsed.chart || !parsed.annotation) {
    throw new Error(`SAMPLE_MALFORMED: ${id}`)
  }
  return parsed
}

/**
 * 渲染「运行时真实 System Prompt」
 * 即实际对话中注入 LLM 的完整内容（含命盘数据 + L3 动态护栏 + 管理员自定义指令）
 */
export function renderRuntimePrompt(sampleId: string): string {
  const { chart, annotation } = loadSample(sampleId)
  return buildSystemPrompt(chart, annotation)
}
