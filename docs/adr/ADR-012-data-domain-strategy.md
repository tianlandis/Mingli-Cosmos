# ADR-012: 数据域分层与多库演进策略

## 状态

`Accepted` ✅（2026-09-29 · 田哥确认方向，开始落地）

## 背景

随着产品从"单一八字排盘工具"向"多体系（八字 / 星座 / 16 型人格）+ 用户体系 + 交易 + 增长"演进，数据边界开始变模糊：

1. **平台本体数据与用户业务数据混装在同一文件**。当前单个 SQLite 文件（`data/mingli.db`，生产挂载 `/opt/mingli-data/mingli.db`）内含 16 张表，既装"可随代码迁移的配置/知识资产"，也装"每个客户每次排盘的产物"。用户提出："软件本体数据应该有个完整可迁移的数据库"。

2. **规模预判**。用户预期注册用户达到 1000 甚至更多，需要提前回答"数据库怎么规划、要不要拆"。

3. **新领域即将落地**：
   - 客户充值数据（已有 `orders` / `subscriptions` / `quota_ledger`，但未按域规划）
   - AI 调用数据（**当前完全没有专门表**，只散落在 `console.log` 与 `quota_ledger.reason='chat'`）
   - 客户推介奖励数据（**当前完全不存在**）
   - 爬虫新增星座 / 16 型人格数据（需明确落点与导入方式）

用户诉求关键词：**清晰、简单、可移植、可操作**。

### 现场核查结论（2026-09-29）

对 `src/server/db/` 全量核查后，确认三个决定性事实：

| 事实 | 数值 | 对拆库的意义 |
|:--|:--|:--|
| 跨表 JOIN | **仅 1 处**（`billing.ts:177` 的 `orders.leftJoin(users)`） | 恰好落在**同一业务域内**，现在拆库不会立刻断 |
| 显式事务 | **仅 2 处**（`repositories/quota.ts:62,132`，幂等台账 reserve/commit） | 同样在**同一域内**，无需跨库事务 |
| 迁移机制 | `migrate.ts::safeAlter()` 幂等 `ALTER TABLE ADD COLUMN` + `CREATE TABLE IF NOT EXISTS` | 加列加表**零人工介入**，向后兼容 |
| 备份机制 | `scripts/backup-db.py` 基于 SQLite **在线备份 API**，**单文件导向**（`--db <单文件>`） | 拆库需**同步改造备份脚本**，否则漏备份 |
| 知识资产种子 | `seed.ts::seedKnowledgeAssets()` **已存在**，代码内定义、幂等导入 | 这是"可迁移"的**现成机制**，爬虫数据照抄即可 |

**关键发现**：`knowledge_assets` 表的 `category` 字段注释里**早已预留** `'personality'` 与键名示例 `'INTJ'`——说明知识资产表从设计之初就是"多体系知识"的容器，爬虫数据无需新建表，**沿用即可**。

## 备选方案

### 方案 A：立即物理拆分为多文件库（用户原始设想）

把 `mingli.db` 拆成 `platform.db` / `knowledge.db` / `users.db` / `charts.db` / `billing.db` / `analytics.db` 等独立文件。

**否决理由**：

- **SQLite 的多库 = 多文件，无跨库 JOIN、无跨库事务**。SQLite 有 `ATTACH DATABASE`，但它不支持跨库原子事务的通用能力（跨库写入需 `BEGIN` 包裹但受很多限制），Drizzle ORM 也**不原生支持多连接 JOIN**。一旦 `quota_ledger` 需与 `users` 对账、`llm_call_logs` 需关联 `sessions`，就会写不出来。
- **收益在当前规模为负**。拆库的收益（故障隔离、独立扩容、独立备份策略）只有在**单库真正成为瓶颈**时才成立。当前 0 用户、2vCPU/1GB 生产机，拆库只会带来：多连接管理复杂度、备份脚本改造、部署挂载点增加、Drizzle 多实例维护——**纯成本，零收益**。
- **违反 ADR-001（模块化单体）精神**。用物理隔离模拟"微服务式"边界，是把运维复杂度提前引入。

### 方案 B：立即迁移 PostgreSQL

**暂缓理由**：PostgreSQL 提供真正的多 schema、行级锁、连接池，是**终局正解**。但当前：

- 生产机 2vCPU / 961MiB（+4GB swap），额外常驻一个 PG 实例的内存开销不划算；
- 迁移需要改 Drizzle dialect、迁移脚本、备份方案、部署编排——一次性成本高；
- **当前规模（< 1 万用户、单库 < 500MB）SQLite 绰绰有余**，提前迁移是过度设计。

保留为**阶段 3**，触发条件见下文。

### 方案 C：逻辑分域 + 预留物理拆分路径 ✅（采纳）

**不改变物理存储（仍是单 SQLite 文件）**，但在**逻辑层**建立清晰的域边界：

1. 定义 7 个数据域，把 16 张表全部归位（见 `docs/arch/DATA-DOMAINS.md`）；
2. 新表统一采用**域前缀命名**（如 `growth_*`、`obs_*`），让"域"在表名上可见；
3. 仓储文件按域组织（详见实施分期）；
4. **补齐 3 个缺口**：`birth_profiles`（生辰档案）、`llm_call_logs`（AI 调用明细）、`referrals` + `referral_rewards`（增长）；
5. **知识资产走"离线 ETL → 种子文件 → 导入"**，实现可迁移；
6. 把物理拆分的**触发条件**写死，届时按域一次性拆分，不做零散迁移。

## 决策

### 1. 数据域划分（7 个域）

| 域 | 归属 | 表 | 特征 | 可迁移 |
|:--|:--|:--|:--|:--:|
| **平台配置** | 软件本体 | `api_keys` `prompt_templates` `prompt_versions` `app_configs` `admin_sessions` `audit_logs` `plans` | 低频变更、随代码版本走、无 PII | ✅ |
| **知识资产** | 软件本体 | `knowledge_assets` | 代码 seed 驱动、版本化、无 PII | ✅ |
| **用户身份** | 业务 | `users` `user_sessions` `consent_records` + ⟦`birth_profiles` 待建⟧ | 核心 PII、删除权对象 | ❌ |
| **命盘业务** | 业务 | `sessions` | 高增长、大 JSON、唯一胖表 | ❌ |
| **交易财务** | 业务 | `orders` `subscriptions` `quota_ledger` | 强一致、需事务、不可删 | ❌ |
| **运营分析** | 业务 | `analytics_events` + ⟦`llm_call_logs` 待建⟧ | 高增长、低价值密度、可采样可清理 | ❌ |
| **增长** | 业务 | ⟦`referrals` `referral_rewards` 待建⟧ | 关联用户与财务、需幂等 | ❌ |

### 2. 命名规范

- **现有表名不改**（改表名是破坏性操作，需改所有仓储 + 迁移，收益低风险高）。以域清单文档建立映射。
- **新增表统一加域前缀**：`growth_referrals`、`growth_referral_rewards`、`obs_llm_call_logs`。
  - 例外：`birth_profiles` 属于用户身份域，与 `users` 同域，可保持无前缀以免割裂（或采用 `identity_` 前缀，实施时二选一，需在本 ADR 的实施记录中登记）。
- **仓储文件**按域组织：`repositories/<domain>/<name>.ts`（渐进迁移，新文件先遵守）。

### 3. 三个缺口表的设计要点（详见 DATA-DOMAINS.md）

- `birth_profiles`：**1 用户 = N 档案**（本人/家人），`is_default` 支撑"登录自动排盘"；`sessions` 加 `birth_profile_id` 以支持按生辰归组。
- `llm_call_logs`：记录 `provider/model/tokens/latency/status/cost/trace_id`，**只增不改**，是 AI 调用计费与成本分析的唯一事实源。
- `referrals` + `referral_rewards`：推介关系与奖励发放，**必须带 `idempotency_key`**，与 `quota_ledger` 同一幂等范式。

### 4. 可迁移性实现（"软件本体可整包带走"）

- **已有基础**：`migrate.ts` 幂等建表 + `seedKnowledgeAssets()` 代码种子。
- **补齐**：把知识资产种子**外部化**为 `seeds/knowledge/*.json`，由导入脚本读取。爬虫的产出**直接生成这些 JSON 文件**，而非运行时写库。
- **效果**：迁移 = 带走 `seeds/` 目录 + 跑一次导入。平台配置域同理可导出为 JSON 快照。

### 5. 物理拆分的触发条件（写死，避免"凭感觉拆"）

满足**任一**条件即启动阶段 2（按域物理拆分，**仍在 SQLite 内**）：

- 单库文件 **> 2 GB**，或 `sessions` 表 **> 50 万行**；
- `llm_call_logs` 写入成为**热点**（写锁竞争可观测），需要独立存储；
- 需要**独立扩容**某个域（如 AI 日志迁往时序库/对象存储）。

**阶段 3（迁移 PostgreSQL）的触发条件不在本 ADR 定义，直接沿用 [ADR-002](./ADR-002-sqlite-to-postgres-triggers.md) 的 T1~T5**：单表 > 1000 万行、`SQLITE_BUSY` 重试率 > 0.5%、需多实例 / 读写分离、需在线 DDL / 行级锁、RPO/RTO < 5min。

> **两阶段不冲突**：物理拆分（本 ADR）是 **SQLite 内的低成本延寿手段**，PG 迁移是**换引擎的终局解**。先拆分可把"单库膨胀"推迟，但一旦命中 ADR-002 的 T1~T5，仍应换引擎而非继续加文件。ADR-002 已指出：若 `sessions` 撑爆，**优先补 TTL / 保留策略**（见本 ADR 阶段 3）而非直接换库——两条决策在此完全一致。

## 后果

### 变容易

- **零迁移风险**：不动物理存储，现有 393 测试 / smoke 42 基线不受影响；
- **保住事务与 JOIN**：`quota_ledger` 的 reserve→commit 原子性、`orders × users` 的关联查询继续可用；
- **心智负担低**：一个文件、一个连接、一套备份（`backup-db.py` 无需改造）；
- **边界可见**：域清单 + 命名前缀让"哪张表属于谁"一目了然，新人可自查；
- **扩展路径明确**：新模块（星座 / 人格 / 推介）落点清晰，不需要临场设计。

### 变困难

- **物理上未隔离**：靠**文档纪律 + code review** 维持边界，而非数据库强制。若团队不遵守命名规范，边界会重新模糊——这是本方案的主要风险，缓解手段是 DATA-DOMAINS.md 作为**约定唯一入口** + 域清单纳入 review checklist；
- **单点风险未消除**：单文件损坏（虽然 WAL + 在线备份已大幅降低概率）影响全部数据。缓解：现有每日 03:17 备份 + `backup-db.py` 完整性校验保留；
- **`sessions` 体积需主动管理**：大 JSON 会持续增长，需**归档策略**（见下）。

### 明确不做

- 不引入数据库中间件、不引入 ORM 之外的抽象层（避免架构宇航员化）；
- 不为"未来可能的规模"提前支付复杂度。

## 复审触发条件

出现以下任一情况，重新评审本决策：

1. 本文档的**物理拆分触发条件**被满足（走阶段 2）；
2. **ADR-002 的 T1~T5 命中**（直接触发阶段 3 换引擎，本 ADR 进入收尾）；
3. 需要**跨服务的多写并发**（单进程模型被打破）；
4. 知识资产类型超过 100 种或单类记录 > 10 万条；
5. 出现"某域需要独立 SLA / 独立生命周期"的**真实业务诉求**（非技术假设）。

## 实施分期

| 期 | 内容 | 风险 | 前置 |
|:--|:--|:--|:--|
| **0** | 本文档 + `DATA-DOMAINS.md` 域清单落地 | 无（纯文档） | — |
| **1** | 补齐 3 个缺口表（`birth_profiles` / `llm_call_logs` / `referrals`+`rewards`）+ 独立迁移，纳入 PII 导出/删除端点 | 低 | 期 0 |
| **2** | 知识资产种子外置（`seeds/knowledge/*.json`）+ 导入脚本；爬虫走离线 ETL | 低 | 期 0 |
| **3** | `sessions` 归档策略（冷数据导出 + `PRAGMA incremental_vacuum`） | 中 | 触发条件 |
| **4** | 按域物理拆分（阶段 2，仍在 SQLite） | 高 | 本 ADR 触发条件 |
| **5** | 迁移 PostgreSQL（阶段 3） | 高 | **ADR-002 的 T1~T5** |

期 1~2 为**独立小任务**，可随时插入现有路线图（P1 批次）。

## 实施记录

- 2026-09-29（起草）：状态 `Proposed`。现场核查 16 张表、1 处 JOIN、2 处事务、`seedKnowledgeAssets()` 机制。未改动任何代码。
- 2026-09-29（落地）：状态升级 `Accepted`。落地内容：
  - **阶段 0**：新增 `docs/arch/DATA-DOMAINS.md`（7 域清单 / 缺口表 DDL / 容量阈值 / 拆分步骤 / review 清单）。
  - **阶段 1（部分）**：落地 2 张缺口表 —— `birth_profiles`（用户身份域 · 核心 PII）、`obs_llm_call_logs`（运营分析域）；
    双写 `schema.ts` + `migrate.ts`；新增仓储 `repositories/birth-profiles.ts`、`repositories/llm-call-logs.ts` 并导出。
    `birth_profiles` 已接入 `GET /user/data/export` + `DELETE /user/data`（合规红线）；
    `obs_llm_call_logs` 已接写入点（`api/chat.ts` 成功 / 失败 / 异常三路径，`try/catch` 全隔离，**不影响计费逻辑**）。
    ⚠️ 增长域（`growth_*`）**暂不建表** —— 业务规则（防刷 / 税务 / 上限）未定，待独立 ADR。
  - **阶段 2（部分）**：铺设知识资产种子外置通道 —— `seeds/knowledge/` + `seeds/platform/` +
    `scripts/seed-import.mts` + `npm run db:seed`（幂等与 `.sample` 跳过已实测）。
  - 新增 `docs/arch/EXTENDING.md`（扩展开发者指南）—— "留下方便的路"的落地载体。
  - 验证：typecheck **0 错** / vitest **393 全绿** / 新表与新索引已实测建库 / 种子幂等已实测。
