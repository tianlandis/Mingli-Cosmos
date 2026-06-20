// ============================================================
// Phase 5 — 管理后台 App（玄青朱砂 · 新中式暗色）
// 文件：admin/App.tsx
// 职责：全局 401 拦截 + 统一 API 客户端注册 + 页面路由
// ============================================================

import { useState, useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import { setUnauthorizedHandler } from './lib/api'
import Login from './components/Login'
import { Layout } from './core'
import type { PageKey } from './core/menu.config'
import DashboardPage from './modules/dashboard/DashboardPage'
import LLMPage from './modules/llm/LLMPage'
import PromptEditor from './modules/prompts/PromptEditor'
import KnowledgeDictPage from './modules/knowledge-dict/KnowledgeDictPage'
import ConfigPanel from './components/ConfigPanel'
import AuditLog from './components/AuditLog'
import { Construction, BookOpen, Database, Cpu, GitBranch } from 'lucide-react'

export default function App() {
  const auth = useAuth()
  const [page, setPage] = useState<PageKey>('dashboard')

  // ═══ 全局 401 拦截：任何 API 调用返回 401 时自动踢回登录页 ═══
  useEffect(() => {
    setUnauthorizedHandler(() => {
      auth.logout()
    })
  }, [auth.logout])

  if (!auth.isAuthenticated) {
    return <Login onLogin={auth.login} />
  }

  return (
    <Layout activePage={page} onNavigate={setPage} onLogout={auth.logout}>
      {page === 'dashboard' && <DashboardPage apiHeaders={auth.apiHeaders} />}
      {page === 'config' && <ConfigPanel apiHeaders={auth.apiHeaders} />}
      {page === 'prompts' && <PromptEditor apiHeaders={auth.apiHeaders} />}
      {page === 'audit' && <AuditLog apiHeaders={auth.apiHeaders} />}
      {page === 'llm' && <LLMPage apiHeaders={auth.apiHeaders} />}
      {page === 'knowledge-dict' && <KnowledgeDictPage />}
      {(page === 'users' || page === 'orders') && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="size-16 flex items-center justify-center rounded-full bg-[#1A1F2E] border border-white/[0.06] mb-4">
            <Construction size={24} className="text-[#4A4540]" />
          </div>
          <p className="text-[#6B6459] text-sm">功能开发中，敬请期待</p>
          <p className="text-[#4A4540] text-xs mt-1">模块建设中，完成后将自动启用</p>
        </div>
      )}
      {page === 'knowledge' && (
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <div className="max-w-lg w-full">
            {/* 主卡片 */}
            <div className="bg-[#1A1F2E] border border-white/[0.06] rounded-xl p-6 mb-6">
              <div className="flex items-start gap-4 mb-5">
                <div className="size-14 flex items-center justify-center rounded-xl bg-[#5B8C5A]/8 border border-[#5B8C5A]/20 shrink-0">
                  <BookOpen size={24} className="text-[#5B8C5A]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#EDE8DF] tracking-[0.04em]">命理知识库</h2>
                  <p className="text-[11px] text-[#6B6459] mt-1 leading-relaxed">
                    知识库架构预告：未来将在此处管理 16 人格特征、十神关系、神煞对照表等命理结构化数据，供 AI 大模型 RAG 检索调用。
                  </p>
                </div>
              </div>

              {/* 架构图 */}
              <div className="space-y-3 mb-5">
                <div className="bg-[#0A1118] border border-white/[0.04] rounded-lg p-4">
                  <p className="text-[10px] font-medium text-[#6B6459] mb-3 tracking-[0.04em]">技术架构规划</p>
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-3">
                      <div className="size-8 flex items-center justify-center rounded-lg bg-[#4D6BFE]/10 shrink-0">
                        <Database size={14} className="text-[#4D6BFE]" />
                      </div>
                      <div>
                        <p className="text-[10px] text-[#EDE8DF] font-medium">存储层</p>
                        <p className="text-[9px] text-[#6B6459]">知识将以结构化 JSON 格式存储于后端 <code className="text-[#4D6BFE] bg-[#4D6BFE]/8 px-1 rounded text-[8px] font-mono">knowledge_mappings</code> 数据库表</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="size-8 flex items-center justify-center rounded-lg bg-[#B8964A]/10 shrink-0">
                        <Cpu size={14} className="text-[#B8964A]" />
                      </div>
                      <div>
                        <p className="text-[10px] text-[#EDE8DF] font-medium">检索层</p>
                        <p className="text-[9px] text-[#6B6459]">通过独立 API 端点提供向量检索 / 精确匹配，嵌入 AI 对话的 RAG 检索增强生成流程</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="size-8 flex items-center justify-center rounded-lg bg-[#5B8C5A]/10 shrink-0">
                        <GitBranch size={14} className="text-[#5B8C5A]" />
                      </div>
                      <div>
                        <p className="text-[10px] text-[#EDE8DF] font-medium">调度层</p>
                        <p className="text-[9px] text-[#6B6459]">Multi-Agent 路由器根据用户问题类型，自动调度相关命理知识注入 System Prompt</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 数据内容预告 */}
              <div className="grid grid-cols-2 gap-2 mb-5">
                <div className="bg-[#0A1118] border border-white/[0.04] rounded-lg p-3">
                  <p className="text-[9px] font-medium text-[#EDE8DF] mb-1">16 人格特征</p>
                  <p className="text-[8px] text-[#4A4540] leading-relaxed">MBTI 16 型人格的命理映射、性格描述、喜用五行参考</p>
                </div>
                <div className="bg-[#0A1118] border border-white/[0.04] rounded-lg p-3">
                  <p className="text-[9px] font-medium text-[#EDE8DF] mb-1">十神关系图谱</p>
                  <p className="text-[8px] text-[#4A4540] leading-relaxed">比肩劫财食神伤官正财偏财正官七杀正印偏印的完整关系数据</p>
                </div>
                <div className="bg-[#0A1118] border border-white/[0.04] rounded-lg p-3">
                  <p className="text-[9px] font-medium text-[#EDE8DF] mb-1">神煞对照表</p>
                  <p className="text-[8px] text-[#4A4540] leading-relaxed">天乙贵人、文昌、驿马等 40+ 神煞的查法与吉凶判断规则</p>
                </div>
                <div className="bg-[#0A1118] border border-white/[0.04] rounded-lg p-3">
                  <p className="text-[9px] font-medium text-[#EDE8DF] mb-1">经典文献引用</p>
                  <p className="text-[8px] text-[#4A4540] leading-relaxed">《渊海子平》《三命通会》《滴天髓》等经典的结构化原文片段索引</p>
                </div>
              </div>

              {/* 状态标签 */}
              <div className="flex items-center gap-2.5 bg-[#B8964A]/5 border border-[#B8964A]/10 rounded-lg p-3">
                <div className="size-2 rounded-full bg-[#C08040] animate-pulse shrink-0" />
                <p className="text-[10px] text-[#A09888] leading-relaxed">
                  此模块处于<span className="text-[#C08040] font-medium">架构规划阶段</span>，数据库表结构已设计完成，前端管理界面将在后续 Phase 迭代中实现。
                </p>
              </div>
            </div>

            <p className="text-center text-[10px] text-[#4A4540]">
              如有紧急需求，可联系开发团队加速此模块的开发排期
            </p>
          </div>
        </div>
      )}
    </Layout>
  )
}
