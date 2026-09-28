// ============================================================
// useBazi — 排盘状态 Hook
// 文件：src/hooks/useBazi.ts
//
// 计算权威（P5-3 ADR-005）：
//   1. 优先调用服务端权威端点 POST /api/v1/app/chart —— 服务端计算并落库，
//      返回 sessionId（后续 AI 对话据此取用权威快照，堵住伪造 chart 的口子）；
//   2. 服务端不可用（网络/未初始化）时**回退本地引擎**，保证排盘永远可用，
//      代价仅是本次没有权威 sessionId（对话退回客户端 chart 路径）。
// ============================================================

import { useCallback, useState } from 'react'
import { calculateBazi, calculateBaziFromLunar, type BaZiResult } from '../engine'
import { generateAnnotation, type AnnotationResult } from '../engine/annotation'
import { userApi } from '../lib/user-api'

export interface ChartInput {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  gender: '男' | '女'
  calendarType: 'solar' | 'lunar'
  isLeapMonth?: boolean
}

/** 服务端权威排盘响应（P5-3） */
interface ChartResponse {
  sessionId: string
  chartHash: string
  engineVersion: string
  chart: BaZiResult
  annotation: AnnotationResult
}

export function useBazi() {
  const [result, setResult] = useState<BaZiResult | null>(null)
  const [annotation, setAnnotation] = useState<AnnotationResult | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** 本地引擎计算（仅作服务端不可用时的回退，保证排盘可用性） */
  const computeLocal = useCallback(async (data: ChartInput) => {
    const bz = data.calendarType === 'lunar'
      ? await calculateBaziFromLunar(
          data.year, data.month, data.day, data.hour, data.minute,
          data.gender, data.isLeapMonth ?? false,
        )
      : await calculateBazi(
          data.year, data.month, data.day, data.hour, data.minute, data.gender,
        )
    let ann: AnnotationResult | null
    try { ann = generateAnnotation(bz) } catch { ann = null }
    return { bz, ann }
  }, [])

  /** 排盘：服务端权威优先，失败回退本地引擎 */
  const handleCalculate = useCallback(async (data: ChartInput) => {
    setLoading(true)
    setError(null)

    try {
      // ① 服务端权威计算 + 落库（返回权威 sessionId）
      const res = await userApi.post<ChartResponse>('/api/v1/app/chart', data)
      if (res.success && res.data?.chart) {
        setResult(res.data.chart)
        setAnnotation(res.data.annotation ?? null)
        setSessionId(res.data.sessionId ?? null)
        return
      }

      // ② 服务端不可用/明确失败 → 本地兜底（行为等价，仅无权威 sessionId）
      const { bz, ann } = await computeLocal(data)
      setResult(bz)
      setAnnotation(ann)
      setSessionId(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '计算失败，请检查输入。')
      setResult(null)
      setAnnotation(null)
      setSessionId(null)
    } finally {
      setLoading(false)
    }
  }, [computeLocal])

  /** 载入一份历史命盘（服务端权威快照，仅限本人） */
  const loadChart = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await userApi.get<{ id: string; chart: BaZiResult; annotation: AnnotationResult }>(
        `/api/v1/app/user/charts/${encodeURIComponent(id)}`,
      )
      if (res.success && res.data?.chart) {
        setResult(res.data.chart)
        setAnnotation(res.data.annotation ?? null)
        setSessionId(res.data.id)
      } else {
        setError(res.error?.message || '命盘载入失败')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  /** 清空当前命盘（身份切换时调用，避免把他人命盘留在屏幕上） */
  const reset = useCallback(() => {
    setResult(null)
    setAnnotation(null)
    setSessionId(null)
    setError(null)
  }, [])

  return { result, annotation, sessionId, loading, error, handleCalculate, loadChart, reset }
}
