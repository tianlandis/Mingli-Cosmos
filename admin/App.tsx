import { useState, useCallback } from 'react'
import { useAuth } from './hooks/useAuth'
import Login from './components/Login'
import Layout from './components/Layout'
import ConfigPanel from './components/ConfigPanel'
import PromptEditor from './components/PromptEditor'
import AuditLog from './components/AuditLog'

type Page = 'config' | 'prompts' | 'audit'

export default function App() {
  const auth = useAuth()
  const [page, setPage] = useState<Page>('config')

  if (!auth.isAuthenticated) {
    return <Login onLogin={auth.login} />
  }

  return (
    <Layout page={page} onNavigate={setPage} onLogout={auth.logout}>
      {page === 'config' && <ConfigPanel apiHeaders={auth.apiHeaders} />}
      {page === 'prompts' && <PromptEditor apiHeaders={auth.apiHeaders} />}
      {page === 'audit' && <AuditLog apiHeaders={auth.apiHeaders} />}
    </Layout>
  )
}
