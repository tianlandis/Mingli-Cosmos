import type { ShiShenItem } from '../engine/types'

interface Props {
  tenGods: ShiShenItem[]
}

const SHISHEN_COLORS: Record<string, string> = {
  '正官': 'text-blue-400', '偏官': 'text-blue-300',
  '正印': 'text-green-400', '偏印': 'text-green-300',
  '比肩': 'text-amber-400', '劫财': 'text-amber-300',
  '食神': 'text-purple-400', '伤官': 'text-purple-300',
  '正财': 'text-pink-400', '偏财': 'text-pink-300',
}

export default function TenGods({ tenGods }: Props) {
  return (
    <div className="bg-stone-900/80 backdrop-blur rounded-2xl border border-amber-700/30 p-6 shadow-xl">
      <h2 className="text-lg font-bold text-amber-400 mb-4 border-b border-amber-700/20 pb-2">十神分析</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-700">
              <th className="text-left text-stone-400 font-medium py-2 px-3">位置</th>
              <th className="text-left text-stone-400 font-medium py-2 px-3">干支</th>
              <th className="text-left text-stone-400 font-medium py-2 px-3">十神</th>
            </tr>
          </thead>
          <tbody>
            {tenGods.map((item, i) => (
              <tr key={i} className="border-b border-stone-800 last:border-0 hover:bg-stone-800/30">
                <td className="py-2 px-3 text-stone-500 text-xs">{item.position}</td>
                <td className="py-2 px-3 text-stone-200 font-medium">{item.ganZhi}</td>
                <td className={`py-2 px-3 font-bold ${SHISHEN_COLORS[item.shiShen] ?? 'text-stone-300'}`}>
                  {item.shiShen}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
