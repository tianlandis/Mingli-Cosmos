// ============================================================
// 进程内 TTL + LRU 缓存（通用）
// 文件：src/server/lib/ttl-cache.ts
//
// 用途：缓存「同一输入必然得出同一输出」的昂贵结果。
//   命书  = 4 次大模型调用
//   合盘  = 2 次排盘 + 规则推演（虽然便宜，但重复算也没意义）
//
// 为什么进程内而不是表：
//   1. 无需 schema 迁移，老库零升级成本
//   2. 这类结果重建代价可接受（命书重生成、合盘重算几毫秒）
//   3. 后续要跨进程共享时，替换本文件实现即可，调用方无感
// ============================================================

export interface TtlCache {
  get(key: string): unknown | undefined
  set(key: string, value: unknown): void
  size(): number
  clear(): void
}

/** 默认容量 200，默认有效期 24 小时 */
export function createTtlCache(max = 200, ttlMs = 24 * 60 * 60 * 1000): TtlCache {
  const store = new Map<string, { value: unknown; at: number }>()

  return {
    get(key) {
      const hit = store.get(key)
      if (!hit) return undefined
      if (Date.now() - hit.at > ttlMs) {
        store.delete(key)
        return undefined
      }
      // Map 插入顺序即 LRU 顺序：先删再插 = 提到最新
      store.delete(key)
      store.set(key, hit)
      return hit.value
    },

    set(key, value) {
      store.delete(key)
      store.set(key, { value, at: Date.now() })
      while (store.size > max) {
        const oldest = store.keys().next()
        if (oldest.done) break
        store.delete(oldest.value)
      }
    },

    size() {
      return store.size
    },

    clear() {
      store.clear()
    },
  }
}
