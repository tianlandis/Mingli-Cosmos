// ============================================================
// Phase 5 P5-2 — 轻量指标注册表（ADR-007 可观测性基线）
// 文件：src/server/lib/metrics.ts
// 职责：进程内计数器 + 直方图，Prometheus 文本暴露（零依赖）
//
// 设计取舍（为什么不用 prom-client / OpenTelemetry）：
//   - 当前是**单实例**部署（ADR-001），跨进程聚合无意义；
//   - 目标是「先结构化，再上指标后端」——先把口径定死，
//     将来换成 Prometheus 客户端或 OTLP 导出时**只替换本文件**。
//   - 内存占用有界：标签维度由**代码写死**的枚举决定，不接受任意用户输入。
// ============================================================

/** 请求维度（ADR-007 §2：按 admin / app 分维度观测，判断是否需要拆服务） */
export type MetricScope = 'admin' | 'app' | 'core' | 'other'

/** 直方图分桶（毫秒）—— 覆盖 P95 < 8s 的 SLO 观测区间 */
export const LATENCY_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 8000, 15000]

interface CounterSeries {
  help: string
  /** 标签键（已序列化）→ 累计值 */
  values: Map<string, number>
}

interface HistogramSeries {
  help: string
  buckets: number[]
  /** 标签键（已序列化）→ 分桶累计 + sum + count */
  values: Map<string, { counts: number[]; sum: number; count: number }>
}

const counters = new Map<string, CounterSeries>()
const histograms = new Map<string, HistogramSeries>()

/** 序列化标签：`{a="1",b="2"}`（按 key 排序保证稳定） */
function serializeLabels(labels: Record<string, string | number>): string {
  const keys = Object.keys(labels).sort()
  if (keys.length === 0) return ''
  return `{${keys.map(k => `${k}="${escapeLabel(String(labels[k]))}"`).join(',')}}`
}

function escapeLabel(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
}

/** 计数器 +value（默认 1） */
export function incCounter(
  name: string,
  labels: Record<string, string | number> = {},
  value = 1,
  help = '',
): void {
  let series = counters.get(name)
  if (!series) {
    series = { help: help || name, values: new Map() }
    counters.set(name, series)
  }
  const key = serializeLabels(labels)
  series.values.set(key, (series.values.get(key) ?? 0) + value)
}

/** 直方图观测一次（毫秒） */
export function observeHistogram(
  name: string,
  valueMs: number,
  labels: Record<string, string | number> = {},
  help = '',
): void {
  let series = histograms.get(name)
  if (!series) {
    series = { help: help || name, buckets: LATENCY_BUCKETS_MS, values: new Map() }
    histograms.set(name, series)
  }
  const key = serializeLabels(labels)
  let bucket = series.values.get(key)
  if (!bucket) {
    bucket = { counts: new Array(series.buckets.length + 1).fill(0), sum: 0, count: 0 }
    series.values.set(key, bucket)
  }
  // 累计分桶：找到第一个 >= valueMs 的桶
  let idx = series.buckets.findIndex(b => valueMs <= b)
  if (idx === -1) idx = series.buckets.length // +Inf
  for (let i = idx; i < bucket.counts.length; i++) bucket.counts[i]++
  bucket.sum += valueMs
  bucket.count++
}

/** 渲染为 Prometheus 文本 exposition 格式 */
export function renderPrometheus(): string {
  const lines: string[] = []

  for (const [name, series] of counters) {
    lines.push(`# HELP ${name} ${series.help}`)
    lines.push(`# TYPE ${name} counter`)
    for (const [labels, value] of series.values) {
      lines.push(`${name}${labels} ${value}`)
    }
  }

  for (const [name, series] of histograms) {
    lines.push(`# HELP ${name} ${series.help}`)
    lines.push(`# TYPE ${name} histogram`)
    for (const [labels, bucket] of series.values) {
      const base = labels ? labels.slice(0, -1) : '{'
      const sep = labels ? ',' : ''
      series.buckets.forEach((le, i) => {
        const leLabels = labels
          ? `${base}${sep}le="${le}"}`
          : `{le="${le}"}`
        lines.push(`${name}_bucket${leLabels} ${bucket.counts[i]}`)
      })
      const infLabels = labels ? `${base}${sep}le="+Inf"}` : '{le="+Inf"}'
      lines.push(`${name}_bucket${infLabels} ${bucket.count}`)
      lines.push(`${name}_sum${labels || '{}'} ${bucket.sum}`)
      lines.push(`${name}_count${labels || '{}'} ${bucket.count}`)
    }
  }

  return lines.join('\n') + (lines.length ? '\n' : '')
}

/** 结构化快照（供 /api/health/deep 或测试断言） */
export function metricsSnapshot(): {
  counters: Record<string, Record<string, number>>
  histograms: Record<string, Array<{ labels: string; count: number; sum: number; avg: number; p95: number }>>
} {
  const c: Record<string, Record<string, number>> = {}
  for (const [name, series] of counters) {
    c[name] = Object.fromEntries(series.values)
  }

  const h: Record<string, Array<{ labels: string; count: number; sum: number; avg: number; p95: number }>> = {}
  for (const [name, series] of histograms) {
    h[name] = [...series.values].map(([labels, b]) => {
      // 由累计分桶近似 P95（取桶上界）
      let p95 = series.buckets[series.buckets.length - 1]
      const target = b.count * 0.95
      for (let i = 0; i < series.buckets.length; i++) {
        if (b.counts[i] >= target) { p95 = series.buckets[i]; break }
      }
      return {
        labels,
        count: b.count,
        sum: b.sum,
        avg: b.count ? Math.round((b.sum / b.count) * 100) / 100 : 0,
        p95,
      }
    })
  }
  return { counters: c, histograms: h }
}

/** 清空（仅供测试隔离） */
export function resetMetrics(): void {
  counters.clear()
  histograms.clear()
}
