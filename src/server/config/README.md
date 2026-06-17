# Phase 4 动态配置双轨路由器

> 此目录为 Phase 4 预留，当前为架构规划阶段（2026-06-18）。

## 核心逻辑

```
DB 已连接 & 有配置记录 → 读取数据库配置
       ↓ (不可用)
  自动回退到 .env 静态文件
```

## 规划文件

| 文件 | 职责 |
|------|------|
| `index.ts` | 统一入口：暴露 `getConfig()` / `reloadConfig()` |
| `loader.ts` | 双轨加载逻辑：DB → .env fallback |
| `schema.ts` | 配置项 Zod Schema 定义 |
| `cache.ts` | 内存缓存层：TTL + 失效策略 |

> 详细契约见 `docs/arch/CONFIG-CONTRACT.md`
