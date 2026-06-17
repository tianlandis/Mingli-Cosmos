# CODEBUDDY.md — 八字排盘项目规则

> CodeBuddy 每次对话自动加载本文件。所有 AI 辅助编码必须遵守以下规则。

---

## 🔒 强制审查规则

**每次新写代码或修改代码后，必须通过 `@skill://using-superpowers` 审查：**

- 写新代码 → 写完后立刻审查
- 修 Bug → 修完后立刻审查
- 重构 → 重构完后立刻审查

审查维度：
1. 架构分层正确性（engine/ ↔ server/ ↔ components/ 边界）
2. 类型安全（全链路 TypeScript，无 `any`）
3. 护栏完备性（System Prompt 约束 + guardrail.ts 后校验）
4. 错误处理覆盖（Try<T> 熔断 + 超时 + 重试）
5. 与设计文档一致性（`docs/plan/` + `docs/design/`）

**此规则不可跳过，不可合理化绕过。**

---

## 🏗 架构红线

| 规则 | 说明 |
|:--|------|
| ❌ 禁止修改 `src/engine/` | 核心引擎已封版 |
| ❌ 禁止外围模块 import engine 内部文件 | 只能通过 `engine/index.ts` |
| ❌ 禁止 LLM 参与八字计算 | 计算归引擎，解释归 AI |
| ✅ 新代码先写类型 | 在 `src/server/lib/types.ts` 定义 |

---

## 📁 关键文档索引

| 场景 | 读哪个文件 |
|:--|------|
| 改引擎 | `docs/arch/ALGORITHM-AUTHORITY.md` |
| 改架构 | `docs/arch/ARCHITECTURE.md` |
| 改 UI | `docs/design/UI_DESIGN_RECOMMENDATIONS.md` |
| 改 AI | `docs/plan/03-ai-strategy.md` + `docs/design/PHASE2_AI_AGENT_DESIGN.md` |
| 看进度 | `docs/tasks/TODO.md` |
| 看路线 | `docs/plan/02-feature-roadmap.md` |
