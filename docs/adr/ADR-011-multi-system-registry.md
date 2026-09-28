# ADR-011: 多体系注册表（System Registry）—— 从「八字专用」到「多术数/测评体系共存」

- **状态**: `Proposed`（待评审；阶段 0 可先行实施）
- **日期**: 2026-09-29
- **决策者**: 田哥
- **类别**: 🧱 骨架（决定系统形态 / 领域边界）
- **关联**: ADR-001（拆分缝）、ADR-004（额度计量）、ADR-005（计算权威 = sessions）、ADR-010（API 兼容）；
  代码：`src/server/db/schema.ts`、`src/server/modules-public/chart/index.ts`、`src/server/lib/chart-source.ts`、
  `src/server/prompts/system.ts`、`src/server/api/chat.ts`、`src/engine/pattern/mbtiMapping.ts`

---

## 背景（Context）

产品侧拟引入**非八字体系**：星座/星盘、16 型人格（独立测评）；更远期还可能有紫微、塔罗、姓名学。

但当前代码库是**单体系垂直实现** —— 从输入到 AI 解读，整条链路都把"八字"焊死在结构里，共 **3 处硬绑定**：

| # | 位置 | 绑定方式 | 后果 |
|:--:|---|---|---|
| 1 | `sessions` 表 `chart` / `annotation` 列 | 语义固定为 `BaZiResult` + 八字批注 | 其他体系的产物无处安放，写入即**语义污染** |
| 2 | `modules-public/chart/index.ts` | 直接调 `calculateBazi` / `calculateBaziFromLunar` | 其他体系无法复用该入口 |
| 3 | `buildSystemPrompt(chart, annotation)` | 形参与语义均为八字 | prompt 无法按体系切换 |

> 若采取"新体系各自复制一套垂直切片"的做法，第 N 个体系的成本**线性增长**，且 `sessions`
> 表会混入 N 种互不可区分的结构 —— 届时**无法迁移、无法按体系计量、无法 A/B**。

**关键事实（本 ADR 的出发点）**：16 型人格**已经存在**，但它**不是独立体系**，而是
**八字引擎的派生输出** —— `src/engine/pattern/mbtiMapping.ts::analyzeMBTI()` 把十神映射为 MBTI 画像
（`typicalTypes / cognitiveFunctions / traits / portrait / industrySuggestions / energyAdjustments`），
产出在 `annotation.patternAnalysis.mbti`，当前仅被渲染在最深层的「命理解读」Tab。星座则**完全空白**。

因此 **"人格突出"是前端信息架构问题**（零架构改动），**"星座新增"才是本 ADR 要解决的骨架问题**。二者性质不同，不可混为一谈。

## 驱动因素（Decision Drivers）

1. **多体系共存**：至少 2 个非八字体系已进入路线图，且共享同一批用户与同一套商业化（额度/订单）。
2. **引擎封版红线**：`src/engine/` 已封版**禁止修改** —— 泛化**不能**改造八字引擎（本项目最硬的约束）。
3. **线上有真实数据**：`sessions` 已有生产数据 → 迁移必须**向后兼容、可回滚**。
4. **共享骨架与体系无关**：用户认证、额度台账、AI 对话、会话持久化、可观测、支付结算应 100% 复用。
5. **可逆性优先**：优先选"容易改回来的"方案，而非"理论上最优"的方案。

## 备选方案（Options）

### Option A：每体系垂直复制（不改骨架）
为新体系各复制一套表 + 路由 + prompt。
- **优点**：本次改动最小、可立即开工。
- **代价**：schema 与路由**线性膨胀**；共享逻辑（鉴权/额度/对话）被复制 N 份 → 修一个 bug 改 N 处；
  `sessions` 无法统一计量与查询。
- **判定**：**不采用**。它把"今天的省事"变成"明天的高利贷"。

### Option B：引入 `system` 维度的 System Registry（泛化）
把"体系"提升为**一等概念**：`sessions` 增加 `system` 标识，产物字段泛化为体系 payload；
引擎按统一接口插件化；prompt 按 `system` 路由。
- **优点**：一次投入，第 N 个体系**边际成本骤降**；`sessions` 可区分/可迁移/可计量；共享骨架完全复用。
- **代价**：`sessions` 结构变更（需迁移）；引入一层"体系注册/路由"间接；hash 口径需分体系命名空间。
- **判定**：**采用**。

### Option C：按体系拆微服务
每个体系一个独立服务。
- **代价**：违背 ADR-001（单体优先）；跨体系共享用户/额度将退化为分布式事务；
  当前 2vCPU / 1GB 生产机无法承载。
- **判定**：**不采用**（明确排除；留待 ADR-002 触发条件满足后再议）。

## 决策（Decision）

**采用 Option B**，并遵循「**最小切口 + 引擎零侵入**」原则：

### 1. 数据模型：`sessions` 泛化（向后兼容）
```ts
// 仅新增列，不改既有列语义
system: text('system').default('bazi').notNull()   // 'bazi' | 'astro' | 'mbti' | ...
// chart / annotation 列名保留（避免破坏既有读路径），语义上升为「体系产物 payload」
```
- 旧数据 `system` 缺省回填 `bazi`，**既有查询行为不变**；
- SQLite 走 `ALTER TABLE ADD COLUMN`（带默认值）在线迁移，**不锁表、不重建**；迁移前先跑 `scripts/backup-db.py`；
- 约定：**所有读路径必须先看 `system` 再解析 payload**，杜绝"按列名猜语义"。

### 2. 引擎：统一接口 + 适配器（**不动 `src/engine/`**）
```ts
// 新增 src/systems/types.ts
export interface SystemEngine<TInput, TResult> {
  readonly id: string                                  // 'bazi' | 'astro' | 'mbti'
  readonly version: string
  compute(input: TInput): Promise<TResult> | TResult
  hash(result: TResult): string                        // 口径必须带体系前缀，如 'astro:v1:<sha256>'
  ctxFor(result: TResult): string                      // 产出注入 LLM 的上下文文本
}
```
- **八字**：新增 `src/systems/bazi/` —— **薄适配器**包住封版引擎，`engine/` 一行不改；
- **星座**：`src/systems/astro/`，独立实现（含天文历/宫位计算）；
- **注册表**：`src/systems/registry.ts` 汇总 `Map<system, SystemEngine>`，是唯一"体系发现"入口。

### 3. AI 链路：prompt 分体系路由（行为等价重构）
- `resolveChartSource` 泛化为 `resolveContext(system, sessionId | birth | payload)`；
- `buildSystemPrompt` 泛化为「按 `system` 选系统提示词 + 调 `engine.ctxFor(result)`」；
- `chat.ts` / `report.ts` 的**计费、鉴权、SSE、护栏链路完全不动**（已被 ADR-004 / ADR-005 验证）。

### 4. 前端：体系选择器 + 各自的 L0/L1/L2
- 复用 `BirthForm` 输入壳、`ChatPanel`、`ResultTabs` 容器壳；
- 各体系自带 L0/L1/L2 结果组件（八字组件不动）。

### 明确不做（Non-Goals）
- ❌ 不修改 `src/engine/`（封版红线）；
- ❌ 不改变既有 API 字段名 / 枚举值（只允许**新增可选字段**，对齐 ADR-010）；
- ❌ 不引入微服务 / 分布式事务；
- ❌ 不为"尚未验证需求"的体系提前建表或提前泛化。

## 后果（Consequences）

**正向 (+)**
- 第 N 个体系 = "实现一个 `SystemEngine` + 一组结果组件"，**边际成本从"复制一套"降为"插一个插件"**；
- `sessions` 成为**跨体系可计量对象**（配合 ADR-004，一张台账管所有体系）；
- 共享骨架（鉴权 / 额度 / 对话 / 可观测 / 支付）零重复；
- 与 ADR-001「预留拆分缝」一致 —— 将来任一体系要独立演进，可沿 `system` 边界**整缝切出**。

**负向 (−)**
- `sessions` 需一次在线迁移（加列 + 回填，风险低但必须先备份）；
- 多一层"注册 / 路由"间接，阅读成本上升；
- 各体系 `hash` 口径若不统一，跨体系一致性校验会失效（用**前缀命名空间**强制隔离）。

**中性 / 风险**
- `chart` 列名保留但语义泛化 → 存在"看列名误判"的认知风险；
  **缓解**：在 `schema.ts` 注释与本 ADR 显式声明，并优先提供命名更准的读取辅助函数。
- 旧客户端不带 `system` → 默认 `bazi`，行为不变。

## 实施分期（建议）

| 阶段 | 内容 | 是否动架构 | 风险 |
|:--:|---|:--:|:--:|
| **0** | **16 型人格「突出重点」**（前端信息架构，零后端改动） | 否 | 🟢 极低 |
| 1 | `sessions` 加 `system` 列 + 迁移 + 回填（纯新增） | 是（兼容） | 🟢 低 |
| 2 | `SystemEngine` 接口 + `bazi` 适配器 + 注册表（**行为等价重构**） | 是 | 🟡 中（需回归） |
| 3 | `resolveContext` / prompt 路由泛化（**行为等价重构**） | 是 | 🟡 中 |
| 4 | 星座引擎 + `/api/v1/app/chart` 支持 `system=astro` | 是（新增） | 🟡 中 |
| 5 | 前端体系选择器 + 星盘 L0/L1/L2 | 否（新增 UI） | 🟢 低 |

> **原则**：阶段 1~3 全部是**行为等价重构**（重构前后对外行为不变），
> 必须先让 `npm run typecheck` 零错误、`vitest` 393/393、`npm run smoke` 42/42 保持全绿，
> **再**进入阶段 4 的新增。任何阶段失败 → 立即回滚，不带病前进。

## 复审触发条件

- 体系数量 ≥ 3 且**出现跨体系组合分析需求**（如"八字 × 星座对照"）→ 需重新设计 **cross-system 上下文模型**
  （当前设计为单体系上下文，跨体系需要新的聚合层）；
- `sessions` 单列不足以承载某体系的产物体积 / 结构 → 拆出 `session_payloads` 子表；
- 某体系需要**独立伸缩或独立数据合规边界** → 触发 ADR-001 拆分缝评估。

## 关联

ADR-001（单体优先 / 拆分缝）｜ADR-004（额度幂等台账，跨体系共用）｜ADR-005（sessions 即计算权威锚点）｜ADR-010（API 版本兼容）
