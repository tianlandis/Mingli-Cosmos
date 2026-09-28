# ADR-005: 计算权威 SSOT —— 服务端算 还是 重算校验

- **状态**: `Accepted` ✅（2026-09-28 实施，Phase 5 P5-3：阶段一闸门 + 阶段二权威端点同时落地）
- **日期**: 2026-09-28
- **决策者**: 田哥
- **类别**: 🧱 骨架（数据流形态 / 完整性）
- **关联**: `../arch/ARCHITECTURE-REVIEW.md` §R-1、`src/hooks/useBazi.ts`、`src/server/api/report.ts`、`src/server/api/chat.ts`

---

## 背景（Context）

当前排盘与批注**在浏览器端计算**：`src/hooks/useBazi.ts` 直接调用封版引擎
`calculateBazi` + `generateAnnotation`；随后前端把 `chart` + `annotation` JSON 传给服务端。
而 `src/server/api/report.ts` 与 `src/server/api/chat.ts` **只做存在性校验就信任并使用**
客户端传来的计算产物。

这带来两个后果：

1. **完整性风险**：产品红线是"AI 必须基于规则引擎 JSON、禁止编造"，但**事实源在客户端** ——
   攻击者伪造 `annotation` 即可操纵 AI 输出（越权、误导、绕过反幻觉护栏）。
2. **一致性风险（漂移）**：admin 改 `knowledge_assets` 后服务端引擎会热加载，但
   **客户端 bundle 的引擎是构建期固化的** → 用户看到的批注与 LLM 工具重算结果可能不一致。

> 这是本次评审**最重要的发现**：它同时是完整性风险与一致性风险。

## 驱动因素（Decision Drivers）

- 红线要求"AI 基于规则引擎 JSON" → 事实源必须是**可信**的。
- 计费 / 审计需要一个**可信的落库锚点**。
- 改造应尽量**可平滑过渡**（不中断已上线的服务）。

## 备选方案（Options）

### Option A：服务端权威（Server-authoritative）
新增 `POST /api/v1/app/chart`：服务端用引擎算盘 → 落 `sessions`（存 chart + annotation + hash）→
返回 `sessionId`。`report` / `chat` **只收 sessionId**，从库里取权威数据。
- **代价**：计算从客户端搬到服务端（CPU 上移，但引擎是纯函数、开销可控）；前端要改数据流；
  离线 / 纯前端体验需重新设计。

### Option B：客户端计算 + 服务端重算校验（Recompute-and-verify）
保留客户端计算，但服务端**用自己的引擎对同一生辰重算**，比对 `chartHash`，不一致即拒绝 / 降级。
- **代价**：服务端承担一次额外计算（可缓存）；需稳定的**哈希口径**（浮点 / 顺序归一化）。

### Option C：现状（客户端算 + 服务端盲信）—— **不采用**
- 无法满足完整性红线，明确排除。

## 决策（Decision）

**采用 Option A（服务端权威）**，理由：

- 从根上消除"事实源在客户端"的完整性缺口，同时**天然消除漂移**（唯一权威 = 服务端引擎版本）；
- 为计费 / 额度 / 审计提供**可信的落库锚点**（`sessions` 成为可计量对象，配合 ADR-004）；
- 与 ADR-001 的"计算权威收敛为单一 Chart 模块"一致。

**过渡策略（灰度）**：先上 **Option B 作为校验闸门**（低成本、不动前端数据流），
待前端改造到位后切换到 Option A；两者**共用同一 `chartHash` 口径**，保证可平滑替换。

## 后果（Consequences）

**正向 (+)**
- 堵住 R-1：伪造 chart 不再影响 AI 输出。
- 服务端缓存 → 常见重复盘面零计算成本。
- `sessions` 成为权威记录，支撑审计与计费。

**负向 (−)**
- 前端需改造（去掉本地计算，或改为"预览用"、提交以服务端为准）。
- 服务端 CPU 上升（有缓存与并发上限兜底）。

**中性 / 风险**
- 切换期间存在"双算"窗口 → 用**特性开关 + `chartHash` 比对**做一致性校验。

## 复审触发条件

- 需要**离线排盘**（PWA / 小程序离线）→ 需重新权衡客户端权威的边界；
- 引擎算法升级导致 hash 口径变化 → hash 需带**引擎版本号**。

## 实施记录（2026-09-28 · P5-3）

**阶段一（重算校验闸门）+ 阶段二（服务端权威端点）已同时落地**，二者共用同一 `chartHash` 口径。

| 组件 | 文件 | 说明 |
|---|---|---|
| 稳定指纹 | `src/server/lib/chart-hash.ts` | 键排序 + 浮点归一化 + `v1:<sha256>`；带 `ENGINE_VERSION` |
| 权威端点 | `src/server/modules-public/chart/` | `POST /api/v1/app/chart`：生辰 → 服务端算 → 落 `sessions` → 返回 `sessionId` |
| 数据源解析 | `src/server/lib/chart-source.ts` | `session` / `recomputed` / `client` 三分支统一裁决 |
| 校验闸门 | `app_configs.chart_verify_mode` | `off`（默认）/ `warn` / `enforce` |
| 请求接入 | `api/chat.ts`、`api/report.ts` | 支持 `sessionId` / `birth`；响应头 `X-Chart-Verified`、`X-Chart-Source` |

**行为矩阵**

| 请求携带 | 结果 |
|---|---|
| `sessionId`（存在） | 取库内权威数据，`verified=true` |
| `sessionId`（不存在） | `404 SESSION_NOT_FOUND` |
| `birth`（重算一致） | 用服务端重算结果，`verified=true` |
| `birth`（重算不一致） | `off/warn` → 采用**服务端结果** + 告警；`enforce` → `409 CHART_MISMATCH` |
| 仅 `chart`+`annotation` | `off/warn` → 放行但 `verified=false`；`enforce` → `409` |

> 关键收益：即使 `off` 模式，一旦带 `birth`，**伪造 chart 也会被服务端重算结果覆盖**——
> 完整性缺口在数据层面即被堵住。

测试：`src/server/modules/__tests__/computation-authority.test.ts`

## 关联

ADR-001（拆分缝）｜ADR-004（额度以权威 session 计量）｜REVIEW §R-1
