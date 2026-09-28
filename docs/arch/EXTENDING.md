# 扩展开发者指南（Extending Guide）

> **这份文档的目的**：让"新增一个模块 / 领域 / 表 / 页面"变成**照做即行**的机械流程，
> 而不是每次重新设计架构。
>
> 配套：[ADR-012 数据域分层](../adr/ADR-012-data-domain-strategy.md) ・
> [DATA-DOMAINS 数据域清单](./DATA-DOMAINS.md) ・
> [ARCHITECTURE 架构约束](./ARCHITECTURE.md)
> 最后更新：2026-09-29

---

## 0. 系统分层与"扩展点"

```
┌─────────────────────────────────────────────────────────┐
│  前端（React 19 + TS + Tailwind v4）                      │
│    src/pages/          页面（路由级）                     │
│    src/components/     组件                               │
│    src/hooks/          数据访问（调 API）                  │
│    src/lib/shell.ts    跨路由共享状态                      │
└───────────────────────────┬─────────────────────────────┘
                            │ fetch /api/v1/app/*  或  /api/chat
┌───────────────────────────▼─────────────────────────────┐
│  后端（Hono）                                             │
│    src/server/core/app.ts      组装中间件 + 挂路由         │
│    src/server/core/router.ts   ★ 自动扫描模块目录          │
│    src/server/modules/         → /api/v1/admin/*（后台）   │
│    src/server/modules-public/  → /api/v1/app/*（C 端）     │
│    src/server/db/              数据层（schema/migrate/仓储）│
│    src/server/lib/             横切能力（日志/追踪/护栏）    │
└───────────────────────────┬─────────────────────────────┘
                            │ Drizzle ORM
┌───────────────────────────▼─────────────────────────────┐
│  数据（SQLite 单文件，7 个逻辑域 · 见 DATA-DOMAINS.md）     │
└─────────────────────────────────────────────────────────┘
```

**五个扩展点**，对应下面各节：

| 想加什么 | 改哪里 | 章节 |
|:--|:--|:--:|
| 一个 API 模块 | 新建 `modules*/<名字>/index.ts` | §1 |
| 一张数据表 | `db/schema.ts` + `db/migrate.ts` + 仓储 | §2 |
| 一个前端页面 | `pages/` + `main.tsx` | §3 |
| 一批知识数据（爬虫） | `seeds/knowledge/*.json` | §4 |
| **一个新的术数/测评体系**（星座/紫微/…） | `src/server/systems/` 实现一个 `SystemEngine` + 注册一行 | §5 |

---

## 1. 新增一个后端模块（API）

### 1.1 它有多简单

`src/server/core/router.ts` 会**自动扫描目录**并注册路由。你只需要：

1. 建目录 `src/server/modules-public/<模块名>/`
2. 建 `index.ts`，导出一个 Hono 实例
3. **完成** —— 路由自动挂到 `/api/v1/app/<模块名>`

不需要改 `app.ts`、不需要注册表、不需要改任何已有文件。

### 1.2 模板（C 端，需登录）

```ts
// src/server/modules-public/report2/index.ts  →  /api/v1/app/report2/*
import { Hono } from 'hono'
import { z } from 'zod'
import { userAuthMiddleware, type UserEnv } from '../../core/middleware/user-auth'

export const route = new Hono<UserEnv>()

const schema = z.object({ foo: z.string().min(1) })

route.post('/', userAuthMiddleware, async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message } }, 400)
  }
  const current = c.get('currentUser')!   // userAuthMiddleware 注入
  return c.json({ success: true, data: { userId: current.userId } })
})

export default route   // ★ 必须 default export（或导出名为 route 的 Hono 实例）
```

### 1.3 三种鉴权姿势（按需选）

| 中间件 | 导入自 | 语义 |
|:--|:--|:--|
| `userAuthMiddleware` | `core/middleware/user-auth` | **必须登录**，未登录 401 |
| `optionalUserAuth` | `core/middleware/user-auth` | **可选登录**（匿名也能用，登录则注入 `currentUser`） |
| `authMiddleware` | `core/middleware/auth` | **管理员**（仅 `modules/` 后台模块用） |

### 1.4 约定与坑

- ✅ 目录名 = 路由前缀。想自定义：`export const meta = { prefix: 'custom-name' }`
  - 活例：`modules-public/birth-profiles/` 用 `meta.prefix='user/birth-profiles'` 挂到 `/api/v1/app/user/birth-profiles`
    （把业务资源收敛到 `/user/*` 前缀下）——**证明 prefix 覆盖确有其用，不是纸面功能**。
- ✅ 响应统一 `{ success, data }` / `{ success:false, error:{ code, message } }`
- ✅ 用 `zod` 校验入参（项目惯例）
- ⚠️ **C 端模块必须放 `modules-public/`** —— 后台鉴权中间件会误伤 C 端接口
- ⚠️ `__` 开头的目录会被跳过（留给 `__tests__`）
- ⚠️ 服务器启动时打印 `[Router] modules-public 已注册模块 (N): ...`，**加模块后看一眼这行确认挂上了**
- 💡 **同一份入参结构被多处复用 → 抽到 `src/server/lib/`**。活例：`birth-input.ts`
  （`birthFieldsObject` / `birthInputSchema` / `checkRealDate`）被「注册收生辰」与「生辰档案 CRUD」共用，
  避免两处各写一份 zod 导致口径漂移（一个收 2/30、另一个拒绝）。
- ⚠️ **zod 默认剥离未声明键**：`z.object({...}).partial()` 只会放行**已声明**的键。
  想支持 `PATCH` 改某字段，必须先在 schema 里**声明**它再 `.partial()`，
  否则该字段会被静默丢弃（表现为"改了但没生效"，无报错）。

---

## 2. 新增一张数据表

> 先读 [DATA-DOMAINS.md](./DATA-DOMAINS.md) —— **每张新表必须归属 7 个域之一**。

### 2.1 五步走

**第 1 步：确定数据域**，并检查命名规范（新表加域前缀，如 `growth_*` / `obs_*`）。

**第 2 步：写 `schema.ts`**（Drizzle 类型定义）

```ts
export const growthReferrals = sqliteTable('growth_referrals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  referrerUserId: integer('referrer_user_id').notNull(),
  refereeUserId: integer('referee_user_id').notNull(),
  status: text('status').default('pending').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})
```

**第 3 步：写 `migrate.ts`**（实际 DDL，**必须与 schema 同步**）

```ts
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS growth_referrals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_user_id INTEGER NOT NULL,
    referee_user_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_growth_referrals_referrer ON growth_referrals(referrer_user_id);
`)
```

**第 4 步：写仓储** `db/repositories/<域>/<名字>.ts`（新文件按域组织）

```ts
import { getDb, schema } from '../index'
import { eq } from 'drizzle-orm'
const { growthReferrals } = schema
export type GrowthReferralRow = typeof growthReferrals.$inferSelect

export function createReferral(input: { referrerUserId: number; refereeUserId: number }): GrowthReferralRow {
  return getDb().insert(growthReferrals).values({
    referrerUserId: input.referrerUserId,
    refereeUserId: input.refereeUserId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }).returning().get()
}
```

**第 5 步：在 `db/index.ts` 导出**

```ts
export * from './repositories/growth/referrals'
```

### 2.2 ⚠️ 最容易踩的坑

| 坑 | 后果 | 规避 |
|:--|:--|:--|
| **只改 `schema.ts` 不改 `migrate.ts`** | 类型有、表没有 → 运行时报错 | **永远双写**，写完 grep 确认 |
| 加列忘了 `safeAlter` | 老库升级后缺列 | 用 `safeAlter(sqlite, '表', '列名 类型')` |
| 时间列用了 `Date` 类型 | Drizzle/SQLite 不匹配 | 统一 `TEXT` + `datetime('now')` |
| 幂等操作没加唯一键 | 重复发放/重复扣费 | 带 `idempotency_key` 唯一约束（见 `quota_ledger`） |
| 表含 PII 但没接导出/删除 | **合规违规** | 纳入 `GET /user/data/export` + `DELETE /user/data` |

### 2.3 迁移是幂等的

`migrate.ts` 用 `CREATE TABLE IF NOT EXISTS` + `safeAlter`（"列已存在"自动跳过）。
启动时 `initDb()` 自动执行 —— **不需要人工跑迁移命令**，重启即升级。

---

## 3. 新增一个 C 端页面

### 3.1 三步走

**第 1 步**：写页面 `src/pages/XxxPage.tsx`

```tsx
import { useShell } from '../lib/shell'

export default function XxxPage() {
  const { user, result } = useShell()   // 跨路由共享状态（登录态 / 排盘结果）
  return <div className="...">...</div>
}
```

**第 2 步**：在 `src/main.tsx` 注册路由

```tsx
const router = createBrowserRouter([
  { path: '/', element: <App />, children: [
    { index: true, element: <PaipanPage /> },
    { path: 'my', element: <MyPage /> },
    { path: 'xxx', element: <XxxPage /> },   // ← 新增
    { path: '*', element: <Navigate to="/" replace /> },
  ]},
])
```

**第 3 步**：需要的话加导航项（手机 `components/BottomNav.tsx` / 桌面 `components/Header.tsx`）。

### 3.2 关键约定

- **跨路由状态走 `useShell()`**（`lib/shell.ts` 的 `<Outlet context>` 下发）—— **不要引入第三方状态库**
- **手机优先**：无前缀 = 手机，`sm:` = 桌面覆盖。真实断点**只有 640px**
- **触控目标 ≥44px**；手机表单控件字号 **≥16px**（抑制 iOS 聚焦放大）
- **颜色一律用 token**（`var(--*)`），不写裸 hex
- 底部 Tab 会遮挡内容 → 页面底部留 `pb-*` 或使用 `.safe-bottom`

### 3.3 ⚠️ dev 环境刷新 404？

`vite.config.ts` 是 `appType: 'mpa'`，已内置 SPA 兜底中间件（放行 `/api`、静态资源、HMR）。
**新增的路由不需要任何额外配置**。若刷新仍 404，检查 `vite.config.ts` 的 `spa-fallback` 插件是否放行了你的路径前缀。

---

## 4. 新增知识资产（爬虫数据）

**不要让爬虫直接写数据库。** 标准流程：

```
爬虫（离线，任意语言 / 任意机器）
   ↓ 产出 JSON
seeds/knowledge/zodiac.json        ← 提交进仓库，可 review diff
   ↓ npm run db:seed               ← 幂等导入
knowledge_assets（category='zodiac'）
```

### 4.1 为什么

| 直写库 | 走种子 |
|:--|:--|
| ❌ 不可 review | ✅ 改动可 diff |
| ❌ 不可迁移（数据锁在某个库） | ✅ 带走 `seeds/` 即带走知识 |
| ❌ 爬虫失败污染生产库 | ✅ 离线产出，人工确认后再导入 |
| ❌ 环境间不一致 | ✅ 同一份种子，结果可复现 |

### 4.2 文件格式

见 `seeds/knowledge/README.md`，格式为 `{ category, items[] }`。
`knowledge_assets.category` **无需改代码即可新增类别**（只要字符串没用过）。

### 4.3 16 型人格 / 星座的落点

- **星座** → 新建 `seeds/knowledge/zodiac.json`（category=`zodiac`）
- **16 型人格** → category=`personality` **已被占用**（现有：十神→MBTI 映射）。
  新增独立人格资料建议用 `personality_profile` 之类的新 category，避免与现有混用。

---

## 5. 新增一个术数/测评体系（多体系注册表 · **ADR-011 阶段 1~3 已落地**）

把「体系」提升为一等概念后，**第 N 个体系 = 实现一个 `SystemEngine` + 注册一行**，
共享骨架（鉴权 / 额度 / 对话 / 会话持久化 / 可观测 / 支付结算）零重复。

> ⚠️ 引擎红线：**绝不修改 `src/engine/`**（八字引擎已封版）。新体系是**新增**一个适配器/实现，
> 不是改造既有引擎——八字自己也是通过 `src/server/systems/bazi.ts` 这个**薄适配器**接入的。

### 5.1 三步走

**① 实现引擎**（`src/server/systems/astro.ts`）—— 照 `bazi.ts` 抄骨架：

```ts
import type { SystemEngine } from './types'

export const astroEngine: SystemEngine<BirthInput, AstroBundle> = {
  id: 'astro',
  version: 'v1.0.0',
  compute(input) { /* 天文历/宫位计算 → AstroBundle */ },
  hash(bundle) { return `astro:v1:${sha256(stableStringify(bundle))}` }, // 口径须带体系前缀
  isValidResult(v): v is AstroBundle { /* 形状守卫 */ },
  ctxFor(bundle) { return '## 星盘数据（唯一数据源）\n...' },
  buildPrompt(bundle, { reportSummary, adminSection }) { /* 角色+数据+护栏 */ },
}
```

**② 注册一行**（`src/server/systems/registry.ts` 末尾）：

```ts
import { astroEngine } from './astro'
registerSystem(astroEngine)   // ← 新增体系只动这一行
```

**③ 数据落库自动带体系**：`/api/v1/app/chart` 已支持可选 `system`（缺省 `bazi`），
计算/落库/指纹/引擎版本全部经注册表；`sessions.system` 自动写入 —— **无需改任何路由代码**。

### 5.2 关键约定（务必遵守）

- **hash 口径带体系前缀命名空间**（如 `astro:v1:<sha256>`），否则跨体系一致性校验会失效。
- **`sessions.chart` / `annotation` 两列是「体系 payload 载体」**：读路径**必须先看 `sessions.system`**
  再解析 payload（`resolveContext` 已强制），杜绝「按列名猜语义」。
- **计费/鉴权/SSE/护栏链路完全不动**（已被 ADR-004 / ADR-005 验证）：新体系自动继承。
- 现有前端 `BirthForm` 输入壳、`ChatPanel`、`ResultTabs` 容器壳可复用；各体系自带 L0/L1/L2 结果组件。

### 5.3 可插拔性怎么验

`src/server/systems/__tests__/registry.test.ts` 已用「注册一个 mock 体系 → 立刻可发现/可计算/可路由 prompt」
证明插件化真的成立。加新体系时照此补一组即可。

---

## 6. 完整走一遍：新增"推介奖励"域（**已实施 · ADR-013**）

以**客户推介奖励**为例，完整流程（下称的路径即仓库现状，可直接对照）：

**① 数据域**：新增「增长域」，前缀 `growth_` → 更新 `DATA-DOMAINS.md`（域清单是唯一约定入口）

**② 表**（2 张）：
- `growth_referrals`（推介关系，`UNIQUE(referee_user_id)` + `UNIQUE(referrer_user_id, referee_user_id)` 防重复绑定）
- `growth_referral_rewards`（奖励发放，`idempotency_key` 唯一防重复发放）

**③ schema + migrate 双写** → ④ 仓储 `repositories/referrals.ts` → ⑤ `db/index.ts` 导出

**⑥ 模块**：`modules-public/referral/index.ts` → `/api/v1/app/referral/*`（目录约定自动挂载，零注册）
- `GET  /me` 我的邀请码与战绩
- `POST /bind` 补绑邀请码

**⑦ 前端**：注册弹窗加「邀请码（选填）」字段；「我的」页加「推荐有礼」卡（邀请码复制 + 战绩）。
> 注：本功能**没有**新开 `/referral` 路由页——单页信息量小，直接并入「我的」更省一次跳转。这是"按内容体量选载体"的取舍，不是遗漏。

**⑧ 合规**：邀请关系含用户标识 → **已**接入 `data/export`（新增 `referrals`/`referralRewards`）与 `DELETE /user/data`（`purgeReferralsForUser`）。

**⑨ 加额度口径** ⚠️ **与"走 quota_ledger"相反**：`quota_ledger` 是**消费**台账，须保持 `sumLedgerDelta == -quotaUsed` 不变量；**发奖不得写入**。奖励权威记录是增长域自己的 `growth_referral_rewards`，加额度走 `users.quota_total += amount`（与既有 `grantQuota()` 同口径）。

**⑩ 风控与决策**：防刷（自邀拦截 / 一次性绑定 / 奖励以真实付费为前提）、税务口径、奖励形态 → 已在 **[ADR-013](../adr/ADR-013-referral-rewards.md)** 定档。

> 这个例子说明：**有了域约定和模块约定，"加一个领域"就是一条机械流程**，不需要重新设计架构。本领域已全程跑通，可当**活样板**参照。

### 6.1 反面教训：表有了 ≠ 能力闭环（生辰档案已补齐）

`birth_profiles` 很早就随 ADR-012 落了 **表 + schema + migrate + 仓储（含完整 CRUD）**，
看上去"数据层做完了"，但**没有任何 API 路由**，前端也无从调用 —— 结果是
"注册不收生辰、登录后仍要手填排盘信息"，用户侧体感就是**功能缺失**。

**补齐闭环的必要动作**（下次别只做一半）：

| 层 | 缺了会怎样 | 本次补了什么 |
|:--|:--|:--|
| API 模块 | 前端无从调用 | `modules-public/birth-profiles/`（5 个路由） |
| 注册入口 | 新用户没有档案 | `registerSchema` 收可选 `birth` → 建默认档案 |
| 读取回传 | 前端不知道有档案 | `GET /user/me` 回传 `defaultBirthProfile` |
| 前端消费 | 档案躺着没人用 | 登录后自动排盘 + 「我的生辰」管理卡 |
| 回归测试 | 下次又断 | `birth-profiles.test.ts`（默认唯一/越权/日期/注册建档） |

> **判据**：一个数据能力算不算"做完"，看它**能不能从界面走通**（入口→落库→读回→消费→可管理）。
> 只有表层能编译、仓储有函数，不算完成。

---

## 7. 提交前检查清单

**数据层**
- [ ] 新表已归入 7 域之一，且更新了 `DATA-DOMAINS.md`
- [ ] `schema.ts` 与 `migrate.ts` **双写一致**
- [ ] 新表加了域前缀；时间列统一 `TEXT`
- [ ] 幂等操作带 `idempotency_key`
- [ ] 含 PII 的表已接入 `data/export` + `DELETE /user/data`

**API 层**
- [ ] C 端在 `modules-public/`，后台在 `modules/`；`default export` 了 Hono 实例
- [ ] 入参用 zod 校验；响应统一 `{ success, data }`
- [ ] 启动日志中出现 `[Router] ... 已注册模块` 含你的模块名

**前端**
- [ ] 跨路由状态走 `useShell()`，未引入状态库
- [ ] 颜色用 token；触控 ≥44px；手机控件字号 ≥16px
- [ ] 新路由在 `main.tsx` 注册；`*` 兜底仍在

**验证（四关，缺一不可）**
- [ ] `npm run typecheck` → 0 错
- [ ] `npx vitest run` → 全绿
- [ ] `npm run build` → 通过
- [ ] `npm run smoke` → 全绿（涉及接口时）

---

## 8. 不要做的事

| ❌ 不要 | 为什么 |
|:--|:--|
| 改 `src/engine/` | 核心引擎**已封版**，新体系走新目录（ADR-011） |
| 跨域 JOIN / 跨域事务 | 会锁死未来的按域拆分（ADR-012） |
| 让 LLM 参与排盘计算 | 计算归引擎、解释归 AI（架构红线） |
| 直接写裸 hex 颜色 | 破坏"改 token 即换肤" |
| 爬虫直连生产库 | 不可 review、不可迁移 |
| 引入新的状态管理库 | `Outlet context` 已够用 |
| 为"未来可能的规模"提前抽象 | 架构宇航员化；按 ADR-012 的**触发条件**再动手 |
