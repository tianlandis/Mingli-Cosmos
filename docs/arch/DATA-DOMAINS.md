# 数据域清单与操作手册

> 配套决策记录：[ADR-012 数据域分层与多库演进策略](./../adr/ADR-012-data-domain-strategy.md)
> 本文件是**数据边界的唯一约定入口**。新增表、新增仓储、code review 时以本文件为准。
> 最后更新：2026-09-29

---

## 一、7 个数据域总览

| # | 域 | 英文 | 归属 | 变更频率 | 含 PII | 可迁移 |
|:-:|:--|:--|:--|:--:|:--:|:--:|
| 1 | 平台配置 | Platform | 软件本体 | 低 | ❌ | ✅ |
| 2 | 知识资产 | Knowledge | 软件本体 | 低（版本化） | ❌ | ✅ |
| 3 | 用户身份 | Identity | 业务 | 低 | ✅ 核心 | ❌ |
| 4 | 命盘业务 | Chart | 业务 | 高 | ✅ | ❌ |
| 5 | 交易财务 | Billing | 业务 | 中 | ✅ | ❌ |
| 6 | 运营分析 | Analytics | 业务 | 高 | 弱 | ❌ |
| 7 | 增长 | Growth | 业务 | 中 | ✅ | ❌ |

**判据**：一个域 = 一组**生命周期一致、归属一致、访问边界一致**的表。
"可迁移"= 不含 PII、可整包导出为种子文件、能在新环境一键重建。

---

## 二、表 → 域 映射（全量）

| 表名 | 域 | 现状 | 说明 |
|:--|:--|:--:|:--|
| `api_keys` | 平台配置 | ✅ | LLM 密钥（加密存储） |
| `prompt_templates` | 平台配置 | ✅ | 提示词模板 |
| `prompt_versions` | 平台配置 | ✅ | 提示词版本历史 |
| `app_configs` | 平台配置 | ✅ | 全局配置 KV |
| `admin_sessions` | 平台配置 | ✅ | 管理员会话 |
| `audit_logs` | 平台配置 | ✅ | 后台操作审计 |
| `plans` | 平台配置 | ✅ | 订阅套餐**定义**（产品配置，非用户数据） |
| `knowledge_assets` | 知识资产 | ✅ | 命理/星座/人格知识字典。**爬虫数据落点** |
| `users` | 用户身份 | ✅ | C 端账户 |
| `user_sessions` | 用户身份 | ✅ | C 端登录会话 |
| `consent_records` | 用户身份 | ✅ | 告知同意留痕 |
| `birth_profiles` | 用户身份 | ✅ 已建 | 生辰档案（1 用户 N 档案） |
| `sessions` | 命盘业务 | ✅ | 排盘结果（BaZiResult JSON）。**唯一胖表** |
| `orders` | 交易财务 | ✅ | 订单 |
| `subscriptions` | 交易财务 | ✅ | 订阅 |
| `quota_ledger` | 交易财务 | ✅ | 额度幂等台账 |
| `analytics_events` | 运营分析 | ✅ | 运营埋点 |
| `obs_llm_call_logs` | 运营分析 | ✅ 已建 | AI 调用明细（token/延迟/成本） |
| `growth_referrals` | 增长 | ✅ 已建 | 推介关系 |
| `growth_referral_rewards` | 增长 | ✅ 已建 | 推介奖励发放 |

合计：**现有 20 张**，待建 **0 张**（ADR-012 规划的 5 张缺口表已全部落地；增长域决策见 ADR-013）。

---

## 三、命名规范

1. **现有表名保持不变**。改表名 = 破坏性操作（需改全部仓储 + 迁移 + 测试），收益低风险高。
2. **新增表加域前缀**（当前唯一约定来源）：
   - 增长域 → `growth_*`（如 `growth_referrals`）
   - 运营分析域 → `obs_*`（如 `obs_llm_call_logs`）
   - 用户身份域 → 与 `users` 同域，保持无前缀（如 `birth_profiles`），避免同域割裂
3. **仓储文件按域组织**：新文件走 `repositories/<domain>/<name>.ts`；现有文件渐进迁移，不强制一次性重构。
4. **索引命名**：`idx_<域前缀>_<表>_<列>`（延续现有 `idx_` 约定）。
5. **所有时间列统一 `TEXT` + `datetime('now')`**（延续现状，SQLite 惯例）。

---

## 四、三个缺口表设计（可直接落地的 Drizzle Schema）

### 4.1 `birth_profiles` — 生辰档案（用户身份域）

**为什么需要**：`users` 表 16 列里 **0 个生辰字段**；`sessions.chart` 内的 `birthDate/birthTime` 是"某次排盘产物"，**不可索引、不含历法/闰月、无归属**，无法充当"用户默认生辰"。
**为什么是独立表而非给 `users` 加 8 列**：1 用户可帮家人排盘（N 档案）；将来星座/16 人格（ADR-011 System Registry）按 `system` 维度挂同一份档案；"登录自动排盘"靠 `is_default`。

```ts
export const birthProfiles = sqliteTable('birth_profiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  label: text('label'),                       // '本人' / '父亲' / 自定义
  calendarType: text('calendar_type').notNull(), // 'solar' | 'lunar'
  birthYear: integer('birth_year').notNull(),
  birthMonth: integer('birth_month').notNull(),
  birthDay: integer('birth_day').notNull(),
  birthHour: integer('birth_hour'),           // 0-23，未知可空
  birthMinute: integer('birth_minute').default(0),
  isLeapMonth: integer('is_leap_month').default(0).notNull(),
  gender: text('gender'),                     // 'male' | 'female'
  isDefault: integer('is_default').default(0).notNull(),  // 登录自动排盘用
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})
```
- 索引：`idx_birth_profiles_user ON birth_profiles(user_id)`；`idx_birth_profiles_default ON birth_profiles(user_id, is_default)`
- **连带**：`sessions` 加 `birth_profile_id INTEGER`（可空，旧数据不回填），支持"历史命盘按生辰归组"。
- **合规红线**：本表是**核心 PII**，必须纳入 `GET /user/data/export` 与 `DELETE /user/data`（P5-6 ADR-006），否则违反"用户删除权"。

### 4.2 `obs_llm_call_logs` — AI 调用明细（运营分析域）

**为什么需要**：当前 AI 调用**无任何持久化明细**——只有 `console.log` 和 `quota_ledger.reason='chat'`（只记额度变动，不记 token/成本/延迟/模型）。无法回答"哪个模型最贵""失败率多少""单次对话平均延迟"。
**设计原则**：**追加式、只增不改**、可采样、可定期清理或外迁。

```ts
export const obsLlmCallLogs = sqliteTable('obs_llm_call_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id'),                 // 可空（匿名）
  sessionId: text('session_id'),
  provider: text('provider').notNull(),       // 'deepseek' | 'local' | ...
  model: text('model'),
  promptTokens: integer('prompt_tokens'),
  completionTokens: integer('completion_tokens'),
  totalTokens: integer('total_tokens'),
  latencyMs: integer('latency_ms'),
  status: text('status').notNull(),           // 'ok' | 'error'
  errorCode: text('error_code'),              // 'LLM_STREAM_FAILED' | '402' | ...
  costCents: integer('cost_cents'),           // 成本（分）
  traceId: text('trace_id'),                  // 关联全局 X-Trace-Id
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})
```
- 索引：`idx_obs_llm_created ON obs_llm_call_logs(created_at)`；`idx_obs_llm_user ON obs_llm_call_logs(user_id)`
- **写入点**：`src/server/api/chat.ts` 流结束判定处（与 `commitQuota/refundQuota` 同一位置，**成功/失败都记**）。
- **与既有机制的关系**：`quota_ledger` 管"扣不扣钱"（财务），本表管"花了多少算力"（运营）。两者通过 `sessionId` / `traceId` 关联，**不合并**。

### 4.3 `growth_referrals` + `growth_referral_rewards` — 推介增长域

**为什么需要**：当前**完全不存在**。推介奖励涉及"给谁发、发多少、发没发成"，必须幂等 + 可审计。

```ts
export const growthReferrals = sqliteTable('growth_referrals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  referrerUserId: integer('referrer_user_id').notNull(), // 推介人
  refereeUserId: integer('referee_user_id').notNull(),   // 被推介人（新用户）
  code: text('code'),                                    // 使用的邀请码
  status: text('status').default('pending').notNull(),   // 'pending' | 'qualified' | 'rewarded' | 'void'
  qualifiedAt: text('qualified_at'),                     // 达标时间（如被推介人首次付费）
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})
export const growthReferralRewards = sqliteTable('growth_referral_rewards', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  referralId: integer('referral_id').notNull(),
  userId: integer('user_id').notNull(),                  // 受益人
  type: text('type').notNull(),                          // 'quota' | 'cash' | 'vip'
  amount: integer('amount').notNull(),
  status: text('status').default('pending').notNull(),   // 'pending' | 'granted' | 'failed'
  idempotencyKey: text('idempotency_key').notNull().unique(), // 幂等（同 quota_ledger 范式）
  ledgerRef: text('ledger_ref'),                         // 关联 quota_ledger.idempotency_key
  grantedAt: text('granted_at'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})
```
- 唯一约束：`growth_referrals(referrer_user_id, referee_user_id)` 唯一（防重复绑定）
- **幂等**：`idempotency_key` 唯一，与 `quota_ledger` 完全同一范式，发放额度时的 `ledgerRef` 直接指向台账。
- ✅ **已实施**（2026-09-29）：本域已按 **[ADR-013 推介奖励域](../adr/ADR-013-referral-rewards.md)** 落地。邀请码**无存储可逆编码**（不加列不加表）、绑定双唯一约束、发奖幂等挂支付单一入口。

---

## 五、容量估算与阈值

### 单库体积估算（`sessions` 是唯一胖表）

| 假设 | 行数 | 单行体积 | `sessions` 体积 | 全库估算 |
|:--|--:|--:|--:|--:|
| 1,000 用户 × 人均 20 次 | 2 万 | ~10 KB | ~200 MB | **< 500 MB** |
| 5,000 用户 × 人均 20 次 | 10 万 | ~10 KB | ~1 GB | ~1.3 GB |
| 10,000 用户 × 人均 20 次 | 20 万 | ~10 KB | ~2 GB | ~2.5 GB |

> 单行体积取决于 `chart` + `annotation` JSON 的完整度。若含全量大运流年，单行可能到 **50 KB+**，上述数字放大 5 倍——这是**最需要监控的变量**。

### SQLite 能力上限 vs 真实瓶颈

- **容量上限**：单库理论 281 TB，**不是瓶颈**。
- **真实瓶颈是 WAL 的单写者模型**：同一时刻只允许一个写事务。1000 用户日活并发写通常个位数，**毫秒级写锁完全够用**。
- 需要警惕的是**写入热点**：`sessions`（每次排盘写一行大 JSON）与未来的 `obs_llm_call_logs`（每次 AI 调用写一行）——这也是阶段 2 优先拆"运营分析域"的原因。

### 阈值

**阶段 2（按域物理拆分，仍在 SQLite）** —— 命中任一即评估：

| 指标 | 阈值 | 动作 |
|:--|:--|:--|
| 单库文件 | > 2 GB | 启动阶段 2 评估 |
| `sessions` 行数 | > 50 万 | 先做 `sessions` 归档策略 |
| `llm_call_logs` 写入 | 出现写锁竞争 | 优先拆分运营分析域 |

**阶段 3（迁移 PostgreSQL）** —— **以 [ADR-002](../adr/ADR-002-sqlite-to-postgres-triggers.md) 的 T1~T5 为唯一标准**，不在本文件另立阈值：

| 触发 | 判据（来自 ADR-002） |
|:--|:--|
| T1 并发写冲突 | `SQLITE_BUSY` 重试率 > 0.5% |
| T2 单表规模 | 任一业务表 > 1000 万行 |
| T3 多实例 | 上线第 2 个副本 / 需读写分离 |
| T4 可用性 | RPO / RTO < 5min |
| T5 运维 | 需在线 DDL / 行级锁 |

> 注意区分：**物理拆分 ≠ 换引擎**。前者是 SQLite 内的延寿手段，后者是终局解。命中 T2 时优先补保留策略（归档 / TTL），而非直接换库。

### `sessions` 归档策略（阶段 3 预研）

大 JSON 不可无限增长。方向：按 `created_at` 将 **N 个月前**的记录导出为冷数据（保留 `chart_hash` / `engine_version` / `user_id` 元数据在库，`chart`/`annotation` blob 外迁），再 `PRAGMA incremental_vacuum` 回收空间。**待触发后单独设计。**

---

## 六、可迁移性：软件本体数据的导出与重建

### 现状基础（已具备）

- `migrate.ts` 幂等建表：新环境 `initDb()` 自动重建全部表结构；
- `seed.ts::seedKnowledgeAssets()` 代码内种子：幂等导入八字基础数据（藏干、长生、地支关系等）。

### 目标形态：种子外置

```
seeds/
  knowledge/
    bazi.json          # 八字基础（现有 seedKnowledgeAssets 内容迁出）
    shensha.json       # 神煞
    zodiac.json        # 星座（爬虫产出）
    personality.json   # 16 型人格（爬虫产出）
  platform/
    plans.json         # 订阅套餐
    prompts.json       # 默认提示词
```

- **导入脚本**：读 `seeds/**/*.json` → 幂等 upsert 到 `knowledge_assets` / `plans` / `prompt_templates`。
- **爬虫正解**：**离线运行 ETL → 直接生成 `seeds/knowledge/zodiac.json` 与 `personality.json` → 导入**。
  - ✅ 可版本控制（种子随代码提交，可 review diff）
  - ✅ 可迁移（带走 `seeds/` 即带走全部知识）
  - ✅ 可复现（同一份种子，任何环境结果一致）
  - ❌ 运行时直写库（不可迁移、不可 review、爬虫失败污染生产库）
- **效果**：迁移到新环境 = `带走 seeds/` + `npm run db:seed`。

### 检查清单（迁移前自检）

- [ ] `git ls-files -- data logs` 为空（判据：持久化数据不在工作树内，见 2026-09-28 事故）
- [ ] `seeds/` 目录完整、`db:seed` 幂等可重跑
- [ ] 业务数据经 `backup-db.py` 在线备份，且 `PRAGMA integrity_check` 通过
- [ ] `DB_PATH` 指向新环境**仓库外**绝对路径

---

## 七、未来物理拆分（阶段 2）操作指南

**触发时**按域一次性拆分，不做零散迁移。建议顺序（按"低关联 + 高增长"优先）：

1. **运营分析域** → `analytics.db`（`analytics_events` + `obs_llm_call_logs`）。理由：与核心业务关联最弱、增长最快、可接受最终一致。
2. **命盘业务域** → `charts.db`（`sessions`）。理由：体积最大，可独立归档/备份策略。
3. **知识资产域** → `knowledge.db`（`knowledge_assets`）。理由：只读为主，天然适合独立。

**拆分前必须解决的两个硬问题**：

| 问题 | 解法 |
|:--|:--|
| 跨库 JOIN 消失 | 改为**应用层 join**（两次查询 + 内存合并），或把 `users.username` 等必要字段**冗余**到订单表快照 |
| 备份脚本单文件导向 | `backup-db.py` 扩展为**多库循环备份** + 各自的完整性校验 |

**明确不拆**：**交易财务域与用户身份域保持同库**。理由：`quota_ledger` × `users`、`orders` × `users` 的强一致与关联查询是刚需，跨库会直接制造写不出的场景。

---

## 八、Code Review 检查清单（数据边界）

新增/修改数据层代码时，逐条自查：

- [ ] 新表是否归入了 7 域之一？未归入 → 先更新本文件
- [ ] 新增表是否加了**域前缀**？
- [ ] 是否引入了**跨域 JOIN**？若是，评估是否应改为应用层关联或字段冗余
- [ ] 是否引入了**跨域事务**？若是，**必须停止**——单库虽支持，但会阻碍未来拆分，需重新评审边界
- [ ] 若表含 PII，是否纳入了 `data/export` 与 `DELETE /user/data`？
- [ ] 时间列是否统一 `TEXT` + `datetime('now')`？
- [ ] 幂等操作是否带 `idempotency_key`？
