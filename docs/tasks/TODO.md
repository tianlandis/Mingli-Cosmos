# 📋 当前待办 — Sprint Backlog

> **更新**: 2026-09-28 | **AI 每次任务优先读取本文件**
> **Sprint**: 工程基线修复 ✅ → Phase 4a 打磨 (R1~R6) ✅ → Phase 4b 运营中台 M-6/M-7/M-8 ✅ + 设计轨 S1 ✅
> → **端到端冒烟 + 登录限流修复 ✅**
> **基线**: `tsc -b` 零错误 ｜ `vitest run`（Node 26）**315/315** ｜ `vite build` 通过 ｜ `npm run smoke` **26/26**

---

## 🔴 阻塞中

| ID | 任务 | 阻塞原因 | 阻塞日期 |
|:---:|------|----------|----------|
| — | 暂无阻塞 | — | — |

---

## 🟡 进行中

| ID | 任务 | 轨道 | 预计完成 |
|:---:|------|:---:|----------|
| — | 暂无（Phase 4a 打磨 R1~R6 已于 2026-09-28 全部闭环） | — | — |

---

## 🟢 已完成（本 Sprint — v4.0.0 + Phase 3 + Phase 4a + Phase 4d）

| ID | 任务 | 轨道 | 完成日期 |
|:---:|------|:---:|:--:|
| — | **v4.0.0 正式发布** | — | 6/18 |
| — | **186 项全量测试零失败** | — | 6/18 |
| — | **README 品牌升级：数字命理推演引擎** | — | 6/18 |
| — | **仓库迁移 → Mingli-Cosmos** | — | 6/18 |
| — | **敏感算法文档全面净化** | — | 6/18 |
| D-1 | Dockerfile 多阶段构建 | 功能轨 | 6/18 |
| D-2 | docker-compose.yml 部署编排 | 功能轨 | 6/18 |
| D-3 | Nginx SSE 流式代理配置 | 功能轨 | 6/18 |
| D-7 | 生产日志 + 监控 (结构化JSON + 请求耗时 + 7天轮转) | 功能轨 | 6/18 |
| — | **Phase 3 本地等价全量验证通过** (build/health/SSE/SPA/logs) | — | 6/18 |
| — | **路线图 + 任务看板全部更新至 v4.0.0+** | — | 6/18 |
| — | **未来架构规划文档 (ARCHITECTURE-FUTURE.md)** | 设计轨 | 6/18 |
| — | **动态双轨配置契约 (CONFIG-CONTRACT.md)** | 设计轨 | 6/18 |
| — | **src/admin/ + src/server/db/ 目录结构规划** | 设计轨 | 6/18 |
| — | **Phase 4a 通用知识字典引擎 (Universal Dict Engine)** | 中台轨 | 6/19 |
| — | **Phase 4a OpenClaw 风格 AI 调优驾驶舱** | 中台轨 | 6/19 |
| — | **Phase 4a 底层数据接口化 (KnowledgeProvider + Tools)** | 中台轨 | 6/19 |
| — | **Phase 4a 全站 UI 工业级质感 (Card 容器 + 自解释)** | 中台轨 | 6/19 |
| — | **Phase 4d 规则字典大闭环：35/35 项全量就位** | 中台轨 | 6/24 |
| — | **L3 护栏全局层级跃升 + PromptEditor 瘦身** | 中台轨 | 6/25 |
| — | **Phase 4a 打磨 R1~R6 全闭环（+ 252/252 测试）** | 中台轨 | 9/28 |
| — | **Phase 4b M-6 C 端用户体系（users + JWT + 后台管理 + 登录 UI）** | 中台轨 | 9/28 |
| — | **Phase 4b M-7 订单与订阅（plans/orders/subscriptions + 支付/退款/套餐 CRUD）** | 中台轨 | 9/28 |
| — | **Phase 4b M-8 运营看板（埋点 + 聚合 + SVG 图表）** | 中台轨 | 9/28 |
| UI-8 | **章节 staggered 入场动画** | 设计轨 S1 | 9/28 |
| UI-9 | **日主强弱进度条** | 设计轨 S1 | 9/28 |
| — | **部署链路修复：Dockerfile Node 26 + compose 数据卷** | 基建 | 9/28 |
| — | **GitHub Push → Mingli-Cosmos (306f207)** | — | 6/25 |
| — | **端到端冒烟脚本 `npm run smoke`（26 项，真实服务全链路）** | 基建 | 9/28 |
| — | **修复登录限流误锁：改为「失败才计数」，成功清零** | 基建 | 9/28 |
| BL-1 | **工程基线修复：`.nvmrc`+engines 声明（Node 26 / ABI 147）** | 基建 | 9/28 |
| BL-2 | **修复约 50 处真实 TS 错误（含 AI SDK v6 两处 API 漂移 bug）** | 基建 | 9/28 |
| BL-3 | **修复 4 个测试隔离缺陷 → 214/214 全绿 + `tsc -b` 零错误 + build 通过** | 基建 | 9/28 |
| UI-1~5 | S0 核心视觉重构全完成 | 设计轨 S0 | 6/17 |
| UI-6 | 大运竖轴 | 设计轨 S1 | 6/18 |
| UI-7 | 专题 Tab 化 | 设计轨 S1 | 6/18 |
| AI-1~22 | Phase 2 全链路（基础设施 + SOP + Chat + 集成验证） | 功能轨 | 6/18 |
| P3-1~5 | 真实大模型跑通 | 功能轨 | 6/18 |

---

## ⬜ 待开始（按优先级排序）

### 🐳 Phase 3 收尾：VPS 上线（待有 VPS 后一键完成）

| ID | 任务 | 说明 | 状态 |
|:---:|------|------|:--:|
| D-4 | 测试域名绑定 + SSL 证书 | 需真实域名 | ⏸️ 待 VPS/域名 |
| D-5 | Linux VPS 部署验证 | `docker compose up -d --build` | ⏸️ 待 VPS |
| D-6 | 公网 SSE 流式体验验收 | 依赖 D-5 | ⏸️ 待 VPS |

> **操作步骤已就绪**：`docs/deploy/VPS-LAUNCH-CHECKLIST.md`（含证书签发、构建、C 端 API 冒烟、
> SSE 公网验收、数据持久化验证、回滚预案）。VPS + 域名就位后按文档执行即可。
> 注：Docker 镜像编排已修复 Node 26 基础镜像与 `data/` 数据卷两处致命隐患。

### 🎨 S1 — 品质提升细节

| ID | 任务 | 轨道 | 状态 |
|:---:|------|:---:|:--:|
| UI-8 | 动画序列（staggered 入场） | 设计轨 S1 | ✅ 9/28 |
| UI-9 | 日主强弱进度条 | 设计轨 S1 | ✅ 9/28 |
| P2-3 | 用户内测反馈收集 | 产品 | ⏸️ 待 Phase 3 公网可用 |

### 🚫 S2 — Phase 4 后延

| ID | 任务 | 
|:---:|------|
| UI-10~13 | 印章微调 / 五行条形图 / 响应式 / 暗色模式 |

---

## 🔧 Phase 4a 打磨补完 ← 当前优先（按 PP_ENGINEERING_SOP 标准）

> Phase 4a 主体 5 项已完成，以下 6 项为收尾打磨，按 SOP 四条铁律逐项验收。

> **状态：R1~R6 全部完成（2026-09-28）** — `tsc -b` 零错误 ｜ 252/252 测试 ｜ build 通过，详见 `DONE.md`

| ID | 任务 | 轨道 | 状态 |
|:---:|------|:---:|:--:|
| 4a-R1 | **Prompt 模板护栏热生效闭环** | 中台轨 | ✅ 9/28 |
| 4a-R2 | **Prompt 编辑器 UI 自解释强化** | 中台轨 | ✅ 9/28 |
| 4a-R3 | **Debug Panel 闭环测试** | 中台轨 | ✅ 9/28 |
| 4a-R4 | **L3 护栏热编辑 + 回退兜底验证** | 中台轨 | ✅ 9/28 |
| 4a-R5 | **全站表单自解释收尾** | 中台轨 | ✅ 6/24 |
| 4a-R6 | **Prompt 版本回滚演练** | 中台轨 | ✅ 9/28 |

> **打磨标准**：每条完成后执行 `npm run typecheck`（= `tsc -b --noEmit`，**注意：根 tsconfig 仅 references，裸 `tsc --noEmit` 会假绿**）→ 功能验证 → 写回 DONE.md
>
> ⚠️ **补充**：`tsconfig.app.json` 的 `include` 已于 9/28 扩展为 `["src", "admin"]` —— 此前 `admin/` 管理后台 21 个文件从未参与类型检查。

---

## 🚀 Phase 4b: 运营中台持续增强 ← 下一阶段

| ID | 任务 | 
|:---:|------|
| M-1 | `src/admin/` 后台管理端 UI（React） ← Phase 4a 已完成 |
| M-2 | `src/server/db/` 数据库持久化模块（Drizzle + SQLite） ← Phase 4a 已完成 |
| M-3 | 动态双轨配置路由实现（DB优先 → .env 回退） ← Phase 4a.3 彻底打通（loadConfig DB-first） |
| M-4 | OpenClaw 风格 API Key 管理 + Prompt 模板编辑器 ← Phase 4a 已完成 |
| M-5 | 配置热更新机制 ← Phase 4a.3 已验证（Admin POST /config → reload → 立即生效） |
| M-6 | C 端用户管理模块 | ✅ 9/28 |
| M-7 | 订单与订阅管理 | ✅ 9/28 |
| M-8 | 运营数据看板增强 (埋点接入) | ✅ 9/28 |

> **Phase 4b 已全量闭环（2026-09-28）**：新增 6 张表（users / user_sessions / plans / orders /
> subscriptions / analytics_events，库表总数 8 → 14），C 端公开路由 `/api/v1/app/*` 与后台
> `/api/v1/admin/{users,orders,analytics}/*` 全部落地，测试 252 → 308。

---

## ⏳ 远期 — Phase 5~6（封存待办）

### Phase 5: 移动端 + 增长

| ID | 任务 | 
|:---:|------|
| 10 | PWA 配置（manifest + service worker） |
| 11 | 微信小程序适配 |
| 12 | 一键分享海报 |
| 13 | 基础订阅系统 |

### Phase 6: 高级功能 + 生态

| ID | 任务 | 
|:---:|------|
| AI-23 | C 模式 Multi-Agent 实现 |
| 14 | RAG 知识库接入 |
| 15 | 合婚 / 择吉功能 |
| — | 社区 + 独立 App |

---

## 📊 Sprint 统计

| 指标 | 数值 |
|------|:--:|
| Phase 0-3 已完成 | ✅ 全部 |
| Phase 4a 主体已完成 | ✅ 5 项 |
| Phase 4d 规则字典大闭环 | ✅ 35/35 项 |
| Phase 4a 打磨补完 | 6 (6 done ✅) |
| Phase 4b 运营中台 | 8 (8 done ✅) |
| Phase 5-6 封存 | 8 |
| Phase 3 上线收尾 (D-4~D-6) | 3 ⏸️ 待 VPS/域名 |
| UI S1 品质提升 | 3 (2 done，1 待公网) |
| UI S2 封存 | 4 |
| 远期总计 | 21 |
| 测试总数 | **315 项 / 15 文件** |
| 端到端冒烟 | **26 项**（`npm run smoke`，真实服务） |
| 数据库表 | 14 张 |

---

> 📎 **已完成记录**: `tasks/DONE.md`
> 📎 **功能路线图**: `plan/02-feature-roadmap.md`
> 📎 **容器化部署**: `../../Dockerfile`, `../../docker-compose.yml`, `../../nginx.conf`
> 📎 **日志系统**: `../server/lib/logger.ts`
> 📎 **未来架构**: `arch/ARCHITECTURE-FUTURE.md`, `arch/CONFIG-CONTRACT.md`
