import type { AnnotationResult } from '../engine/annotation'

type MbtiProfile = AnnotationResult['patternAnalysis']['mbti']

interface Props {
  mbti: MbtiProfile
}

/**
 * L2「人格画像」Tab —— 16 型人格的完整展示。
 *
 * 数据来源：规则引擎 `engine/pattern/mbtiMapping.ts::analyzeMBTI()`
 * （由八字十神 / 格局组合映射得到，**非 LLM 生成**）。
 * 内容此前埋在「命理解读」Tab 的角落卡片里，此处提升为独立视图。
 */
export default function PersonalityProfile({ mbti }: Props) {
  if (mbti.typicalTypes.length === 0) {
    return <p className="py-8 text-center text-sm italic text-neutral-300">暂无人格画像数据</p>
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-2">
        <h2
          className="text-lg font-bold text-fg-primary tracking-[0.15em]"
          style={{ fontFamily: '"Noto Serif SC", serif' }}
        >
          人格画像
        </h2>
        <p className="text-fg-tertiary text-xs mt-1 tracking-wider">规则引擎 · 十神映射 16 型人格</p>
      </div>

      {/* 主卡：类型 + 认知功能 + 核心特质 */}
      <div className="ink-card border-accent-purple-soft">
        <div className="flex items-baseline gap-3 flex-wrap mb-3">
          <span
            className="text-3xl font-bold text-accent-purple-deep tracking-wide"
            style={{ fontFamily: '"Noto Serif SC", serif' }}
          >
            {mbti.typicalTypes.join(' / ')}
          </span>
        </div>
        {mbti.cognitiveFunctions && (
          <p className="text-fg-tertiary text-xs mb-3">认知功能：{mbti.cognitiveFunctions}</p>
        )}
        {mbti.traits && <p className="text-fg-primary text-sm font-medium">{mbti.traits}</p>}
      </div>

      {/* 实战画像 */}
      {mbti.portrait && (
        <div className="ink-card">
          <h3 className="text-accent-purple text-xs font-bold mb-2 tracking-wider">实战画像</h3>
          <p className="text-fg-secondary text-sm leading-relaxed">{mbti.portrait}</p>
        </div>
      )}

      {/* 行业适配 */}
      {mbti.industrySuggestions.length > 0 && (
        <div className="ink-card">
          <h3 className="text-accent-purple text-xs font-bold mb-3 tracking-wider">行业适配</h3>
          <ul className="space-y-2">
            {mbti.industrySuggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-fg-secondary text-sm leading-relaxed">
                <span className="text-accent-purple shrink-0 mt-0.5">·</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 能量调整策略 */}
      {mbti.energyAdjustments.length > 0 && (
        <div className="ink-card border-semantic-attention/40">
          <h3 className="text-semantic-attention text-xs font-bold mb-3 tracking-wider">能量调整策略</h3>
          <ul className="space-y-2">
            {mbti.energyAdjustments.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-fg-secondary text-sm leading-relaxed">
                <span className="text-semantic-attention shrink-0 mt-0.5">·</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-center text-neutral-300 text-xs py-2 tracking-wider">
        人格画像由规则引擎基于十神配置映射生成，仅供参考
      </p>
    </div>
  )
}
