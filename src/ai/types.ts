// ============================================================
// 前端 AI 类型层
// 文件：src/ai/types.ts
// 职责：从 server/lib/types 重导出前端需要的类型
//       前端只消费类型定义，不引入任何服务端运行时依赖
// ============================================================

export type {
  Try,
  PersonalityOutput,
  LuckOutput,
  ReportSection,
  ReportResult,
  ReportRequest,
  ChatRequest,
  ChatMessage,
  GuardResult,
  ModelProvider,
  LLMConfig,
  AgentRouter,
  AgentCapability,
  AgentContext,
} from '../server/lib/types'
