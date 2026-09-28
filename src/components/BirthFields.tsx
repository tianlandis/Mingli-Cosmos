// ============================================================
// 生辰字段（受控组件 · 三处复用的唯一来源）
// 文件：src/components/BirthFields.tsx
//
// 复用方：
//   ① BirthForm       —— 排盘页录入
//   ② AuthDialog      —— 注册时采集生辰（compact）
//   ③ MyPage 生辰档案 —— 新增档案（compact）
//
// 抽出来的原因：历法切换、闰月查表、月份天数裁剪这些逻辑若各写一份，
// 迟早漂移成「排盘页能选 2 月 30 日、注册页不能」这类不一致。
// 本组件只负责字段与交互，不管提交（提交由调用方决定）。
// ============================================================

import { useState } from 'react'
import { HOUR_OPTIONS, daysInMonth, type BirthValue } from '../lib/birth'

const LUNAR_MONTH_NAMES = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月']

/* ── 样式常量：卡内统一栅格，控件等宽对齐 ──
 * 移动端（无 sm 前缀）一律取更大的触摸目标（≈40–44px 高），桌面端收紧回原值。 */
const labelCls = 'block text-xs sm:text-[11px] text-fg-secondary tracking-[0.15em] mb-1.5'
const segmentWrap = 'grid grid-cols-2 rounded-sm overflow-hidden border border-line-strong'
const segmentBase = 'w-full py-2.5 sm:py-2 text-xs text-center transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60'
const selectCls = 'w-full bg-surface-raised border border-line-strong rounded-sm px-2 py-2.5 sm:py-2 text-xs text-fg-primary hover:border-neutral-300 focus:border-brand focus:outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-60'

interface Props {
  value: BirthValue
  /** 字段增量更新（可一次传多个字段，如切年时同时裁剪日） */
  onChange: (patch: Partial<BirthValue>) => void
  disabled?: boolean
  /** 紧凑模式：窄容器（弹窗/内联表单）下时辰固定 7 列，避免 13 列挤成一条 */
  compact?: boolean
  /** 是否在字段组顶部显示当前时辰回显（排盘页把回显放在自己的卡头，故传 false） */
  showHourEcho?: boolean
}

export default function BirthFields({
  value, onChange, disabled = false, compact = false, showHourEcho = true,
}: Props) {
  const now = new Date()
  const [leapMonth, setLeapMonth] = useState(0)

  const { calendarType, year, month, day, hour, gender, isLeapMonth } = value

  /** 农历闰月查表：仅在切换到农历 / 变更年份时按需执行（事件驱动，不占 effect） */
  const syncLeapMonth = async (lunarYear: number) => {
    try {
      const { LunarYear } = await import('lunar-typescript')
      const lm = LunarYear.fromYear(lunarYear).getLeapMonth()
      setLeapMonth(lm)
      if (lm === 0 || month !== lm) onChange({ isLeapMonth: false })
    } catch {
      setLeapMonth(0)
      onChange({ isLeapMonth: false })
    }
  }

  const handleYearChange = (nextYear: number) => {
    const maxDay = daysInMonth(calendarType, nextYear, month)
    onChange({
      year: nextYear,
      ...(day > maxDay ? { day: maxDay } : {}),
    })
    if (calendarType === 'lunar') void syncLeapMonth(nextYear)
  }

  const handleMonthChange = (nextMonth: number) => {
    const maxDay = daysInMonth(calendarType, year, nextMonth)
    onChange({
      month: nextMonth,
      ...(day > maxDay ? { day: maxDay } : {}),
      ...(nextMonth !== leapMonth ? { isLeapMonth: false } : {}),
    })
  }

  const days = daysInMonth(calendarType, year, month)
  const activeHour = HOUR_OPTIONS.find(o => o.hour === hour) ?? HOUR_OPTIONS[6]

  const hourGridCls = compact
    ? 'grid grid-cols-7 gap-1.5'
    : 'grid grid-cols-7 sm:grid-cols-[repeat(13,minmax(0,1fr))] gap-1.5'

  return (
    <div>
      {/* 当前时辰回显 */}
      {showHourEcho && (
        <div className="flex justify-end mb-2">
          <span className="text-[11px] text-fg-tertiary tracking-wider tabular-nums">
            {activeHour.label}时 · {activeHour.range}
          </span>
        </div>
      )}

      {/* 第 1 行：历法 / 性别 —— 两列等宽 */}
      <div className="grid grid-cols-2 gap-3 sm:gap-5">
        <div>
          <span className={labelCls}>历法</span>
          <div className={segmentWrap}>
            {(['solar', 'lunar'] as const).map(ct => (
              <button
                key={ct}
                type="button"
                disabled={disabled}
                aria-pressed={calendarType === ct}
                onClick={() => {
                  onChange({ calendarType: ct, isLeapMonth: false })
                  if (ct === 'lunar') void syncLeapMonth(year)
                }}
                className={`${segmentBase} ${
                  calendarType === ct
                    ? 'bg-fg-primary text-surface-page'
                    : 'bg-white text-fg-secondary hover:bg-surface-muted'
                }`}
              >
                {ct === 'solar' ? '公历' : '农历'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className={labelCls}>性别</span>
          <div className={segmentWrap}>
            {(['男', '女'] as const).map(g => (
              <button
                key={g}
                type="button"
                disabled={disabled}
                aria-pressed={gender === g}
                onClick={() => onChange({ gender: g })}
                className={`${segmentBase} ${
                  gender === g
                    ? 'bg-fg-primary text-surface-page'
                    : 'bg-white text-fg-secondary hover:bg-surface-muted'
                }`}
              >
                {g === '男' ? '乾 · 男' : '坤 · 女'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 第 2 行：出生日期 —— 三列等宽 */}
      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        <div>
          <span className={labelCls}>年</span>
          <select
            value={year}
            disabled={disabled}
            onChange={e => handleYearChange(Number(e.target.value))}
            aria-label="出生年份"
            className={selectCls}
          >
            {Array.from({ length: 100 }, (_, i) => now.getFullYear() - i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <span className={labelCls}>月</span>
          <select
            value={month}
            disabled={disabled}
            onChange={e => handleMonthChange(Number(e.target.value))}
            aria-label="出生月份"
            className={selectCls}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>
                {calendarType === 'solar' ? m : LUNAR_MONTH_NAMES[m - 1]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className={labelCls}>日</span>
          <select
            value={day}
            disabled={disabled}
            onChange={e => onChange({ day: Number(e.target.value) })}
            aria-label="出生日期"
            className={selectCls}
          >
            {Array.from({ length: days }, (_, i) => i + 1).map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 闰月勾选 —— 仅农历且该月为闰月时出现 */}
      {calendarType === 'lunar' && leapMonth > 0 && month === leapMonth && (
        <label className="mt-2 inline-flex items-center gap-2 py-1 text-xs text-fg-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={isLeapMonth}
            disabled={disabled}
            onChange={e => onChange({ isLeapMonth: e.target.checked })}
            className="accent-brand size-4 sm:size-3.5 cursor-pointer"
          />
          本月为闰月
        </label>
      )}

      {/* 第 3 行：出生时辰 —— 等宽网格（手机 7 列 / 桌面 13 列一行） */}
      <div className="mt-4">
        <span className={labelCls}>出生时辰</span>
        <div className={hourGridCls}>
          {HOUR_OPTIONS.map(opt => (
            <button
              key={opt.hour}
              type="button"
              disabled={disabled}
              aria-pressed={hour === opt.hour}
              aria-label={`${opt.label}时 ${opt.range}`}
              onClick={() => onChange({ hour: opt.hour })}
              title={`${opt.label}时 ${opt.range}`}
              className={`w-full py-2.5 sm:py-1.5 text-xs sm:text-[11px] text-center rounded-sm transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                hour === opt.hour
                  ? 'bg-brand text-white'
                  : 'bg-white border border-line-strong text-fg-secondary hover:border-neutral-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
