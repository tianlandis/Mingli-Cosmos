// ============================================================
// 命书生成 hook
// 文件：src/hooks/useReport.ts
//
// 命书是「库算事实 + AI 润滑」的典型：四柱/批注由引擎给出（免费），
// 命书正文由大模型把结构化结论改写成有人味的文字（收点券）。
//
// 后端契约（2026-09-29 止血后）：
//   POST /api/report —— 需登录；成功扣额度；**同命盘命中缓存则不扣**；失败不计费。
//   响应：成功 `{ ok:true, data, cached }`；失败 `{ error, code, message }`。
// ============================================================

import { useCallback, useState } from 'react'
import type { ReportResult } from '../ai/types'
import { getUserToken } from '../lib/user-api'

export interface UseReportReturn {
  report: ReportResult | null
  loading: boolean
  error: string | null
  /** 本次是否来自服务端缓存（缓存命中不扣券，UI 可提示"已为你省下 5 券"） */
  cached: boolean
  generate: (sessionId: string | null) => Promise<boolean>
  close: () => void
}

export function useReport(): UseReportReturn {
  const [report, setReport] = useState<ReportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cached, setCached] = useState(false)

  const generate = useCallback(async (sessionId: string | null): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      const token = getUserToken()
      if (token) headers.Authorization = `Bearer ${token}`

      const res = await fetch('/api/report', {
        method: 'POST',
        headers,
        // 有 sessionId 就走服务端权威库，避免客户端命盘被篡改
        body: JSON.stringify(sessionId ? { sessionId } : {}),
      })
      const raw = await res.json().catch(() => null)

      if (!res.ok || !raw || raw.ok !== true) {
        const message = raw?.message
          ?? (res.status === 401 ? '生成命书需要登录' : '命书生成失败，请稍后重试')
        setError(String(message))
        return false
      }

      setReport(raw.data as ReportResult)
      setCached(raw.cached === true)
      return true
    } catch {
      setError('网络连接失败，请稍后重试')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const close = useCallback(() => {
    setReport(null)
    setError(null)
    setCached(false)
  }, [])

  return { report, loading, error, cached, generate, close }
}
