// ============================================================
// Phase 4A — 数据库种子数据
// 文件：src/server/db/seed.ts
// 职责：首次运行时写入默认配置（从 .env 兜底）
// ============================================================

import { setConfig } from './repositories/app-configs'

export function seedDefaults() {
  // 默认 LLM 配置（从环境变量读取，写入数据库作为初始值）
  const defaultProvider = process.env.LLM_PROVIDER || 'openai'

  setConfig('default_llm_provider', defaultProvider, '默认 LLM 厂商', '当前使用的 LLM Provider')
  setConfig('default_llm_model', process.env.LLM_MODEL || process.env.OPENAI_MODEL || 'deepseek-ai/DeepSeek-V3', '默认模型', 'LLM 模型名称')
  setConfig('default_temperature', process.env.LLM_TEMPERATURE || '0.7', '默认温度', '生成温度 0-2')
  setConfig('max_chat_messages', '10', '对话窗口大小', '滑动窗口最大消息数')
  setConfig('max_retries', '1', 'LLM 重试次数', '失败后最大重试次数')
  setConfig('llm_timeout_ms', '30000', 'LLM 超时(ms)', '单次请求超时时间')

  console.log('[DB] seed: default configs written')
}
