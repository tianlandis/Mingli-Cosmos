# Phase 4 数据库持久化模块

> 此目录为 Phase 4 预留，当前为架构规划阶段（2026-06-18）。

## 预计技术选型

- **数据库**: SQLite (better-sqlite3) — 单机部署首选
- **ORM**: Drizzle ORM — 类型安全、迁移成熟
- **表**: api_keys / prompt_templates / app_configs / sessions / audit_logs

## 规划表结构

| 表名 | 用途 |
|------|------|
| `api_keys` | 多厂商 API Key 加密存储 |
| `prompt_templates` | Prompt 模板版本管理 |
| `app_configs` | 全局 Key-Value 配置 |
| `sessions` | 用户会话持久化 |
| `audit_logs` | 管理后台操作审计 |

> 详细 Schema 见 `docs/arch/CONFIG-CONTRACT.md`
> 架构规划见 `docs/arch/ARCHITECTURE-FUTURE.md`
