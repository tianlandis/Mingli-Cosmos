# 配置契约：动态双轨配置路由

> **用途**: Phase 4 配置读取的标准契约，供 `server/config/` 实现时遵循
> **原则**: 开箱即用 — 无数据库也能跑；有数据库则享受可视化配置
> **创建日期**: 2026-06-18

---

## 一、核心理念

```
数据库配置优先（Phase 4+）
        │
        ├── 数据库已初始化 & 有配置记录？
        │       │
        │       YES ──→ 读取数据库配置（享受可视化后台管理）
        │       │
        │       NO  ──→ 自动回退到 .env 静态文件（保持开箱即用）
        │
        └── 两种模式下 API 使用方代码完全相同
```

---

## 二、契约接口（伪代码）

```typescript
// ═══════════════════════════════════════
// 文件：src/server/config/index.ts
// 对外暴露的唯一入口
// ═══════════════════════════════════════

import { loadConfig } from './loader'
import { configSchema } from './schema'

/**
 * 获取当前生效的配置（双轨自动选择）
 *
 * 路由逻辑：
 *   1. 尝试从数据库读取（如果 db 已连接且有配置记录）
 *   2. 数据库不可用或无配置 → 回退到 .env 文件
 *   3. 结果缓存在内存中（TTL 60s），避免每次请求都读库
 */
export async function getConfig(): Promise<AppConfig> {
  const raw = await loadConfig()       // 双轨加载
  return configSchema.parse(raw)       // Zod 校验
}

/**
 * 强制刷新配置缓存（管理后台保存后调用）
 */
export async function reloadConfig(): Promise<AppConfig> {
  cache.invalidate()
  return getConfig()
}
```

---

## 三、双轨加载逻辑（伪代码）

```typescript
// ═══════════════════════════════════════
// 文件：src/server/config/loader.ts
// ═══════════════════════════════════════

import { db } from '../db'             // Phase 4 新增
import { envConfig } from './env'       // .env 读取器（已有）
import { cache } from './cache'         // 内存缓存层

export async function loadConfig(): Promise<RawConfig> {
  // ── Step 1: 检查缓存 ──
  const cached = cache.get('app-config')
  if (cached) return cached

  // ── Step 2: 尝试数据库路径 ──
  try {
    if (await db.isConnected()) {
      const dbConfig = await db.config.findFirst({
        where: { key: 'app-config' }
      })
      if (dbConfig && dbConfig.value) {
        const parsed = JSON.parse(dbConfig.value)
        cache.set('app-config', parsed, { ttl: 60_000 })  // 60s TTL
        return parsed
      }
    }
  } catch (err) {
    // 数据库不可用是预期行为（首次部署无数据库），静默回退即可
    console.debug('[Config] 数据库路径不可用，回退到 .env 文件')
  }

  // ── Step 3: 回退到 .env 静态文件 ──
  const env = envConfig.load()          // process.env + dotenv
  cache.set('app-config', env, { ttl: 30_000 })  // 30s TTL
  return env
}
```

---

## 四、数据库配置存储模型（Drizzle Schema 示例）

```typescript
// ═══════════════════════════════════════
// 文件：src/server/db/schema.ts（Phase 4 实现）
// ═══════════════════════════════════════

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

/**
 * API Key 配置表
 * 支持多厂商：DeepSeek, OpenAI, Claude, Ollama
 */
export const apiKeys = sqliteTable('api_keys', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  provider:  text('provider').notNull(),           // 'deepseek' | 'openai' | 'claude' | 'ollama'
  label:     text('label'),                        // 人类可读名称，如 "生产环境 DeepSeek"
  apiKey:    text('api_key').notNull(),             // 加密存储的 API Key
  baseUrl:   text('base_url'),                     // 可选：自定义 Base URL
  isActive:  integer('is_active').default(1),      // 0=禁用 1=启用
  createdAt: text('created_at').default(new Date().toISOString()),
  updatedAt: text('updated_at').default(new Date().toISOString()),
})

/**
 * Prompt 模板表
 * 支持版本历史，可回溯
 */
export const promptTemplates = sqliteTable('prompt_templates', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  name:        text('name').notNull(),             // 模板名：'system' | 'personality' | 'luck'
  version:     integer('version').default(1),      // 版本号
  content:     text('content').notNull(),           // Prompt 模板正文
  variables:   text('variables'),                   // JSON: 可用变量列表 ['chart', 'annotation']
  isActive:    integer('is_active').default(1),     // 是否当前激活版本
  createdBy:   text('created_by'),                  // 创建者
  createdAt:   text('created_at').default(new Date().toISOString()),
  updatedAt:   text('updated_at').default(new Date().toISOString()),
})

/**
 * 全局配置表
 * Key-Value 存储，灵活扩展
 */
export const appConfigs = sqliteTable('app_configs', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  key:       text('key').notNull().unique(),        // 'app-config' | 'feature-flags' 等
  value:     text('value').notNull(),               // JSON 序列化字符串
  updatedAt: text('updated_at').default(new Date().toISOString()),
})
```

---

## 五、调用方使用示例（完全透明）

```typescript
// ═══════════════════════════════════════
// 现有代码（server/lib/llm.ts）迁移到动态配置后的样子
// 调用方无需关心配置来自 DB 还是 .env — 接口完全不变
// ═══════════════════════════════════════

import { getConfig } from '../config'    // ← 替换原来的 process.env 直接读取

export async function createLLMClient() {
  const config = await getConfig()       // 双轨自动选择

  return createOpenAI({
    apiKey:  config.llm.apiKey,          // 可能来自 DB 或 .env
    baseURL: config.llm.baseUrl,
  })
}
```

---

## 六、开箱即用保证

| 场景 | 行为 |
|------|------|
| 全新 clone + `npm run start`（无数据库） | 读取 `.env`，正常工作 ✅ |
| 首次运行管理后台，保存配置 | 自动写入数据库，后续读数据库 ✅ |
| 数据库损坏 / 连接丢失 | 自动回退 `.env`，服务不中断 ✅ |
| 修改 `.env` 后不做任何操作 | 30s 后缓存过期自动生效 ✅ |
| 管理后台修改配置 | 调用 `reloadConfig()` 即时生效 ✅ |

---

## 七、安全注意事项

- API Key 在数据库中应**加密存储**（建议 AES-256-GCM 或使用环境变量衍生密钥）
- 管理后台必须**认证授权**（JWT + bcrypt），不可公开访问
- 审计日志记录所有配置变更操作（谁、何时、改了什么）
- `.env` 文件中的 API Key 依然有效作为冷备份/灾备方案
