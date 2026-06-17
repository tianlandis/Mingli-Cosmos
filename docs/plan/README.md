# 📋 项目计划层导航（Plan Layer · Navigation）

> **用途**: 了解项目方向、功能规划、商业策略时使用。
> **受众**: PM / 全员 / 新人上手

---

## 计划层结构

```
plan/
├── README.md                    ← 【你在这里】计划层入口
├── 01-product-brief.md          ← 产品一页纸：愿景·定位·用户·价值
├── 02-feature-roadmap.md        ← 功能路线图：4阶段功能清单+进度追踪
├── 03-ai-strategy.md            ← AI增强策略：对话·报告·RAG·护栏机制
├── 04-growth-model.md           ← 增长变现：渠道·定价·营销·Freemium
└── 05-risk-compliance.md        ← 风险合规：法律·伦理·隐私·成本控制
```

## 与其他层的关系

```
plan/          ← 计划层（做什么、何时做、为什么做）
  ↓ 驱动
arch/          ← 架构层（怎么做、怎么分层隔离）
  ↓ 约束
contracts/     ← 契约层（核心引擎对外API → 外围模块只能通过契约消费）
  ↓ 实现
src/engine/    ← 核心引擎（不可变内核）
src/components/← UI层（只消费引擎输出）
```

## 读取指南

| 场景 | 需读文件 |
|------|----------|
| 新人了解项目 | `plan/01-product-brief.md` |
| 规划新功能/版本 | `plan/02-feature-roadmap.md` |
| 开发 AI 功能 | `plan/03-ai-strategy.md` + `contracts/engine-api.md` |
| 运营/推广 | `plan/04-growth-model.md` |
| 合规审查 | `plan/05-risk-compliance.md` |

---

> 📎 **执行层**: `tasks/TODO.md`（当前 Sprint 任务）
> 📎 **架构层**: `arch/ARCHITECTURE.md`
> 📎 **契约层**: `contracts/engine-api.md`
