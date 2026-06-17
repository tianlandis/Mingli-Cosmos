import { useCallback, useState } from 'react'
import { calculateBazi, calculateBaziFromLunar, type BaZiResult } from '../engine'
import { generateAnnotation, type AnnotationResult } from '../engine/annotation'

export function useBazi() {
  const [result, setResult] = useState<BaZiResult | null>(null)
  const [annotation, setAnnotation] = useState<AnnotationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCalculate = useCallback(async (data: {
    year: number
    month: number
    day: number
    hour: number
    minute: number
    gender: '男' | '女'
    calendarType: 'solar' | 'lunar'
    isLeapMonth?: boolean
  }) => {
    setLoading(true)
    setError(null)

    try {
      const bz = data.calendarType === 'lunar'
        ? await calculateBaziFromLunar(
            data.year,
            data.month,
            data.day,
            data.hour,
            data.minute,
            data.gender,
            data.isLeapMonth ?? false,
          )
        : await calculateBazi(
            data.year,
            data.month,
            data.day,
            data.hour,
            data.minute,
            data.gender,
          )
      setResult(bz)

      // 同步生成批注
      try {
        const ann = generateAnnotation(bz)
        setAnnotation(ann)
      } catch {
        setAnnotation(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '计算失败，请检查输入。')
      setResult(null)
      setAnnotation(null)
    } finally {
      setLoading(false)
    }
  }, [])

  return { result, annotation, loading, error, handleCalculate }
}
