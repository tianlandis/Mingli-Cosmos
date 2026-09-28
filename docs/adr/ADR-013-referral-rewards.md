# ADR-013: 推介奖励域（邀请码 · 绑定 · 达标 · 幂等发奖）

- **状态**: `Accepted` ✅（2026-09-29 · 田哥确认"全部进行，不再询问"，按 ADR-012 增长域规划落地）
- **日期**: 2026-09-29
- **决策者**: 田哥（架构方向） / 球球（方案与实现）
- **类别**: 🔧 完善
- **关联**: [ADR-004 额度幂等](./ADR-004-quota-idempotency.md) · [ADR-006 PII 治理](./ADR-006-pii-governance.md) · [ADR-009 支付幂等](./ADR-009-payment-integration.md) · [ADR-012 数据域分层](./ADR-012-data-domain-strategy.md) · `docs/arch/DATA-DOMAINS.md` §4.3

## 背景

用户提出"客户推介奖励数据"需要纳入数据库规划。现场核查后确认：**该域此前完全不存在**——库里零表、代码零逻辑。而推介奖励天然带三个必须一次做对的点：

1. **给谁发**（归因）——谁推介了谁，必须唯一、可追溯；
2. **发多少、发没发成**（结算）——必须可审计，且**绝不能重复发放**；
3. **防刷**（风控）——自邀、批量注册套利是这套机制最容易崩的地方。

ADR-012 已把该域规划为增长域的 `growth_referrals` + `growth_referral_rewards` 两张表，并明确"新领域建议单独立 ADR 后再实施"。本 ADR 即该决策。

## 驱动因素

| 驱动 | 约束 |
|:--|:--|
| **幂等**（硬约束） | 与 ADR-004 一脉相承：同一笔奖励二次触发**直接返回首次结果**，靠唯一约束而非业务流程保证 |
| **不影响支付主流程**（硬约束） | 发奖挂在 ADR-009 的**单一结算入口**上，任何异常都必须被隔离，不能回滚已完成的支付 |
| **不污染财务台账** | `quota_ledger` 是**消费**台账，须保持 `sumLedgerDelta == -quotaUsed` 不变量；发奖是"加额度"，不得写进去 |
| **合规** | 邀请关系携带用户标识，须随 ADR-006 的导出/删除一并治理 |
| **零运维** | 不新增常驻服务、不新增外部依赖；沿用 SQLite 单库（ADR-012） |
| **迁移友好** | 邀请码不应逼我们"为用户表加列"或"新增码表"——那会跨域污染用户身份域 |

## 备选方案

### 方案 A：邀请码落库（用户表加列 或 独立码表）

- 加 `users.referral_code` 列：**跨域污染**——码属增长域，却写进用户身份域；
- 新增 `growth_referral_codes` 表：多一张表 + 一次查表，收益仅是"码可随机"。

**否决理由**：成本（加列/加表 + 迁移）明显高于收益。邀请码本身**不需要保密强度**（它要被用户分享出去），真正的风控在"绑定唯一 + 奖励达标"两端，而非码的随机性。

### 方案 B：码由 userId 直接可读（`M{id}` 形式）

**否决理由**：连续可枚举，容易被"遍历填码"刷归因，且在用户侧观感廉价。

### 方案 C：奖励写进 `quota_ledger`

**否决理由**：破坏 ADR-004 的台账不变量（`quota_ledger` 只记消费，`delta` 恒为负语义）。奖励的权威记录应是增长域自己的 `growth_referral_rewards`。

### 方案 D（采纳）：**无存储可逆码 + 双唯一约束 + 独立幂等奖励表**

## 决策

### 1. 邀请码：无存储、可逆、非连续

```ts
// encode: userId → code（仿射变换后 base36 大写）
code = base36(userId * 7919 + 104729).toUpperCase()
// decode: code → userId（整数性校验，拒绝非法码）
```

- **不落库**：用户身份域零改动，增长域零新表；
- **可逆**：无需查表即可从码还原推介人；
- **非连续**：乘性偏移让相邻 id 的码不连续，降低枚举价值；
- **校验**：解码要求结果为**正整数**且码字符集合法，非法直接拒绝。

### 2. 绑定：一个被推介人只归属一个推介人

`growth_referrals` 上两道唯一约束：

- `UNIQUE(referee_user_id)` —— **一个被推介人只能被绑定一次**（核心防重复归因）；
- `UNIQUE(referrer_user_id, referee_user_id)` —— 防同一对关系重复插入。

绑定发生在**注册时**（`POST /user/register` 接受可选 `referralCode`），也支持**登录后补绑**（`POST /api/v1/app/referral/bind`，仅限尚未绑定者）。绑定失败**不影响注册**（仅告警）。

### 3. 达标与发奖：挂在支付单一入口，幂等

- **触发点**：ADR-009 的 `services/order-settlement.ts::settleOrderPaid()` —— 即"订单结算为已支付"的唯一实现点。被推介人**首次付费成功**即达标；
- **编排**：`onRefereePaid(refereeUserId)` —— pending → qualified → rewarded，全程幂等；
- **发放**：`growth_referral_rewards.idempotency_key = 'referral:reward:{referralId}'`（**唯一约束**）。二次触发命中已有记录 → 返回 `ALREADY_GRANTED`，不重复加额度；
- **加额度口径**：`users.quota_total += amount`，**与既有 `grantQuota()` 完全同一口径**，**不写 `quota_ledger`**；
- **隔离**：调用点整体 `try/catch`，异常只记日志——**发奖失败绝不回滚已完成的支付**。

### 4. 奖励额度可配置

后台配置项 `referral_reward_quota`（默认 `10` 次，`0` = 关闭）。读取顺序 **DB 配置 > 默认值**，与项目其它配置一致。

### 5. 防刷（当前经济性边界）

- **自邀拦截**：`referrer == referee` 直接拒绝；
- **一次性绑定**：唯一约束兜底，无法"多绑多刷"；
- **奖励以真实付费为前提**：套利需**真金白银**付费，经济门槛即风控门槛；
- **幂等发奖**：同一关系只发一次，无法通过重复回调放大。

### 6. 合规：邀请数据纳入 PII 治理

- `GET /user/data/export` 增加 `referrals`（我作为推介人的绑定）与 `referralRewards`（我收到的奖励）；
- `DELETE /user/data` 调用 `purgeReferralsForUser()`：清除该用户**作为推介人或被推介人**的全部推介行与奖励行。

## 后果

**正向 (+)**
- 增长域从"零"到"可用"，且与既有幂等范式（ADR-004）同构，认知成本低；
- 用户身份域**一行未动**，邀请码零存储——迁移与备份零负担；
- 发奖挂在支付单一入口，**天然继承 ADR-009 的幂等性**；
- 支付主流程与增长侧**故障隔离**：推介出问题不影响收钱。

**负向 (−)**
- 邀请码可被计算/枚举（已知取舍）：缓解在于"绑定唯一 + 达标需付费"，枚举无法直接变现；
- 奖励目前只有 `quota` 一种形态（`type` 字段已预留 `cash`/`vip`），现金/会员奖励待独立评估（涉税务）；
- 大额刷单只能靠"付费门槛"约束，尚无设备指纹 / IP 关联风控。

**中性 / 风险**
- `purgeReferralsForUser` 会连带删除**对方**视角下的奖励记录——这是删除权的必然结果（用户数据不可留存），已在删除响应中回传计数以便审计。

## 复审触发条件

满足**任一**即需重评：

1. 引入 **cash / voucher** 奖励形态（涉税务、发票、对账口径）；
2. 出现**规模化套利**（如批量注册 + 小额付费刷奖），需引入设备/IP 级风控；
3. 邀请关系需要**多级分销**（当前仅一级）；
4. 奖励额度需要**按套餐差异化**（当前全局单一配置）。

## 实施记录

- 2026-09-29：ADR 起草并落地为 `Accepted`。
  - 数据层：`growth_referrals` / `growth_referral_rewards`（`schema.ts` + `migrate.ts` 双写，幂等 DDL）；
  - 仓储：`repositories/referrals.ts`（码编解码 / 绑定 / 达标 / 幂等发奖 / 统计 / 清除）；
  - 后端模块：`modules-public/referral/index.ts`（`GET /me` · `POST /bind`，目录约定自动挂载）；
  - 接入点：`user/index.ts` 注册接受 `referralCode`；`order-settlement.ts` 结算后触发 `onRefereePaid`；
  - 合规：`/user/data/export` 与 `DELETE /user/data` 纳入推介数据；
  - 前端：注册弹窗「邀请码（选填）」+「我的 · 推荐有礼」卡（邀请码复制 + 战绩）。

## 关联

- 上游：ADR-012（增长域规划与两张表的 DDL 草案）、`docs/arch/DATA-DOMAINS.md` §4.3
- 同族：ADR-004（幂等范式）、ADR-009（结算单一入口）、ADR-006（PII 导出/删除）
- 代码：`src/server/db/repositories/referrals.ts`、`src/server/modules-public/referral/index.ts`、`src/server/services/order-settlement.ts`
