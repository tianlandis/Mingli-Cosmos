# 📋 当前待办 — Sprint Backlog

> **更新**: 2026-06-19 | **AI 每次任务优先读取本文件**
> **Sprint**: Phase 8 ✅ 完成 → VPS 上线验证 ✅ → Phase 9 规划

---

## 🔴 阻塞中

| ID | 任务 | 阻塞原因 | 阻塞日期 |
|:---:|------|----------|----------|
| — | 暂无阻塞 | — | — |

---

## 🟡 进行中

| ID | 任务 | 轨道 | 预计完成 |
|:---:|------|:---:|----------|
| — | 暂无 | — | — |

---

## 🟢 已完成（本 Sprint — v4.0.0 + Phase 3 + Phase 8）

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
| — | **Phase 8 通用知识字典引擎 (Universal Dict Engine)** | 中台轨 | 6/19 |
| — | **Phase 8 OpenClaw 风格 AI 调优驾驶舱** | 中台轨 | 6/19 |
| — | **Phase 8 底层数据接口化 (KnowledgeProvider + Tools)** | 中台轨 | 6/19 |
| — | **Phase 8 全站 UI 工业级质感 (Card 容器 + 自解释)** | 中台轨 | 6/19 |
| UI-1~5 | P0 核心视觉重构全完成 | 设计轨 P0 | 6/17 |
| UI-6 | 大运竖轴 | 设计轨 P1 | 6/18 |
| UI-7 | 专题 Tab 化 | 设计轨 P1 | 6/18 |
| AI-1~22 | Phase 2 全链路（基础设施 + SOP + Chat + 集成验证） | 功能轨 | 6/18 |
| P3-1~5 | 真实大模型跑通 | 功能轨 | 6/18 |

---

## ⬜ 待开始（按优先级排序）

### 🐳 Phase 3 收尾：VPS 上线（待有 VPS 后一键完成）

| ID | 任务 | 说明 | 状态 |
|:---:|------|------|:--:|
| D-4 | 测试域名绑定 + SSL 证书 | 需真实域名 | ⏸️ 待 VPS |
| D-5 | Linux VPS 部署验证 | `docker compose up -d --build` | ⏸️ 待 VPS |
| D-6 | 公网 SSE 流式体验验收 | 依赖 D-5 | ⏸️ 待 VPS |

> D-4~D-6 三件套在本地已完成等价验证，Docker 镜像/编排/日志均就绪，VPS 就位后一键上线。

### 🎨 P1 — 品质提升细节

| ID | 任务 | 轨道 | 依赖 | 预估 |
|:---:|------|:---:|------|:--:|
| UI-8 | 动画序列（staggered 入场） | 设计轨 | UI-6,7 ✅ | 0.5d |
| UI-9 | 日主强弱进度条 | 设计轨 | — | 0.5d |
| P2-3 | 用户内测反馈收集 | 产品 | Phase 3 公网可用 | 持续 |

### 🚫 P2 — Phase 4 后延

| ID | 任务 | 
|:---:|------|
| UI-10~13 | 印章微调 / 五行条形图 / 响应式 / 暗色模式 |

---

## 🚀 Phase 9: 运营中台持续增强 ← 下一阶段

| ID | 任务 | 
|:---:|------|
| M-1 | `src/admin/` 后台管理端 UI（React） ← Phase 8 已完成 |
| M-2 | `src/server/db/` 数据库持久化模块（Drizzle + SQLite） ← Phase 8 已完成 |
| M-3 | 动态双轨配置路由实现（DB优先 → .env 回退） ← Phase 8.3 彻底打通（loadConfig DB-first） |
| M-4 | OpenClaw 风格 API Key 管理 + Prompt 模板编辑器 ← Phase 8 已完成 |
| M-5 | 配置热更新机制 ← Phase 8.3 已验证（Admin POST /config → reload → 立即生效） |
| M-6 | C 端用户管理模块 | 
| M-7 | 订单与订阅管理 |
| M-8 | 运营数据看板增强 (GA/埋点接入) |

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
| Phase 3 VPS 上线（待 VPS） | 3 |
| Phase 4 下一阶段 | 5 |
| Phase 5-6 封存 | 8 |
| UI P1 品质提升 | 3 |
| UI P2 封存 | 4 |
| 远期总计 | 15 |

---

> 📎 **已完成记录**: `tasks/DONE.md`
> 📎 **功能路线图**: `plan/02-feature-roadmap.md`
> 📎 **容器化部署**: `../../Dockerfile`, `../../docker-compose.yml`, `../../nginx.conf`
> 📎 **日志系统**: `../server/lib/logger.ts`
> 📎 **未来架构**: `arch/ARCHITECTURE-FUTURE.md`, `arch/CONFIG-CONTRACT.md`
