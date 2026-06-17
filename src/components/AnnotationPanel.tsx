import type { AnnotationResult } from '../engine/annotation'

interface Props {
  annotation: AnnotationResult
}

export default function AnnotationPanel({ annotation }: Props) {
  const { overview, strengthAnalysis, wuXingBalance, shiShenProfile, patternAnalysis, comprehensiveAdvice } = annotation

  const scoreWidth = Math.max(5, Math.min(100, strengthAnalysis.score))
  const scoreColor = scoreWidth > 60 ? '#B83A2E' : scoreWidth > 35 ? '#B8973E' : '#3D5A80'

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div className="text-center mb-2">
        <h2 className="text-lg font-bold text-[#1C1914] tracking-[0.15em]" style={{ fontFamily: '"Noto Serif SC", serif' }}>
          命盘批注
        </h2>
        <p className="text-[#B0A898] text-xs mt-1 tracking-wider">规则引擎 · 结构化解读</p>
      </div>

      {/* ── 命局总览 ── */}
      <div className="ink-card border-[#D4A8A4]">
        <div className="text-[#B83A2E] text-xs font-bold mb-2 tracking-wider">命局总览</div>
        <p className="text-[#1C1914] text-sm leading-relaxed">{overview.summary}</p>
      </div>

      {/* ── 日主强弱 + 格局分析 并排 ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 日主强弱 */}
        <div className="ink-card">
          <div className="text-[#B83A2E] text-xs font-bold mb-3 tracking-wider">日主强弱</div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-lg font-bold" style={{ color: scoreColor }}>
              {strengthAnalysis.strength}
            </span>
            <span className="text-[#B0A898] text-xs">({strengthAnalysis.score}分)</span>
          </div>
          {/* 进度条 */}
          <div className="w-full h-2 bg-[#E8E3D9] rounded-full mb-3 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${scoreWidth}%`, backgroundColor: scoreColor }}
            />
          </div>
          {/* 判断依据 */}
          <ul className="space-y-1">
            {strengthAnalysis.reasons.map((r, i) => (
              <li key={i} className="text-[#6B6459] text-xs flex items-start gap-1.5">
                <span className="text-[#B0A898] shrink-0 mt-0.5">·</span>
                {r}
              </li>
            ))}
          </ul>
        </div>

        {/* 格局分析 */}
        <div className="ink-card">
          <div className="text-[#B83A2E] text-xs font-bold mb-3 tracking-wider">格局分析</div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="ink-tag">{patternAnalysis.patternType}</span>
            <span className="text-[#1C1914] font-bold text-sm" style={{ fontFamily: '"Noto Serif SC", serif' }}>
              {patternAnalysis.patternName}
            </span>
            <span className={`text-xs ${
              patternAnalysis.quality === '上等' ? 'text-[#B83A2E]' :
              patternAnalysis.quality === '中等' ? 'text-[#6B6459]' : 'text-[#B0A898]'
            }`}>
              {patternAnalysis.quality}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded-sm ${
              patternAnalysis.jiXiong === '吉' ? 'bg-[#E8F0E4] text-[#4A7C3F]' :
              patternAnalysis.jiXiong === '凶' ? 'bg-[#F5EDEB] text-[#B83A2E]' :
              'bg-[#EDE8DF] text-[#B0A898]'
            }`}>{patternAnalysis.jiXiong}</span>
          </div>
          {patternAnalysis.combination.name && (
            <div className="text-[#6B6459] text-xs mb-2">
              格局组合：
              <span className="text-[#B83A2E] font-bold">{patternAnalysis.combination.name}</span>
              {patternAnalysis.combination.isPure && <span className="text-[#B0A898] ml-1">（纯格）</span>}
            </div>
          )}
          <div className="text-[#B0A898] text-xs mb-2">{patternAnalysis.method}</div>
          <p className="text-[#6B6459] text-xs leading-relaxed mb-2">{patternAnalysis.description}</p>
          <ul className="space-y-0.5">
            {patternAnalysis.conditions.map((c, i) => (
              <li key={i} className="text-[#B0A898] text-xs flex items-start gap-1.5">
                <span className="text-[#C4B8A8] shrink-0 mt-0.5">◦</span>
                {c}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── 五行平衡 ── */}
      <div className="ink-card">
        <div className="text-[#B83A2E] text-xs font-bold mb-3 tracking-wider">五行平衡</div>
        <div className="space-y-2">
          {wuXingBalance.map((item) => {
            const wxColors: Record<string, string> = {
              '木': '#4A7C3F', '火': '#B83A2E', '土': '#B8973E',
              '金': '#C4A458', '水': '#3D5A80',
            }
            return (
              <div key={item.name} className="flex items-center gap-2">
                <span className="text-xs w-6 shrink-0 font-bold" style={{ color: wxColors[item.name] }}>
                  {item.name}
                </span>
                <div className="flex-1 h-1.5 bg-[#E8E3D9] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.max(5, (item.count / 8) * 100)}%`, backgroundColor: wxColors[item.name] }}
                  />
                </div>
                <span className="text-[#B0A898] text-xs w-4 text-right">{item.count}</span>
                <span className={`text-xs ${
                  item.level === '偏旺' ? 'text-[#B83A2E]' :
                  item.level === '偏弱' ? 'text-[#3D5A80]' : 'text-[#B0A898]'
                }`}>{item.level}</span>
              </div>
            )
          })}
        </div>
        {wuXingBalance.filter(it => it.advice).length > 0 && (
          <div className="mt-3 pt-3 border-t border-[#D8D2C8]">
            {wuXingBalance.filter(it => it.advice).map((it, i) => (
              <p key={i} className="text-[#6B6459] text-xs mb-1">{it.advice}</p>
            ))}
          </div>
        )}
      </div>

      {/* ── 十神概况 ── */}
      <div className="ink-card">
        <div className="text-[#B83A2E] text-xs font-bold mb-3 tracking-wider">十神配置</div>
        <div className="flex flex-wrap gap-2">
          {shiShenProfile.map((item) => (
            <div key={item.name} className="ink-tag flex items-center gap-1.5 px-2 py-1">
              <span className="text-[#1C1914] text-xs font-medium">{item.name}</span>
              <span className="bg-[#B83A2E]/10 text-[#9B2C22] text-xs px-1.5 py-0.5 rounded-full font-bold">{item.count}</span>
              <span className="text-[#B0A898] text-xs">{item.positions.join('、')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── V2.0 MBTI 分析 + 破格风险 并排 ── */}
      {(patternAnalysis.mbti.typicalTypes.length > 0 || patternAnalysis.poGeRisks.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* MBTI 分析 */}
          {patternAnalysis.mbti.typicalTypes.length > 0 && (
            <div className="ink-card border-[#C4B8D8]">
              <div className="text-[#7B4A8F] text-xs font-bold mb-3 tracking-wider">MBTI 人格画像</div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[#5A3068] text-base font-bold">
                  {patternAnalysis.mbti.typicalTypes.join(' / ')}
                </span>
                <span className="text-[#B0A898] text-xs">（{patternAnalysis.mbti.cognitiveFunctions}）</span>
              </div>
              {patternAnalysis.mbti.traits && (
                <p className="text-[#6B6459] text-xs mb-2">{patternAnalysis.mbti.traits}</p>
              )}
              {patternAnalysis.mbti.portrait && (
                <p className="text-[#B0A898] text-xs leading-relaxed mb-2 italic">"{patternAnalysis.mbti.portrait}"</p>
              )}
              {patternAnalysis.mbti.industrySuggestions.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[#D8D2C8]">
                  <div className="text-[#7B4A8F]/70 text-xs font-bold mb-1 tracking-wider">行业适配</div>
                  {patternAnalysis.mbti.industrySuggestions.map((s, i) => (
                    <p key={i} className="text-[#6B6459] text-xs">· {s}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 破格风险 */}
          {patternAnalysis.poGeRisks.length > 0 && (
            <div className="ink-card border-[#D4A8A4]">
              <div className="text-[#B83A2E] text-xs font-bold mb-3 tracking-wider">格局风险</div>
              <div className="space-y-3">
                {patternAnalysis.poGeRisks.map((risk, i) => (
                  <div key={i} className="bg-[#F5EDEB] border border-[#D4A8A4] rounded-sm p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[#9B2C22] text-sm font-bold">{risk.type}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-sm ${
                        risk.severity === '高' ? 'bg-[#B83A2E]/10 text-[#9B2C22]' :
                        risk.severity === '中' ? 'bg-[#B8973E]/10 text-[#8A6D20]' :
                        'bg-[#EDE8DF] text-[#B0A898]'
                      }`}>{risk.severity}风险</span>
                    </div>
                    <p className="text-[#6B6459] text-xs mb-1">{risk.description}</p>
                    <p className="text-[#6B6459] text-xs mb-1">💡 {risk.suggestion}</p>
                    <p className="text-[#7B4A8F]/80 text-xs">🧠 MBTI补益：{risk.mbtiAdjust}</p>
                  </div>
                ))}
              </div>
              {patternAnalysis.mbti.energyAdjustments.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[#D8D2C8]">
                  <div className="text-[#B8973E] text-xs font-bold mb-1 tracking-wider">能量调整策略</div>
                  {patternAnalysis.mbti.energyAdjustments.map((adj, i) => (
                    <p key={i} className="text-[#6B6459] text-xs">· {adj}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 综合建议 ── */}
      <div className="ink-card border-[#B8973E]/40">
        <div className="text-[#B83A2E] text-xs font-bold mb-3 tracking-wider">综合建议</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {comprehensiveAdvice.map((adv, i) => (
            <div key={i} className="flex items-start gap-2 bg-white/50 rounded-sm p-2.5">
              <span className="text-[#B83A2E] text-xs shrink-0 mt-0.5 font-bold">{i + 1}.</span>
              <span className="text-[#1C1914] text-xs">{adv}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 脚注 */}
      <div className="text-center text-[#C4B8A8] text-xs py-2 tracking-wider">
        以上批注由规则引擎基于命理规则自动生成，仅供参考
      </div>
    </div>
  )
}
