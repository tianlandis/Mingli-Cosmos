import { useState, useEffect } from 'react'

const HOUR_OPTIONS = [
  ['子时 23-01', '丑时 01-03', '寅时 03-05', '卯时 05-07'],
  ['辰时 07-09', '巳时 09-11', '午时 11-13', '未时 13-15'],
  ['申时 15-17', '酉时 17-19', '戌时 19-21', '亥时 21-23'],
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
  const [hourIndex, setHourIndex] = useState(6) // 午时
  const [gender, setGender] = useState<'男' | '女'>('男')
  const [isLeapMonth, setIsLeapMonth] = useState(false)
  const [leapMonth, setLeapMonth] = useState(0) // 0=无闰月, >0=闰几月

  // 检测选中农历年是否有闰月
  useEffect(() => {
    if (calendarType === 'lunar') {
      checkLeapMonth(year)
    }
  }, [year, calendarType])

  const checkLeapMonth = async (lunarYear: number) => {
    try {
      const { Lunar } = await import('lunar-typescript')
      const lunar = Lunar.fromYmd(lunarYear, 1, 1)
      // lunar-typescript: getLeapMonth() 返回闰月数字，0 表示无闰月
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

  // 公历模式下：根据年/月动态计算当月天数
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
    // 切换月份时重置闰月勾选
    if (value !== leapMonth) setIsLeapMonth(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const actualHour = hourIndex === 0 ? 23 : hourIndex * 2 - 1
    onCalculate({
      year, month, day, hour: actualHour, minute: 0, gender,
      calendarType,
      isLeapMonth: calendarType === 'lunar' ? isLeapMonth : undefined,
    })
  }

  const daysInMonth = calendarType === 'solar'
    ? new Date(year, month, 0).getDate()
    : 30 // 农历月最多30天

  return (
    <form onSubmit={handleSubmit} className="bg-stone-900/80 backdrop-blur rounded-2xl border border-amber-700/30 p-6 shadow-xl">
      <h2 className="text-lg font-bold text-amber-400 mb-4 border-b border-amber-700/20 pb-2">
        出生信息
      </h2>

      {/* 公历/农历切换 */}
      <div className="mb-4">
        <label className="text-stone-300 text-sm mb-1 block">历法类型</label>
        <div className="flex gap-2">
          {(['solar', 'lunar'] as const).map(ct => (
            <button
              key={ct}
              type="button"
              onClick={() => {
                setCalendarType(ct)
                setIsLeapMonth(false)
              }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                calendarType === ct
                  ? 'bg-amber-700 text-amber-100'
                  : 'bg-stone-800 text-stone-400 hover:bg-stone-700'
              }`}
            >
              {ct === 'solar' ? '☀ 公历' : '🌙 农历'}
            </button>
          ))}
        </div>
      </div>

      {/* 性别 */}
      <div className="mb-4">
        <label className="text-stone-300 text-sm mb-1 block">性别</label>
        <div className="flex gap-2">
          {(['男', '女'] as const).map(g => (
            <button
              key={g}
              type="button"
              onClick={() => setGender(g)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                gender === g
                  ? 'bg-amber-700 text-amber-100'
                  : 'bg-stone-800 text-stone-400 hover:bg-stone-700'
              }`}
            >
              {g === '男' ? '♂ 男' : '♀ 女'}
            </button>
          ))}
        </div>
      </div>

      {/* 日期 */}
      <div className="mb-4">
        <label className="text-stone-300 text-sm mb-1 block">
          出生日期（{calendarType === 'solar' ? '公历' : '农历'}）
        </label>
        <div className="flex gap-2">
          <select
            value={year}
            onChange={e => handleYearChange(Number(e.target.value))}
            className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm focus:border-amber-600 focus:outline-none"
          >
            {Array.from({ length: 100 }, (_, i) => now.getFullYear() - i).map(y => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
          <select
            value={month}
            onChange={e => handleMonthChange(Number(e.target.value))}
            className="w-20 bg-stone-800 border border-stone-700 rounded-lg px-2 py-2 text-stone-200 text-sm focus:border-amber-600 focus:outline-none"
          >
            {calendarType === 'solar'
              ? Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m}月</option>
                ))
              : Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{LUNAR_MONTH_NAMES[m - 1]}</option>
                ))
            }
          </select>
          <select
            value={day}
            onChange={e => setDay(Number(e.target.value))}
            className="w-20 bg-stone-800 border border-stone-700 rounded-lg px-2 py-2 text-stone-200 text-sm focus:border-amber-600 focus:outline-none"
          >
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
              <option key={d} value={d}>{d}日</option>
            ))}
          </select>
        </div>
        {/* 闰月勾选（仅农历模式且当前年份有闰月且选中了闰月对应的月份） */}
        {calendarType === 'lunar' && leapMonth > 0 && month === leapMonth && (
          <label className="flex items-center gap-2 mt-2 text-sm text-stone-400 cursor-pointer">
            <input
              type="checkbox"
              checked={isLeapMonth}
              onChange={e => setIsLeapMonth(e.target.checked)}
              className="accent-amber-600 w-4 h-4 cursor-pointer"
            />
            闰{leapMonth}月
          </label>
        )}
      </div>

      {/* 时辰选择器 */}
      <div className="mb-5">
        <label className="text-stone-300 text-sm mb-1 block">出生时辰</label>
        <div className="grid grid-cols-4 gap-2">
          {HOUR_OPTIONS.flat().map((label, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setHourIndex(idx)}
              className={`py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                hourIndex === idx
                  ? 'bg-amber-700 text-amber-100 ring-1 ring-amber-500'
                  : 'bg-stone-800 text-stone-400 hover:bg-stone-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-700 to-red-800 text-amber-100 font-bold text-base tracking-wider hover:from-amber-600 hover:to-red-700 transition-all shadow-lg cursor-pointer"
      >
        排 盘
      </button>
    </form>
  )
}
