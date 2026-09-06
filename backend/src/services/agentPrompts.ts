import type { AgentRole, ConfirmedContext, ReviewIssue } from '../../../shared/types'

export type AgentTask =
  | 'inspiration'
  | 'setting'
  | 'setting_all'
  | 'characters'
  | 'character_field'
  | 'outline'
  | 'review_chapter'
  | 'review_summary'
  | 'revise_by_review'
  | 'summarize'

const SYSTEM_PROMPTS: Record<AgentRole, string> = {
  inspiration: '你是「灵感智能体」，只提供可由人审核的创作选项，不写章节正文，不引用未确认草稿。',
  writer: '你是「写作智能体」，只服从已确认设定与当前任务，不发明新的核心世界观。',
  reviewer: '你是「审查智能体」，以可证伪证据审查网文，不重写全文，文风偏好不得标为 blocker。'
}

const JSON_SCHEMAS: Partial<Record<AgentTask, string>> = {
  inspiration: '{"options":[{"title":"string","genre":"string","premise":"string","coreConflict":"string","sellingPoints":["string"],"reasoning":"string"}]}',
  setting: '{"field":"string","content":"string","alternatives":["string"],"reasoning":"string"}',
  setting_all: '{"settings":{"worldview":"string","genreStyle":"string","powerSystem":"string","timeline":"string","plotRules":"string","taboos":"string","styleGuide":"string","notes":"string"}}',
  characters: '{"characters":[{"name":"string","role":"string","identity":"string","personality":"string","appearance":"string","relationship":"string","secret":"string","arc":"string","priority":5,"reasoning":"string"}]}',
  character_field: '{"field":"string","content":"string","reasoning":"string"}',
  outline: '{"overallOutline":"string","chapters":[{"title":"string","outline":"string","order":0}]}',
  review_chapter: '{"verdict":"pass|revise|block","summary":"string","issues":[{"id":"string","severity":"minor|major|blocker","category":"plot|character|world|taboo|style|continuity","location":"string","evidence":"string","expected":"string","suggestion":"string"}]}',
  review_summary: '{"verdict":"pass|revise","summary":"string","issues":[{"id":"string","severity":"minor|major","message":"string","suggestion":"string"}]}'
}

/** 根据角色、任务和 confirmed 记忆构造隔离 Prompt。 */
export const buildAgentPrompt = (
  role: AgentRole,
  task: AgentTask,
  context: ConfirmedContext,
  input: Record<string, unknown>
): string => {
  const confirmed = JSON.stringify(context, null, 2)
  const hint = typeof input.userHint === 'string' ? input.userHint : ''
  const schema = JSON_SCHEMAS[task]

  if (task === 'revise_by_review') {
    const selectedIssues = (Array.isArray(input.selectedIssues) ? input.selectedIssues : []) as ReviewIssue[]
    return `${SYSTEM_PROMPTS.writer}
【已确认上下文】${confirmed}
【当前正文】${String(input.draft || '')}
【仅处理这些审查意见】${JSON.stringify(selectedIssues, null, 2)}
仅局部改写与上述意见相关的段落，其他段落原样保留。直接输出完整正文，不输出分析。`
  }

  if (task === 'summarize') {
    return `${SYSTEM_PROMPTS.writer}
【章纲】${String(input.chapterOutline || '')}
【本章正文】${String(input.draft || '')}
输出 100-200 字情节概括，只写实际发生的剧情，不作评价。`
  }

  if (task === 'review_summary') {
    return `${SYSTEM_PROMPTS.reviewer}
【章节概括】${String(input.plot || '')}
【本章正文】${String(input.draft || '')}
对照正文检查概括：是否漏写关键事件、是否写了未发生情节、人物关系或结局是否偏差。
只输出合法 JSON，结构必须为：${schema}
无问题时 issues=[] 且 verdict="pass"。`
  }

  if (task === 'review_chapter') {
    return `${SYSTEM_PROMPTS.reviewer}
【已确认对照材料】${confirmed}
【待审正文】${String(input.draft || '')}
只输出合法 JSON，结构必须为：${schema}
每条问题必须有原文 evidence 与设定依据 expected；无问题时 issues=[] 且 verdict="pass"。`
  }

  const taskDirections: Record<'inspiration' | 'setting' | 'setting_all' | 'characters' | 'character_field' | 'outline', string> = {
    inspiration: '给出 3 套差异明确的小说定位方案。',
    setting: `为字段 ${String(input.field || 'worldview')} 提供一个主方案和可选替代方案。`,
    setting_all: '一次生成世界观、题材风格、力量体系、时间线、剧情规则、禁忌、文风指南和补充备注八个字段。',
    characters: '提案 3-5 个角色，覆盖主角、对立角色和配角，并避免与已确认人物重名。',
    character_field: `为人物卡字段 ${String(input.field || 'personality')} 补全内容，遵守用户提供的人物草稿。`,
    outline: '生成整体大纲，可按用户要求附章节拆分。'
  }
  return `${SYSTEM_PROMPTS.inspiration}
【已确认上下文】${confirmed}
【用户补充要求】${hint}
【任务】${taskDirections[task as keyof typeof taskDirections]}
只输出合法 JSON，不要 Markdown 代码块。结构必须为：${schema}`
}
