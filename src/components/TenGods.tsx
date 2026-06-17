import type { ShiShenItem } from '../engine/types'

interface Props {
  tenGods: ShiShenItem[]
}

const SHISHEN_COLORS: Record<string, string> = {
  '正官': '#3D5A80', '偏官': '#5A7BA0',
  '正印': '#4A7C3F', '偏印': '#6B9A5E',
  '比肩': '#B8973E', '劫财': '#C4A458',
  '食神': '#7B4A8F', '伤官': '#9B6AAF',
  '正财': '#B83A2E', '偏财': '#D4685A',
}

export default function TenGods({ tenGods }: Props) {
  return (
    <div>
      <h3 className="chapter-title">十神分析</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#D8D2C8]">
              <th className="text-left text-[#B0A898] font-medium text-xs py-2 px-3 tracking-wider">位置</th>
              <th className="text-left text-[#B0A898] font-medium text-xs py-2 px-3 tracking-wider">干支</th>
              <th className="text-left text-[#B0A898] font-medium text-xs py-2 px-3 tracking-wider">十神</th>
            </tr>
          </thead>
          <tbody>
            {tenGods.map((item, i) => (
              <tr key={i} className="border-b border-[#E8E3D9] last:border-0 hover:bg-[#F5F2EB] transition-colors">
                <td className="py-2 px-3 text-[#B0A898] text-xs">{item.position}</td>
                <td className="py-2 px-3 text-[#1C1914] font-medium">{item.ganZhi}</td>
                <td
                  className="py-2 px-3 font-bold text-sm"
                  style={{ color: SHISHEN_COLORS[item.shiShen] ?? '#6B6459' }}
                >
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
