// ============================================================
// Phase 4C — 管理后台：Prompt 模板 CRUD API
// 文件：src/server/api/admin/prompts.ts
// ============================================================

import { Hono } from 'hono'
import { authMiddleware } from './auth'
import {
  listPrompts, getPrompt, createPrompt, updatePrompt, deletePrompt, getPromptByName,
} from '../../db'
import { createAuditLog } from '../../db'

interface PromptBody {
  name: string
  displayName: string
  content: string
  variables?: string
  description?: string
}

export const promptRoute = new Hono()
promptRoute.use('*', authMiddleware)

// 列出所有 Prompt
promptRoute.get('/prompts', (c) => {
  const prompts = listPrompts()
  return c.json({ prompts })
})

// 获取单个 Prompt
promptRoute.get('/prompts/:id', (c) => {
  const id = Number(c.req.param('id'))
  const prompt = getPrompt(id)
  if (!prompt) return c.json({ error: 'NOT_FOUND' }, 404)
  return c.json(prompt)
})

// 创建 Prompt
promptRoute.post('/prompts', async (c) => {
  const body = await c.req.json() as PromptBody
  const result = createPrompt({
    name: body.name,
    displayName: body.displayName,
    content: body.content,
    variables: body.variables || '[]',
    description: body.description || null,
  })
  createAuditLog({ action: 'create', resource: 'prompt', resourceId: result.id })
  return c.json(result)
})

// 更新 Prompt
promptRoute.put('/prompts/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json() as Partial<PromptBody>
  const result = updatePrompt(id, {
    ...body,
    variables: body.variables || undefined,
  })
  if (!result) return c.json({ error: 'NOT_FOUND' }, 404)
  createAuditLog({ action: 'update', resource: 'prompt', resourceId: id })
  return c.json(result)
})

// 删除 Prompt
promptRoute.delete('/prompts/:id', (c) => {
  const id = Number(c.req.param('id'))
  deletePrompt(id)
  createAuditLog({ action: 'delete', resource: 'prompt', resourceId: id })
  return c.json({ ok: true })
})
