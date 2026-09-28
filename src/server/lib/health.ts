// ============================================================
// Phase 5 P5-2 — 分级健康检查（ADR-007）
// 文件：src/server/lib/health.ts
// 职责：
//   /api/health        → 进程级轻量（app.ts 内联，保持零依赖）
//   /api/health/deep   → 依赖级探测：DB 可读 + LLM 上游可达（带超时）
//
// 设计原则：
//   - 探测**不抛错**：任何异常都转成 check 结果，健康检查本身必须永远 200/503 可返回；
//   - LLM 探测可关闭（HEALTH_LLM_PROBE=0）——本地无 Key 时不应产生噪音告警；
//   - 不做写操作，不消耗额度。
// ============================================================

import { countUsers } from '../db'
import { isDbReady } from '../db'
import { getAppConfig } from '../config'

export type CheckStatus = 'ok' | 'degraded' | 'down' | 'skipped'

export interface HealthCheck {
  name: string
  status: CheckStatus
  latencyMs?: number
  detail?: string
}

export interface DeepHealthResult {
  status: 'ok' | 'degraded' | 'down'
  timestamp: string
  uptimeSeconds: number
  memoryMb: number
  nodeVersion: string
  dbReady: boolean
  checks: HealthCheck[]
}

/** DB 依赖探测：真实读一次 users 计数（同时验证连接 + 迁移到位） */
function probeDb(): HealthCheck {
  if (!isDbReady()) {
    return { name: 'database', status: 'skipped', detail: 'DB 未初始化（纯代码回退模式）' }
  }
  const start = Date.now()
  try {
    countUsers()
    return { name: 'database', status: 'ok', latencyMs: Date.now() - start }
  } catch (e) {
    return { name: 'database', status: 'down', latencyMs: Date.now() - start, detail: String(e) }
  }
}

/**
 * LLM 上游探测：向 baseUrl/models 发一次极短探活
 * - provider=local 且 key 为占位（ollama）→ skipped（避免本地噪音）
 * - 未配置 Key → skipped
 */
async function probeLlm(timeoutMs: number): Promise<HealthCheck> {
  const start = Date.now()
  let cfg: ReturnType<typeof getAppConfig>
  try {
    cfg = getAppConfig()
  } catch (e) {
    return { name: 'llm', status: 'skipped', detail: `配置不可读：${String(e)}` }
  }

  const apiKey = cfg.apiKey || ''
  const baseUrl = cfg.baseUrl || ''
  const isPlaceholder = !apiKey || apiKey === 'ollama' || apiKey === 'sk-xxx'
  if (isPlaceholder) {
    return { name: 'llm', status: 'skipped', detail: `未配置真实 Key（provider=${cfg.provider}）` }
  }
  if (!baseUrl) {
    return { name: 'llm', status: 'skipped', detail: '无自定义 baseUrl，跳过探活' }
  }

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(timeoutMs),
    })
    const latencyMs = Date.now() - start
    if (res.ok) {
      return { name: 'llm', status: 'ok', latencyMs, detail: `${cfg.provider}` }
    }
    // 401/403 说明可达但 Key 无效 → degraded（不是 down：进程本身健康）
    return {
      name: 'llm',
      status: 'degraded',
      latencyMs,
      detail: `HTTP ${res.status}（provider=${cfg.provider}）`,
    }
  } catch (e) {
    return {
      name: 'llm',
      status: 'degraded',
      latencyMs: Date.now() - start,
      detail: `不可达：${e instanceof Error ? e.message : String(e)}`,
    }
  }
}

/**
 * 深度健康检查
 * 聚合规则：任一 down → 整体 down；任一 degraded → 整体 degraded；否则 ok
 */
export async function deepHealthcheck(opts?: {
  llmTimeoutMs?: number
  includeLlm?: boolean
}): Promise<DeepHealthResult> {
  const llmTimeoutMs = opts?.llmTimeoutMs ?? 3000
  const includeLlm = opts?.includeLlm ?? process.env.HEALTH_LLM_PROBE !== '0'

  const checks: HealthCheck[] = [probeDb()]
  if (includeLlm) {
    checks.push(await probeLlm(llmTimeoutMs))
  } else {
    checks.push({ name: 'llm', status: 'skipped', detail: '探活已关闭（HEALTH_LLM_PROBE=0）' })
  }

  const status: DeepHealthResult['status'] = checks.some(c => c.status === 'down')
    ? 'down'
    : checks.some(c => c.status === 'degraded')
      ? 'degraded'
      : 'ok'

  const mem = process.memoryUsage()
  return {
    status,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    memoryMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
    nodeVersion: process.version,
    dbReady: isDbReady(),
    checks,
  }
}
