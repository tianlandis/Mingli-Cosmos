import type { ShiShenItem } from '../engine/types'

interface Props {
  tenGods: ShiShenItem[]
}

// 十神色 —— 值指向设计 token（src/index.css 的 --shishen-*）。
// 正/偏成对：正 = 主色，偏 = 浅一档。改动色板请改 token，勿在此写裸值。
const SHISHEN_COLORS: Record<string, string> = {
  '正官': 'var(--shishen-guan-zheng)', '偏官': 'var(--shishen-guan-pian)',
  '正印': 'var(--shishen-yin-zheng)', '偏印': 'var(--shishen-yin-pian)',
  '比肩': 'var(--shishen-bi-zheng)', '劫财': 'var(--shishen-bi-pian)',
  '食神': 'var(--shishen-shi-zheng)', '伤官': 'var(--shishen-shi-pian)',
  '正财': 'var(--shishen-cai-zheng)', '偏财': 'var(--shishen-cai-pian)',
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
