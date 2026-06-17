# 🔒 核心引擎 API 契约（Engine API Contract）

> **版本**: v1.0 | **用途**: 核心引擎与外围模块之间的"宪法"
> ⚠️ **外围模块（AI、UI、报告等）只能通过本契约定义的接口消费引擎，禁止直接引用 engine/ 内部实现。**

---

## 设计原则

```
┌──────────────────────────────────────────────┐
│     外围模块（AI对话/报告导出/分享/UI）        │
│                                                │
│     ✅ 允许: import from 'engine/index'        │
│     ❌ 禁止: import from 'engine/calculator'   │
│     ❌ 禁止: import from 'engine/pattern/...'  │
│     ❌ 禁止: 修改 engine/ 下任何文件            │
├──────────────────────────────────────────────┤
│        contracts/engine-api.md                 │  ← 本文件
│        (核心对外暴露的稳定接口)                  │
├──────────────────────────────────────────────┤
│     核心引擎 engine/ （不可变内核）             │
│     calculator · pattern · annotation · rules  │
│     已完成封版，后续只修 bug 不加功能           │
└──────────────────────────────────────────────┘
```

---

## 一、对外暴露的类型（Stable Types）

> 以下类型为引擎对外的稳定接口，外围模块可以安全引用。
> 直接引用路径: `import { TypeName } from '../engine'` (相对路径) 或 `import { TypeName } from '@/engine'` (别名路径)

| 类型 | 说明 | 引入路径 |
|------|------|----------|
| `BaZiResult` | 八字排盘完整结果（含四柱+藏干+纳音+大运+起运天数） | `engine/index` |
| `AnnotationResult` | 批注完整结果（含强弱/用神/格局/神煞/专题/建议） | `engine/index` |
| `TianGan` | 天干类型（'甲'~'癸'） | `engine/index` |
| `DiZhi` | 地支类型（'子'~'亥'） | `engine/index` |
| `PatternResult` | 格局判断结果（含取格/组合/破格/MBTI） | `engine/index` |

---

## 二、对外暴露的函数（Stable Functions）

### 2.1 排盘计算

```typescript
// 从 engine/index 导出
function computeBazi(input: BaziInput): BaZiResult
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `input.year` | `number` | 公历年份 |
| `input.month` | `number` | 公历月份 (1-12) |
| `input.day` | `number` | 公历日 |
| `input.hour` | `number` | 公历小时 (0-23) |
| `input.gender` | `'male' \| 'female'` | 性别 |
| `input.isLunar` | `boolean` | 是否农历输入 |

### 2.2 批注生成

```typescript
// 从 engine/index 导出
function generateAnnotation(result: BaZiResult): AnnotationResult
```

> 这是外围模块获取八字分析的**唯一入口**。
> AI 对话、报告生成等模块调用此函数获取结构化数据，再包装为自然语言。

---

## 三、外围模块集成模式

### 3.1 AI 对话模块集成

```typescript
// ✅ 正确: 通过 engine/index 公开接口消费
import { computeBazi, generateAnnotation } from '@/engine';

const chart = computeBazi(input);
const annotation = generateAnnotation(chart);
// → 将 annotation 转为 AI Prompt 的 context JSON

// ❌ 错误: 直接引用 engine 内部实现
import { determinePattern } from '@/engine/pattern/patternRules'; // 禁止!
```

### 3.2 报告生成模块集成

```typescript
// ✅ 正确: 消费 generateAnnotation() 的输出结构
import { generateAnnotation } from '@/engine';
const result = generateAnnotation(chart);
// → 从 result.specialTopics.career 取事业内容
// → 从 result.patternAnalysis.mbti 取 MBTI 内容
```

### 3.3 UI 组件集成

```typescript
// ✅ 正确: UI 组件只展示 AnnotationResult，不做计算
function AnnotationPanel({ result }: { result: AnnotationResult }) {
  return <div>{result.overview}</div>;
}
```

---

## 四、红线（不可逾越）

| 规则 | 说明 |
|:---:|------|
| ❌ | **禁止** 外围模块直接 import `engine/calculator` 内部函数 |
| ❌ | **禁止** 外围模块直接 import `engine/pattern/patternRules` 内部函数 |
| ❌ | **禁止** 外围模块直接 import `engine/annotation/engine` 内部函数 |
| ❌ | **禁止** 修改 `engine/` 下任何文件的代码 |
| ❌ | **禁止** 在组件中实现排盘计算逻辑 |
| ✅ | **只能** 通过 `engine/index.ts` 公开导出的接口消费引擎 |
| ✅ | 如需引擎新增导出，必须先更新本契约文件 |

---

## 五、引擎内部模块索引（仅供引擎内部使用）

> ⚠️ 以下模块仅供引擎内部互相引用，**不对外暴露**。

| 内部模块 | 路径 | 用途 |
|----------|------|------|
| `relation.ts` | `engine/relation.ts` | 地支关系常量（引擎内部唯一来源） |
| `calculator.ts` | `engine/calculator.ts` | 八字排盘计算 |
| `pattern/patternRules.ts` | `engine/pattern/patternRules.ts` | V2.0 取格引擎 |
| `pattern/mbtiMapping.ts` | `engine/pattern/mbtiMapping.ts` | MBTI 人格映射 |
| `annotation/engine.ts` | `engine/annotation/engine.ts` | 批注主流水线 |
| `annotation/dayMasterStrength.ts` | `engine/annotation/dayMasterStrength.ts` | 日主强弱 |
| ~~`annotation/yongShen.ts`~~ | ~~`engine/annotation/yongShen.ts`~~ | ~~用神忌神~~ (V2.1 已移除，改用格局导向分析) |
| `annotation/luckAnalysis.ts` | `engine/annotation/luckAnalysis.ts` | 大运流年 |
| `annotation/specialTopics.ts` | `engine/annotation/specialTopics.ts` | 专题批注 |
| `annotation/branchRelations.ts` | `engine/annotation/branchRelations.ts` | 地支关系分析 |
| `rules/shenShaRules.ts` | `engine/rules/shenShaRules.ts` | 神煞规则 |

---

## 六、变更流程

如需修改引擎对外 API：

1. 先在该 `contracts/engine-api.md` 中更新接口定义
2. 在 `engine/index.ts` 中实现变更
3. 通知所有外围模块开发者
4. 确保向后兼容（旧接口保留至少一个版本周期）

---

> 📎 **架构层**: `arch/ARCHITECTURE.md`
> 📎 **AI 策略**: `plan/03-ai-strategy.md`
> 📎 **产品愿景**: `plan/01-product-brief.md`
