// ============================================================
// MBTI 表达锚点解析器 — Phase 4e 表达层增强
// 文件：src/server/workflows/mbti-expression.ts
//
// 职责：
//   - 从引擎批注结果（格局 MBTI 映射 + 日主强弱）解析出
//     "类型-身份"（如 INTJ-T），并从知识字典取咨询师口吻表达档案
//   - 供 Step1 性格工作流注入 Prompt 作为表达锚点
//
// 数据优先级：knowledge_assets（personality.mbti_core32_profiles）
//   → 编译时兜底（data/mbti-expression-corpus.ts），DB 故障不死机
//
// 铁律：表达层润色不改变命理结论；输出挂"（现代心理类型视角参考）"
// ============================================================

import type { AnnotationResult } from '../../engine/index'
import { KnowledgeRegistry } from '../../engine/knowledge-registry'
import {
  MBTI_CORE32_PROFILES,
  type MbtiCoreProfile,
} from '../knowledge/mbti-expression-corpus'

/** MBTI 类型字母合法性（四字母，如 INTJ） */
const MBTI_TYPE_RE = /^[EINF][NS][TF][JP]$/

export interface MbtiExpression {
  /** 档案 ID，如 "INTJ-T" */
  id: string
  /** 身份认同：A=自信（身强） T=动荡（身弱） */
  identity: 'A' | 'T'
  cnName: string
  group: string
  baziArchetype: string
  profile: string
  innerNeed: string
  careTip: string
}

/**
 * 日主强弱 → 身份认同
 * 强侧（极强/强/中和偏强）→ A；弱侧（中和偏弱/弱/极弱）→ T；
 * 中和按 score 分界（>=50 → A）
 */
export function resolveIdentity(strength: string, score: number): 'A' | 'T' {
  if (strength === '极强' || strength === '强' || strength === '中和偏强') return 'A'
  if (strength === '中和偏弱' || strength === '弱' || strength === '极弱') return 'T'
  return score >= 50 ? 'A' : 'T'
}

/**
 * 从批注结果解析 MBTI 表达锚点。
 * 任一环节缺失（无典型类型 / 字典未命中）返回 null，调用方降级为原行为。
 */
export function resolveMbtiExpression(annotation: AnnotationResult): MbtiExpression | null {
  const types = annotation.patternAnalysis?.mbti?.typicalTypes ?? []
  const type = types.find(t => MBTI_TYPE_RE.test(t))
  if (!type) return null

  const { strength, score } = annotation.strengthAnalysis
  const identity = resolveIdentity(strength, score)
  const id = `${type}-${identity}`

  const store = KnowledgeRegistry.getByCategory<Record<string, MbtiCoreProfile>>(
    'personality',
    'mbti_core32_profiles',
  )
  const hit = (store ?? MBTI_CORE32_PROFILES)[id]
  if (!hit) return null

  return { id, identity, ...hit }
}

/**
 * 构建 Prompt 注入块。仅当锚点存在时非空。
 */
export function buildMbtiAnchorBlock(expr: MbtiExpression): string {
  return [
    `MBTI 表达锚点（${expr.id} ${expr.cnName}，现代心理类型视角参考，仅用于润色表达，不得据此新增命理结论）：`,
    `- 参考画像：${expr.profile}`,
    `- 内在需要：${expr.innerNeed}`,
    `- 照护建议：${expr.careTip}`,
  ].join('\n')
}
