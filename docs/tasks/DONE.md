# ✅ 已完成记录（DONE）

> **用途**: 记录已完成的重要任务，避免重复工作

---

## 2026-09-29 — 👤 真实用户闭环：注册收录生辰 + 登录免重复排盘 ✅

> 目标：修掉"数据层做完、能力未闭环"——`birth_profiles` 早有表+仓储，却**无 API、注册不收**，
> 用户登录后仍要每次手填排盘信息。本批补齐：**注册即收生辰 → 落默认档案 → 登录自动排盘 → 我的页可管理**。
> 起因：测试账号 `123456`/`123456` 不能登录（生产库本无该账号；本地库不随部署同步）→ 现场真实注册并顺带补齐注册生辰。

| 落点 | 内容 |
|---|---|
| `src/server/modules-public/birth-profiles/index.ts` | 新建 C 端模块（`meta.prefix='user/birth-profiles'`）：列表/新建/改/删/设默认；删默认自动顺延（回传 `promotedDefaultId`）；越权 404 |
| `src/server/lib/birth-input.ts` | 新建共享校验：`birthFieldsObject` / `birthInputSchema` / `checkRealDate`（阳历真实月天数，农历 30 天），注册与 CRUD 复用 |
| `src/server/db/repositories/birth-profiles.ts` | 增 `toBirthProfileDto()`（0/1→boolean），模块与 `/me` 共用 |
| `src/server/modules-public/user/index.ts` | `registerSchema` 收可选 `birth` → 建默认档案；`GET /me` 回传 `defaultBirthProfile` |
| `src/lib/birth.ts` | 新建纯逻辑：类型、13 时辰选项、`toBirthPayload`/`birthPayloadToChartInput`/`profileToChartInput` |
| `src/components/BirthFields.tsx` | 新建共享字段组件（历法/性别/年月日/闰月/时辰），排盘表单/注册弹窗/我的页三处共用 |
| `src/components/AuthDialog.tsx` | 注册模式生辰**必填**；必填项（账号→密码→生辰）前置，可选项（昵称/手机/邀请码）后置 |
| `src/hooks/useUser.ts` / `useBazi.ts` / `src/App.tsx` | `useUser` 暴露 `defaultBirthProfile`；`useBazi` 增 `reset()`；App 身份切换 reset + 登录后自动排盘 |
| `src/pages/MyPage.tsx` | 新增「我的生辰」卡：列表 / 设为默认 / 删除 / 展开式新增 |
| `src/server/modules/__tests__/birth-profiles.test.ts` | 新增 19 项：默认唯一 + 删除顺延、越权 404、真实日期（2/30 拒、2/29 受）、注册建档 + `/me` 回传 |

**顺带修复**：`PATCH` 改标签静默失效 —— `updateSchema` 漏声明 `label` 被 zod 剥离；改为先 `.extend({label})再.partial()`（坑已写入 EXTENDING.md）。

**验证**：`tsc -b --noEmit` 零错误 ｜ `vitest run`（Node 26）**447/447（26 文件，+19）** ｜ `vite build` 通过 ｜ `npm run smoke` **42/42** ｜ 真机 390px：注册弹窗含「生辰信息(必填)」，登录后**免填表自动出盘**，「我的生辰」增删设默认正常，控制台零错误。

---

## 2026-09-29 — 🎭 Phase 4e：MBTI 表达语料接入知识字典 + Step1 锚点注入 ✅

> 目标：排盘报告的 `mbtiProfile` 段落从"泛泛而谈"升级为"心理咨询师口吻"——
> 先共情 → 再描述 → 后照护建议，全篇倾向性措辞，禁绝对化断言（对齐 L3 护栏）。

| 落点 | 内容 |
|---|---|
| `src/server/data/mbti-expression-corpus.ts` | 新建语料数据模块：**32 份核心档案**（16 类型 × A/T）+ **8 维度咨询师档案**，提炼自北大 Machine-Mindset 中文语料（Apache 2.0）+ 原创改写 |
| `src/server/db/seed.ts` | `personality` 分类新增 2 个知识资产：`mbti_core32_profiles`（sortOrder 20）、`mbti_dimension_counselor`（sortOrder 30），writeSeedAsset 按 key 幂等 |
| `src/server/workflows/mbti-expression.ts` | 新建解析器：格局 MBTI 典型类型 + 日主强弱（强侧→-A / 弱侧→-T / 中和按 score 分界）→ 档案查找 → Prompt 锚点块；字典未命中静默降级 |
| `src/server/prompts/personality.ts` | `buildPersonalityPrompt` 增加可选 `mbtiAnchor` 参数（缺省行为不变，兼容既有回归测试） |
| `src/server/workflows/step-personality.ts` | Step1 工作流解析锚点并注入 Prompt |
| `src/server/workflows/__tests__/mbti-expression.test.ts` | 新增 11 项测试：强弱映射、降级路径、字典热覆盖、兜底数据完整性、锚点块护栏标注 |
| `docs/corpus/mbti-corpus/` | 语料来源/许可/版权红线（SOURCES）、说明总结（SUMMARY）、口吻规则（expression_rules）、语料 JSON 全套归档 |

**架构对齐**：数据走 Phase 4c 知识字典路线（`knowledge_assets` → `KnowledgeRegistry` → `getOrFallback` 编译时兜底），管理后台可 CRUD 热更新；表达层不改排盘算法，`mbtiProfile` 段末挂"（现代心理类型视角参考）"。

**验证**：`tsc -b --noEmit` 零错误 ｜ `vitest run`（Node 26）**428/428（25 文件，+11）** ｜ `vite build` 通过。

**版权红线**：16personalities.com 官网文案禁止整段入库；语料许可 Apache 2.0，表达文案为原创改写可商用。

---

## 2026-09-28 — 🔴 生产事故修复：数据库文件被 git 覆盖（最严重）✅

> 部署备份脚本时**顺带发现**：生产库磁盘文件是 9 表旧库，而应用在写一个**被删除的 inode**
> —— 一旦容器重启，真实用户/订单数据全丢。

| 落点 | 内容 |
|---|---|
| **抢救** | 从 `/proc/<pid>/fd` 导出活库 + WAL → 恢复出 15 表完整数据（用户/订单/订阅/埋点齐全） |
| `git rm --cached data/mingli.db` | 取消对那个 9 表开发库的跟踪（**根因**） |
| `docker-compose.yml` | 挂载改 `${HOST_DATA_DIR:-./data}`，生产指向仓库之外 `/opt/mingli-data` |
| `scripts/deploy-vps.sh` | 守卫：仓库跟踪 data/logs 即中止；自动建/迁移数据目录 |
| `src/server/db/index.ts` | 启动自检 `warnIfDbInsideGitTree()` |
| `docs/deploy/DEPLOY-LOG-VPS.md` | 新增事故复盘章节 |

**验证**：`tsc -b` 零错误 ｜ `vitest 320/320` ｜ 生产服务健康、数据可用。

---

## 2026-09-28 — 🧱 Phase 5 骨架 P5-1：数据库自动备份（ADR-008）✅

> 先止住"生产库无备份"这个最沉默的 P0 风险。

| 落点 | 内容 |
|---|---|
| `scripts/backup-db.py` | SQLite 在线备份/恢复工具（Python 标准库零依赖；WAL 安全；完整性校验；保留策略；gzip；restore 覆盖保护） |
| `docs/deploy/*` | 上线手册新增 3.7 备份章节；运维命令更新 |
| `docs/adr/ADR-008` | 状态 → `Accepted`，附实施记录与真 bug 复盘 |

**验证**：本地同一解释器实跑 **9/9 PASS**（含恢复演练）。
**部署**：宿主机 `/opt/mingli/` + cron `17 3 * * *`，**未重建容器、未中断服务**。

---

## 2026-09-28 — 🏛️ 架构评审 + ADR 决策骨架（10 条）✅

> 全仓库真实勘察（代码/文档/schema/生产现状）+ 架构决策评审会，产出评审报告与决策基线。

| 落点 | 内容 |
|---|---|
| `docs/arch/ARCHITECTURE-REVIEW.md` | C4 三视图 · 7 限界上下文 · 四维扩展性 · 3 方案权衡 · P5~P8 路线 · 风险清单（带证据） |
| `docs/adr/README.md` + ADR-001~010 | 10 条正式决策记录 + 索引（状态机 / 骨架-完善分组 / 骨架实施顺序表） |
| `docs/INDEX.md` / `ARCHITECTURE.md` | 登记决策层 + 交叉引用 |

**核心结论**：模块化单体形态正确、无需重写；走"加固单体 + 预留拆分缝"路线。
**最重要发现**：计算 SSOT 违背（客户端算、服务端盲信）→ 完整性与一致性双风险（ADR-005 收敛）。

---

## 2026-09-28 — 🔴 安全修复：ADMIN_PASSWORD 静默失效（默认弱口令）✅

> 验收：`tsc -b --noEmit` 零错误 ｜ `vitest run` **320/320**（16 文件）
> ｜ 生产实测：新密码可登录、`mingli2026` 被拒

| 落点 | 内容 |
|------|------|
| 根因 | `auth/index.ts` 模块顶层常量读 `process.env.ADMIN_PASSWORD`，求值早于 dotenv 注入 → 落到内置默认值并写入 DB；而 DB 优先级最高，此后改 `.env` 永不生效 |
| 修复 | 环境变量全部惰性读取；新增 `ensureAdminPasswordInitialized()` 在 `initDb()` 后显式初始化，并打印密码来源 / 弱口令告警 / env 与 DB 不一致提示 |
| 回归测试 | `src/server/modules/__tests__/admin-password.test.ts`（5 项）：自检写入 env 密码、默认密码必须 401、DB 已有记录不被覆盖 |

> 教训：**配置读取不要放在模块顶层**。凡是「模块加载可能早于配置注入」的场景
> （dotenv / 容器注入 / 单测注入），一律惰性读取，并在启动时显式初始化 + 自检告警。

---

## 2026-09-28 — 端到端冒烟 + 登录限流缺陷修复 ✅

> 验收：`tsc -b --noEmit` 零错误 ｜ `vitest run`（Node 26）**315/315**（15 文件）｜ `vite build` 通过
> ｜ `npm run smoke` 真实服务 **26/26** 且可连续重跑

| 落点 | 内容 |
|------|------|
| 冒烟脚本 | `scripts/smoke-e2e.mjs`（`npm run smoke`）：真实 HTTP 覆盖 C 端注册/登录/下单/支付/埋点 + 后台用户/订单/看板 + 双鉴权未授权拦截 |
| 缺陷修复 | 登录限流改为「失败才计数」：中间件只预检，失败时 `recordLoginFailure()`、成功时 `clearLoginAttempts()`；原实现把成功登录也计入，5 次即锁 15 分钟 |
| 回归测试 | `src/server/core/__tests__/rate-limit.test.ts`（7 项）：IP 5 次/账号 10 次阈值、成功清零、两维度独立 |
| 配套 | `package.json` 新增 `npm run smoke` |

---

## 2026-09-28 — Phase 4b 运营中台 M-6/M-7/M-8 + 设计轨 S1 全闭环 ✅

> 验收：`tsc -b --noEmit` 零错误 ｜ `vitest run`（Node 26）**308/308**（14 文件）｜ `vite build` 通过
> 提交：`d33eef3`（后端）、`e1a856b`（前端 + S1）

### M-6 C 端用户体系

| 落点 | 内容 |
|------|------|
| 数据层 | 新增 `users` / `user_sessions` 表 + `repositories/users.ts`（CRUD、原子扣减额度、会话管理） |
| 认证 | 新增 `core/middleware/user-auth.ts`：与 admin 完全隔离的密钥、会话表、JWT（7 天） |
| C 端 API | `/api/v1/app/user/*`：register / login / logout / me / quota / profile / sessions / status |
| 后台 API | `/api/v1/admin/users/*`：列表搜索、统计、详情、改状态、调额度、重置密码、删除 |
| 前端 | `admin/modules/users/UsersPage.tsx`；C 端 `AuthDialog` + `useUser` + Header 登录态 |

- 停用账号或重置密码 → 强制该用户所有会话下线
- 额度扣减用 SQL 条件更新（`quota_used < quota_total`）避免并发超卖
- AI 对话可选扣额度：配置项 `quota_enforce_chat`（默认 `false`，开启后不足返回 402）

### M-7 订单与订阅

| 落点 | 内容 |
|------|------|
| 数据层 | 新增 `plans` / `orders` / `subscriptions` 表 + `repositories/billing.ts` |
| C 端 API | `/api/v1/app/billing/*`：套餐列表、下单、模拟支付、我的订单、我的订阅 |
| 后台 API | `/api/v1/admin/orders/*`：订单列表与统计、套餐 CRUD、离线确认收款、退款回收权益、维护任务 |
| 前端 | `admin/modules/orders/OrdersPage.tsx`（订单 Tab + 套餐 Tab） |

- 支付后自动激活/顺延订阅、发放额度、提升等级；退款撤销订阅并回收额度、无其它订阅时降级 free
- 默认种子套餐：体验包 ¥9.9 / 月度 ¥39 / 年度 ¥299（按 code 幂等）

### M-8 运营数据看板

- 新增 `analytics_events` 表 + 事件白名单（9 类），`POST /api/v1/app/track` 支持匿名上报
- 后台 `/api/v1/admin/analytics/overview|series|events` 聚合（用户/活跃/排盘/对话/收入/订阅/趋势）
- `admin/modules/dashboard/OperationsOverview.tsx`：指标卡 + 纯 SVG 趋势图 + 事件分布（60s 刷新，无第三方图表依赖）

### 设计轨 S1

- **UI-8**：新增 `.chapter-enter` 交错入场动画（0→490ms 逐级 delay），尊重 `prefers-reduced-motion`
- **UI-9**：新增 `DayMasterStrength.tsx` 日主强弱进度条（0-100 刻度 + 7 档等级 + 五维分量 + 判断依据折叠）

### 部署链路修复（本次发现的真隐患）

1. `Dockerfile` 基础镜像 `node:22-alpine` → **`node:26-alpine`**（better-sqlite3 ABI 147，Node 22 启动即崩）
2. `docker-compose.yml` 缺数据卷 → 新增 `./data:/app/data`、`./logs:/app/logs`（否则容器重建丢失全部用户与订单）
3. 新增 `docs/deploy/VPS-LAUNCH-CHECKLIST.md`（D-4~D-6 上线手册）

### 新增文件（14 个）

- 后端：`modules-public/{user,billing,track}/index.ts`、`modules/{users,orders,analytics}/index.ts`
- 数据层：`repositories/{users,billing,analytics}.ts`、`core/middleware/user-auth.ts`
- 前端：`admin/modules/users/UsersPage.tsx`、`admin/modules/orders/OrdersPage.tsx`、`admin/modules/dashboard/OperationsOverview.tsx`
- C 端：`src/lib/user-api.ts`、`src/hooks/useUser.ts`、`src/components/AuthDialog.tsx`、`src/components/DayMasterStrength.tsx`

---

## 2026-09-28 — Phase 4a 打磨收尾 R1~R6 全闭环 ✅

> 验收：`tsc -b --noEmit` 零错误 ｜ `vitest run`（Node 26）**252/252** ｜ `vite build` 通过

| ID | 任务 | 交付 | 测试 |
|:---:|------|------|------|
| R1 | 护栏热生效闭环 | 端到端验证 `GuardPanel → PUT /prompts/guards → app_configs → buildAntiHallucinationPromptDynamic()` 全链路；前端"已修改"判定改为对比服务端基线，消除前后端两份默认值漂移 | `guards.test.ts` 14 项 |
| R2 | Prompt 编辑器自解释 | 新增 `HelpTip` 组件；模板标识/版本号、启用开关、用途说明、系统锁定区、版本历史、停用标记全部补齐 tooltip | — |
| R3 | Debug 闭环 | **修复断点**：此前 `prompt_templates` 内容运行时不消费，沙盒调试与真实对话是两套。现新增 `GET /samples` + `POST /render`，运行时 System Prompt 支持管理员自定义指令段；沙盒抽出为 `DebugPanel.tsx` 并支持「编辑器内容 / 运行时真实 Prompt」双来源 | `debug-loop.test.ts` 10 项 |
| R4 | L3 护栏热编辑 + 回退兜底 | 新增 `isValidGuards()` 结构校验（8 条规则在位 + 白名单 + 内容非空 + 话术非空 + 无重名），任一不满足即整体回退硬编码；`L1_RULE_NAMES` 提为唯一权威来源，管理后台 Zod 校验改为 import | `guards.test.ts` +7 项 |
| R6 | 版本回滚演练 | 修正版本推进逻辑（原首次编辑后版本号仍为 1、与快照撞号）；回滚前自动存档可再回滚；后台新增行级 diff 对比视图 | `versions.test.ts` 7 项 |

### 附带修复

- **`admin/` 从未被类型检查**：`tsconfig.app.json` 的 `include` 只有 `src`，管理后台 21 个文件长期裸奔。已纳入并修掉 19 处错误（含 `App.tsx` 给 `PromptEditor` 传不存在 props、`GuardPanel` 读 `json.source` 不存在字段两处真 bug）。
- 新增 `isDbReady()`：DB 未初始化时纯代码回退，避免可选增强逻辑误建真实库文件。

### 新增文件

- `src/server/modules/__tests__/guards.test.ts`、`debug-loop.test.ts`、`versions.test.ts`
- `src/server/prompts/samples.ts` + `src/server/prompts/samples/`（3 个调试命例）
- `admin/modules/prompts/DebugPanel.tsx`

---

## 2026-09-28 — 工程基线修复：tsc 全绿 + 214/214 + build 通过 🧱

### 背景

复工盘点的结论：项目的"健康度"被两类假象掩盖 ——（1）`tsc --noEmit` 零错误是**假的**（根 `tsconfig.json` 只有 `references`，不检查任何文件）；（2）测试/构建隐式依赖 Node 版本，无声明。本次把基线拉回"真实可验证"。

### 一、工程基建

- 新增 `.nvmrc`（内容 `26`）；`package.json` 增 `engines.node >= 26.0.0`。原因：`better-sqlite3` 按 Node 26（ABI 147）编译，托管 Node 22（ABI 127）加载即崩。
- 确认有效验证入口为 `npm run typecheck`（`tsc -b --noEmit`）。

### 二、真实 TypeScript 错误修复（约 50 处）

**AI SDK v6 API 漂移（顺手修掉的功能级 bug）**：

| 问题 | 文件 | 修复 |
|------|------|------|
| `maxTokens` 被静默忽略 | `step-personality.ts` / `step-luck.ts` / `router-agent.ts` | → `maxOutputTokens` |
| 工具参数校验失效 | `modules/llm/tools-executor.ts` | `tool({ parameters })` → `tool({ inputSchema })` |
| `LanguageModelV1` 类型不存在 | `lib/llm.ts` | → `LanguageModel`，删无效 `@ts-expect-error` |

**类型收敛**：`TOOL_EXECUTORS` / `getEnabledTools` / `getAllToolExecutors` 由 `ReturnType<typeof tool>`（退化为 `Tool<never,never>`）改为 `ToolSet`；`logAudit` 改用统一导出的 `AdminEnv`，config/knowledge/llm/prompts 模块路由改为 `new Hono<AdminEnv>()`；`step-assemble.formatTopics` 用 `keyof` 键类型收敛替代 `as Record<string,string[]>` 强转。

**Zod v4**：object 上 `.default({})` → `.prefault({})`；`z.record(z.any())` → `z.record(z.string(), z.any())`。
**TS 6**：删除 `tsconfig.app.json` / `tsconfig.node.json` 已弃用的 `baseUrl`。
**严格模式**：批量清理未使用导入/变量。**顺带**：重写 `executeSolarTermCalc`（原两分支必抛、全靠 fallback）。

### 三、测试隔离缺陷修复（4 个文件）

- `tests/config.test.ts`：`deleteConfig('default_llm_provider')` → `reloadConfig()`，验证 `.env` 回退。
- `tests/db.test.ts`：持有 `createdKeyId` / `createdPromptId`，不再假设 `id=1`。
- `workflows.test.ts` / `e2e.test.ts`：各自 `beforeAll` 设 `DB_PATH=':memory:'` + `initDb()`。

### 四、验证结果

| 项目 | 结果 |
|------|:--:|
| `tsc -b --noEmit` | ✅ 零错误 |
| `vitest run`（Node 26） | ✅ **214 passed / 0 failed**（9 文件） |
| `vite build` | ✅ 成功（2.50s） |

---

## 2026-06-24 — Admin UI 字号放大收网 + Dashboard 细节修复

### Admin 管理后台全站字号放大（9 文件 ~230 处）

**背景**：管理后台多处使用 `text-[7px]`~`text-[13px]` 任意字号，可读性差。统一按规则放大。

| 文件 | 变更数 | 说明 |
|------|:--:|------|
| `App.tsx` | ~3 处 | 主布局字号 |
| `Login.tsx` | ~2 处 | 登录页字号 |
| `AuditLog.tsx` | ~4 处 | 审计日志字号 |
| `ConfigPanel.tsx` | ~6 处 | 配置面板字号 |
| `Sidebar.tsx` | ~2 处 | 侧边栏菜单字号 |
| `DashboardPage.tsx` | ~9 处 | 仪表盘字号 |
| `LLMPage.tsx` | ~42 处 | LLM 配置页字号 |
| `ProviderForm.tsx` | ~25 处 | 供应商表单字号 |
| `SkillsPanel.tsx` | ~9 处 | 技能面板字号 |
| `ToolCallingPanel.tsx` | ~5 处 | 工具调用面板字号 |
| `GuardPanel.tsx` | ~20 处 | 护栏面板字号 |
| `PromptEditor.tsx` | ~50 处 | 提示词编辑器字号 |
| `KnowledgeDictPage.tsx` | 已于 21:55 完成 | 知识字典页字号 |

**变更规则**：`text-[7px]→[9px]` / `text-[8px]→[9px]` / `text-[9px]→[11px]` / `text-[10px]→xs` / `text-[11px]→sm` / `text-[12px]→sm` / `text-[13px]→sm`

### Dashboard 细节修复
- `AuditSummaryCard`：`auditToday` 数字增加 `.toLocaleString()` 格式化（与其他指标一致）
- `FeatureBadge` 组件：移除未使用的 `status?: 'active' | 'inactive'` 属性

### 编译验证
`tsc --noEmit` 零错误 ✅ | `vite build` 通过 ✅

---

## 2026-06-24 — Phase 4d：规则字典大闭环 🎉

### 背景
Phase 4a 建成了知识字典引擎架构（KnowledgeProvider + knowledge_assets 表 + 管理后台 CRUD），但规则资产填充不完整。Phase 4d 目标：补全所有未填充的字典键值，实现 35/35 项全量规则字典大闭环。

### 新增 10 项字典资产

| 分类 | Key | SortOrder | 内容 |
|:---:|------|:--:|------|
| **bazi** | `hidden_stems` | 110 | 地支藏干完整表（子→亥） |
| **bazi** | `hidden_stems_days` | 120 | 藏干天数分配（月令分金依据） |
| **bazi** | `chang_sheng` | 130 | 长生十二宫（天干在地支的旺衰状态） |
| **bazi** | `month_power` | 140 | 月令旺衰强度表（当令/次旺/休囚等） |
| **bazi** | `di_zhi_ben_qi_wuxing` | 150 | 地支本气五行映射 |
| **pattern** | `pattern_ji_xiong` | 40 | 格局吉凶判定映射（建禄/七杀/正官等 → 吉凶） |
| **classics** | `wuxing_personality` | 10 | 五行性格特质（金木水火土 → 性格描述） |
| **classics** | `shishen_personality` | 20 | 十神性格特质（比肩/劫财/正印等 → 性格描述） |
| **classics** | `wuxing_health` | 30 | 五行健康映射（五行 → 对应脏腑/易患疾病） |
| **classics** | `industry_map` | 40 | 行业适配映射（五行 → 适合行业方向） |

### 五分类全量分布

| Category | 数量 | 资产 |
|----------|:--:|------|
| **bazi** | 17 | chong_map, he_map, he_hua_wuxing, san_he, ban_he, san_hui, xing_map, zi_xing, po_map, hai_map, kong_wang_xun, jia_zi_order, hidden_stems, hidden_stems_days, chang_sheng, month_power, di_zhi_ben_qi_wuxing |
| **shensha** | 9 | lu_map, gui_ren_map, taohua_map, yi_ma, xue_zai, wang_shen, tian_yi_gui_ren, wen_chang, kuigang |
| **classics** | 4 | wuxing_personality, shishen_personality, wuxing_health, industry_map |
| **pattern** | 4 | combination_mbti_map, industry_matches, energy_adjustments, pattern_ji_xiong |
| **personality** | 1 | shishen_mbti_function |
| **合计** | **35** | 全量就位 ✅ |

### 代码变更
- `src/server/db/seed.ts` — 新增 10 项 seed 注册
- `src/server/modules/knowledge/index.ts` — 补充 API 路由
- `src/server/services/KnowledgeProvider.ts` — 扩展 provider 方法
- `src/engine/knowledge-registry.ts` — 新建 knowledge_keys 白名单注册表（35 项）
- `src/engine/relation.ts` / `types.ts` / `patternRules.ts` / `mbtiMapping.ts` / `shenShaRules.ts` / `wuxing.ts` / `specialTopics.ts` — 引用端替换为 KnowledgeProvider

### 线上验证
`GET /api/v1/admin/knowledge/export/all` → **35 条资产，5 分类全量** ✅
按 category 逐个 HTTP 200 + sortOrder 递增验证通过 ✅

### 结论
**35/35 全量规则字典大闭环，Phase 4d 圆满完成！**

---

## 2026-06-19 — Phase 4a：全掌控命理中台大基建 + VPS 上线

| 任务 | 说明 |
|------|------|
| **知识字典引擎增强** | API 新增 `GET /api/v1/admin/knowledge/category/:category` 路径风格路由；KnowledgeDictPage 全面 Card 化 + 字段自解释说明 |
| **OpenClaw 调优驾驶舱** | 验证 PROVIDER_PRESETS 参数自动同步机制完备：ProviderForm 自动填充 baseUrl/model、TuningPanel 自动加载 temp/topP/maxTokens/freqPenalty/personality |
| **底层数据接口化** | famous_chart_compare 接入 KnowledgeProvider，从 knowledge_assets 动态加载名人命例；classic_search + web_search 已完整接入知识库检索链路 |
| **全站 UI 工业级打磨** | ConfigPanel/AuditLog/KnowledgeDictPage 统一使用 shadcn Card 容器；所有表单字段统一 `text-[#6B6459] italic` 自解释说明 |
| **Sidebar 菜单** | 命理规则字典 已启用 (Library 图标 + NEW 徽章)，命理知识库 规划中 (BookOpen 图标 + 规划中 徽章) |
| **技术架构** | KnowledgeProvider 5min TTL 缓存 + invalidateCache() 热刷新；VALID_CATEGORIES 白名单校验；Zod Schema 验证 |
| **L3 护栏保护** | 全程未触碰 anti-hallucination.ts 核心模块，防幻觉机制 100% 保持可用 |
| **VPS 全链路部署** | Git pull → docker compose down → up -d --build → 容器健康检查 → API/SSE 验证 ✅ |
| **SSE 流式修复** | 非流式模型(siliconflow DeepSeek-V3) fullStream 不含 text-delta chunk → result.text() Promise fallback 兜底 → SSE text-delta 成功推送 ✅ |
| **SiliconFlow 接入** | 新增 ModelProvider='siliconflow' + PROVIDER_DEFAULTS/BaseUrl + loadConfig 自动推断 + 管理后台 PROVIDER_PRESETS 已就绪 |
| **Phase 4a 收尾** | 编译零错 ✅ 186 测试全绿 ✅ GitHub 推送 ✅ VPS 上线 ✅ |

---

## 2026-06-19 — 模型架构双修复：DeepSeek-V3 → Qwen3.5-122B-A10B + Admin 热配置打通

### 背景
- 用户反馈 "DeepSeek-V3 不好用"，要求从 SiliconFlow 平台重新选型
- 通过 API 查询账号实际可用模型列表（60+ LLM），选定 **Qwen/Qwen3.5-122B-A10B**
- 阿里通义千问最新代，122B MoE，中文能力业界最强，八字命理分析精度远超 DeepSeek-V3

### 架构修复：Admin Config API ↔ 运行时 LLM 打通
**根因**：`chat.ts` 的 `loadConfig()` 只读 `.env`，admin 的 `POST /api/v1/admin/config` 写 `app_configs` 表，两者互不通。管理后台改配置后不生效。

**修复** (`src/server/lib/llm.ts` L52-100)：
```
loadConfig() 的 DB-first 策略：
1. isUsingDbConfig() → 检查 DB 是否有配置
2. 有 → getAppConfig() 从 app_configs 表读取 provider/model/baseUrl/temperature/maxTokens
3. 无 → 回退到 process.env 环境变量
```
这意味着 `POST /api/v1/admin/config` → `reload` → 立即生效，无需重启。

### 换模型操作流程
1. Admin 登录 → `POST /api/v1/admin/auth/login`
2. 设置 base_url → `POST /api/v1/admin/config {key:"default_llm_base_url", value:"https://api.siliconflow.cn/v1"}`
3. 设置 model → `POST /api/v1/admin/config {key:"default_llm_model", value:"Qwen/Qwen3.5-122B-A10B"}`
4. 刷新配置 → `POST /api/v1/admin/config/reload`（清除 60s 缓存）
5. **立即生效，无需重启或修改 .env**

### 验证结果
- VPS Admin login ✅ → Config update ✅ → Reload ✅
- SSE Chat HTTP 200 ✅ → text-delta ✅ → [DONE] ✅
- **回复质量**：准确识别建禄格、七杀→伤官、木火通明、用神火土 — 全部正确

### 修改文件
- `src/server/lib/llm.ts` — loadConfig() DB-first + 默认模型改 Qwen3.5-122B-A10B
- `src/server/config/index.ts` — 已存在双轨加载（DB优先→.env回退），本次无需改动
- `admin/modules/llm/LLMPage.tsx` — siliconflow 预设更新 (temp=0.5, topP=0.9, maxTokens=8192)
- `vps_admin_test.py` / `vps_test_final.py` — 全链路测试脚本

## 2026-06-18 — v4.0.0 里程碑发布 + Phase 3 完成

| 任务 | 说明 |
|------|------|
| **v4.0.0 发布** | Git commit `95e7c01` → `78ebcd2`，push GitHub master |
| **186 项全量测试** | vitest 3.2.4，7/7 文件全覆盖，零失败 |
| **SSE Bugfix** | AI SDK v6 移除 `toDataStreamResponse()`，手动构建 `text/event-stream` |
| **生产环境同构** | Vite + Hono 统一端口部署，SPA 回退路由 |
| **大运竖轴** | LuckTimeline 竖向时间轴组件 (UI-6) |
| **专题 Tab** | TopicTabs 六个专题水平切换 (UI-7) |
| **ChatPanel** | SSE 流式对话 Copilot，逐字增量渲染 |
| **品牌升级** | 项目更名为"数字命理推演引擎"，README 重写 |
| **仓库迁移** | bazipaipan → Mingli-Cosmos，orphan 初始提交，敏感文档净化 |
| **Dockerfile** | 多阶段构建：build → 极简生产镜像 |
| **docker-compose.yml** | 端口映射 3001:3001，.env volumes 挂载，restart: always |
| **Nginx 配置** | SSE 流式代理优化（proxy_buffering off + chunked_transfer_encoding on） |
| **生产日志系统** | `src/server/lib/logger.ts`：结构化 JSON、请求耗时中间件、每日轮转、7天清理 |
| **增强健康检查** | `/api/health` 返回 uptime/memory/node_version/env 7 指标 |
| **Phase 3 全量验证** | build ✅ health ✅ static ✅ SPA ✅ SSE ✅ logs ✅ (8 项全通过) |
| **路线图更新** | 双轨演进 v4.0.0+ 版本，Phase 0-6 + P0-P2 全更新 |
| **未来架构规划** | `arch/ARCHITECTURE-FUTURE.md` + `arch/CONFIG-CONTRACT.md` |
| **src/admin/ + db/** | Phase 4 管理后台 + 数据库持久化目录结构规划 |

## 2026-06-17

| 任务 | 说明 |
|------|------|
| **v3.0 发布** | Git tag `v3.0` 推送 GitHub，CHANGELOG 完整版本记录 |
| **P0 Bug 修复** | `getShiShenName()` 参数颠倒，十神判断此前全颠倒 |
| **测试体系** | vitest 安装配置，39 单元测试 100% 通过 |
| **CI/CD** | `.github/workflows/ci.yml` (lint→typecheck→test→build) |
| **UI S0 改造** | 全面视觉重构：宣纸底 + 朱砂印 + 章节化 + 思源字体 |
| UI-1 调色板 | 深棕黑→宣纸底 `#FBF7F0`，墨色 `#1C1914`，朱砂 `#B83A2E` |
| UI-2 英雄区 | 四柱大字居中 + 日主朱砂印章（`.seal-stamp`） |
| UI-3 章节化 | 卡片→`.chapter` 流式 + 淡墨线分隔，`max-w-3xl` 书页宽 |
| UI-4 字体 | 微软雅黑→思源宋体(标题)+思源黑体(正文) |
| UI-5 输入区 | 独立卡片→一行内联工具栏，时辰按钮平铺 |
| **计划合并** | UI 设计轨并入 `plan/02-feature-roadmap.md`，TODO 看板更新 |

---

## 2026-06-16

| 任务 | 说明 |
|------|------|
| V2.0 格局判断引擎 | 四正月取格 / 透干取用 / 月令分金 / 组合判定 / 破格风险 |
| MBTI 人格映射 | 十神→认知功能 / 组合→画像 / 行业适配 / 能量调整 |
| 神煞规则 | 8种神煞全部实现（天乙/文昌/桃花/驿马/华盖/金舆/禄/羊刃） |
| 专题批注 | 六大专题（性格/事业/财运/婚姻/健康/子女） |
| 地支关系全面分析 | 刑冲破害合 + 三合三会 + 空亡 |
| 人生里程碑 | 本命年/冲太岁/换大运等关键年份 |
| 文档体系重构 V1 | BaziSystemRules.md → rules/ 7个分层文档 |
| 文档体系重构 V2 | ProjectPlan.md → plan/6文件 + design/ + contracts/ + arch/增强 |
| 接口契约层 | contracts/engine-api.md 核心/外围隔离 |
| 清理旧文件 | 删除 BaziSystemRules.md / ProjectPlan.md / 旧zip / 旧日志 |
| README.md 重写 | 突出正宗子平法算法传承 + 13步流水线 + 架构说明 |

---

## Phase 0 — 基础排盘 ✅

| 任务 | 说明 |
|------|------|
| 出生信息输入 | 公历/农历、时辰、性别、地点 |
| 四柱八字排盘 | 天干地支、藏干、纳音 |
| 五行分析 | 分布 + 旺衰可视化 |
| 十神分析 | 以日主为中心 |
| 大运流年计算 | 起运年龄 + 十年一换 |
| 空亡标注 | 六甲旬空亡 |
| 地支关系 | 刑冲破害合三合三会 |
| 起运天数计算 | V2.0 月令分金依赖 |

---

## Phase 1 — 结构化批注 ✅

| 任务 | 说明 |
|------|------|
| 规则引擎批注 | 日主强弱、用神忌神 |
| V2.0 格局判断 | 四正/透干/分金/组合/破格/MBTI |
| 神煞规则 | 8种 |
| 专题批注 | 六大专题 |
| 地支关系全面分析 | 全7种关系类型 |
