import type { AgentTask } from './agentPrompts'

export interface StructuredParseResult {
  data: Record<string, unknown>
  valid: boolean
}

/** 去除常见 Markdown 包裹后解析 JSON。 */
export const parseAgentJson = (raw: string): Record<string, unknown> => {
  const normalized = raw.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  const firstBrace = normalized.indexOf('{')
  const lastBrace = normalized.lastIndexOf('}')
  if (firstBrace < 0 || lastBrace <= firstBrace) throw new Error('AI 未返回 JSON 对象')
  const parsed: unknown = JSON.parse(normalized.slice(firstBrace, lastBrace + 1))
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('AI 返回的根节点必须是对象')
  return parsed as Record<string, unknown>
}

/** 对 Phase 1-3 结构化任务执行最小必需字段校验。 */
export const validateAgentResult = (task: AgentTask, data: Record<string, unknown>): boolean => {
  if (task === 'inspiration') return Array.isArray(data.options) && data.options.length > 0
  if (task === 'setting') return typeof data.field === 'string' && typeof data.content === 'string'
  if (task === 'setting_all') return Boolean(data.settings && typeof data.settings === 'object')
  if (task === 'characters') return Array.isArray(data.characters) && data.characters.length > 0
  if (task === 'character_field') return typeof data.field === 'string' && typeof data.content === 'string'
  if (task === 'outline') return typeof data.overallOutline === 'string'
  if (task === 'review_chapter' || task === 'review_summary') {
    return ['pass', 'revise', 'block'].includes(String(data.verdict))
      && typeof data.summary === 'string'
      && Array.isArray(data.issues)
  }
  return true
}
