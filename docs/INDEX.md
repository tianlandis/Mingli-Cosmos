# 📋 八字排盘系统 — AI 开发索引（AI Development Index）

> **版本**: v3.0 | **更新**: 2026-06-16
> **用途**: AI 开发助手每次任务必须首先读取本文件，按需加载后续文档。

---

## ⚡ 快速导航（按需读取）

### 我要修代码...

| 我要... | 需读文件 | 层级 |
|---------|----------|:---:|
| 修天干/地支/藏干/纳音/六十甲子 | `rules/01-tiangan-dizhi.md` | 规则 |
| 修五行生克/十神/旺衰 | `rules/02-wuxing-shishen.md` | 规则 |
| 修刑冲破害/三合三会/空亡 | `rules/03-dizhi-relations.md` | 规则 |
| 修强弱评分/用神忌神 | `rules/04-qiangruo-yongshen.md` | 规则 |
| 修格局判断/透干/分金 | `rules/05-geju-v2.md` | 规则 |
| 修大运流年/专题批注 | `rules/06-dayun-liunian.md` | 规则 |
| 修神煞/MBTI | `rules/07-shensha-mbti.md` | 规则 |
| 新增组件/改架构/改流水线 | `arch/ARCHITECTURE.md` | 架构 |
| 了解技术栈限制 | `arch/STACK.md` | 架构 |
| 了解代码规范 | `arch/CODE-STYLE.md` | 架构 |
| 了解核心引擎对外API | `contracts/engine-api.md` | 契约 |
| 开发 AI/报告等外围功能 | `contracts/engine-api.md` + `plan/03-ai-strategy.md` | 契约+计划 |

### 我要了解项目...

| 我要... | 需读文件 | 层级 |
|---------|----------|:---:|
| 查看当前任务进度 | `tasks/TODO.md` | 执行 |
| 查看历史完成记录 | `tasks/DONE.md` | 执行 |
| 了解产品方向和定位 | `plan/01-product-brief.md` | 计划 |
| 了解功能路线图 | `plan/02-feature-roadmap.md` | 计划 |
| 了解 AI 增强策略 | `plan/03-ai-strategy.md` | 计划 |
| 了解增长变现计划 | `plan/04-growth-model.md` | 计划 |
| 了解风险合规要求 | `plan/05-risk-compliance.md` | 计划 |
| 了解 UI/UX 设计规范 | `design/UI-UX.md` | 设计 |
| 开发 Phase 2 AI Agent | `design/PHASE2_AI_AGENT_DESIGN.md` | 设计 |

---

## 📁 文档分层架构（V3.0）

```
docs/
├── INDEX.md                          ← 【你在这里】AI 首次必读
│
├── rules/                            ← 📐 规则层（纯领域知识，不涉代码）
│   ├── 01-tiangan-dizhi.md           ← 天干地支·藏干·纳音·六十甲子·五虎遁
│   ├── 02-wuxing-shishen.md          ← 五行生克·十神矩阵·月令旺衰
│   ├── 03-dizhi-relations.md         ← 冲·合·刑·破·害·三合·三会·空亡
│   ├── 04-qiangruo-yongshen.md       ← 日主强弱评分·用神忌神·调候
│   ├── 05-geju-v2.md                 ← 格局判断V2（四正/透干/分金/破格/组合）
│   ├── 06-dayun-liunian.md           ← 大运流年·太岁·人生节点·专题批注
│   └── 07-shensha-mbti.md            ← 神煞规则·MBTI人格映射
│
├── arch/                             ← 🏗️ 架构层（工程约束，改代码时必读）
│   ├── ARCHITECTURE.md               ← 分层架构·核心/外围隔离·数据流·流水线
│   ├── STACK.md                      ← 技术栈锁定·配色·限制规则
│   └── CODE-STYLE.md                 ← 代码规范·命名约定·调用约定
│
├── contracts/                        ← 🔒 契约层（核心←→外围的接口"宪法"）
│   └── engine-api.md                 ← 引擎对外稳定API·红线·集成模式
│
├── plan/                             ← 📋 计划层（产品方向+商业策略）
│   ├── README.md                     ← 计划层导航
│   ├── 01-product-brief.md           ← 产品一页纸：愿景·定位·用户·价值
│   ├── 02-feature-roadmap.md         ← 功能路线图：4阶段功能清单+进度
│   ├── 03-ai-strategy.md             ← AI增强策略：对话·报告·RAG·护栏
│   ├── 04-growth-model.md            ← 增长变现：渠道·定价·营销·Freemium
│   └── 05-risk-compliance.md         ← 风险合规：法律·伦理·隐私·成本
│
├── design/                           ← 🎨 设计层（UI/UX + AI Agent 架构）
│   ├── UI-UX.md                      ← 配色·字体·布局·组件·页面流
│   └── PHASE2_AI_AGENT_DESIGN.md     ← Phase 2 AI Agent 架构（B→A→C 路径）
│
├── tasks/                            ← 📌 执行层（任务状态机）
│   ├── TODO.md                       ← 当前 Sprint Backlog（优先读取）
│   └── DONE.md                       ← 已完成记录
│
└── ref/                              ← 📚 参考层（外部资料，只读不修改）
    └── bazijichu.md                  ← 原版教材（source of truth）
```

---

## 🚫 AI 禁止行为

- ❌ **不要一次性读取所有 rules 文件** — 按需加载，节省 token
- ❌ **修改 domain 规则时不要动 arch 层代码** — 规则与架构分离
- ❌ **新增功能不要跳过 INDEX.md 导航** — 先查索引再读对应文档
- ❌ **不要直接修改 ref/ 下的参考文件** — 源文件只读
- ❌ **不要在代码中重新定义 `relation.ts` 已有的常量** — 全系统唯一来源
- ❌ **外围模块禁止直接引用 engine 内部实现** — 只能通过 `engine/index` 公开接口消费，详见 `contracts/engine-api.md`
- ❌ **修改核心引擎 API 前必须先更新 `contracts/engine-api.md`** — 契约先行

---

## 🔗 深度参考资料

以下为外部编写的高质量参考资料，涉及复杂场景时可查阅：

| 文档 | 用途 |
|------|------|
| `八字取格判断规则引导词（V2.0）.md` | V2.0 取格规则引导词 |
| `从月令取用到实战策略的完整解析.md` | 月令分金实战策略 |
| `八字格局与MBTI类型映射.md` | MBTI 映射详细规则 |
