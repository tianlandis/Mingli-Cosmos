// ============================================================
// [ADR-011] 体系注册表 —— 唯一的「体系发现」入口
// 文件：src/server/systems/registry.ts
//
// 新增一个体系 = 「实现一个 SystemEngine + 在下方注册一行」，
// 无需改动共享骨架（鉴权 / 额度 / 对话 / 会话持久化 / 可观测 / 支付）。
// ============================================================

import type { AnySystemEngine, SystemEngine } from './types'
import { baziEngine } from './bazi'

const REGISTRY = new Map<string, AnySystemEngine>()

/** 默认体系（旧请求不带 system 时落到此） */
export const DEFAULT_SYSTEM = 'bazi'

/**
 * 注册体系引擎（幂等：重复 id 覆盖并告警，避免重复初始化崩溃）
 * 供内置体系在模块加载期注册，也供测试注入 mock 体系以验证可插拔性。
 */
export function registerSystem(engine: AnySystemEngine): void {
  if (REGISTRY.has(engine.id)) {
    console.warn(`[Systems] 覆盖已注册体系: ${engine.id}`)
  }
  REGISTRY.set(engine.id, engine)
}

/** 按 id 取引擎（不存在返回 undefined） */
export function getSystemEngine(id: string): AnySystemEngine | undefined {
  return REGISTRY.get(id)
}

/** 按 id 取引擎（不存在抛错，用于确定能拿到的路径） */
export function requireSystemEngine(id: string): AnySystemEngine {
  const engine = REGISTRY.get(id)
  if (!engine) {
    throw new Error(`未注册的体系: ${id}（可用: ${listSystemIds().join(', ') || '无'}）`)
  }
  return engine
}

/** 已注册体系 id 列表 */
export function listSystemIds(): string[] {
  return [...REGISTRY.keys()]
}

/** 是否已注册某体系 */
export function isKnownSystem(id: string): boolean {
  return REGISTRY.has(id)
}

/**
 * 泛型计算入口：以调用方指定的 TResult 类型取回计算结果。
 * 注册表内部以 unknown 存放（异质），此函数负责对外恢复类型。
 */
export async function computeSystem<TResult>(id: string, input: unknown): Promise<TResult> {
  const engine = requireSystemEngine(id)
  return (await engine.compute(input)) as TResult
}

/** 类型级辅助：把具体体系引擎注册进异质注册表时的统一收窄点 */
export type { SystemEngine }

// ── 内置体系注册（新体系在此追加一行即可）──
registerSystem(baziEngine)
