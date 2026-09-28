import { useState, useEffect } from 'react'

interface HourOption { label: string; hour: number; range: string }

/** 时辰选项：0→24 时间顺序，共13个时辰 */
const HOUR_OPTIONS: HourOption[] = [
  { label: '早子', hour: 0, range: '00:00–01:00' },
  { label: '丑', hour: 1, range: '01:00–03:00' },
  { label: '寅', hour: 3, range: '03:00–05:00' },
  { label: '卯', hour: 5, range: '05:00–07:00' },
  { label: '辰', hour: 7, range: '07:00–09:00' },
  { label: '巳', hour: 9, range: '09:00–11:00' },
  { label: '午', hour: 11, range: '11:00–13:00' },
  { label: '未', hour: 13, range: '13:00–15:00' },
  { label: '申', hour: 15, range: '15:00–17:00' },
  { label: '酉', hour: 17, range: '17:00–19:00' },
  { label: '戌', hour: 19, range: '19:00–21:00' },
  { label: '亥', hour: 21, range: '21:00–23:00' },
  { label: '晚子', hour: 23, range: '23:00–24:00' },
]

const LUNAR_MONTH_NAMES = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月']

interface Props {
  onCalculate: (data: {
    year: number; month: number; day: number
    hour: number; minute: number; gender: '男' | '女'
    calendarType: 'solar' | 'lunar'
    isLeapMonth?: boolean
  }) => void
}

/* ── 样式常量：卡内统一栅格，控件等宽对齐 ──
 * 移动端（无 sm 前缀）一律取更大的触摸目标（≈40–44px 高），桌面端收紧回原值。 */
const labelCls = 'block text-xs sm:text-[11px] text-[#8A8172] tracking-[0.15em] mb-1.5'
const segmentWrap = 'grid grid-cols-2 rounded-sm overflow-hidden border border-[#D8D2C8]'
const segmentBase = 'w-full py-2.5 sm:py-2 text-xs text-center transition-colors cursor-pointer'
const selectCls = 'w-full bg-white border border-[#D8D2C8] rounded-sm px-2 py-2.5 sm:py-2 text-xs text-[#1C1914] hover:border-[#C4B8A8] focus:border-[#B83A2E] focus:outline-none cursor-pointer'

export default function BirthForm({ onCalculate }: Props) {
  const now = new Date()
  const [calendarType, setCalendarType] = useState<'solar' | 'lunar'>('solar')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [day, setDay] = useState(now.getDate())
  const [selectedHour, setSelectedHour] = useState(11)
  const [gender, setGender] = useState<'男' | '女'>('男')
  const [isLeapMonth, setIsLeapMonth] = useState(false)
  const [leapMonth, setLeapMonth] = useState(0)

  useEffect(() => {
    if (calendarType === 'lunar') {
      checkLeapMonth(year)
    }
  }, [year, calendarType])

  const checkLeapMonth = async (lunarYear: number) => {
    try {
      const { LunarYear } = await import('lunar-typescript')
      const y = LunarYear.fromYear(lunarYear)
      const lm = y.getLeapMonth()
      setLeapMonth(lm)
      if (lm === 0 || month !== lm) {
        setIsLeapMonth(false)
      }
    } catch {
      setLeapMonth(0)
      setIsLeapMonth(false)
    }
  }

  const handleYearChange = (value: number) => {
    const maxDay = calendarType === 'solar'
      ? new Date(value, month, 0).getDate()
      : 30
    setYear(value)
    if (day > maxDay) setDay(maxDay)
  }

  const handleMonthChange = (value: number) => {
    const maxDay = calendarType === 'solar'
      ? new Date(year, value, 0).getDate()
      : 30
    setMonth(value)
    if (day > maxDay) setDay(maxDay)
    if (value !== leapMonth) setIsLeapMonth(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onCalculate({
      year, month, day, hour: selectedHour, minute: 0, gender,
      calendarType,
      isLeapMonth: calendarType === 'lunar' ? isLeapMonth : undefined,
    })
  }

  const daysInMonth = calendarType === 'solar'
    ? new Date(year, month, 0).getDate()
    : 30

  const activeHour = HOUR_OPTIONS.find(o => o.hour === selectedHour) ?? HOUR_OPTIONS[6]

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-md border border-[#E4DED3] bg-white shadow-[0_1px_3px_rgba(28,25,20,0.05)] p-4 sm:p-5"
    >
      {/* 卡头：区域标题 + 当前时辰回显 */}
      <div className="flex items-baseline justify-between mb-4">
        <h2
          className="text-sm font-semibold tracking-[0.25em] text-[#1C1914]"
          style={{ fontFamily: '"Noto Serif SC", serif' }}
        >
          生辰录入
        </h2>
        <span className="text-[11px] text-[#B0A898] tracking-wider tabular-nums">
          {activeHour.label}时 · {activeHour.range}
        </span>
      </div>

      {/* 第 1 行：历法 / 性别 —— 两列等宽 */}
      <div className="grid grid-cols-2 gap-3 sm:gap-5">
        <div>
          <span className={labelCls}>历法</span>
          <div className={segmentWrap}>
            {(['solar', 'lunar'] as const).map(ct => (
              <button
                key={ct}
                type="button"
                aria-pressed={calendarType === ct}
                onClick={() => { setCalendarType(ct); setIsLeapMonth(false) }}
                className={`${segmentBase} ${
                  calendarType === ct
                    ? 'bg-[#1C1914] text-[#FBF7F0]'
                    : 'bg-white text-[#6B6459] hover:bg-[#F5F2EB]'
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
                aria-pressed={gender === g}
                onClick={() => setGender(g)}
                className={`${segmentBase} ${
                  gender === g
                    ? 'bg-[#1C1914] text-[#FBF7F0]'
                    : 'bg-white text-[#6B6459] hover:bg-[#F5F2EB]'
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
            onChange={e => handleMonthChange(Number(e.target.value))}
            aria-label="出生月份"
            className={selectCls}
          >
            {calendarType === 'solar'
              ? Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))
              : Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{LUNAR_MONTH_NAMES[m - 1]}</option>
                ))
            }
          </select>
        </div>
        <div>
          <span className={labelCls}>日</span>
          <select
            value={day}
            onChange={e => setDay(Number(e.target.value))}
            aria-label="出生日期"
            className={selectCls}
          >
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 闰月勾选 —— 仅农历且该月为闰月时出现 */}
      {calendarType === 'lunar' && leapMonth > 0 && month === leapMonth && (
        <label className="mt-2 inline-flex items-center gap-2 py-1 text-xs text-[#6B6459] cursor-pointer">
          <input
            type="checkbox"
            checked={isLeapMonth}
            onChange={e => setIsLeapMonth(e.target.checked)}
            className="accent-[#B83A2E] size-4 sm:size-3.5 cursor-pointer"
          />
          本月为闰月
        </label>
      )}

      {/* 第 3 行：出生时辰 —— 等宽网格（手机 7 列 / 桌面 13 列一行） */}
      <div className="mt-4">
        <span className={labelCls}>出生时辰</span>
        <div className="grid grid-cols-7 sm:grid-cols-[repeat(13,minmax(0,1fr))] gap-1.5">
          {HOUR_OPTIONS.map(opt => (
            <button
              key={opt.hour}
              type="button"
              aria-pressed={selectedHour === opt.hour}
              aria-label={`${opt.label}时 ${opt.range}`}
              onClick={() => setSelectedHour(opt.hour)}
              title={`${opt.label}时 ${opt.range}`}
              className={`w-full py-2.5 sm:py-1.5 text-xs sm:text-[11px] text-center rounded-sm transition-colors cursor-pointer ${
                selectedHour === opt.hour
                  ? 'bg-[#B83A2E] text-white'
                  : 'bg-white border border-[#D8D2C8] text-[#6B6459] hover:border-[#C4B8A8]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 排盘 CTA —— 整宽按钮，明确的主动作 */}
      <button
        type="submit"
        className="mt-5 w-full py-3 sm:py-2.5 bg-[#B83A2E] text-white text-sm font-medium tracking-[0.3em] rounded-sm hover:bg-[#9B2C22] transition-colors cursor-pointer"
      >
        开始排盘
      </button>
    </form>
  )
}
