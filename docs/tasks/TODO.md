# 📋 当前待办 — Sprint Backlog

> **更新**: 2026-06-18 | **AI 每次任务优先读取本文件**
> **Sprint**: Phase 3 跑通模型 → P0 UI 打磨 → MVP 上线

---

## 🔴 阻塞中

| ID | 任务 | 阻塞原因 | 阻塞日期 |
|:---:|------|----------|----------|
| — | 暂无阻塞 | — | — |

---

## 🟡 进行中

| ID | 任务 | 轨道 | 预计完成 |
|:---:|------|:---:|----------|
| — | 无进行中任务 | — | — |

---

## 🟢 已完成（本 Sprint）

| ID | 任务 | 轨道 | 完成日期 |
|:---:|------|:---:|:--:|
| UI-1 | 调色板切换：深棕黑 → 宣纸底 | 设计轨 P0 | 6/17 |
| UI-2 | 命盘英雄区 + 日主朱砂印章 | 设计轨 P0 | 6/17 |
| UI-3 | 章节化布局（.chapter 流式） | 设计轨 P0 | 6/17 |
| UI-4 | 字体替换：雅黑 → 思源宋体+黑体 | 设计轨 P0 | 6/17 |
| UI-5 | 输入区紧凑化（内联工具栏） | 设计轨 P0 | 6/17 |
| AI-DESIGN | Phase 2 AI Agent 架构设计 v2.0 完成 | 设计轨 | 6/18 |
| AI-1~6 | Phase 2-A 基础设施全完成（6任务） | 功能轨 | 6/18 |

---

## ⬜ 待开始（按优先级排序）

### 🔌 Phase 3: 跑通真实模型（最高优先）

| ID | 任务 | 轨道 | 依赖 | 预估 |
|:---:|------|:---:|------|:--:|
| P3-1 | 补 `.env` + `dotenv` 自动加载 | 功能轨 | — | ✅ 完成 |
| P3-2 | `tools/test-real-llm.ts` 验证脚本 | 功能轨 | P3-1 | ✅ 完成 |
| P3-3 | 启动本地模型服务器 | 环境 | — | ✅ Ollama 已运行 |
| P3-4 | 运行验证脚本，跑通真实生成 | 功能轨 | P3-3 | ✅ 完成 |
| P3-5 | 修复跑通中出现的任何问题 | 功能轨 | P3-4 | 待定 |

### P0 — 本周必做（模型跑通后立即开始）

| ID | 任务 | 轨道 | 依赖 | 预估 |
|:---:|------|:---:|------|:--:|
| UI-6 | **大运竖轴**（横向表格→竖向时间轴） | 设计轨 | Phase 3 ✅ | ✅ 完成 |
| UI-7 | **专题 Tab 化**（6宫格→水平切换） | 设计轨 | Phase 3 ✅ | ✅ 完成 |

### 🚫 已跳过（MVP 不包含）

| ID | 任务 | 跳过原因 |
|:---:|------|----------|
| UI-8 | 动画序列 | MVP 不加视觉效果 |
| UI-9 | 日主强弱进度条 | MVP 不加视觉效果 |
| UI-10 | 印章微调 | P3 延后 |
| UI-11 | 五行条形图重设计 | P3 延后 |
| UI-12 | 响应式三断点细化 | P3 延后 |
| UI-13 | 暗色模式 fallback | P3 延后 |
| 9 | 小红书推广内容 | 等界面定型 |
| 1 | 10+ 历史名人验证 | 等真实大模型 |

### Phase 2-A: AI 基础设施 (✅ 完成)

| ID | 任务 | 轨道 | 依赖 | 预估 | 状态 |
|:---:|------|:---:|------|:--:|:--:|
| AI-1 | 安装依赖 (hono, ai, @ai-sdk/openai, zod, tsx) | 功能轨 | — | 0.5d | ✅ |
| AI-2 | `src/server/index.ts` Hono 服务 (port 3001) | 功能轨 | AI-1 | 0.5d | ✅ |
| AI-3 | `vite.config.ts` proxy 配置 + package.json scripts | 功能轨 | AI-2 | 0.5d | ✅ |
| AI-4 | `src/server/lib/types.ts` 全链路类型契约 | 功能轨 | — | 0.5d | ✅ |
| AI-5 | `src/server/lib/llm.ts` LLM Provider 抽象 + withRetry | 功能轨 | AI-4 | 0.5d | ✅ |
| AI-6 | `src/server/lib/guardrail.ts` 护栏 (建议句式先检测) | 功能轨 | — | 0.5d | ✅ |

### Phase 2-B: B 模式命书生器 (✅ 完成)

| ID | 任务 | 轨道 | 依赖 | 预估 |
|:---:|------|:---:|------|:--:|
| AI-7 | `src/server/prompts/` (system, personality, luck) | 功能轨 | AI-4 | 1d |
| AI-8 | `src/server/workflows/step-personality.ts` SOP-1 | 功能轨 | AI-5,7 | 1d | ✅ |
| AI-9 | `src/server/workflows/step-luck.ts` SOP-2 | 功能轨 | AI-8 | 1d | ✅ |
| AI-10 | `src/server/workflows/step-assemble.ts` SOP-3 | 功能轨 | — | 0.5d | ✅ |
| AI-11 | `src/server/workflows/index.ts` runReportPipeline + Try<T> | 功能轨 | AI-8,9,10 | 0.5d | ✅ |
| AI-12 | `src/server/api/report.ts` POST /api/report | 功能轨 | AI-11 | 0.5d | ✅ |
| AI-13 | `src/ui/components/ReportView.tsx` | 功能轨 | AI-12 | 1d | ✅ |

### Phase 2-C: A 模式对话 Copilot (✅ 完成)

| ID | 任务 | 轨道 | 依赖 | 预估 | 状态 |
|:---:|------|:---:|------|:--:|:--:|
| AI-14 | `src/server/api/chat.ts` SSE 流式 + 滑动窗口 | 功能轨 | AI-2,5,6 | 1.5d | ✅ |
| AI-15 | `src/ui/hooks/useAgentChat.ts` | 功能轨 | AI-14 | 0.5d | ✅ |
| AI-16 | `src/ui/components/ChatPanel.tsx` | 功能轨 | AI-15 | 1d | ✅ |
| AI-17 | 上下文管理 + 历史摘要 + App 集成 | 功能轨 | AI-14 | 0.5d | ✅ |

### Phase 2-D: 集成验证 (✅ 完成)

| ID | 任务 | 轨道 | 依赖 | 预估 | 状态 |
|:---:|------|:---:|------|:--:|:--:|
| AI-18 | 5个经典命例 fixture JSON | 功能轨 | AI-4 | 0.5d | ✅ |
| AI-19 | `__tests__/guardrail.test.ts` 护栏测试 | 功能轨 | AI-6 | 0.5d | ✅ |
| AI-20 | `__tests__/workflows.test.ts` 集成测试 (mock LLM) | 功能轨 | AI-11 | 1d | ✅ |
| AI-21 | Prompt 调优迭代 (5个命例回归) | 功能轨 | AI-7,18 | 1d | ✅ |
| AI-22 | 端到端测试 | 功能轨 | AI-14,20 | 0.5d | ✅ |

### P2 — 本 Sprint 应做 (✅ 完成)

| ID | 任务 | 轨道 | 依赖 | 预估 | 状态 |
|:---:|------|:---:|------|:--:|:--:|
| 7 | 生成 3-5 个名人八字测试报告 | 功能轨 | — | 1-2d | ✅ |

### P1 — 远期（待排期）

| ID | 任务 | 说明 |
|:---:|------|------|
| 9 | 小红书推广内容 | 界面定型后再写 |
| 1 | 10+ 历史名人验证 | 换上真实大模型后再测 |
| 8b | 上线测试版，收集反馈 | 排在 UI-6/7 完成之后 |

---

## ⏳ 远期 — Phase 4（封存待办）

| ID | 任务 | Phase |
|:---:|------|:---:|
| AI-23 | C 模式 Multi-Agent 实现 (router + 各专题 agent) | Phase 4 |
| 10 | PWA 配置（manifest + service worker） | Phase 4 |
| 11 | 微信小程序适配 | Phase 4 |
| 12 | 一键分享海报 | Phase 4 |
| 13 | 基础订阅系统 | Phase 4 |
| 14 | RAG 知识库接入 | Phase 4 |
| 15 | 合婚 / 择吉功能 | Phase 4 |
| UI-10 | 印章微调 | Phase 4 |
| UI-11 | 五行条形图重设计 | Phase 4 |
| UI-12 | 响应式三断点细化 | Phase 4 |
| UI-13 | 暗色模式 fallback | Phase 4 |
| UI-8 | 动画序列 | Phase 4 |
| UI-9 | 日主强弱进度条 | Phase 4 |

---

## 📊 Sprint 统计

| 指标 | 数值 |
|------|:--:|
| 总任务（当前 Sprint） | 33 |
| 已完成 | 34 |
| 进行中 | 0 |
| 待开始 | 2 |
| 远期封存 | 15 |

---

> 📎 **已完成记录**: `tasks/DONE.md`
> 📎 **功能路线图**: `plan/02-feature-roadmap.md`
> 📎 **AI 策略**: `plan/03-ai-strategy.md`
> 📎 **AI Agent 设计**: `design/PHASE2_AI_AGENT_DESIGN.md`
> 📎 **UI 设计**: `design/UI_DESIGN_RECOMMENDATIONS.md`
