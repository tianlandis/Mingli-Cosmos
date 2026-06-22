# 02-功能路线图（Feature Roadmap）

> **来源**: `ProjectPlan.md` §二 + §七 + `design/UI_DESIGN_RECOMMENDATIONS.md`
> **用途**: 功能规划唯一来源，按阶段追踪
> **更新频率**: 月级（每完成一个 Phase 更新一次）
> **最后更新**: 2026-06-20（Phase 4+4a 完成，VPS 上线，转向 Phase 4b）

---

## 📊 双轨演进路线 (v4.0.0+ 容器化与架构升级版)

> 项目有两类并行工作流：**功能轨**（引擎/算法/AI/基础设施）与 **设计轨**（UI/UX/视觉）。互不阻塞、可并行推进。

```
====================================================================
功能轨（引擎 + AI）                       设计轨（UI/UX 数字命书）
------------------                       -----------------------
Phase 0  [✅] 基础排盘                    S0  [✅] 核心视觉重构 (v3.0 基础落成)
Phase 1  [✅] 结构化批注                  S1  [✅] 大运竖轴 + 专题Tab 完成
Phase 2  [✅] AI 深度集成 (本地/流式)      │   └─ UI-6 LuckTimeline + UI-7 TopicTabs
Phase 3  [✅] Docker 容器化 + 生产日志     S2  [⏳] 细节打磨与动效适配
Phase 4a [✅] 动态配置与管理后台 (大基建)
Phase 4b [⏳] 运营中台持续增强 ← 当前推进
Phase 5  [ ] 移动端 + 增长
Phase 6  [ ] 高级功能 + 生态
====================================================================
```

---

## Phase 0：基础排盘 ✅ 已完成

- [x] 出生信息输入（公历/农历、时辰、性别、地点）
- [x] 四柱八字排盘（天干地支、藏干、纳音）
- [x] 五行分析（分布 + 旺衰可视化）
- [x] 十神分析
- [x] 大运流年计算
- [x] 空亡标注
- [x] 地支关系（刑、冲、合、害、破、三合、三会）
- [x] 起运天数计算（月令分金依赖）

---

## Phase 1：结构化批注 + AI 增强 ✅ 已完成

### 已完成 ✅ (2026-06-17)

- [x] 规则引擎批注：日主强弱、用神忌神
- [x] 格局判断引擎（封版黑盒）
- [x] MBTI 人格映射（十神→认知功能 + 画像 + 行业适配 + 能量调整）
- [x] 神煞规则（天乙贵人/文昌/桃花/驿马/华盖/金舆/禄/羊刃 等 8 种）
- [x] 专题批注：婚姻、事业、健康、财运、性格、人际
- [x] 地支关系全面分析
- [x] `engine/pattern/` 格局引擎子目录
- [x] `engine/rules/` 神煞规则模块
- [x] 测试体系：186 项全量测试零失败

---

## Phase 2：AI 深度集成 ✅ 已完成 (v4.0.0)

### 基础设施 (Phase 2-A)

- [x] **Hono 后端服务框架** (port 3001)，API + 静态文件同构
- [x] **Vite proxy 配置**，开发模式前后端联动
- [x] **全链路类型契约** (`server/lib/types.ts` + `zod` 校验)
- [x] **LLM Provider 抽象层** (`server/lib/llm.ts`)
  - 统一 4 种后端：DeepSeek / OpenAI / Claude / Ollama(本地)
  - 环境变量动态切换、失败自动重试
- [x] **Guardrail 护栏** (`server/lib/guardrail.ts`)
  - 建议句式检测 + 敏感词过滤 + 免责声明补全

### B 模式命书生器 (Phase 2-B)

- [x] **System Prompt 构建器** (`server/prompts/`)
  - 注入全量命盘数据（~800-1200 tokens）
  - 三类 Prompt：system（全局）/ personality（性格格局）/ luck（运势趋势）
- [x] **SOP 三阶段流水线** (`server/workflows/`)
  - SOP-1 性格格局 → SOP-2 运势趋势 → SOP-3 报告装配
  - `runReportPipeline()` 统一入口 + `Try<T>` 错误容器
- [x] **POST /api/report** 命书接口
- [x] **ReportView.tsx** 前端命书展示

### C 模式对话 Copilot (Phase 2-C)

- [x] **SSE 流式对话** (`server/api/chat.ts`)
  - `text/event-stream` 响应格式，逐字增量推送
  - 滑动窗口上下文管理（最近 10 轮）
- [x] **前端流式渲染** (`ChatPanel.tsx` + `useAgentChat.ts`)
  - SSE 实时解析 + 增量渲染 + 低延迟首字
- [x] **上下文管理 + 历史摘要**

### 集成验证 (Phase 2-D)

- [x] 5 个经典命例 fixture JSON
- [x] 护栏自动化测试 (guardrail.test.ts)
- [x] 集成测试 mock LLM (workflows.test.ts)
- [x] Prompt 调优迭代 (5 命例回归)
- [x] 端到端测试

---

## Phase 3：Docker 容器化与公网测试 ✅ 已完成

| ID | 任务 | 说明 | 状态 |
|:---:|------|------|:--:|
| D-1 | **Dockerfile 多阶段构建** | 第一阶段 npm run build → 第二阶段仅保留 dist/ + 生产依赖 | ✅ |
| D-2 | **docker-compose.yml** | 端口映射 :3001, .env volumes 挂载, restart: always | ✅ |
| D-3 | **Nginx 反向代理** | SSE 流式专项优化 (proxy_buffering off + chunked_transfer_encoding on) | ✅ |
| D-7 | **生产日志与监控** | 结构化 JSON 日志 + 请求耗时中间件 + 每日轮转 + 7天清理 | ✅ |
| D-4 | 测试域名绑定 + SSL 证书 | Let's Encrypt / acme.sh 自动续签 | ⏸️ 待VPS |
| D-5 | Linux VPS 部署验证 | 两行命令拉起容器测试 | ⏸️ 待VPS |
| D-6 | 公网流式对话体验验收 | 延迟、吞吐、并发压力测试 | ⏸️ 待VPS |

> **本地等价验证**（2026-06-18）：build ✅ health ✅ static ✅ SPA ✅ SSE(327 chunks) ✅ logs(8 lines) ✅ — 7/7 通过。
> D-4~D-6 需真实 Linux VPS，Docker 镜像/编排/日志/SSE 均已就绪，VPS 就位后一键上线。

---

## Phase 4a：动态配置与管理后台 ✅ 主体完成 (大基建)

### 已完成 ✅ (2026-06-19)

| ID | 任务 | 说明 |
|:---:|------|------|
| M-1 | **后台管理端 UI** (`src/admin/`) | React 管理面板，可视化配置大厂 API Key + Prompt 模板 |
| M-2 | **数据库持久化模块** (`src/server/db/`) | SQLite/PostgreSQL，存储多厂商 API 配置、Prompt 版本、用户数据 |
| M-3 | **动态双轨配置路由** | 数据库配置优先 → `.env` 静态文件自动回退 |
| M-4 | **OpenClaw 风格可视化** | 类 OpenClaw 的 API Key 管理 + Prompt 模板编辑器 |
| M-5 | **配置热更新** | 管理后台修改配置后无需重启服务 |

> **以上 5 项全部在 Phase 4a（2026-06-19）中完成**，含 SiliconFlow 接入 + Qwen3.5-122B-A10B 模型切换 + Admin Config API ↔ 运行时 LLM DB-first 打通。

### Phase 4a 打磨补完 ⬜ (按 PP_ENGINEERING_SOP 标准)

| ID | 任务 | 说明 | 预估 |
|:---:|------|------|:--:|
| 4a-R1 | **Prompt 模板护栏热生效闭环** | GuardPanel 修改 → DB 写入 → 下一轮对话自动生效，端到端验证链路完备 | 0.5d |
| 4a-R2 | **Prompt 编辑器 UI 自解释强化** | 所有字段 helper text + tooltip + 中英对照，达到「零文档可用」标准 | 0.5d |
| 4a-R3 | **Debug Panel 闭环测试** | 沙盒调试 → 保存模板 → 实际对话验证，全链路无断点 | 0.5d |
| 4a-R4 | **L3 护栏热编辑 + 回退兜底验证** | buildAntiHallucinationPromptDynamic() 热加载 + 回退硬编码 双重保险 | 0.5d |
| 4a-R5 | **全站表单自解释收尾** | LLM ProviderForm / ConfigPanel / KnowledgeDictPage 统一自解释标准 | 0.5d |
| 4a-R6 | **Prompt 版本回滚演练** | prompt_versions 表回滚 → 历史版本对比 → 一键恢复 | 0.5d |

> 以上 6 项为 Phase 4a 收尾打磨，按 PP_ENGINEERING_SOP 四条铁律逐项验收。完成后 Phase 4a 标记为 ✅ 终极完成。

---

## Phase 4b：运营中台持续增强 ⏳ 当前推进

| ID | 任务 | 说明 |
|:---:|------|------|
| M-6 | **C 端用户管理模块** | 用户注册/登录/权限体系 |
| M-7 | **订单与订阅管理** | 支付集成 + 订阅生命周期 |
| M-8 | **运营数据看板增强** | GA/埋点接入 + 业务指标仪表盘 |

---

## Phase 5：移动端 + 增长 ⬜ 远期

- [ ] PWA 支持（manifest + service worker）
- [ ] 微信小程序适配
- [ ] 一键分享海报生成
- [ ] 基础订阅系统

---

## Phase 6：高级功能 + 生态 ⬜ 远期

- [ ] RAG 知识库（《滴天髓》《三命通会》等经典）
- [ ] C 模式 Multi-Agent 实现（router + 各专题 agent）
- [ ] 合婚 / 择吉高级功能
- [ ] 社区功能
- [ ] 独立 iOS / Android App

---

## 设计轨：UI/UX 数字命书改造

> **来源**: `design/UI_DESIGN_RECOMMENDATIONS.md`（基于 frontend-design 方法论）
> **设计方向**：宣纸为底 / 朱砂为印 / 墨迹为字 / 留白呼吸 — 数字命书风格
> **约束**：不修改 `engine/` 核心算法，仅改 UI 层

---

### S0 · 核心视觉重构 ✅ 已完成 (v3.0)

| ID | 任务 | 状态 |
|:---:|------|:--:|
| UI-1 | **调色板切换**: 深棕黑 `#1a1410` → 宣纸底 `#FBF7F0`，墨色 `#1C1914`，朱砂 `#B83A2E` | ✅ |
| UI-2 | **命盘英雄区**: 四柱大字居中 + 日主朱砂印章（`.seal-stamp` CSS 类，红字+方框+-3°旋转） | ✅ |
| UI-3 | **章节化布局**: 卡片 → `.chapter` 流式布局 + 淡墨细线 `#D8D2C8` 分隔 | ✅ |
| UI-4 | **字体替换**: 微软雅黑 → 思源宋体（标题/干支）+ 思源黑体（正文） | ✅ |
| UI-5 | **输入区紧凑化**: 独立卡片 → 一行内联工具栏（历法/性别/年/月/日/闰/排盘） | ✅ |

---

### S1 · 品质提升 & UI 重塑 ✅ 大运竖轴+专题Tab已完成，动画+强弱条待做

| ID | 任务 | 说明 | 状态 |
|:---:|------|------|:--:|
| UI-6 | **大运竖轴** | LuckCycle 从横向表格 → 竖向时间轴：左侧年份、右侧干支+判词，当前十年高亮 | ✅ |
| UI-7 | **专题 Tab 化** | AnnotationPanel 6 宫格平铺 → 水平 Tab 切换（性格/事业/财运/婚姻/健康/子女） | ✅ |
| UI-8 | **动画序列** | 排盘后章节 staggered 入场（每节延迟 150ms），命盘抬头渐显 | ⬜ |
| UI-9 | **日主强弱条** | 水平进度条替代当前展示，左"弱"右"强"，墨色渐变刻度 | ⬜ |

---

### S2 · 细节打磨与动效适配 ⬜ 待开始

| ID | 任务 | 说明 |
|:---:|------|------|
| UI-10 | **印章微调** | 旋转角度精调、方框纹理、印章 hover 效果 |
| UI-11 | **五行条形图** | 水平条形替代柱状图，五行色填充、左侧标签 |
| UI-12 | **响应式细化** | `sm:`（<640px）/ `md:`（≥640px）/ `lg:`（≥1024px）三断点打磨 |
| UI-13 | **暗色模式** | `prefers-color-scheme: dark` 备选方案 |

---

## 测试与验证计划

| 阶段 | 测试内容 | 状态 |
|------|----------|:--:|
| Phase 1 | 39 单元测试（calculator + patternRules） | ✅ |
| Phase 2 | 186 项全量测试（7 文件全覆盖） | ✅ |
| Phase 3 | Docker 部署验证 + 公网 SSE 体验验收 | ⬜ |
| Phase 4a | 管理后台功能测试 + 数据库集成测试 | ✅ |
| Phase 5 | 移动端/平板/桌面三断点视觉一致性验收 | ⬜ |
| Phase 5-6 | 用户内测反馈循环（小红书、微信群） | ⬜ |

---

> 📎 **当前执行任务**: `tasks/TODO.md`
> 📎 **产品愿景**: `plan/01-product-brief.md`
> 📎 **AI 策略**: `plan/03-ai-strategy.md`
> 📎 **UI 设计**: `design/UI_DESIGN_RECOMMENDATIONS.md`
> 📎 **未来架构规划**: `arch/ARCHITECTURE-FUTURE.md`
