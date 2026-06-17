# 未来架构规划：Phase 4+ 管理后台 & 数据库模块

> **用途**: Phase 4 "动态配置与管理后台"的技术蓝图，当前为架构设计文档（不绑定实现）
> **原则**: 预计新增代码全部位于 `src/` 新建子目录，零侵入现有 `engine/` 和 `server/api/`
> **创建日期**: 2026-06-18

---

## 一、目标

在 Phase 4 实现以下核心能力：

1. **可视化后台管理端**：类似 OpenClaw 风格的 Web UI，集中管理大厂 API Key 和 Prompt 模板
2. **数据库持久化**：存储多厂商配置、Prompt 版本历史、用户会话数据
3. **动态双轨配置路由**：数据库配置优先 → `.env` 静态文件自动回退
4. **配置热更新**：管理后台修改后无需重启服务即可生效

---

## 二、目录结构规划

```
src/
├── engine/                     ← 核心引擎（不可变，Phase 4 不触碰）
├── server/
│   ├── index.ts                ← Hono 服务器入口
│   ├── api/                    ← 现有 API（report, chat, health）
│   │   ├── report.ts
│   │   └── chat.ts
│   ├── lib/                    ← 现有库（llm, guardrail, types）
│   ├── prompts/                ← 现有 Prompt 模板
│   ├── workflows/              ← 现有 SOP 流水线
│   │
│   │   ╔══════════════════════════════════════════╗
│   │   ║  🆕 Phase 4 新增模块                      ║
│   │   ╚══════════════════════════════════════════╝
│   │
│   ├── db/                     ← 数据库持久化模块
│   │   ├── index.ts            ← 统一导出 + 初始化
│   │   ├── schema.ts           ← 表结构定义（Drizzle ORM / Knex）
│   │   ├── migrations/         ← 数据库迁移文件
│   │   ├── repositories/
│   │   │   ├── api-keys.ts     ← API Key 的 CRUD 操作
│   │   │   ├── prompts.ts      ← Prompt 模板的 CRUD + 版本管理
│   │   │   ├── sessions.ts     ← 用户会话存储
│   │   │   └── audit-log.ts    ← 管理后台操作审计日志
│   │   └── seed.ts             ← 初始种子数据
│   │
│   ├── config/                 ← 动态配置双轨路由器
│   │   ├── index.ts            ← 统一入口（暴露 getConfig / reloadConfig）
│   │   ├── loader.ts           ← 双轨加载逻辑（DB → .env fallback）
│   │   ├── schema.ts           ← 配置项的 Zod Schema
│   │   └── cache.ts            ← 内存缓存层（TTL + 失效策略）
│   │
│   └── api/
│       └── admin/              ← 🆕 管理后台 API
│           ├── index.ts        ← 路由注册
│           ├── auth.ts         ← 后台登录认证（JWT / Session）
│           ├── config.ts       ← 配置 CRUD API
│           ├── prompts.ts      ← Prompt 模板管理 API
│           └── health.ts       ← 扩展健康检查（含 DB 连通性）
│
├── admin/                      ← 🆕 后台管理端前端源码（独立 SPA）
│   ├── index.html              ← 入口 HTML
│   ├── main.tsx                ← React 入口
│   ├── App.tsx                 ← 路由 + 布局
│   ├── components/
│   │   ├── Layout.tsx          ← 后台布局（侧边栏 + 顶栏）
│   │   ├── ApiKeyManager.tsx   ← API Key 可视化管理面板
│   │   ├── PromptEditor.tsx    ← Prompt 模板编辑器（CodeMirror / Monaco）
│   │   ├── ConfigPanel.tsx     ← 全局配置面板
│   │   ├── SessionList.tsx     ← 会话列表
│   │   └── AuditLog.tsx        ← 操作日志
│   ├── hooks/
│   │   ├── useAuth.ts          ← 登录态管理
│   │   └── useConfigApi.ts     ← 配置 API 调用
│   └── styles/
│       └── admin.css           ← 后台专用样式
│
├── client/                     ← 现有用户端前端（不变）
└── contracts/
    └── config-contract.md      ← 🆕 配置契约文档
```

---

## 三、技术选型建议（Phase 4 时决策）

| 层级 | 候选方案 | 备注 |
|------|----------|------|
| **数据库** | SQLite (better-sqlite3) / PostgreSQL | SQLite 适合单机部署；PostgreSQL 适合多实例 |
| **ORM** | Drizzle ORM / Knex | Drizzle 类型安全好，Knex 迁移成熟 |
| **管理端认证** | JWT + bcrypt / Session + Cookie | JWT 无状态更简单 |
| **Prompt 编辑器** | CodeMirror 6 / Monaco Editor | 两者均可，按体积偏好选择 |
| **配置热更新** | EventEmitter / fs.watch / Redis pub/sub | 单机用 EventEmitter，多机用 Redis |

---

## 四、模块防污染原则

```
                          ┌────────────────┐
                          │   admin/       │  ← Phase 4 新增：管理端 UI
                          │   (React SPA)  │
                          └──────┬─────────┘
                                 │ HTTP API
                          ┌──────┴─────────┐
                          │ server/api/    │
                          │   admin/       │  ← Phase 4 新增：管理 API
                          └──────┬─────────┘
                                 │
            ┌────────────────────┼────────────────────┐
            │                    │                    │
     ┌──────┴──────┐    ┌───────┴───────┐    ┌──────┴──────┐
     │ server/db/  │    │ server/config/ │    │ contracts/  │
     │ (数据库)     │    │ (动态配置)      │    │ (契约层)     │
     └─────────────┘    └───────────────┘    └─────────────┘
            │                    │
            └────────┬───────────┘
                     │ 只通过契约消费
              ┌──────┴──────┐
              │  engine/    │  ← 不可变内核，Phase 4 不触碰
              │  (封版)      │
              └─────────────┘
```

- **红线**：`admin/` 和 `server/api/admin/` 禁止直接 import `engine/` 内部实现
- **接口**：通过 `contracts/` 定义的稳定契约与核心引擎交互
- **隔离**：`server/db/` 和 `server/config/` 为新增模块，与现有 `server/lib/` 零耦合

---

## 五、实施路线

| 阶段 | 内容 | 预估 |
|:---:|------|:--:|
| 4A | `server/db/` 数据库模块搭建（schema + repositories） | 2d |
| 4B | `server/config/` 双轨配置路由实现（DB→.env fallback） | 1.5d |
| 4C | `server/api/admin/` 管理 API（auth + config CRUD） | 2d |
| 4D | `admin/` 管理端前端 SPA（Vite 独立构建） | 2d |
| 4E | 集成测试 + 配置热更新验证 | 1d |

> 详细配置契约见 [`CONFIG-CONTRACT.md`](./CONFIG-CONTRACT.md)
