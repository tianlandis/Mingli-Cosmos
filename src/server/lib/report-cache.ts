// ============================================================
// 命书结果缓存 —— 按 chart 指纹复用
// 文件：src/server/lib/report-cache.ts
//
// 为什么需要：命书 pipeline 内部有 4 次大模型调用，是全场最贵的操作。
// 同一个人（甚至不同的人）拿同一张命盘反复生成，成本完全一样但结果也几乎一样。
// 按 chartHash 缓存后：
//   - 重复请求**不扣额度、不烧 token**（缓存命中直接返回）
//   - 防刷：成本与"不同命盘数"挂钩，而不是与"请求数"挂钩
//
// 实现：复用通用 TTL+LRU 缓存（ttl-cache.ts），本文件只负责命名空间与可观测。
// ============================================================

import { createTtlCache, type TtlCache } from './ttl-cache'

/** 默认容量 200，默认有效期 24 小时 */
let cache: TtlCache = createTtlCache(200)

/** 重置缓存（测试用；传参数则按新参数重建实例） */
export function resetReportCache(options?: { max?: number; ttlMs?: number }): void {
  if (options?.max !== undefined || options?.ttlMs !== undefined) {
    cache = createTtlCache(options.max ?? 200, options.ttlMs ?? 24 * 60 * 60 * 1000)
  }
  cache.clear()
}

/** 取缓存命书（未命中/已过期返回 undefined） */
export function getCachedReport(chartHash: string): unknown | undefined {
  return cache.get(`report:${chartHash}`)
}

/** 写入缓存 */
export function setCachedReport(chartHash: string, report: unknown): void {
  cache.set(`report:${chartHash}`, report)
}

/** 可观测：当前缓存条目数 */
export function reportCacheSize(): number {
  return cache.size()
}
