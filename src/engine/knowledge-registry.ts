// ============================================================
// Phase 4b — KnowledgeRegistry：引擎侧纯内存知识资产注册表
// 文件：src/engine/knowledge-registry.ts
// 职责：
//   - 接收服务端注入的命理规则数据（纯 TypeScript，零 DB 依赖）
//   - 提供 engine/ 下所有模块动态读取知识资产的统一入口
//   - 保留兜底 fallback 确保数据库故障时引擎仍可运行
//
// 架构铁律：
//   engine/ 目录绝不 import 任何 DB/SQLite 模块
//   所有数据由服务端启动时通过 KnowledgeRegistry.init() 注入
// ============================================================

// ═══════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════

/** 服务端注入的知识资产条目 */
export interface KnowledgeAssetInput {
  category: string   // 'bazi' | 'shensha' | 'pattern' | 'personality' | 'classics'
  key: string        // 唯一键名，如 'chong_map'
  value: unknown     // 已解析的 JSON 对象/数组/基础值
  version: number
}

/** 存储的完整条目 */
interface KnowledgeEntry {
  category: string
  key: string
  value: unknown
  version: number
  loadedAt: number
}

// ═══════════════════════════════════════
// Registry 单例
// ═══════════════════════════════════════

class KnowledgeRegistry {
  /** Map<"category.key", entry> */
  private static store = new Map<string, KnowledgeEntry>()
  private static initialized = false

  // ─── 公共 API ───

  /**
   * 服务端启动时调用，一次性注入全部活跃知识资产。
   * 多次调用会覆盖已有数据（支持热更新）。
   */
  static init(assets: KnowledgeAssetInput[]): void {
    this.store.clear()
    for (const a of assets) {
      const nsKey = `${a.category}.${a.key}`
      this.store.set(nsKey, {
        category: a.category,
        key: a.key,
        value: a.value,
        version: a.version,
        loadedAt: Date.now(),
      })
    }
    this.initialized = true
  }

  /**
   * 精确查询：按 namespace key（如 'bazi.chong_map'）返回数据。
   * @returns 解析后的数据，未命中返回 null
   */
  static get<T = unknown>(nsKey: string): T | null {
    const entry = this.store.get(nsKey)
    if (!entry) return null
    return entry.value as T
  }

  /**
   * 带编译时兜底的查询：数据库有则用数据库，没有则用硬编码 fallback。
   * 这是引擎函数的主要使用方式，确保数据库故障时引擎绝不死机。
   */
  static getOrFallback<T>(nsKey: string, fallback: T): T {
    const entry = this.store.get(nsKey)
    if (!entry) return fallback
    return entry.value as T
  }

  /**
   * 按分类 + key 组合查询（便捷方法）。
   */
  static getByCategory<T = unknown>(category: string, key: string): T | null {
    return this.get<T>(`${category}.${key}`)
  }

  /**
   * 按分类批量获取所有条目。
   */
  static getByCategoryAll(category: string): Array<{ key: string; value: unknown; version: number }> {
    const prefix = `${category}.`
    const result: Array<{ key: string; value: unknown; version: number }> = []
    for (const [nsKey, entry] of this.store) {
      if (nsKey.startsWith(prefix)) {
        result.push({ key: entry.key, value: entry.value, version: entry.version })
      }
    }
    return result
  }

  /**
   * 检查某个 namespace key 是否已加载。
   */
  static has(nsKey: string): boolean {
    return this.store.has(nsKey)
  }

  /**
   * 列出所有已加载的 namespace key（调试用）。
   */
  static keys(): string[] {
    return Array.from(this.store.keys())
  }

  /**
   * 已加载的条目总数。
   */
  static get size(): number {
    return this.store.size
  }

  /**
   * 是否已完成初始化。
   */
  static get isReady(): boolean {
    return this.initialized
  }

  /**
   * 清空全部数据（测试/重置用）。
   */
  static reset(): void {
    this.store.clear()
    this.initialized = false
  }
}

export { KnowledgeRegistry }
