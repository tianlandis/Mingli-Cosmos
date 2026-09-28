import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import BirthFields from './BirthFields'
import { HOUR_OPTIONS, createDefaultBirthValue, type BirthValue } from '../lib/birth'

interface Props {
  onCalculate: (data: {
    year: number; month: number; day: number
    hour: number; minute: number; gender: '男' | '女'
    calendarType: 'solar' | 'lunar'
    isLeapMonth?: boolean
  }) => void
  /** 排盘进行中：锁定控件并给出明确反馈，避免重复提交 */
  loading?: boolean
}

export default function BirthForm({ onCalculate, loading = false }: Props) {
  // 字段状态与交互逻辑统一由 BirthFields 承担（注册弹窗 / 生辰档案复用同一份）
  const [value, setValue] = useState<BirthValue>(createDefaultBirthValue)

  const patch = (p: Partial<BirthValue>) => setValue(v => ({ ...v, ...p }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    onCalculate({
      year: value.year,
      month: value.month,
      day: value.day,
      hour: value.hour,
      minute: value.minute,
      gender: value.gender,
      calendarType: value.calendarType,
      isLeapMonth: value.calendarType === 'lunar' ? value.isLeapMonth : undefined,
    })
  }

  const activeHour = HOUR_OPTIONS.find(o => o.hour === value.hour) ?? HOUR_OPTIONS[6]

  return (
    <form
      onSubmit={handleSubmit}
      aria-busy={loading}
      className="rounded-md border border-line-soft bg-white shadow-[0_1px_3px_rgba(28,25,20,0.05)] p-4 sm:p-5"
    >
      {/* 卡头：区域标题 + 当前时辰回显 */}
      <div className="flex items-baseline justify-between mb-4">
        <h2
          className="text-sm font-semibold tracking-[0.25em] text-fg-primary"
          style={{ fontFamily: '"Noto Serif SC", serif' }}
        >
          生辰录入
        </h2>
        <span className="text-[11px] text-fg-tertiary tracking-wider tabular-nums">
          {activeHour.label}时 · {activeHour.range}
        </span>
      </div>

      <BirthFields
        value={value}
        onChange={patch}
        disabled={loading}
        showHourEcho={false}
      />

      {/* 排盘 CTA —— 整宽按钮，明确的主动作；进行中锁定并给出反馈 */}
      <button
        type="submit"
        disabled={loading}
        className="mt-5 w-full py-3 sm:py-2.5 bg-brand text-white text-sm font-medium tracking-[0.3em] rounded-sm hover:bg-brand-strong transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? (
          <span className="inline-flex items-center justify-center gap-2">
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            推演中…
          </span>
        ) : (
          '开始排盘'
        )}
      </button>
    </form>
  )
}
