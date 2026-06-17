# Phase 2 AI 深度集成 — Agent 架构设计

> **版本**: v2.0 | **日期**: 2026-06-18 | **状态**: 设计审批通过
> **来源**: `plan/02-feature-roadmap.md` §Phase 2 + `plan/03-ai-strategy.md`
> **约束**: `contracts/engine-api.md`（AI 模块只能通过 engine/index 公开接口消费引擎）
> **审查**: 已通过 `@skill://using-superpowers` 四节设计审查

---

## 目录

- [一、产品路径：B → A → C](#一产品路径b--a--c)
- [二、技术选型](#二技术选型)
- [三、目录结构（最终版）](#三目录结构最终版)
- [四、全链路类型契约](#四全链路类型契约)
- [五、B 模式：任务型 Agent — 3 步 SOP 流水线](#五b-模式任务型-agent--3-步-sop-流水线)
- [六、A 模式：对话 Copilot + 护栏](#六a-模式对话-copilot--护栏)
- [七、LLM Provider 抽象层](#七llm-provider-抽象层)
- [八、护栏 & 安全设计（精确版）](#八护栏--安全设计精确版)
- [九、错误处理矩阵](#九错误处理矩阵)
- [十、测试策略](#十测试策略)
- [十一、构建 & 部署配置](#十一构建--部署配置)
- [十二、实施序列](#十二实施序列)
- [十三、红线汇总](#十三红线汇总)

---

## 一、产品路径：B → A → C

```
B 模式 (任务型 Agent) → A 模式 (对话 Copilot) → C 模式 (Multi-Agent)
   主轴 · 闭环交付           体验增强 · 个性化追问        终极形态 · 交叉论命
```

| 阶段 | 业务目标 | 核心能力 |
|:--:|------|------|
| **B** | "数字命书"一键生成 | 硬编码 SOP 流水线 → 分步喂 LLM → 组装 Markdown 报告 |
| **A** | 命书生成后的个性化追问 | 带八字全量上下文 + 护栏的多轮对话（SSE 流式） |
| **C** | 多专家协作论命（远期） | 各专题独立 Agent + Router 调度 |

### 设计原则

- **计算归引擎，解释归 AI**：LLM 不参与任何天干地支的计算
- **B 主轴闭环**：SOP 硬编码，不依赖 AI 自主规划
- **A 增强体验**：上下文注入 + 双层护栏，安全可控
- **C 预留接口**：目录和类型设计已预留 `agents/` 和 `orchestrate.ts` 入口

---

## 二、技术选型

| 决策 | 选择 | 理由 |
|------|:--:|------|
| **运行时** | TypeScript 全栈（前 Vite 8 + 后 Hono） | 单一语言，共享 engine 类型，零基建成本 |
| **LLM 接入** | Vercel AI SDK (`ai` + `@ai-sdk/openai`) | 原生 SSE 流式 + `useChat` React hook + 结构化输出 |
| **后端框架** | Hono (Web Standard) | 极轻量，完美兼容 Vite proxy + Edge Runtime |
| **模型策略** | 开发期 Ollama/Qwen2.5 本地 → 上线后 DeepSeek/Claude | 零成本开发测试，上线切换环境变量 |
| **类型共享** | `server/` 放入 `src/` 下，统一 tsconfig paths | 跨层类型 import 零配置 |

---

## 三、目录结构（最终版）

> **关键变更（v2.0）**: `server/` 从独立目录移入 `src/` 下，解决跨项目类型引用问题。

```
bazipaipan/
│
├── src/                          ← 前端 + 后端统一目录
│   ├── engine/                   ← 核心引擎 [已有，封版不动]
│   │   └── index.ts              ← 唯一公开入口
│   │
│   ├── ui/                       ← UI 层 (组件+样式)
│   │   ├── components/           ← 现有组件 + 🆕 ReportView, ChatPanel
│   │   ├── hooks/
│   │   │   ├── useBazi.ts        ← 现有：计算+批注状态
│   │   │   └── useAgentChat.ts   ← 🆕 A模式：对话流状态
│   │   └── App.tsx, main.tsx, index.css
│   │
│   ├── ai/                       ← 🆕 前端 AI 类型层
│   │   └── types.ts              ← 前端消费的类型重导出
│   │
│   └── server/                   ← 🆕 轻量后端（Hono，在 src/ 下共享类型）
│       ├── index.ts              ← Hono 服务器入口 (port 3001)
│       ├── api/
│       │   ├── report.ts         ← B模式：POST /api/report
│       │   └── chat.ts           ← A模式：POST /api/chat (SSE流式)
│       │
│       ├── workflows/            ← 🆕 SOP 编排层 (B模式核心)
│       │   ├── index.ts          ← 编排入口：runReportPipeline() + Try<T> 熔断
│       │   ├── step-personality.ts  ← SOP-1：性格与格局总评
│       │   ├── step-luck.ts      ← SOP-2：近三年运势趋势
│       │   └── step-assemble.ts  ← SOP-3：汇总装订 → Markdown（不调LLM）
│       │
│       ├── prompts/              ← 🆕 Prompt 模板库
│       │   ├── system.ts         ← System Prompt 构建器
│       │   ├── personality.ts    ← 性格格局 prompt 模板
│       │   └── luck.ts           ← 大运流年 prompt 模板
│       │
│       └── lib/
│           ├── llm.ts            ← LLM 调用封装 (Vercel AI SDK + withRetry)
│           ├── guardrail.ts      ← 护栏：输出校验 + 敏感过滤（建议句式先检测）
│           └── types.ts          ← 🆕 全链路共享类型契约
│
├── package.json                  ← + hono, @hono/node-server, ai, @ai-sdk/openai, concurrently
├── vite.config.ts                ← + devServer.proxy → localhost:3001/api
└── tsconfig.json                 ← + @/ paths 别名
```

### 分层职责

| 层 | 位置 | 职责 | 依赖方向 |
|:--:|------|------|:--:|
| ① 引擎层 | `src/engine/` | 纯计算，产出 `BaZiResult` + `AnnotationResult` JSON | 无外部依赖 |
| ② SOP 编排层 | `src/server/workflows/` | B 模式核心：硬编码 3 步流水线 + Try<T> 熔断 | → 引擎 JSON |
| ③ Prompt 层 | `src/server/prompts/` | 模板字符串组装，不含业务逻辑 | → 引擎 JSON |
| ④ API 层 | `src/server/api/` | HTTP 端点 | → workflows / prompts |
| ⑤ LLM 抽象层 | `src/server/lib/` | Provider 封装 + 护栏 | — |
| ⑥ UI 层 | `src/ui/` | React 组件 + hooks | → API 端点 |

### 设计约束

```
❌ 引擎层不可修改（封版原则）
❌ SOP 层不实现任何八字计算（只读 JSON）
❌ LLM 不参与计算（天干地支 → 引擎算完）
✅ 所有数据流通经过 engine/index.ts 的类型定义
✅ server/ 和 ai/ 共享同一套 TypeScript 类型
```

---

## 四、全链路类型契约

> **文件**: `src/server/lib/types.ts`

```typescript
import type { BaZiResult, AnnotationResult } from '@/engine'

// ═══════════════════════════════════════
// 通用工具类型
// ═══════════════════════════════════════

/** 熔断包装：每个 step 返回 Try<T>，失败短路 */
export type Try<T> = 
  | { ok: true; data: T }
  | { ok: false; error: string; step: string }

// ═══════════════════════════════════════
// B 模式：命书生成
// ═══════════════════════════════════════

export interface PersonalityOutput {
  overview: string       // 格局总评 (~250字)
  mbtiProfile: string    // 人格画像 (~150字)
}

export interface LuckOutput {
  trend: string          // 近三年趋势 (~200字)
  highlights: string     // 重点关注 (~100字)
}

export interface ReportSection {
  id: string             // 'seal' | 'personality' | 'luck' | 'topics' | 'disclaimer'
  title: string
  content: string        // Markdown
}

export interface ReportResult {
  markdown: string       // 完整命书 Markdown
  sections: ReportSection[]
}

export interface ReportRequest {
  chart: BaZiResult
  annotation: AnnotationResult
}

// ═══════════════════════════════════════
// A 模式：对话
// ═══════════════════════════════════════

export interface ChatRequest {
  chart: BaZiResult
  annotation: AnnotationResult
  messages: ChatMessage[]
  reportSummary?: string  // 如果已生成命书，注入摘要
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// ═══════════════════════════════════════
// 护栏
// ═══════════════════════════════════════

export interface GuardResult {
  passed: boolean
  reason?: string
  sanitized?: string
}

// ═══════════════════════════════════════
// LLM Provider
// ═══════════════════════════════════════

export type ModelProvider = 'deepseek' | 'claude' | 'openai' | 'local'

export interface LLMConfig {
  provider: ModelProvider
  apiKey: string
  baseUrl?: string       // Ollama/vLLM 等本地模型
  model?: string         // 模型名，不填用 provider 默认
  temperature?: number   // 默认 0.7
  maxTokens?: number     // 默认 1024
}

// ═══════════════════════════════════════
// C 模式预留
// ═══════════════════════════════════════

/** 未来 Multi-Agent 的调度器接口 */
export interface AgentRouter {
  route(question: string): string   // 返回目标 agentId
}

export interface AgentCapability {
  agentId: string
  domain: string[]        // 能力域：['career', 'marriage', 'wealth', 'health']
  analyze(context: AgentContext): Promise<Try<string>>
}

export interface AgentContext {
  annotation: AnnotationResult
  personalitySummary?: string
  history?: ChatMessage[]
}
```

---

## 五、B 模式：任务型 Agent — 3 步 SOP 流水线

### 5.1 流水线图

```
用户点击「生成命书」
        │
        ▼
POST /api/report { chart, annotation }
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│  runReportPipeline(req)                                  │
│                                                          │
│  Step 1: 性格与格局总评                                    │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 输入: annotation.patternAnalysis                   │  │
│  │       + annotation.shiShenProfile                  │  │
│  │       + annotation.strengthAnalysis                │  │
│  │ 调 LLM → PersonalityOutput { overview, mbtiProfile } │  │
│  │ 策略: 温度 0.1, 超时 30s, 重试 1 次                  │  │
│  │ 失败 → 返回 Try<>.ok = false, 流水线短路             │  │
│  └────────────────────────────────────────────────────┘  │
│        │ success                                         │
│        ▼                                                 │
│  Step 2: 近三年运势趋势                                    │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 输入: annotation.luckAnalysis                      │  │
│  │       + Step1.overview (伪记忆上下文)                │  │
│  │ 调 LLM → LuckOutput { trend, highlights }           │  │
│  │ 策略: 温度 0.3, 超时 30s, 重试 1 次                  │  │
│  │ 失败 → 返回 Try<>.ok = false, 流水线短路             │  │
│  └────────────────────────────────────────────────────┘  │
│        │ success                                         │
│        ▼                                                 │
│  Step 3: 汇总组装                                         │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 输入: chart + annotation.specialTopics              │  │
│  │       + Step1 完整输出 + Step2 完整输出              │  │
│  │ 纯模板拼接 → ReportResult { markdown, sections[] }  │  │
│  │ 策略: 不调 LLM，纯 Markdown 模板                     │  │
│  └────────────────────────────────────────────────────┘  │
│        │                                                 │
│        ▼                                                 │
│  返回 Try<ReportResult>                                  │
└─────────────────────────────────────────────────────────┘
```

### 5.2 分步 Prompt 策略

#### Step 1 — 性格与格局总评

```
System: 你是八字命理分析师。基于给定的结构化数据撰写分析，
        不得编造数据之外的内容。
        风格：平和客观，有典籍气质，不使用绝对化断言。

Context: 
  格局类型：{patternType}，组合：{combination}
  十神分布：日主{dayMaster}，{tenGodList}
  日主强弱：{strengthScore}/100，{strengthLabel}

要求：
1. 先解释格局名称的来源和含义
2. 结合十神分布描述性格特质
3. 如 MBTI 映射可用，自然融入人格画像
4. 结尾附免责："以上分析仅供参考"
```

#### Step 2 — 近三年运势趋势

```
Context:
  格局背景：{personalitySummary}
  当前大运：{currentDaYun.ganZhi} ({startYear}-{endYear})
  当前流年：{currentYear.ganZhi}，解读：{currentYear.interpretation}
  未来三年：{nextYears.map(y => y.ganZhi)}

要求：
1. 结合格局强弱，分析当前大运对命主的总体影响
2. 点出未来三年中值得关注的年份（好坏都提）
3. 语言风格：命理术语 + 白话解释，易懂不失专业
```

#### Step 3 — 汇总模板（不调 LLM）

```markdown
# 数字命书 · {日主}{gender === 'male' ? '乾造' : '坤造'}

{四柱八字天干地支表格}

---

## 卷一 · 性格格局

{Step1.overview}
{Step1.mbtiProfile}

---

## 卷二 · 运势前瞻

{Step2.trend}
{Step2.highlights}

---

## 卷三 · 人生诸域

### 事业
{specialTopics.career}

### 财运
{specialTopics.wealth}

### 婚姻
{specialTopics.marriage}

### 健康
{specialTopics.health}

### 子女
{specialTopics.children}

---

{disclaimer}
```

### 5.3 分步策略一览

| 维度 | Step 1 (性格) | Step 2 (运势) | Step 3 (汇总) |
|------|:--:|:--:|:--:|
| LLM 调用 | ✅ 是 | ✅ 是 | ❌ 不调 |
| 温度 | 0.1 | 0.3 | — |
| 最大 Token | 800 | 1000 | — |
| 超时 | 30s | 30s | — |
| 重试次数 | 1 | 1 | — |
| 失败策略 | 短路 → 返回 Try.error | 短路 → 返回 Try.error | 不会失败 |

### 5.4 流水线执行器（含 Try<T> 熔断）

```typescript
// src/server/workflows/index.ts

import type { Try, ReportResult, ReportRequest } from '../lib/types'
import { generatePersonality } from './step-personality'
import { generateLuck } from './step-luck'
import { assembleReport } from './step-assemble'

export async function runReportPipeline(
  req: ReportRequest
): Promise<Try<ReportResult>> {

  // Step 1
  const s1 = await generatePersonality(req.annotation)
  if (!s1.ok) return s1  // ← 短路

  // Step 2（依赖 s1 输出）
  const s2 = await generateLuck(req.annotation.luckAnalysis, s1.data.overview)
  if (!s2.ok) return s2  // ← 短路

  // Step 3（不调 LLM，不会失败）
  const report = assembleReport(req.chart, req.annotation.specialTopics, s1.data, s2.data)

  return { ok: true, data: report }
}
```

---

## 六、A 模式：对话 Copilot + 护栏

### 6.1 A 模式与 B 模式关系

| 维度 | B 模式 (命书) | A 模式 (Copilot) |
|------|------|------|
| 触发 | 用户点击"生成命书" | 用户自由追问 |
| 控制流 | 硬编码 SOP，顺序执行 | 开放式对话，LLM 决定回答方向 |
| 上下文 | 每步只喂相关 JSON 片段 | 全量 JSON + 命书摘要常驻 System Prompt |
| 输出 | 结构化 Markdown 命书 | SSE 流式自然语言 |
| 依赖 | 仅需 AnnotationResult | 需要 B 模式输出 + 对话历史 |

### 6.2 System Prompt 构建策略

```typescript
// src/server/prompts/system.ts

export function buildSystemPrompt(
  chart: BaZiResult,
  annotation: AnnotationResult,
  reportSummary?: string
): string {
  return `
## 角色
你是八字命理分析师"墨白"。你的分析基于下方结构化排盘数据，不得编造数据之外的内容。

## 命盘数据
- 四柱：${formatPillars(chart)}
- 日主：${chart.dayMaster}（${annotation.strengthAnalysis.label}，${annotation.strengthAnalysis.score}/100）
- 格局：${annotation.patternAnalysis.patternName}（${annotation.patternAnalysis.quality}）
- 十神：${formatShiShen(annotation.shiShenProfile)}
- 当前大运：${formatDaYun(annotation.luckAnalysis)}
- 神煞：${formatShenSha(annotation.shenSha)}

${reportSummary ? `## 命书摘要\n${reportSummary}` : ''}

## 规则
1. 所有回答必须基于以上数据，不得脱离数据自由发挥
2. 禁止绝对化断言（"一定""必然""绝对"）
3. 禁止提供医疗、法律、投资建议
4. 语气平和客观，有典籍气质但不晦涩
5. 每次回复末尾附："以上分析仅供参考，祝您生活愉快。"
6. 拒绝回答与命盘无关的闲聊问题
  `.trim()
}
```

### 6.3 对话窗口管理

System Prompt 含全量 JSON 约 800-1200 tokens。多轮对话需滑动窗口：

```typescript
// src/server/api/chat.ts 内

const MAX_CONTEXT_TOKENS = 4000  // 留给对话历史
const MAX_MESSAGES = 10          // 保留最近 10 条

function trimMessages(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= MAX_MESSAGES) return messages
  return messages.slice(-MAX_MESSAGES)
}
```

### 6.4 SSE 流式 API

```typescript
// src/server/api/chat.ts
import { streamText } from 'ai'
import { buildSystemPrompt } from '../prompts/system'
import { validateResponse } from '../lib/guardrail'

export const chatRoute = app.post('/api/chat', async (c) => {
  const { chart, annotation, messages, reportSummary } = await c.req.json() as ChatRequest

  const systemPrompt = buildSystemPrompt(chart, annotation, reportSummary)
  const trimmedMessages = trimMessages(messages)

  const result = streamText({
    model: /* 从环境变量取 LLMConfig */,
    system: systemPrompt,
    messages: trimmedMessages,
    onFinish: ({ text }) => {
      const guard = validateResponse(text)
      if (!guard.passed) {
        console.warn('[Guardrail]', guard.reason)
      }
    }
  })

  return result.toDataStreamResponse()
})
```

### 6.5 前端消费

```typescript
// src/ui/hooks/useAgentChat.ts
import { useChat } from '@ai-sdk/react'

export function useAgentChat(chart: BaZiResult, annotation: AnnotationResult) {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    body: { chart, annotation },
  })

  return { messages, input, handleInputChange, handleSubmit, isLoading }
}
```

### 6.6 C 模式预留接口

不现在实现，但在目录和类型设计上预留：

```
src/server/（未来扩展）
  ├── agents/               ← Multi-Agent 目录
  │   ├── career-agent.ts    ← 事业专家 Agent
  │   ├── marriage-agent.ts  ← 婚姻专家 Agent
  │   └── router-agent.ts    ← 调度 Agent（根据问题路由）
  └── orchestrate.ts         ← 🆕 替代当前流水线
```

当前 SOP 的 `runReportPipeline()` 是顺序调用函数，未来只需在 `orchestrate.ts` 中加一个 `routeToAgent(question)` 调度器，每个 `*-agent.ts` 内部调自己的 prompt → LLM，就是 Multi-Agent。

---

## 七、LLM Provider 抽象层

> **文件**: `src/server/lib/llm.ts`

```typescript
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModelV1 } from 'ai'
import type { LLMConfig, ModelProvider, Try } from './types'

const PROVIDER_DEFAULTS: Record<ModelProvider, { model: string }> = {
  deepseek:  { model: 'deepseek-chat' },
  claude:    { model: 'claude-3-5-sonnet-20241022' },
  openai:    { model: 'gpt-4o-mini' },
  local:     { model: 'qwen2.5:7b' },  // Ollama 默认
}

export function createModel(config: LLMConfig): LanguageModelV1 {
  const { model: defaultModel } = PROVIDER_DEFAULTS[config.provider]
  
  const provider = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl ?? getDefaultBaseUrl(config.provider),
  })

  return provider(config.model ?? defaultModel)
}

function getDefaultBaseUrl(provider: ModelProvider): string {
  switch (provider) {
    case 'deepseek': return 'https://api.deepseek.com/v1'
    case 'claude':   return 'https://api.anthropic.com/v1'
    case 'openai':   return 'https://api.openai.com/v1'
    case 'local':    return 'http://localhost:11434/v1'  // Ollama
  }
}

// 带重试 + 超时的 LLM 调用包装
export async function withRetry<T>(
  fn: () => Promise<T>, 
  step: string, 
  maxRetries = 1
): Promise<Try<T>> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('LLM_TIMEOUT')), 30_000)
        )
      ])
      return { ok: true, data: result }
    } catch (e) {
      if (attempt === maxRetries) {
        return { ok: false, error: String(e), step }
      }
      console.warn(`[LLM] retry ${attempt + 1}/${maxRetries} for ${step}`)
    }
  }
  return { ok: false, error: 'UNREACHABLE', step }
}
```

### 模型切换一览

| 阶段 | Provider | 模型 | baseUrl |
|------|:--:|------|------|
| 本地开发 | `local` | `qwen2.5:7b` | `http://localhost:11434/v1` |
| 内测上线 | `deepseek` | `deepseek-chat` | `https://api.deepseek.com/v1` |
| 深度报告 | `claude` | `claude-3-5-sonnet` | `https://api.anthropic.com/v1` |
| 通用对话 | `openai` | `gpt-4o-mini` | `https://api.openai.com/v1` |

---

## 八、护栏 & 安全设计（精确版）

### 三层防线

| 层级 | 位置 | 机制 |
|:--:|------|------|
| **Prompt 层** | `src/server/prompts/system.ts` | System Prompt 锁定角色 + 数据边界 + 6 条硬规则 |
| **输出校验层** | `src/server/lib/guardrail.ts` | 建议句式先检测 + 敏感词检测 + 免责声明补全 |
| **API 层** | `src/server/api/*.ts` | 频率限制 + 输入长度限制 + API Key 服务端存储 |

### 护栏规则清单

| 规则 | 检测方式 | 处理 |
|------|----------|------|
| 禁止建议 + 敏感词 | 建议句式 AND 禁止词 → 拦截 | 返回固定拒绝话术 |
| 禁止建议 + 医疗术语 | 建议句式 AND 医疗词 → 拦截 | 返回固定拒绝话术 |
| 免责声明缺失 | 末尾不含"仅供参考" | 自动追加声明 |
| 长度异常 (>2000字) | 字数检测 | 警告日志 + 放行 |
| 绝对化断言 | 正则匹配 (一定/必然/保证) | 提示 + 建议改为 "倾向于…" |
| 频率限制 | 计数器 | 10次/分钟 → 429 |

### 护栏实现（精确版）

```typescript
// src/server/lib/guardrail.ts

// 检测"建议句式" + 敏感词，而非单独检测敏感词
const ADVICE_PATTERNS = /(你应该|建议你|去买|去查|服用|投资|买入|卖出)/g
const FORBIDDEN_TERMS = /(癌症|肿瘤|手术|自杀|毒品|违法)/g
const MEDICAL_SHADOW = /(处方|药品|剂量|治疗|诊断)/g

export function validateResponse(text: string): GuardResult {
  // 1. 只有在建议句式中出现禁止词才拦截
  const hasAdvice = ADVICE_PATTERNS.test(text)
  if (hasAdvice) {
    if (FORBIDDEN_TERMS.test(text)) {
      return { passed: false, reason: 'forbidden_advice' }
    }
    if (MEDICAL_SHADOW.test(text)) {
      return { passed: false, reason: 'medical_advice' }
    }
  }

  // 2. 免责声明检查（允许自动补上）
  if (!text.includes('仅供参考')) {
    return { 
      passed: false, 
      reason: 'missing_disclaimer', 
      sanitized: text + '\n\n*以上分析仅供参考，祝您生活愉快。*' 
    }
  }

  // 3. 长度异常（超过 2000 字 → 警告但放行 + 日志）
  if (text.length > 2000) {
    console.warn('[Guardrail] long_response', text.length)
  }

  return { passed: true }
}
```

> **关键设计**: 不会误杀正常命理讨论（如"木主肝胆，土弱可能有消化问题"不算医疗建议，因为不在建议句式中）。

---

## 九、错误处理矩阵

| 失败场景 | 后端行为 | 前端表现 |
|:--|------|------|
| LLM API 超时 (30s) | 重试 1 次，仍失败 → 返回 `Try { ok: false, error: "LLM_TIMEOUT" }` | "命书生成中断，请稍后重试" |
| LLM 返回空内容 | `Try.ok = false`, error 含空内容描述 | "该步骤未能生成内容，已跳过" |
| API Key 无效 | Hono error handler → 500 | "服务暂不可用，请联系管理员" |
| 输入 JSON 格式错误 | Zod schema 校验 → 400 | "输入数据格式异常" |
| 护栏拦截 | 返回替代文本 | 正常显示，但内容为拒绝回复 |

```typescript
// src/server/index.ts — Hono 全局错误处理
app.onError((err, c) => {
  console.error('[API Error]', err.message)
  return c.json({ error: 'INTERNAL_ERROR', message: '服务暂不可用' }, 500)
})
```

---

## 十、测试策略

### 10.1 测试沙盒 — 5 个经典命例

```
src/server/workflows/__tests__/
├── fixtures/
│   ├── case-01-qianlong.json    ← 乾隆 (身强正官格)
│   ├── case-02-zhugeliang.json  ← 诸葛亮 (食神制杀)
│   ├── case-03-normal-male.json ← 普通男性
│   ├── case-04-normal-female.json ← 普通女性
│   └── case-05-bianryu.json     ← 边缘命例 (特殊格局)
│
├── guardrail.test.ts            ← 护栏正则测试
├── prompts.test.ts              ← Prompt 模板输出快照
├── workflows.test.ts            ← SOP 流水线集成测试 (mock LLM)
└── types.test.ts                ← 类型契约 shape 验证
```

### 10.2 测试层次

| 层级 | 内容 | 工具 | Mock 策略 |
|------|------|------|------|
| **单元测试** | guardrail.validate() 各规则 | vitest | 不调 LLM |
| **集成测试** | 每个 Step 的输入→输出 | vitest + fixture JSON | mock `streamText` |
| **Prompt 回归** | 固定 JSON → 对比输出质量变化 | 手动 + 日志 diff | 真实 LLM（内测阶段） |
| **E2E** | 完整流水线 | vitest + 真实 API | 需要 LLM Key |

### 10.3 护栏测试用例设计

| 输入 | 预期 |
|------|------|
| "木主肝胆，土弱可能有消化问题" | ✅ passed（正常命理讨论） |
| "我建议你去买XX股票" | ❌ forbidden_advice |
| "你应该服用XX药品" | ❌ medical_advice |
| 正常命理分析，无免责声明 | ❌ missing_disclaimer → 自动补上 |

---

## 十一、构建 & 部署配置

### 11.1 vite.config.ts

```typescript
// vite.config.ts

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': '/src' }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',   // Hono 开发服务器
        changeOrigin: true,
      }
    }
  }
})
```

### 11.2 package.json scripts

```json
{
  "scripts": {
    "dev": "concurrently \"vite\" \"tsx watch src/server/index.ts\"",
    "dev:ui": "vite",
    "dev:server": "tsx watch src/server/index.ts",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  }
}
```

### 11.3 新增依赖

```json
{
  "dependencies": {
    "hono": "^4.x",
    "@hono/node-server": "^1.x",
    "ai": "^4.x",
    "@ai-sdk/openai": "^1.x",
    "zod": "^3.x"
  },
  "devDependencies": {
    "concurrently": "^9.x",
    "tsx": "^4.x"
  }
}
```

---

## 十二、实施序列

```
Phase 2-A: 基础设施 (1-2d)
├── 1. npm i hono @hono/node-server ai @ai-sdk/openai zod concurrently tsx
├── 2. src/server/index.ts Hono 服务 (port 3001)
├── 3. vite.config.ts proxy 配置
├── 4. src/server/lib/types.ts 类型契约
├── 5. src/server/lib/llm.ts LLM Provider 抽象 + withRetry
├── 6. src/server/lib/guardrail.ts 护栏
└── 7. src/ai/types.ts 前端类型重导出

Phase 2-B: B 模式 (3-5d)
├── 8.  src/server/prompts/{system,personality,luck}.ts
├── 9.  src/server/workflows/step-personality.ts
├── 10. src/server/workflows/step-luck.ts
├── 11. src/server/workflows/step-assemble.ts
├── 12. src/server/workflows/index.ts (runReportPipeline + Try<T>)
├── 13. src/server/api/report.ts
└── 14. src/ui/components/ReportView.tsx

Phase 2-C: A 模式 (3-4d)
├── 15. src/server/api/chat.ts (SSE 流式 + 滑动窗口)
├── 16. src/ui/hooks/useAgentChat.ts
├── 17. src/ui/components/ChatPanel.tsx
└── 18. 上下文管理 + 历史摘要

Phase 2-D: 集成验证 (1-2d)
├── 19. 5个经典命例 fixture JSON
├── 20. guardrail.test.ts
├── 21. 护栏测试用例编写
├── 22. Prompt 调优迭代
└── 23. 端到端测试
```

**总预估：8-12 个工作日，约 1200 行新代码。**

---

## 十三、红线汇总

| # | 规则 | 来源 |
|:--:|------|------|
| ❌ | engine/ 目录不得修改 | `arch/ARCHITECTURE.md` |
| ❌ | AI 模块不得 import engine 内部文件 | `contracts/engine-api.md` |
| ❌ | LLM 不得参与八字计算 | `plan/03-ai-strategy.md` |
| ❌ | API Key 不得出现在前端代码中 | 安全基线 |
| ✅ | 所有数据输入 LLM 前必须是确定性 JSON | B 模式设计 |
| ✅ | 所有 LLM 输出必须过 guardrail | A 模式设计 |
| ✅ | 每一步 LLM 调用必须有 Try<T> 熔断 | 流水线可靠性 |
| ✅ | System Prompt 必须在对话窗口中固定位置 | 上下文管理 |

---

> 📎 **引擎契约**: `contracts/engine-api.md`
> 📎 **架构约束**: `arch/ARCHITECTURE.md`
> 📎 **AI 策略**: `plan/03-ai-strategy.md`
> 📎 **功能路线图**: `plan/02-feature-roadmap.md`
> 📎 **强制审查规则**: `CODEBUDDY.md` — 每次写代码后必须 `@skill://using-superpowers` 审查
