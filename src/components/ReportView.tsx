// ============================================================
// ReportView — 命书展示组件
// ============================================================

import type { ReportResult } from '../ai/types'

interface ReportViewProps {
  report: ReportResult
  loading?: boolean
  onClose?: () => void
}

export default function ReportView({ report, loading, onClose }: ReportViewProps) {
  if (loading) {
    return (
      <div className="chapter animate-pulse">
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[#B83A2E] border-t-transparent" />
          <p className="text-[#6B6459] mt-3 text-sm">命书生成中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="chapter animate-in fade-in duration-700">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-6 border-b border-[#D8D2C8] pb-3">
        <h2 className="text-lg font-bold text-[#8B3A2B] tracking-wider serif">
          📜 数字命书
        </h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-[#B0A898] hover:text-[#8B3A2B] transition-colors text-sm"
          >
            关闭
          </button>
        )}
      </div>

      {/* 章节流 */}
      {report.sections.map(section => (
        <div key={section.id} className="mb-6">
          {section.id !== 'seal' && (
            <h3 className="text-md font-bold text-[#5B5040] mb-2 tracking-wide serif border-l-2 border-[#B83A2E] pl-3">
              {section.title}
            </h3>
          )}
          <div
            className="report-content text-[#4A4035] text-sm leading-relaxed whitespace-pre-wrap"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: content is LLM-generated sanitized markdown
            dangerouslySetInnerHTML={{ __html: renderMarkdown(section.content) }}
          />
        </div>
      ))}
    </div>
  )
}

/** 简易 Markdown → HTML 渲染 */
function renderMarkdown(md: string): string {
  return md
    // 标题
    .replace(/^### (.+)$/gm, '<h4 class="text-sm font-bold text-[#5B5040] mt-3 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="text-base font-bold text-[#5B5040] mt-4 mb-2">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="text-lg font-bold text-[#8B3A2B] mb-3">$1</h2>')
    // 粗体
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>')
    // 引用
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-2 border-[#D8D2C8] pl-3 italic text-[#8B8070] my-2">$1</blockquote>')
    // 列表
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-[#4A4035]">$1</li>')
    // 分割线
    .replace(/^---$/gm, '<hr class="border-[#D8D2C8] my-4" />')
    // 表格
    .replace(/<li/g, '<ul><li')
    .replace(/<\/li>/g, '</li></ul>')
    // 合并相邻 ul
    .replace(/<\/ul>\n<ul>/g, '')
    // 换行
    .replace(/\n\n/g, '<br/><br/>')
}
