// ============================================================
// System Prompt 构建器（多体系路由）
// 文件：src/server/prompts/system.ts
//
// [ADR-011 阶段3] 行为等价重构：
//   - 骨架只负责「读后台自定义指令 + 按体系选引擎」，不再感知任何体系细节；
//   - 体系细节（角色 / 数据段 / 护栏）全部下沉到该体系的 SystemEngine.buildPrompt；
//   - buildSystemPrompt(chart, annotation, ...) 保留原签名，内部委托 bazi 引擎，
//     对既有调用方与回归测试**逐字等价**。
// ============================================================

import type { BaZiResult, AnnotationResult } from '../../engine/index'
import { requireSystemEngine, DEFAULT_SYSTEM } from '../systems/registry'
import { isDbReady, listPrompts } from '../db'

/**
 * 读取管理后台中「启用」的自定义模板，拼装为管理员自定义指令段
 *
 * 设计约束：
 * - DB 未初始化 / 未配置任何自定义模板 → 返回 null，行为与历史版本完全一致（可回归）
 * - 仅消费 category='custom' 且 isActive=1 的模板，内置模板不参与
 * - 任何异常静默降级，绝不因配置问题中断排盘对话
 */
function buildAdminInstructionSection(): string | null {
  try {
    if (!isDbReady()) return null

    const customs = listPrompts().filter(
      p => p.isActive === 1 && (p.category === 'custom' || p.isBuiltin === 0),
    )
    if (customs.length === 0) return null

    const blocks = customs.map(p => `### ${p.displayName || p.name}\n${p.content}`)
    return `## 管理员自定义指令（prompt_templates · 热生效）\n\n${blocks.join('\n\n')}`
  } catch {
    return null
  }
}

/**
 * [ADR-011] 按体系构建 System Prompt —— 唯一入口。
 *
 * @param system  体系 id（如 'bazi'）；未注册将抛错（调用方应先用 isKnownSystem 校验）
 * @param result  该体系的产物（bazi: { chart, annotation }）
 * @param reportSummary 命书摘要（可选，跨体系通用）
 */
export function buildSystemPromptFor(
  system: string,
  result: unknown,
  reportSummary?: string,
): string {
  const engine = requireSystemEngine(system)
  return engine.buildPrompt(result, {
    reportSummary,
    adminSection: buildAdminInstructionSection(),
  })
}

/**
 * 八字专用快捷入口（保持既有签名与输出，内部委托注册表）。
 * 上游（A 模式对话 / B 模式命书 / 集成测试）无需改动。
 */
export function buildSystemPrompt(
  chart: BaZiResult,
  annotation: AnnotationResult,
  reportSummary?: string,
): string {
  return buildSystemPromptFor(DEFAULT_SYSTEM, { chart, annotation }, reportSummary)
}
