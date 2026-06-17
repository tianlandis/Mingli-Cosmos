import { useState, useEffect } from 'react'

interface HourOption { label: string; hour: number }

/** 时辰选项：0→24 时间顺序，共13个时辰 */
const HOUR_OPTIONS: HourOption[] = [
  { label: '早子 0-1', hour: 0 },
  { label: '丑 1-3', hour: 1 },
  { label: '寅 3-5', hour: 3 },
  { label: '卯 5-7', hour: 5 },
  { label: '辰 7-9', hour: 7 },
  { label: '巳 9-11', hour: 9 },
  { label: '午 11-13', hour: 11 },
  { label: '未 13-15', hour: 13 },
  { label: '申 15-17', hour: 15 },
  { label: '酉 17-19', hour: 17 },
  { label: '戌 19-21', hour: 19 },
  { label: '亥 21-23', hour: 21 },
  { label: '晚子 23-24', hour: 23 },
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
      const { Lunar } = await import('lunar-typescript')
      const lunar = Lunar.fromYmd(lunarYear, 1, 1)
      const lm = (lunar as unknown as Record<string, () => number>)['getLeapMonth']?.() ?? 0
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

  const selectCls = 'bg-white border border-[#D8D2C8] rounded-sm px-2 py-1.5 text-xs text-[#1C1914] hover:border-[#C4B8A8] focus:border-[#B83A2E] focus:outline-none cursor-pointer'
  const toggleBase = 'px-3 py-1.5 text-xs transition-colors cursor-pointer'

  return (
    <form onSubmit={handleSubmit}>
      {/* 工具栏第一行：历法 · 性别 · 日期 · 排盘 */}
      <div className="flex flex-wrap items-end gap-2">
        {/* 公历/农历 */}
        <div className="flex rounded-sm overflow-hidden border border-[#D8D2C8]">
          {(['solar', 'lunar'] as const).map(ct => (
            <button
              key={ct}
              type="button"
              onClick={() => { setCalendarType(ct); setIsLeapMonth(false) }}
              className={`${toggleBase} ${
                calendarType === ct
                  ? 'bg-[#1C1914] text-[#FBF7F0]'
                  : 'bg-white text-[#6B6459] hover:bg-[#F5F2EB]'
              }`}
            >
              {ct === 'solar' ? '公历' : '农历'}
            </button>
          ))}
        </div>

        {/* 性别 */}
        <div className="flex rounded-sm overflow-hidden border border-[#D8D2C8]">
          {(['男', '女'] as const).map(g => (
            <button
              key={g}
              type="button"
              onClick={() => setGender(g)}
              className={`${toggleBase} ${
                gender === g
                  ? 'bg-[#1C1914] text-[#FBF7F0]'
                  : 'bg-white text-[#6B6459] hover:bg-[#F5F2EB]'
              }`}
            >
              {g === '男' ? '♂' : '♀'}
            </button>
          ))}
        </div>

        {/* 年 */}
        <select
          value={year}
          onChange={e => handleYearChange(Number(e.target.value))}
          className={`${selectCls} w-[72px]`}
        >
          {Array.from({ length: 100 }, (_, i) => now.getFullYear() - i).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        {/* 月 */}
        <select
          value={month}
          onChange={e => handleMonthChange(Number(e.target.value))}
          className={`${selectCls} ${calendarType === 'solar' ? 'w-[56px]' : 'w-[64px]'}`}
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

        {/* 日 */}
        <select
          value={day}
          onChange={e => setDay(Number(e.target.value))}
          className={`${selectCls} w-[56px]`}
        >
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        {/* 闰月勾选 */}
        {calendarType === 'lunar' && leapMonth > 0 && month === leapMonth && (
          <label className="flex items-center gap-1.5 text-xs text-[#6B6459] cursor-pointer">
            <input
              type="checkbox"
              checked={isLeapMonth}
              onChange={e => setIsLeapMonth(e.target.checked)}
              className="accent-[#B83A2E] w-3.5 h-3.5 cursor-pointer"
            />
            闰
          </label>
        )}

        {/* 排盘按钮 — 朱砂红 */}
        <button
          type="submit"
          className="px-6 py-1.5 bg-[#B83A2E] text-white text-xs font-medium tracking-[0.1em] hover:bg-[#9B2C22] transition-colors rounded-sm cursor-pointer"
        >
          排 盘
        </button>
      </div>

      {/* 工具栏第二行：时辰选择 */}
      <div className="mt-2 flex flex-wrap gap-1">
        {HOUR_OPTIONS.map(opt => (
          <button
            key={opt.hour}
            type="button"
            onClick={() => setSelectedHour(opt.hour)}
            className={`px-2 py-1 text-xs rounded-sm transition-colors cursor-pointer ${
              selectedHour === opt.hour
                ? 'bg-[#B83A2E] text-white'
                : 'bg-white border border-[#D8D2C8] text-[#6B6459] hover:border-[#C4B8A8]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </form>
  )
}
