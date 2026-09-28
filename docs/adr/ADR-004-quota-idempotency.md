# ADR-004: 配额与计费的一致性 —— 幂等消费

- **状态**: `Accepted` ✅（2026-09-28 实施，Phase 5 P5-4）
- **日期**: 2026-09-28
- **决策者**: 田哥
- **类别**: 🧱 骨架（计费形态）
- **关联**: `../arch/ARCHITECTURE-REVIEW.md` §3、`src/server/db/schema.ts`（`quota_enforce_chat` 默认关）、`src/server/api/chat.ts`

---

## 背景（Context）

系统已有 `users.quota`（初始 5）、`plans` / `orders` / `subscriptions` 与配额扣减逻辑，但：

1. `quota_enforce_chat` **默认关闭** → 额度在运行时**不生效**，Freemium 商业模型形同虚设；
2. 扣减**无幂等键** → 重试 / 双击 / 网络重发可能**重复扣费**；
3. 扣减未与"一次 AI 调用"的**唯一标识**绑定 → 无对账锚点，无法回溯。

## 驱动因素（Decision Drivers）

- 收钱的前提是"**扣得准、扣不重、能对账**"。
- 单机内存态无法保证幂等 → 需要**持久化的幂等键**。
- 免费 / 付费权益差异必须在运行时**真实生效**。

## 决策（Decision）

1. **额度门禁转正**：`quota_enforce_chat` 生产默认改为 `true`（保留配置回退能力）。
2. **幂等消费**：改为 `consumeQuota(userId, idempotencyKey, cost)`，以 `(userId, idempotencyKey)`
   为**唯一约束**；新增 `quota_ledger` 表（`key / userId / delta / balanceAfter / reason / status / createdAt`）：
   - 二次提交同 key **直接返回首次结果**，不重复扣减；
   - 采用**追加式台账（ledger）**而非仅改 `users.quota` 字段 → 可审计、可对账、可回溯。
3. **一次 AI 调用 = 一个幂等键**（由服务端生成并透传给客户端，重试复用）。
4. **余额不足**返回结构化错误（如 `402 QUOTA_EXHAUSTED`）+ 购买引导，而非静默或 500。
5. **事务语义**：在单个 SQLite 事务内完成"校验余额 → 写 ledger(pending) → 扣减 → 置 committed"；
   AI 失败则回滚 / 退款（两阶段）。

## 后果（Consequences）

**正向 (+)**
- 扣费可对账（ledger 是唯一事实源），重复请求不重复扣。
- 商业模型真实生效，免费 / 付费行为差异可测。

**负向 (−)**
- 新增一张表 + 一次写放大（可接受）。
- 需处理"扣了但 AI 失败"的**补偿** → 用 pending → committed/refunded 两阶段。

**中性 / 风险**
- 并发扣减需事务隔离 → SQLite 事务内串行化即可（与 ADR-002 的 T1 触发条件呼应）。

## 复审触发条件

- 引入订阅自动续费 / 周期计费 → ledger 需扩展周期维度；
- 迁移 PostgreSQL 后 → 幂等键改由数据库唯一索引强制。

## 实施记录（2026-09-28 · P5-4）

| 决策项 | 落点 |
|---|---|
| 额度门禁转正 | `app_configs.quota_enforce_chat`；生产（`NODE_ENV=production`）种子默认 `true`，开发/测试默认 `false` |
| 幂等键 | `quota_ledger.idempotency_key` **唯一约束**；`(userId, key)` 语义 |
| 追加式台账 | 新表 `quota_ledger`（`delta / balanceAfter / reason / status / refKey`） |
| 消费接口 | `reserveQuota()` / `commitQuota()` / `refundQuota()`（`src/server/db/repositories/quota.ts`） |
| 一次调用一个键 | 客户端可传 `X-Idempotency-Key`（重试复用），否则服务端生成 |
| 余额不足 | `402 QUOTA_EXHAUSTED` + `quotaRemaining` 结构化返回 |
| 事务语义 | 余额与台账在**同一 SQLite 事务**内变更（`db.transaction`） |

**已实现的不变量（有测试守）**
- 同 key 二次提交 → 复用首次结果，**不重复扣**；
- `refundQuota` **幂等**，且不会把 `quotaUsed` 退成负数；
- 台账净额 ≡ `quotaUsed`（对账锚点）；
- AI 流式失败 → 自动 `refund`（见 `api/chat.ts` SSE catch 分支）。

测试：`src/server/modules/__tests__/quota-ledger.test.ts`

> ⚠️ 灰度提示：生产开关**默认已成为 true**，但**已存在**的库仍保留原值（`false`）。
> 上线前请在后台「系统配置」确认该开关，或直接改库：`quota_enforce_chat=true`。

## 关联

ADR-009（支付入账同样走 ledger）｜ADR-005（以权威 session 计量）｜REVIEW §3「半成品上下文」
