// ============================================================
// [ADR-011] 多体系注册表 —— 统一体系引擎接口
// 文件：src/server/systems/types.ts
//
// 目的：把「体系」提升为一等概念。第 N 个体系 = 实现一个 SystemEngine + 注册，
//       共享骨架（鉴权 / 额度 / 对话 / 会话持久化 / 可观测 / 支付结算）零重复。
//
// 引擎红线：本层**只做适配与编排**，绝不修改 src/engine/（八字引擎已封版）；
//           外围模块只允许通过 src/engine/index.ts 访问引擎。
// ============================================================

/**
 * 体系引擎统一接口（对齐 ADR-011；含实施期增补，见 ADR「实施注记」）。
 *
 * 泛型：TInput = 输入（如生辰 BirthInput），TResult = 体系产物（如 { map payload }）。
 *
 * 关键设计：所有方法与 buildPrompt 均以**方法简写**声明（非箭头属性），
 * 从而获得 TypeScript 方法参数**双变性**（bivariance）——
 * 使具体体系（`SystemEngine<BirthInput, BaziBundle>`）能安全存入
 * 异质注册表 `SystemEngine<unknown, unknown>`，无需 `any` 或强制断言。
 */
export interface SystemEngine<TInput = unknown, TResult = unknown> {
  /** 体系标识：'bazi' | 'astro' | 'mbti' | ...（与 sessions.system 对齐） */
  readonly id: string
  /** 引擎口径版本（如 'v4.1.0'）；写入 sessions.engine_version 供追溯 */
  readonly version: string

  /** 计算：纯函数或异步；**不得有副作用**（落库由调用方负责） */
  compute(input: TInput): Promise<TResult> | TResult

  /** 稳定指纹：口径必须带体系前缀命名空间，如 'bazi:v1:<sha256>' */
  hash(result: TResult): string

  /** 产物形状守卫：判定未知 payload 是否为本体系的合法产物 */
  isValidResult(value: unknown): value is TResult

  /** 可选：两个产物的首个差异描述（校验不一致时的人类可读 detail） */
  firstDifference?(expected: TResult, actual: TResult): string | null

  /** 产出注入 LLM 的「体系上下文」文本（数据段） */
  ctxFor(result: TResult): string

  /**
   * 完整 System Prompt（角色 + 体系上下文 + 防幻觉护栏）。
   * 由**体系自持**，使共享骨架（prompts/system.ts）无需感知任何体系细节；
   * adminSection 由骨架读取后台配置后注入，保证「管理员自定义指令」跨体系一致。
   */
  buildPrompt(
    result: TResult,
    opts?: { reportSummary?: string; adminSection?: string | null },
  ): string
}

/** 异质注册表内部存放类型（具体体系因方法双变性可赋值到此类型） */
export type AnySystemEngine = SystemEngine<unknown, unknown>
