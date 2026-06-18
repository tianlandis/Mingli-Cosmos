// ============================================================
// 结构化日志工具 — 生产级可观测性
// 职责：统一日志格式、请求耗时追踪、文件持久化
// ============================================================

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { Context, Next } from 'hono'

// ── 日志级别 ──
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

// ── 日志条目 ──
interface LogEntry {
  ts: string // ISO 8601
  level: LogLevel
  module: string
  msg: string
  durationMs?: number
  statusCode?: number
  method?: string
  path?: string
  error?: string
  data?: unknown
}

// ── 配置 ──
let minLevel: LogLevel = 'info'
let logDir: string | null = null
let logStream: fs.WriteStream | null = null

export function configureLogger(opts: {
  level?: LogLevel
  logDir?: string
}) {
  if (opts.level) minLevel = opts.level
  if (opts.logDir) {
    logDir = opts.logDir
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }
  }
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[minLevel]
}

function formatEntry(entry: LogEntry): string {
  // 生产环境：单行 JSON（便于 grep / Loki 采集）
  return JSON.stringify(entry)
}

function writeLog(entry: LogEntry) {
  if (!shouldLog(entry.level)) return

  const line = formatEntry(entry)

  // Console 输出
  const prefix = entry.level === 'error' ? '🔴' : entry.level === 'warn' ? '🟡' : 'ℹ️'
  const extra = entry.durationMs ? ` [${entry.durationMs}ms]` : ''
  const reqInfo = entry.method && entry.path ? ` ${entry.method} ${entry.path}` : ''
  const statusSuffix = entry.statusCode ? ` → ${entry.statusCode}` : ''
  console.log(`${prefix} [${entry.module}]${reqInfo}${statusSuffix}${extra} ${entry.msg}`)

  // 文件持久化
  if (logStream) {
    logStream.write(line + '\n')
  }
}

// 每日轮转日志文件
function getLogFile(): string {
  const date = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  return path.join(logDir!, `server-${date}.log`)
}

function ensureLogStream() {
  if (!logDir) return
  const file = getLogFile()
  if (!logStream || (logStream.path as string) !== file) {
    logStream?.end()
    logStream = fs.createWriteStream(file, { flags: 'a' })
  }
}

// ── 公开 API ──

export const logger = {
  debug(module: string, msg: string, data?: unknown) {
    ensureLogStream()
    writeLog({ ts: new Date().toISOString(), level: 'debug', module, msg, data })
  },
  info(module: string, msg: string, data?: unknown) {
    ensureLogStream()
    writeLog({ ts: new Date().toISOString(), level: 'info', module, msg, data })
  },
  warn(module: string, msg: string, data?: unknown) {
    ensureLogStream()
    writeLog({ ts: new Date().toISOString(), level: 'warn', module, msg, data })
  },
  error(module: string, msg: string, error?: Error | string) {
    ensureLogStream()
    const errStr = error instanceof Error ? `${error.message}\n${error.stack}` : error
    writeLog({ ts: new Date().toISOString(), level: 'error', module, msg, error: errStr })
  },
}

// ── Hono 请求日志中间件 ──
export function requestLogger() {
  return async (c: Context, next: Next) => {
    const start = Date.now()
    const method = c.req.method
    const path = c.req.path

    await next()

    const duration = Date.now() - start
    const status = c.res.status

    ensureLogStream()
    writeLog({
      ts: new Date().toISOString(),
      level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
      module: 'http',
      msg: status >= 400 ? `${method} ${path} failed` : `${method} ${path}`,
      durationMs: duration,
      statusCode: status,
      method,
      path,
    })
  }
}

// ── 启动时清理旧日志（保留 7 天）──
export function rotateLogs(retainDays = 7) {
  if (!logDir || !fs.existsSync(logDir)) return

  const cutoff = Date.now() - retainDays * 86400_000
  const files = fs.readdirSync(logDir)
  for (const f of files) {
    if (!f.startsWith('server-') || !f.endsWith('.log')) continue
    const filePath = path.join(logDir, f)
    const stat = fs.statSync(filePath)
    if (stat.mtimeMs < cutoff) {
      fs.unlinkSync(filePath)
      console.log(`[Logger] 清理旧日志: ${f}`)
    }
  }
}

// ── 优雅关闭 ──
export function closeLogger() {
  logStream?.end()
  logStream = null
}
