# 数字命理推演引擎 · 版本记录

---

## 未发布 — 🔴 安全修复：ADMIN_PASSWORD 被静默忽略导致默认弱口令可用 (2026-09-28)

> **发现场景**：首次部署到生产 VPS（216.167.120.225）后跑端到端冒烟，
> 后台登录用 `.env` 中设置的 `ADMIN_PASSWORD` 却返回 401。深挖后确认：
> **生产环境后台一直可以用内置默认密码 `mingli2026` 登录。**

### 缺陷链路

1. `src/server/modules/auth/index.ts` 在**模块顶层**读取配置：
   `const DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD || 'mingli2026'`
2. 该模块的求值时机可能早于 `import 'dotenv/config'` 完成注入 → 读到 `undefined` → 落到内置默认值
3. 首次登录时把「内置默认值」的 bcrypt 哈希写入 `app_configs.admin_password_hash`
4. 而密码来源优先级是 **DB > env**，于是此后再改 `.env` 也**永远不会生效**
5. 结果：部署方以为已设置强密码，实际后台弱口令公网可用

### 修复

- **环境变量改为惰性读取**（`adminUsername()` / `resolveConfiguredPassword()` 调用时求值），彻底消除模块求值时序依赖
- 新增 `ensureAdminPasswordInitialized()`：在 `initDb()` 之后由启动流程**显式初始化**密码哈希，不再依赖「第一次有人登录」这个不确定时机
- 启动时打印密码来源，并对以下情况**显式告警**：
  - 未设置 `ADMIN_PASSWORD` → 「后台正在使用内置默认密码，请立即修改」
  - DB 中仍是内置默认密码 → 「管理员仍在使用内置默认密码」
  - `.env` 与 DB 不一致（DB 优先）→ 提示如何让环境变量生效
- 新增 `src/server/modules/__tests__/admin-password.test.ts`（5 项）：含
  「启动自检写入 env 密码而非默认值」「默认密码必须登录失败」等回归用例；
  该测试刻意在模块加载**之后**设置 env，旧实现在此必然失败

---

## 未发布 — 上线前加固：端到端冒烟 + 登录限流缺陷修复 (2026-09-28)

> **主题**：单测全绿 ≠ 真实运行态可用。补一条真实服务的端到端冒烟链路，并修复冒烟暴露的可用性缺陷
>
> **规模**：新增 1 个冒烟脚本（26 项断言）+ 1 个回归测试文件（7 项）；测试 308 → **315**

### 🧪 端到端冒烟脚本

- 新增 `scripts/smoke-e2e.mjs`（`npm run smoke`，需先起服务）：真实 HTTP 跑通
  健康检查 → C 端注册 → 重名/错密码拦截 → 登录 → me/quota → 套餐 → 下单 → 模拟支付
  → 我的订单/订阅 → 埋点（含白名单拒绝）→ 后台登录 → 用户/订单/看板 → 未授权拦截
- 覆盖 admin 与 C 端两套鉴权，26 项断言全绿；VPS 上线后可直接对公网域名跑同一脚本

### 🐛 修复：登录限流误锁正常用户（可用性缺陷）

- **问题**：`loginRateLimit()` 对**每一次**登录请求计数（含成功登录），IP 维度 5 次/15 分钟
  → 管理员或用户正常登录 5 次即被锁 15 分钟；反向代理下若 `x-forwarded-for` 未透传，全部请求落到
  `127.0.0.1` 同一个桶，等于全站共享 5 次额度
- **修复**：改为 **失败才计数** 语义 —— 中间件只做只读预检 + 全局并发保护，
  计数由路由在凭据校验失败时调用 `recordLoginFailure(ip, account)` 累加，
  登录成功时调用 `clearLoginAttempts(ip, account)` 清零
- 新增 `src/server/core/__tests__/rate-limit.test.ts`（7 项）锁死该语义：
  含「连续 5 次成功登录不被锁」「失败 4 次后成功一次可重新累计」等回归用例

---

## 未发布 — Phase 4b 运营中台 + 设计轨 S1 (2026-09-28)

> **主题**：从「内部工具」推进到「可运营的产品」——C 端账号、订单订阅、运营看板三件套落地
>
> **规模**：新增 6 张表（8 → 14）、14 个新文件、测试 252 → **308**

### 👤 M-6 C 端用户体系

- 新增 `users` / `user_sessions` 表；C 端 JWT 与后台完全隔离（独立密钥 `USER_JWT_SECRET`、独立会话表、7 天有效期）
- C 端 API `/api/v1/app/user/*`：注册（用户名/手机/邮箱唯一性校验）、登录（账号/手机/邮箱任一）、登出、me、quota、profile、sessions、status
- 后台 API `/api/v1/admin/users/*`：列表搜索、统计、详情、启停、调额度（delta / setTotal）、重置密码、删除
- 安全设计：停用账号或重置密码强制所有会话下线；额度扣减走 SQL 条件更新避免并发超卖；响应永不外泄 `passwordHash`
- AI 对话可选扣额度：配置 `quota_enforce_chat`（默认 `false`，DB 未初始化时自动跳过，保证既有行为不变）

### 💰 M-7 订单与订阅

- 新增 `plans` / `orders` / `subscriptions` 表
- C 端 `/api/v1/app/billing/*`：套餐列表、下单、模拟支付、我的订单、我的订阅
- 后台 `/api/v1/admin/orders/*`：订单列表与统计、套餐 CRUD、离线确认收款、退款回收权益、清理超时订单/过期订阅
- 权益逻辑：支付后激活或**在原到期时间上顺延**订阅、发放额度、提升等级；退款撤销订阅并回收额度，无其它有效订阅时降级 free
- 默认种子套餐：体验包 ¥9.9 / 月度 ¥39 / 年度 ¥299（按 code 幂等）

### 📊 M-8 运营数据看板

- 新增 `analytics_events` 表 + 9 类事件白名单（拒绝任意事件名污染看板）
- `POST /api/v1/app/track` 支持匿名上报（`keepalive` 保证跳转时送达）；C 端已接入 page_view / paipan / chat
- 后台 `/api/v1/admin/analytics/overview|series|events`
- 仪表盘新增「运营概览」：指标卡 + 纯 SVG 趋势图 + 事件分布（60s 刷新，零第三方图表依赖）

### 🎨 设计轨 S1

- **UI-8**：`.chapter-enter` 交错入场动画，命书章节 0→490ms 逐级展开，自动尊重 `prefers-reduced-motion`
- **UI-9**：`DayMasterStrength` 日主强弱进度条（0-100 刻度 + 7 档等级标签 + 五维分量 + 判断依据折叠）

### 🐳 部署链路修复

- `Dockerfile`：基础镜像 `node:22-alpine` → **`node:26-alpine`**（better-sqlite3 ABI 147，Node 22 启动即崩）
- `docker-compose.yml`：新增 `./data:/app/data` + `./logs:/app/logs` 卷（原配置下容器重建会丢失全部用户与订单数据）
- 新增 `docs/deploy/VPS-LAUNCH-CHECKLIST.md`：D-4~D-6 上线操作手册（含证书、构建、C 端 API 冒烟、SSE 验收、回滚）

### ✅ 验证

- `tsc -b --noEmit` → 零错误（含 `admin/` 与全部新模块）
- `vitest run`（Node 26）→ **308 passed / 0 failed**（14 个文件，新增 56 项）
- `vite build` → 通过（含 C 端 + 管理后台双入口）

---

## 未发布 — 工程基线修复（v4.1.0 后复工）(2026-09-28)

> **主题**：恢复"真实可验证"的工程基线 —— 类型检查、测试、构建三线全绿
>
> **背景**：长期未动的代码库存在两类系统性问题：① 真实 TypeScript 错误被 `tsc --noEmit` 假绿掩盖；② 测试与构建依赖 Node 版本，缺乏显式声明。

### 🧱 工程基建

- 新增 `.nvmrc`（`26`）+ `package.json` `engines.node >= 26.0.0`：明确 `better-sqlite3` 原生模块 ABI（Node 26 / ABI 147）要求，杜绝 Node 22 下装包后运行时崩溃。
- 确认 `tsc -b --noEmit` 为有效验证入口（根 `tsconfig.json` 仅 `references`，旧的 `tsc --noEmit` 不检查任何文件 → 长期假绿）。

### 🐛 真实类型错误修复（约 50 处）

- **AI SDK v6 API 漂移（功能级 bug）**：
  - `maxTokens` → `maxOutputTokens`（`step-personality` / `step-luck` / `router-agent`）—— 原参数被静默忽略。
  - `tool({ parameters })` → `tool({ inputSchema })`（`tools-executor`）—— 工具调用参数校验此前失效。
  - `LanguageModelV1` → `LanguageModel`（`lib/llm.ts`），移除失效 `@ts-expect-error`。
- **类型收敛**：`TOOL_EXECUTORS` / `getEnabledTools` 等由 `ReturnType<typeof tool>`（退化为 `Tool<never,never>`）改为 `ToolSet`；`logAudit` 统一使用导出的 `AdminEnv`，各 admin 模块路由声明 `new Hono<AdminEnv>()`；`SpecialTopics` 专题遍历改为键类型收敛（去掉不安全强转）。
- **Zod v4**：object 上 `.default({})` → `.prefault({})`；`z.record(z.any())` → `z.record(z.string(), z.any())`。
- **TypeScript 6**：移除 `tsconfig.*.json` 中已弃用的 `baseUrl`（paths 改相对）。
- **严格模式清理**：批量删除未使用导入/变量（`noUnusedLocals` / `noUnusedParameters`）。
- **顺带修正**：`tools-executor.executeSolarTermCalc` 原两分支必抛异常、全靠 fallback 兜底 —— 重写为逐月逼近（`getPrevJieQi` / `getNextJieQi`）。

### 🧪 测试隔离缺陷修复

- `tests/config.test.ts`：先 `deleteConfig('default_llm_provider')` 再 `reloadConfig()`，验证 `.env` 回退（原被 seed 数据污染）。
- `tests/db.test.ts`：改为持有创建返回的 `createdKeyId` / `createdPromptId`，不再假设 `id=1`（seed 默认 provider 占用 id=1）。
- `workflows.test.ts` / `e2e.test.ts`：各自 `beforeAll` 设 `DB_PATH=':memory:'` + `initDb()`，避免 `singleFork` 单进程下 `DB_PATH` 跨文件串扰。

### ✅ 验证

- `tsc -b --noEmit` → 零错误
- `vitest run`（Node 26）→ **214 passed / 0 failed**（9 个文件）
- `vite build` → 成功（2.50s）

---

## 未发布 — Phase 4a 打磨收尾 R1~R6 (2026-09-28)

> **主题**：把管理后台从"功能存在"推进到"闭环可验证"

### 🔗 R1 护栏热生效闭环

- 端到端验证 `GuardPanel → PUT /prompts/guards → app_configs → buildAntiHallucinationPromptDynamic() / getRejectMessage()` 全链路，14 项测试覆盖「未配置回退 / 保存热生效 / 损坏回退 / 前后端默认值一致性」。
- 前端"已修改"判定改为对比**服务端返回的当前生效配置**，不再依赖前端另存的一份默认值副本。

### 🧪 R3 Debug 闭环（含一处真断点修复）

- **断点**：此前 `prompt_templates` 中的模板内容**不参与运行时**，沙盒里调试的 Prompt 与真实对话实际使用的 Prompt 是两套。
- 修复：运行时 `buildSystemPrompt()` 支持「管理员自定义指令」段（仅消费 `isActive=1` 的自定义模板，默认无则行为完全不变）。
- 新增 `GET /prompts/samples`、`POST /prompts/render`：可用内置命例渲染**运行时真实 System Prompt**。
- 沙盒抽出为 `admin/modules/prompts/DebugPanel.tsx`，支持「编辑器内容 / 运行时真实 Prompt」双来源调试。

### 🛡 R4 L3 护栏回退兜底

- 新增结构校验 `isValidGuards()`：8 条规则必须齐全、名称在白名单内、内容非空、拒绝话术非空、无重名 —— 任一不满足**整体回退**内置常量，避免管理员误删关键规则导致防幻觉失效。
- `L1_RULE_NAMES` 提为唯一权威来源（`anti-hallucination.ts` 导出，管理后台 Zod 校验 import 复用）。

### 🕓 R6 版本回滚演练

- **修正版本推进逻辑**：原实现首次编辑后版本号仍为 1，与快照版本号撞号。现为「先归档当前内容 → 再推进版本号」，回滚动作本身也会存档（可再次回滚）。
- 后台回滚弹窗新增行级 diff 对比（+/- 统计 + 逐行着色）。

### 🧱 附带修复

- **`admin/` 目录从未参与类型检查**：`tsconfig.app.json` 的 `include` 由 `["src"]` 扩展为 `["src", "admin"]`，并修掉暴露的 19 处错误（含 `App.tsx` 向 `PromptEditor` 传不存在的 props、`GuardPanel` 读取不存在的 `json.source` 两处真 bug）。
- 新增 `isDbReady()`：DB 未初始化时走纯代码回退，防止可选增强逻辑误建真实库文件。

### ✅ 验证

- `tsc -b --noEmit` → 零错误（含 `admin/` 21 个文件）
- `vitest run`（Node 26）→ **252 passed / 0 failed**（12 个文件，新增 38 项）
- `vite build` → 成功

---

## v4.1.0 — Phase 4d 规则字典大闭环 (2026-06-24)

> **主题**：35/35 项全量规则字典 + 五分类完整体系
>
> GitHub: [tianlandis/bazipaipan](https://github.com/tianlandis/bazipaipan)

### 📚 知识字典全量收网

- **35 项规则资产全部入库**，五分类完整体系：
  - **bazi** (17 项) — 冲合刑害、空亡、藏干、长生、月令旺衰等
  - **shensha** (9 项) — 天乙贵人、文昌、桃花、驿马、魁罡等
  - **classics** (4 项) — 五行性格、十神性格、五行健康、行业适配
  - **pattern** (4 项) — MBTI 组合映射、行业匹配、能量调整、格局吉凶
  - **personality** (1 项) — 十神 MBTI 认知功能映射
- **Phase 4d 新增 10 项**：hidden_stems / hidden_stems_days / chang_sheng / month_power / di_zhi_ben_qi_wuxing / pattern_ji_xiong / wuxing_personality / shishen_personality / wuxing_health / industry_map
- `knowledge-registry.ts` 白名单注册表，`KnowledgeProvider` 全品类覆盖

### 🔌 引擎层改造

- `relation.ts` / `patternRules.ts` / `mbtiMapping.ts` / `shenShaRules.ts` / `wuxing.ts` / `specialTopics.ts` — 引用端全面接入 KnowledgeProvider
- `GET /api/v1/admin/knowledge/export/all` — 35 条全量导出验证通过

### 🧪 线上验证

- 按 category 逐个 HTTP 200 ✅
- sortOrder 递增一致性 ✅
- 前后端联调无断点 ✅

---

## v4.0.0 — 生产就绪 MVP (2026-06-18)

> **主题**：容器化 + 品牌升级 + 未来架构规划
>
> Tag: `v4.0.0` | Commit: `78ebcd2` | GitHub: [tianlandis/bazipaipan](https://github.com/tianlandis/bazipaipan)

---

### 🏗️ 架构升级：Vite + Hono 生产同构

- Hono 后端服务框架 (port 3001)，同时承载 API 与前端静态文件
- Vite 生产打包：dist/ 输出 SPA，Hono SPA fallback 路由
- 环境判定：`--prod` CLI flag 或 `NODE_ENV=production`
- 一键启动：`npm run start` → vite build + tsx --prod 自托管

### 🎨 UI 重构：大运竖轴 + 专题 Tab

- LuckTimeline.tsx：竖向时间轴，年龄/干支/quality 徽章，当前大运高亮
- TopicTabs.tsx：6 个专题 Tab（性格/事业/财运/婚姻/健康/子女）
- ChatPanel.tsx：A 模式对话 Copilot，SSE 流式渐入渲染
- ReportView.tsx：命书全量展示

### 🤖 算力增强：AI 全链路流水线

- LLM Provider 抽象层：统一 4 种后端（DeepSeek/OpenAI/Claude/Ollama）
- SOP 三阶段流水线：性格格局 → 运势趋势 → 报告装配
- System Prompt 构建器 + Guardrail 护栏 + SSE 流式响应
- AI SDK v6 SSE 兼容性修复（手动构建 text/event-stream）

### 🧪 测试稳固：186 项零失败

- vitest 3.2.4，7/7 文件全覆盖（calculator/patternRules/celebrity/e2e/guardrail/prompts/workflows）
- tsc --noEmit + vite build 回归通过

### 🐳 容器化：Docker + Nginx 部署方案

- `Dockerfile` 多阶段构建（build → 极简生产镜像，alpine 基镜像）
- `docker-compose.yml` 端口映射 3001:3001 + .env volumes 动态挂载 + restart: always
- `nginx.conf` SSE 流式代理专项优化（proxy_buffering off + chunked_transfer_encoding on）

### 📋 品牌升级 & 路线图

- 项目更名为"数字命理推演引擎"
- README 重写：古籍真传校准 + LLM 语义增强混合机制
- 双轨演进路线 v4.0.0+（功能轨 6 阶段 + 设计轨 3 优先级 S0/S1/S2）
- 未来架构规划：Phase 4a 管理后台 + 数据库 + 动态配置双轨路由

---

## v3.0 — 内核稳定版 (2026-06-17)

> **主题**：算法稳定 + 测试体系 + CI/CD + Bug 修复 + UI 规划
>
> Tag: `v3.0` | Commit: `06eae84` | GitHub: [tianlandis/bazipaipan](https://github.com/tianlandis/bazipaipan)

---

### 🔴 关键 Bug 修复

**`wuxing.ts` — `getShiShenName()` 参数颠倒**
- `getWuXingRelation(target, dayMaster)` → `getWuXingRelation(dayMaster, target)`
- 此前以 target 为"我"计算十神关系，导致全引擎十神判断颠倒
- **影响范围**：4 个调用点（patternRules.ts × 1, luckAnalysis.ts × 3）
- **严重程度**：P0 — 格局判断、大运流年解读均受影响

### ✅ 测试体系（从零搭建）

| 文件 | 用例数 | 覆盖范围 |
|------|:--:|------|
| `tests/calculator.test.ts` | 21 | 藏干表、五行常量、六合/三会/三合/六冲表 |
| `tests/patternRules.test.ts` | 18 | 格局判断、透干/分金、组合判定、破格风险 |

- 框架：`vitest`
- 运行：`npm test` — **39/39 全部通过**

### 🛠 工程化

| 项目 | 说明 |
|------|------|
| `vitest.config.ts` | vitest 配置 |
| `.prettierrc` | 格式化规则（无分号、单引号、尾逗号） |
| `.github/workflows/ci.yml` | CI 流程：lint → typecheck → test → build |
| `package.json` | 新增 `typecheck` + `test` scripts |

### 📚 文档

- **清理 5 个文件**：移除过时的 `yongShen.ts` 引用（V2.1 废弃用神忌神体系）
  - `ARCHITECTURE.md` — 流水线、组件表、文件表、输出 json 示例
  - `contracts/engine-api.md` — 文件引用表
  - `rules/04-qiangruo-yongshen.md` — 代码引用
- **新增**：`docs/design/UI_DESIGN_RECOMMENDATIONS.md` — 基于 frontend-design 方法论的全面 UI 评审

### 🧪 算法已验证

- 透干/分金/比劫逻辑对齐 Python MCP（v2.1 完成）
- `HIDDEN_STEMS` 数据对齐 3 个 MD 规则文件（v2.1 完成）
- `npm run build` ✓ | `npx tsc --noEmit` 零错误

---

### 版本统计数据

```
文件变更:  12 files, +1741 -30
测试覆盖:  39 tests (2 files)
新增文件:  7 (.github/ci.yml, .prettierrc, vitest.config.ts,
               tests/calculator.test.ts, tests/patternRules.test.ts,
               docs/design/UI_DESIGN_RECOMMENDATIONS.md, docs/CHANGELOG.md)
依赖变更:  3 新增 (vitest, @testing-library/react, jsdom)
```

---

## v2.1 — 核心算法对齐 (2026-06-17)

> Tag: `v2.1` | 主题：核心算法对齐 Python MCP + 架构文档完善

- 透干阶段：`resolveTouGan()` 新增比劫跳过逻辑
- 分金逆排：`resolveFenJin()` 重写反向迭代
- 亥月特规：分金去戊
- 比劫不成格：简化逻辑对齐 MCP
- 藏干修正：丑月顺序改为 癸→辛→己
- 残留代码清理：3 个未使用删除表
- 文档架构：`docs/arch/ALGORITHM-AUTHORITY.md` + 拆分策略

## v1.1 — 规则引擎增强

- 格局判断支持：内格/外格 + 四正月/透干/分金备选路径
- 神煞分析、五行平衡、十神配置
- 经典引证系统（《渊海子平》《三命通会》）

## v1.0 — 初始版本

- 四柱八字排盘
- 大运流年计算
- 基础批注输出
