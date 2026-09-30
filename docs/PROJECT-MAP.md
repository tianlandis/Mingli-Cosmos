# 项目结构注释表（PROJECT-MAP）

> 生成：2026-09-30 ｜ 维护：球球(QQ) ｜ 用途：**随便哪个文件夹/文件，一眼看懂它是干嘛的**
> 配套：[INDEX.md](INDEX.md)（文档索引）・[../CODEBUDDY.md](../CODEBUDDY.md)（AI 规则）
> 技术栈：前端 React+Vite ｜ 后端 Hono+Drizzle+SQLite ｜ 核心引擎 `src/engine/` **封版**

---

## 一、顶层：一张图看懂

```
bazipaipan/
├── src/        ← 全部源代码（前端页面 + 后端服务 + 核心引擎）
├── admin/      ← 管理后台前端（独立的第二个网页）
├── docs/       ← 全部文档（规则 / 架构 / 决策 / 计划 / 进度）
├── seeds/      ← 知识数据种子文件（星座、古籍…，可导入数据库）
├── scripts/    ← 运维脚本（备份 / 冒烟 / 导入 / 部署）
├── tools/      ← 开发辅助脚本（生成报告 / 集成测试）
├── tests/      ← 端到端测试
├── public/     ← 网站图标等静态资源
├── deploy/     ← 部署脚本
├── data/       ← 数据库文件 + 临时数据（不提交 git）
├── logs/       ← 运行日志（不提交 git）
├── reports/    ← 生成的报告产物（不提交 git）
├── dist/       ← 编译产物（自动生成，不提交 git）
└── node_modules/ ← 依赖包（自动生成）
```

> **一句话**：`src` 是主体，`admin` 是后台，`docs` 是说明书，`seeds` 是数据，`scripts` 是工具。

---

## 二、根目录文件

| 文件 | 作用 |
|:--|:--|
| `package.json` | 项目配置：依赖清单 + 所有命令（`npm run xxx`） |
| `package-lock.json` | 依赖的精确版本锁定（自动生成） |
| `tsconfig*.json` | TypeScript 编译配置（app=前端 / node=后端） |
| `vite.config.ts` | 前端打包工具配置 |
| `vitest.config.ts` | 测试工具配置 |
| `eslint.config.js` | 代码检查规则 |
| `Dockerfile` | 打包成容器镜像的配方 |
| `docker-compose.yml` | 一键启动容器（端口 + 数据卷 + 自动重启） |
| `nginx.conf` | 反向代理配置（重点：SSE 流式不卡顿） |
| `index.html` | 前端网页入口 |
| `components.json` | shadcn 组件库配置 |
| `README.md` | 项目总说明（给人看的第一份） |
| `CODEBUDDY.md` | **给 AI 助手看的规则**（红线 + 审查要求） |
| `PP_ENGINEERING_SOP.md` | 工程流程规范 |

---

## 三、`src/` 源代码

### 3.1 前端（浏览器里跑的）

| 路径 | 作用 |
|:--|:--|
| `src/main.tsx` | 前端启动入口 |
| `src/App.tsx` | 前端总路由（哪个网址显示哪个页面） |
| `src/index.css` | 全局样式 |
| `src/pages/` | **页面**（`/`=排盘页、`/my`=我的、`/discover`=发现、`/synastry`=合盘） |
| `src/components/` | **可复用组件**（21 个）：`BaziChart`排盘表格、`ChatPanel`对话、`ReportView`命书、`BirthForm`生辰表单、`FiveElements`五行、`LuckCycle`大运、`SystemSwitcher`体系切换… |
| `src/hooks/` | **数据钩子**：`useBazi`排盘、`useReport`命书、`useAgentChat`对话、`useUser`用户 |
| `src/lib/` | **前端工具**：`birth.ts`生辰、`wuxing.ts`五行、`systems.ts`体系、`credits.ts`额度、`user-api.ts`接口封装 |
| `src/ai/types.ts` | AI 相关类型定义 |

### 3.2 后端（`src/server/`）

| 路径 | 作用 |
|:--|:--|
| `server/index.ts` | **后端启动入口** |
| `server/core/app.ts` | **应用装配**：挂载所有接口 + 静态页 + SPA 兜底 |
| `server/core/router.ts` | 路由聚合 |
| `server/core/middleware/` | **中间件**（鉴权、限流、日志、错误处理） |
| `server/config/` | **配置读取**（环境变量 + 数据库配置双轨） |
| `server/db/schema.ts` | **数据库表结构定义**（20 张表都在这） |
| `server/db/seed.ts` | **内置知识种子**（八字/神煞/人格/格局/经典 的初始数据） |
| `server/db/migrate.ts` | 数据库迁移脚本 |
| `server/db/index.ts` | 数据库连接 + 仓储层入口 |
| `server/lib/` | **后端工具库**（重点看）：`billing.ts`计费、`llm.ts`大模型、`astro-mapping.ts`星座映射、`guardrail.ts`护栏、`logger.ts`日志、`types.ts`类型 |
| `server/systems/` | **多体系注册表**：`bazi`八字 / `astro`星座 / `mbti`人格 三个引擎的适配 + 中文名真值(`meta.ts`) |
| `server/modules/` | **后台 API**（`/api/v1/admin/*`）：auth登录 / users用户 / orders订单 / billing计费 / llm模型 / knowledge知识 / systems体系 / dashboard看板 / audit审计 / analytics统计 / config配置 / prompts提示词 |
| `server/modules-public/` | **C端 API**（`/api/v1/app/*`）：user用户 / chart排盘 / birth-profiles生辰档案 / synastry合盘 / payment支付 / referral邀请 / billing / track埋点 |
| `server/api/` | 命书(`report.ts`) 与 对话(`chat.ts`) 两个大接口 |
| `server/agents/` | **AI 智能体**：编排(`orchestrate`)、路由(`router-agent`)、提示词 |
| `server/workflows/` | **生成流水线**：`step-personality`性格 / `step-luck`运势 / `step-assemble`组装 / `mbti-expression`MBTI表达 |
| `server/prompts/` | **提示词模板**（命书/性格/运势/系统） |
| `server/services/` | 服务层：`KnowledgeProvider`知识提供、`order-settlement`订单结算 |
| `server/knowledge/` | `mbti-expression-corpus.ts` MBTI 表达语料 |

### 3.3 核心引擎（`src/engine/`）—— 🔒 已封版，禁止修改

| 路径 | 作用 |
|:--|:--|
| `engine/index.ts` | **引擎唯一对外出口**（外围只能从这里调用） |
| `engine/calculator.ts` | 排盘计算主流程 |
| `engine/relation.ts` | 干支关系常量（全系统唯一来源） |
| `engine/knowledge-registry.ts` | 知识字典热接管（引擎可读取数据库知识） |
| `engine/annotation/` | **批注生成**：五行、日主强弱、格局、大运、神煞 |
| `engine/pattern/` | **格局判定**：`patternRules`取格规则、`mbtiMapping`MBTI映射 |
| `engine/rules/shenShaRules.ts` | 神煞规则 |

---

## 四、`admin/` 管理后台前端

| 路径 | 作用 |
|:--|:--|
| `admin/main.tsx` / `App.tsx` | 后台启动入口 + 路由 |
| `admin/core/Layout.tsx` | 后台整体布局（含响应式侧边栏） |
| `admin/core/Sidebar.tsx` | 左侧菜单栏 |
| `admin/core/menu.config.ts` | **菜单配置**（加菜单改这里） |
| `admin/lib/api.ts` | **后台接口封装**（自动带登录令牌 + 401 拦截） |
| `admin/components/` | 后台组件：`Login`登录、`BillingPanel`计费、`ConfigPanel`配置、`SystemSelector`体系选择、`AuditLog`审计日志 |
| `admin/modules/` | **后台各功能页**：`dashboard`看板 / `users`用户 / `orders`订单 / `llm`模型 / `knowledge-dict`知识字典 / `prompts`提示词 / `account`账户与安全 |
| `admin/hooks/useAuth.ts` | 后台登录状态 |

---

## 五、`docs/` 文档

| 路径 | 作用 |
|:--|:--|
| `docs/INDEX.md` | **文档总索引**（找文档先看它） |
| `docs/CHANGELOG.md` | 版本变更记录 |
| `docs/arch/` | **架构文档**（12 篇）：总架构、算法权威、配置契约、数据域、星座映射、LLM 路由、技术栈、代码规范… |
| `docs/adr/` | **架构决策记录**（ADR-001~013）：为什么这么设计 |
| `docs/rules/` | **命理规则**（7 篇，纯知识不涉代码）：干支、五行十神、地支关系、强弱用神、格局、大运流年、神煞MBTI |
| `docs/plan/` | **产品计划**（5 篇）：产品简介、功能路线图、AI 策略、增长模式、风险合规 |
| `docs/design/` | **设计文档**：UI/UX 规范、AI Agent 设计 |
| `docs/contracts/engine-api.md` | **引擎接口契约**（改引擎前必读） |
| `docs/tasks/` | `TODO.md`当前任务 / `DONE.md`已完成 |
| `docs/ops/` | 运维层：各批次实施与实测报告 |
| `docs/corpus/` | 语料原始资料（MBTI 语料、星座语料） |
| `docs/deploy/` | 部署手册 |
| `docs/ref/` | 外部参考资料（只读） |
| `docs/八字格局与MBTI类型映射.md` 等 | 命理专题深度文档 |

---

## 六、其他目录

| 路径 | 作用 |
|:--|:--|
| `seeds/knowledge/zodiac.json` | **星座知识数据**（12 星座，导入数据库用） |
| `seeds/knowledge/README.md` | 种子文件格式说明 |
| `seeds/platform/` | 平台配置快照（套餐/提示词，预留未启用） |
| `scripts/smoke-e2e.mjs` | **端到端冒烟测试**（42 项，上线必跑） |
| `scripts/backup-db.py` | 数据库备份 |
| `scripts/seed-import.mts` | 把 seeds 导入数据库 |
| `scripts/deploy-vps.sh` | VPS 部署脚本（已暂停用） |
| `tools/` | 开发辅助：生成名人报告、集成测试、迁移校验 |
| `tests/` | 端到端测试（引擎/配置/数据库/规则/e2e） |
| `public/` | 网站图标、PWA 清单 |
| `deploy/deploy.sh` | 部署脚本 |
| `data/mingli.db` | **主数据库文件**（本机开发用；不提交 git） |
| `reports/` | 报告产物输出目录 |

---

## 七、记忆口诀

- 想改**页面** → `src/pages` + `src/components`
- 想改**接口** → `src/server/modules`(后台) / `src/server/modules-public`(C端)
- 想改**数据库表** → `src/server/db/schema.ts`
- 想加**知识数据** → `seeds/knowledge/` 或 `src/server/db/seed.ts`
- 想改**后台菜单/页面** → `admin/core/menu.config.ts` + `admin/modules/`
- **永远别碰** → `src/engine/`（封版）
- 找**文档** → 先看 `docs/INDEX.md`
