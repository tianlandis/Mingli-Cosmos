import type { AnnotationResult } from '../engine/annotation'
import { wxColor } from '../lib/wuxing'

interface Props {
  annotation: AnnotationResult
}

export default function AnnotationPanel({ annotation }: Props) {
  const { overview, wuXingBalance, shiShenProfile, patternAnalysis, comprehensiveAdvice } = annotation

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div className="text-center mb-2">
        <h2 className="text-lg font-bold text-fg-primary tracking-[0.15em]" style={{ fontFamily: '"Noto Serif SC", serif' }}>
          命盘批注
        </h2>
        <p className="text-fg-tertiary text-xs mt-1 tracking-wider">规则引擎 · 结构化解读</p>
      </div>

      {/* ── 命局总览 ── */}
      <div className="ink-card border-[#D4A8A4]">
        <div className="text-brand text-xs font-bold mb-2 tracking-wider">命局总览</div>
        <p className="text-fg-primary text-sm leading-relaxed">{overview.summary}</p>
      </div>

      {/* ── 格局分析（日主强弱见 L1 速读卡与上方详细强弱图，此处不再重复）── */}
      <div className="ink-card">
          <div className="text-brand text-xs font-bold mb-3 tracking-wider">格局分析</div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="ink-tag">{patternAnalysis.patternType}</span>
            <span className="text-fg-primary font-bold text-sm" style={{ fontFamily: '"Noto Serif SC", serif' }}>
              {patternAnalysis.patternName}
            </span>
            <span className={`text-xs ${
              patternAnalysis.quality === '上等' ? 'text-brand' :
              patternAnalysis.quality === '中等' ? 'text-fg-secondary' : 'text-fg-tertiary'
            }`}>
              {patternAnalysis.quality}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded-sm ${
              patternAnalysis.jiXiong === '吉' ? 'bg-accent-green-soft text-semantic-positive' :
              patternAnalysis.jiXiong === '凶' ? 'bg-[#F5EDEB] text-brand' :
              'bg-surface-sunken text-fg-tertiary'
            }`}>{patternAnalysis.jiXiong}</span>
          </div>
          {patternAnalysis.combination.name && (
            <div className="text-fg-secondary text-xs mb-2">
              格局组合：
              <span className="text-brand font-bold">{patternAnalysis.combination.name}</span>
              {patternAnalysis.combination.isPure && <span className="text-fg-tertiary ml-1">（纯格）</span>}
            </div>
          )}
          <div className="text-fg-tertiary text-xs mb-2">{patternAnalysis.method}</div>
          <p className="text-fg-secondary text-xs leading-relaxed mb-2">{patternAnalysis.description}</p>
          <ul className="space-y-0.5">
            {patternAnalysis.conditions.map((c, i) => (
              <li key={i} className="text-fg-tertiary text-xs flex items-start gap-1.5">
                <span className="text-neutral-300 shrink-0 mt-0.5">◦</span>
                {c}
              </li>
            ))}
          </ul>
        </div>

      {/* ── 五行平衡 ── */}
      <div className="ink-card">
        <div className="text-brand text-xs font-bold mb-3 tracking-wider">五行平衡</div>
        <div className="space-y-2">
          {wuXingBalance.map((item) => {
            const color = wxColor(item.name)
            return (
              <div key={item.name} className="flex items-center gap-2">
                <span className="text-xs w-6 shrink-0 font-bold" style={{ color }}>
                  {item.name}
                </span>
                <div className="flex-1 h-1.5 bg-[#E8E3D9] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.max(5, (item.count / 8) * 100)}%`, backgroundColor: color }}
                  />
                </div>
                <span className="text-fg-tertiary text-xs w-4 text-right">{item.count}</span>
                <span className={`text-xs ${
                  item.level === '偏旺' ? 'text-brand' :
                  item.level === '偏弱' ? 'text-semantic-info' : 'text-fg-tertiary'
                }`}>{item.level}</span>
              </div>
            )
          })}
        </div>
        {wuXingBalance.filter(it => it.advice).length > 0 && (
          <div className="mt-3 pt-3 border-t border-line-strong">
            {wuXingBalance.filter(it => it.advice).map((it, i) => (
              <p key={i} className="text-fg-secondary text-xs mb-1">{it.advice}</p>
            ))}
          </div>
        )}
      </div>

      {/* ── 十神概况 ── */}
      <div className="ink-card">
        <div className="text-brand text-xs font-bold mb-3 tracking-wider">十神配置</div>
        <div className="flex flex-wrap gap-2">
          {shiShenProfile.map((item) => (
            <div key={item.name} className="ink-tag flex items-center gap-1.5 px-2 py-1">
              <span className="text-fg-primary text-xs font-medium">{item.name}</span>
              <span className="bg-brand/10 text-brand-strong text-xs px-1.5 py-0.5 rounded-full font-bold">{item.count}</span>
              <span className="text-fg-tertiary text-xs">{item.positions.join('、')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 格局风险（人格画像已独立到「人格画像」Tab，此处不再重复）── */}
      {patternAnalysis.poGeRisks.length > 0 && (
        <div className="ink-card border-cinnabar-200">
          <div className="text-brand text-xs font-bold mb-3 tracking-wider">格局风险</div>
          <div className="space-y-3">
            {patternAnalysis.poGeRisks.map((risk, i) => (
              <div key={i} className="bg-cinnabar-100 border border-cinnabar-200 rounded-sm p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-brand-strong text-sm font-bold">{risk.type}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-sm ${
                    risk.severity === '高' ? 'bg-brand/10 text-brand-strong' :
                    risk.severity === '中' ? 'bg-semantic-attention/10 text-gold-600' :
                    'bg-surface-sunken text-fg-tertiary'
                  }`}>{risk.severity}风险</span>
                </div>
                <p className="text-fg-secondary text-xs mb-1">{risk.description}</p>
                <p className="text-fg-secondary text-xs mb-1">💡 {risk.suggestion}</p>
                <p className="text-accent-purple text-xs">🧠 MBTI补益：{risk.mbtiAdjust}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 综合建议 ── */}
      <div className="ink-card border-semantic-attention/40">
        <div className="text-brand text-xs font-bold mb-3 tracking-wider">综合建议</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {comprehensiveAdvice.map((adv, i) => (
            <div key={i} className="flex items-start gap-2 bg-white/50 rounded-sm p-2.5">
              <span className="text-brand text-xs shrink-0 mt-0.5 font-bold">{i + 1}.</span>
              <span className="text-fg-primary text-xs">{adv}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 脚注 */}
      <div className="text-center text-neutral-300 text-xs py-2 tracking-wider">
        以上批注由规则引擎基于命理规则自动生成，仅供参考
      </div>
    </div>
  )
}
