# 🏗️ 架构约束（Architecture Constraints）

> **版本**: v3.1 | **用途**: 新增组件/修改架构/改流水线时必读
> **权威源**: 格局算法以 Python MCP 为准 → `arch/ALGORITHM-AUTHORITY.md`

---

## 一、分层架构（Layer Architecture）

```
UI 层 (React)  →  State 层 (useBazi Hook)  →  Core 引擎层 (纯 TS)  →  lunar-typescript
                                                    ↓
                                              规则引擎输出
                                            (结构化 JSON)
                                                    ↓
                                              AI Layer (护栏)
                                           (自然语言 + 对话)
```

### 核心原则

| 层级 | 约束 |
|------|------|
| **engine/** | **纯 TypeScript，零 React 依赖**。可独立用于 Node.js/CLI。封版后不修改。 |
| **components/** | React UI 层，只消费 engine 输出，不实现计算逻辑 |
| **hooks/** | 状态管理桥接层，useBazi 是 UI 和 engine 之间的唯一桥梁 |
| **ai/** | Phase 2 AI 模块，只通过 `engine/index` 公开接口消费，不碰引擎内部 |

### 核心/外围隔离（Core/Plugin Boundary）

```
┌──────────────────────────────────────────┐
│     外围模块（可变、可增删）               │
│     AI对话 · 报告导出 · UI 改版 · 分享    │
│         ↑ 只通过契约消费                   │
│    contracts/engine-api.md                │  ← 接口契约
│         ↑ engine/index.ts 公开导出         │
├──────────────────────────────────────────┤
│     核心引擎 engine/（不可变内核）          │
│     calculator · pattern · annotation     │
│     已完成封版，后续只修 bug 不加功能       │
└──────────────────────────────────────────┘
```

> ⚠️ **红线**: 外围模块禁止 `import` engine 内部实现文件（如 `engine/calculator`、`engine/pattern/patternRules`），只能通过 `engine/index.ts` 公开导出消费。详见 `contracts/engine-api.md`。

---

## 二、目录结构（必须遵守）

```
src/
├── engine/                      ← 纯 TypeScript 引擎层
│   ├── types.ts                 ← 核心数据结构（天干/地支/藏干/藏干天数/BaZiResult）
│   ├── relation.ts              ← ★ 地支关系常量（全系统唯一来源）
│   ├── calculator.ts            ← 八字排盘计算 + computeQiYunDays()
│   ├── index.ts                 ← 顶层导出
│   ├── pattern/                 ← V2.0 格局子系统
│   │   ├── patternRules.ts      ← 取格引擎：determinePattern/Combination/DetectPoGeRisks
│   │   ├── mbtiMapping.ts       ← MBTI 映射：analyzeMBTI/行业适配/能量调整
│   │   └── index.ts             ← 统一导出
│   ├── annotation/              ← 批注子系统
│   │   ├── engine.ts            ← 主引擎串联 → generateAnnotation()
│   │   ├── wuxing.ts            ← 五行生克工具 + getShiShenName()
│   │   ├── dayMasterStrength.ts ← 日主强弱打分
│   │   ├── ~~yongShen.ts~~      ← (V2.1 已移除，用神忌神体系废弃)
│   │   ├── pattern.ts           ← 格局判断包装（串联V2.0引擎+从格/特殊格局）
│   │   ├── luckAnalysis.ts      ← 大运流年节点
│   │   ├── branchRelations.ts   ← 地支关系全面分析
│   │   ├── specialTopics.ts     ← 六大专题批注
│   │   ├── types.ts             ← 批注输出类型定义
│   │   └── index.ts             ← 统一导出
│   └── rules/                   ← 规则库
│       ├── shenShaRules.ts      ← 神煞规则★
│       └── index.ts             ← 统一导出
├── components/                  ← React UI 层
│   ├── BirthForm.tsx            ← 输入表单
│   ├── BaziChart.tsx            ← 四柱展示
│   ├── HiddenStems.tsx          ← 藏干展示
│   ├── NaYin.tsx                ← 纳音展示
│   ├── FiveElements.tsx         ← 五行图表
│   ├── TenGods.tsx              ← 十神分析表
│   ├── LuckCycle.tsx            ← 大运流年时间线
│   └── Header.tsx               ← 头部
├── hooks/
│   └── useBazi.ts               ← 状态管理 hook
├── App.tsx                      ← 根组件
├── index.css                    ← Tailwind + 自定义样式
└── main.tsx                     ← 入口
```

---

## 三、数据流（Data Flow）

```
输入（年月日时 + 性别）
  → calculator.ts（四柱 + 纳音 + 藏干 + 十神 + 大运）
  → annotation/engine.ts（批注流水线）
     ├── dayMasterStrength.ts   → 日主强弱
     ├── ~~yongShen.ts~~        → (已移除，V2.1 废弃用神忌神体系)
     ├── pattern.ts             → V2.0格局(调用pattern/)
     ├── wuxing.ts              → 五行平衡
     ├── luckAnalysis.ts        → 大运流年
     ├── branchRelations.ts     → 地支关系
     ├── specialTopics.ts       → 专题批注
     └── shenShaRules.ts        → 神煞分析
  → AnnotationResult（完整批注结果）
```

---

## 四、批注引擎执行顺序（Execution Pipeline）

```
1.  analyzeDayMasterStrength    → 日主强弱
2.  ~~analyzeYongShen~~         → (V2.1 已移除，用神忌神体系废弃)
3.  analyzePattern              → V2.0格局（独立于强弱）
    3.1  determinePattern()      → V2.0取格（四正月/透干/分金）
    3.2  determineCombination()  → 组合判定
    3.3  detectPoGeRisks()       → 破格风险检测
    3.4  analyzeMBTI()           → MBTI人格映射
4.  analyzeWuXingBalance        → 五行平衡
5.  analyzeShiShenProfile       → 十神概况
6.  analyzeDaYun                → 大运（格局导向分析）
7.  analyzeCurrentYear          → 流年（格局导向分析）
8.  analyzeMilestones           → 人生节点
9.  analyzeBranchRelations      → 地支关系
10. analyzeSpecialTopics        → 专题批注（含所有专题子分析）
11. analyzeShenSha              → 神煞分析
12. generateOverview            → 总览（整合MBTI/组合/取格详情）
13. generateAdvice              → 综合建议（含破格风险建议）
```

⚠️ **执行顺序不可更改**：步骤3-13为固定流水线。V2.1 已移除用神忌神体系，大运流年改用格局导向分析。

---

## 五、输出数据结构（AnnotationResult）

```
AnnotationResult
├── overview          总览（日主、强弱、格局、MBTI、组合）
├── strengthAnalysis  日主强弱（分数+原因+各维度分）
├── ~~yongShen~~      (V2.1 已移除)
├── wuXingBalance     五行平衡（各五行等级+补益建议）
├── shiShenProfile    十神概况（各十神数量+位置）
├── patternAnalysis   格局分析（V2.0全部字段）
│   ├── patternType / patternName / confidence / quality
│   ├── method / sourceStem / shiShen / jiXiong
│   ├── combination   格局组合
│   ├── poGeRisks     破格风险（含MBTI补益）
│   ├── mbti          MBTI画像（功能/类型/特质/行业/能量调整）
│   └── fenJinDetail  月令分金详情（仅分金取格时）
├── luckAnalysis
│   ├── daYunList     大运列表（干支+解读+好坏）
│   ├── currentYear   流年分析（解读+关注要点）
│   └── milestones    人生节点（年龄+事件+原因）
├── branchRelations   地支关系（刑冲破害合列表+空亡+合局）
├── shenSha           神煞分析（汇总+逐项）
├── specialTopics
│   ├── personality   性格
│   ├── career        事业
│   ├── wealth        财运
│   ├── marriage      婚姻
│   ├── health        健康
│   └── children      子女
├── disclaimer        免责声明
└── comprehensiveAdvice 综合建议（含V2.0破格风险建议）
```

---

## 六、代码文件索引（Code File Index）

| 文件 | 职责 |
|------|------|
| `engine/types.ts` | 核心数据结构（天干/地支/藏干/藏干天数/HIDDEN_STEMS_DAYS/BaZiResult含qiYunDays） |
| `engine/relation.ts` | **地支关系常量**（冲合刑破害三合三会空亡）★ 全系统唯一来源 |
| `engine/calculator.ts` | 八字排盘计算 + `computeQiYunDays()` 起运天数 |
| `engine/annotation/wuxing.ts` | 五行生克工具函数 + `getShiShenName()` |
| `engine/annotation/dayMasterStrength.ts` | 日主强弱打分 |
| `engine/annotation/yongShen.ts` | ~~用神忌神取用~~ (V2.1 已移除) |
| `engine/pattern/patternRules.ts` | **V2.0 核心取格引擎**: `determinePattern()` / `determineCombination()` / `detectPoGeRisks()` |
| `engine/pattern/mbtiMapping.ts` | MBTI 人格映射: `analyzeMBTI()` / 十神→MBTI映射表 / 行业适配 / 能量调整 |
| `engine/pattern/index.ts` | pattern 统一导出 |
| `engine/annotation/pattern.ts` | 格局判断包装（串联 V2.0 引擎 + 从格/特殊格局备选） |
| `engine/annotation/luckAnalysis.ts` | 大运流年节点 |
| `engine/annotation/branchRelations.ts` | 地支关系全面分析 |
| `engine/annotation/specialTopics.ts` | 六大专题批注 |
| `engine/rules/shenShaRules.ts` | 神煞规则★ |
| `engine/rules/index.ts` | rules 统一导出 |
| `engine/annotation/engine.ts` | 主引擎串联 → `generateAnnotation()` |
| `engine/annotation/types.ts` | 批注输出类型定义（含V2.0扩展字段） |
| `engine/annotation/index.ts` | 统一导出 |
| `engine/index.ts` | 顶层导出 |

---

## 七、调用约定（Calling Conventions）

1. **地支关系**：统一从 `engine/relation.ts` 导入，**禁止**在函数内局部定义重复常量
2. **类型安全**：所有 `DiZhi` 参数使用类型别名而非裸 `string`
3. **批注流水线**：通过 `generateAnnotation()` 一站式获取全部输出
4. **扩展点**：新增批注模块在 `annotation/` 下创建，在 `engine.ts` 中串联，在 `index.ts` 中导出
5. **V2.0 格局**：取格统一走 `pattern/patternRules.ts` 的 `determinePattern()`，不要在 `annotation/pattern.ts` 中重新实现取格逻辑
6. **MBTI 映射**：由 `pattern/mbtiMapping.ts` 统一处理，破格风险的 MBTI 补益建议在此模块中

---

> 📎 **算法权威源**: `arch/ALGORITHM-AUTHORITY.md`（Python MCP 为最高权威）
> 📎 **技术栈锁定**: `arch/STACK.md`
> 📎 **代码规范**: `arch/CODE-STYLE.md`
