import type { AnnotationResult } from '../engine/annotation'

interface Props {
  annotation: AnnotationResult
}

const SECTION_CLASS = 'bg-gradient-to-b from-stone-900/80 to-stone-900/40 border border-stone-700/50 rounded-xl p-5'

export default function AnnotationPanel({ annotation }: Props) {
  const { overview, strengthAnalysis, wuXingBalance, shiShenProfile, patternAnalysis, luckAnalysis, specialTopics, comprehensiveAdvice } = annotation

  const scoreWidth = Math.max(5, Math.min(100, strengthAnalysis.score))

  return (
    <div className="space-y-4 animate-in fade-in duration-500 mt-6">
      {/* 标题 */}
      <div className="text-center mb-2">
        <h2 className="text-xl font-bold text-amber-200 tracking-wider">📋 命盘批注</h2>
        <p className="text-stone-500 text-xs mt-1">规则引擎 · 结构化解读</p>
      </div>

      {/* ── 命局总览 ── */}
      <div className={`${SECTION_CLASS} border-amber-700/30 bg-gradient-to-r from-amber-900/20 to-stone-900/80`}>
        <div className="text-amber-400/80 text-sm font-bold mb-2">命局总览</div>
        <p className="text-stone-200 text-base leading-relaxed">{overview.summary}</p>
      </div>

      {/* ── 日主强弱 + 格局分析 并排 ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 日主强弱 */}
        <div className={SECTION_CLASS}>
          <div className="text-amber-400/80 text-sm font-bold mb-3">日主强弱</div>
          <div className="flex items-center gap-3 mb-3">
            <span className={`text-lg font-bold ${
              strengthAnalysis.strength.includes('强') ? 'text-red-400' :
              strengthAnalysis.strength.includes('弱') ? 'text-blue-400' :
              'text-green-400'
            }`}>
              {strengthAnalysis.strength}
            </span>
            <span className="text-stone-500 text-xs">({strengthAnalysis.score}分)</span>
          </div>
          {/* 进度条 */}
          <div className="w-full h-2 bg-stone-700 rounded-full mb-3 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${scoreWidth}%`,
                background: scoreWidth > 60 ? 'linear-gradient(90deg, #dc2626, #f59e0b)' :
                            scoreWidth > 35 ? 'linear-gradient(90deg, #f59e0b, #22c55e)' :
                            'linear-gradient(90deg, #3b82f6, #6366f1)'
              }}
            />
          </div>
          {/* 判断依据 */}
          <ul className="space-y-1">
            {strengthAnalysis.reasons.map((r, i) => (
              <li key={i} className="text-stone-400 text-xs flex items-start gap-1.5">
                <span className="text-amber-600 shrink-0 mt-0.5">·</span>
                {r}
              </li>
            ))}
          </ul>
        </div>

        {/* 格局分析 */}
        <div className={SECTION_CLASS}>
          <div className="text-amber-400/80 text-sm font-bold mb-3">格局分析</div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="bg-amber-900/40 text-amber-300 text-xs px-2 py-0.5 rounded">{patternAnalysis.patternType}</span>
            <span className="text-stone-200 font-bold text-base">{patternAnalysis.patternName}</span>
            <span className={`text-xs ${
              patternAnalysis.quality === '上等' ? 'text-yellow-400' :
              patternAnalysis.quality === '中等' ? 'text-stone-300' : 'text-stone-500'
            }`}>
              {patternAnalysis.quality}
            </span>
            {/* V2.0: 吉凶标签 */}
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              patternAnalysis.jiXiong === '吉' ? 'bg-green-900/40 text-green-400' :
              patternAnalysis.jiXiong === '凶' ? 'bg-red-900/40 text-red-400' :
              'bg-stone-700/50 text-stone-400'
            }`}>{patternAnalysis.jiXiong}</span>
          </div>
          {/* V2.0: 组合信息 */}
          {patternAnalysis.combination.name && (
            <div className="text-stone-300 text-xs mb-2">
              格局组合：<span className="text-amber-400 font-bold">{patternAnalysis.combination.name}</span>
              {patternAnalysis.combination.isPure && <span className="text-stone-500 ml-1">（纯格）</span>}
            </div>
          )}
          {/* V2.0: 取格方法 */}
          <div className="text-stone-500 text-xs mb-2">{patternAnalysis.method}</div>
          <p className="text-stone-400 text-xs leading-relaxed mb-2">{patternAnalysis.description}</p>
          <ul className="space-y-0.5">
            {patternAnalysis.conditions.map((c, i) => (
              <li key={i} className="text-stone-500 text-xs flex items-start gap-1.5">
                <span className="text-amber-700 shrink-0 mt-0.5">◦</span>
                {c}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── 五行平衡 ── */}
      <div className="grid grid-cols-1 gap-4">
        <div className={SECTION_CLASS}>
          <div className="text-amber-400/80 text-sm font-bold mb-3">五行平衡</div>
          <div className="space-y-2">
            {wuXingBalance.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <span className={`text-xs w-6 shrink-0 ${
                  item.name === '木' ? 'text-green-400' :
                  item.name === '火' ? 'text-red-400' :
                  item.name === '土' ? 'text-yellow-400' :
                  item.name === '金' ? 'text-amber-200' : 'text-blue-400'
                }`}>{item.name}</span>
                <div className="flex-1 h-1.5 bg-stone-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${Math.max(5, (item.count / 8) * 100)}%`,
                    background: item.name === '木' ? '#22c55e' : item.name === '火' ? '#ef4444' :
                                item.name === '土' ? '#f59e0b' : item.name === '金' ? '#f5f0e1' : '#3b82f6'
                  }} />
                </div>
                <span className="text-stone-500 text-xs w-4">{item.count}</span>
                <span className={`text-xs ${
                  item.level === '偏旺' ? 'text-red-400' : item.level === '偏弱' ? 'text-blue-400' : 'text-stone-500'
                }`}>{item.level}</span>
              </div>
            ))}
          </div>
          {/* 建议 */}
          {wuXingBalance.filter(it => it.advice).length > 0 && (
            <div className="mt-3 pt-3 border-t border-stone-700/50">
              {wuXingBalance.filter(it => it.advice).map((it, i) => (
                <p key={i} className="text-stone-400 text-xs mb-1">{it.advice}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 十神概况 ── */}
      <div className={SECTION_CLASS}>
        <div className="text-amber-400/80 text-sm font-bold mb-3">十神配置</div>
        <div className="flex flex-wrap gap-2">
          {shiShenProfile.map((item) => (
            <div key={item.name}
              className="bg-stone-800/60 border border-stone-700/50 rounded-lg px-3 py-2 flex items-center gap-2"
            >
              <span className="text-stone-300 text-sm">{item.name}</span>
              <span className="bg-amber-900/50 text-amber-300 text-xs px-1.5 py-0.5 rounded-full">{item.count}</span>
              <span className="text-stone-600 text-xs">{item.positions.join('、')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── V2.0 MBTI 分析 + 破格风险 并排 ── */}
      {(patternAnalysis.mbti.typicalTypes.length > 0 || patternAnalysis.poGeRisks.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* MBTI 分析 */}
          {patternAnalysis.mbti.typicalTypes.length > 0 && (
            <div className={`${SECTION_CLASS} border-purple-700/30 bg-gradient-to-b from-purple-900/10 to-stone-900/60`}>
              <div className="text-purple-400/80 text-sm font-bold mb-3">🧠 MBTI 人格画像</div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-purple-300 text-lg font-bold">
                  {patternAnalysis.mbti.typicalTypes.join(' / ')}
                </span>
                <span className="text-stone-500 text-xs">（{patternAnalysis.mbti.cognitiveFunctions}）</span>
              </div>
              {patternAnalysis.mbti.traits && (
                <p className="text-stone-400 text-xs mb-2">{patternAnalysis.mbti.traits}</p>
              )}
              {patternAnalysis.mbti.portrait && (
                <p className="text-stone-500 text-xs leading-relaxed mb-2 italic">"{patternAnalysis.mbti.portrait}"</p>
              )}
              {patternAnalysis.mbti.industrySuggestions.length > 0 && (
                <div className="mt-2 pt-2 border-t border-stone-700/30">
                  <div className="text-purple-400/60 text-xs font-bold mb-1">行业适配</div>
                  {patternAnalysis.mbti.industrySuggestions.map((s, i) => (
                    <p key={i} className="text-stone-500 text-xs">· {s}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 破格风险 */}
          {patternAnalysis.poGeRisks.length > 0 && (
            <div className={`${SECTION_CLASS} border-red-700/20 bg-gradient-to-b from-red-900/5 to-stone-900/60`}>
              <div className="text-red-400/80 text-sm font-bold mb-3">⚠️ 格局风险</div>
              <div className="space-y-3">
                {patternAnalysis.poGeRisks.map((risk, i) => (
                  <div key={i} className="bg-red-900/10 border border-red-700/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-red-300 text-sm font-bold">{risk.type}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        risk.severity === '高' ? 'bg-red-900/40 text-red-400' :
                        risk.severity === '中' ? 'bg-yellow-900/40 text-yellow-400' :
                        'bg-stone-700/30 text-stone-400'
                      }`}>{risk.severity}风险</span>
                    </div>
                    <p className="text-stone-400 text-xs mb-1">{risk.description}</p>
                    <p className="text-stone-500 text-xs mb-1">💡 {risk.suggestion}</p>
                    <p className="text-purple-400/70 text-xs">🧠 MBTI补益：{risk.mbtiAdjust}</p>
                  </div>
                ))}
              </div>
              {/* 能量调整 */}
              {patternAnalysis.mbti.energyAdjustments.length > 0 && (
                <div className="mt-3 pt-3 border-t border-stone-700/30">
                  <div className="text-amber-400/60 text-xs font-bold mb-1">能量调整策略</div>
                  {patternAnalysis.mbti.energyAdjustments.map((adj, i) => (
                    <p key={i} className="text-stone-500 text-xs">· {adj}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 大运流年 ── */}
      <div className={SECTION_CLASS}>
        <div className="text-amber-400/80 text-sm font-bold mb-3">大运流年</div>
        {/* 当前流年 */}
        <div className="bg-amber-900/15 border border-amber-700/30 rounded-lg p-3 mb-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-amber-400 text-xs font-bold">当前流年</span>
            <span className="text-amber-300 text-sm font-bold">{luckAnalysis.currentYear.ganZhi}</span>
          </div>
          <p className="text-stone-300 text-xs">{luckAnalysis.currentYear.interpretation}</p>
          {luckAnalysis.currentYear.focus.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {luckAnalysis.currentYear.focus.map((f, i) => (
                <span key={i} className="bg-amber-900/30 text-amber-400/80 text-xs px-2 py-0.5 rounded-full">
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 大运列表 (只显示前 4 个) */}
        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
          {luckAnalysis.daYunList.slice(0, 4).map((dy, i) => (
            <div key={i} className={`flex items-start gap-3 p-2 rounded-lg transition-colors ${
              dy.quality === '佳' ? 'bg-green-900/10 border border-green-700/20' :
              dy.quality === '不佳' ? 'bg-red-900/10 border border-red-700/20' :
              'bg-stone-800/40'
            }`}>
              <div className="shrink-0 text-center min-w-[60px]">
                <div className="text-stone-300 font-bold text-sm">{dy.ganZhi}</div>
                <div className="text-stone-600 text-xs">{dy.startAge}-{dy.endAge}岁</div>
              </div>
              <div className="flex-1 text-stone-400 text-xs leading-relaxed min-w-0">
                {dy.interpretation}
              </div>
              <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded ${
                dy.quality === '佳' ? 'text-green-400 bg-green-900/30' :
                dy.quality === '不佳' ? 'text-red-400 bg-red-900/30' :
                'text-stone-500 bg-stone-700/30'
              }`}>{dy.quality}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 专题批注（6宫格） ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {(['personality', 'career', 'wealth', 'marriage', 'health', 'children'] as const).map((key) => {
          const titles: Record<string, string> = {
            personality: '🎭 性格', career: '💼 事业', wealth: '💰 财运',
            marriage: '💕 婚姻', health: '🏥 健康', children: '👶 子女'
          }
          return (
            <div key={key} className={`${SECTION_CLASS} p-4`}>
              <div className="text-amber-400/80 text-xs font-bold mb-2">{titles[key]}</div>
              <ul className="space-y-1">
                {specialTopics[key].slice(0, 4).map((tip, i) => (
                  <li key={i} className="text-stone-400 text-xs leading-relaxed flex items-start gap-1">
                    <span className="text-amber-700 shrink-0 mt-0.5">·</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      {/* ── 综合建议 ── */}
      <div className={`${SECTION_CLASS} border-amber-600/30 bg-gradient-to-b from-amber-900/5 to-stone-900/80`}>
        <div className="text-amber-400/80 text-sm font-bold mb-3">综合建议</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {comprehensiveAdvice.map((adv, i) => (
            <div key={i} className="flex items-start gap-2 bg-stone-800/30 rounded-lg p-2.5">
              <span className="text-amber-600 text-xs shrink-0 mt-0.5">{i + 1}.</span>
              <span className="text-stone-300 text-xs">{adv}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 人生关键节点 ── */}
      {luckAnalysis.milestones.length > 0 && (
        <div className={SECTION_CLASS}>
          <div className="text-amber-400/80 text-sm font-bold mb-3">人生关键节点</div>
          <div className="flex flex-wrap gap-2">
            {luckAnalysis.milestones.slice(0, 8).map((m, i) => (
              <div key={i} className="bg-stone-800/60 border border-stone-700/40 rounded-lg px-3 py-2">
                <div className="text-stone-300 text-xs font-bold">{m.age}岁 ({m.year}年)</div>
                <div className="text-stone-500 text-xs mt-0.5">{m.event}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 脚注 */}
      <div className="text-center text-stone-600 text-xs py-2">
        以上批注由规则引擎基于命理规则自动生成，仅供参考
      </div>
    </div>
  )
}
