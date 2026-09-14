import type { AgentRole, AiContentResult, AiKeySource, AiPlatform, ConfirmedContext } from '../../../shared/types'
import { AiProposalLog } from '../models'
import aiService, { type AiOptions, type AiStreamCallbacks } from './aiService'
import { buildAgentPrompt, type AgentTask } from './agentPrompts'
import { parseAgentJson, validateAgentResult } from './agentSchemas'
import novelMemoryService from './novelMemoryService'
import { recordAiUsage } from './aiUsageService'

export interface AgentRunOptions {
  novelId: number
  userId: number
  task: AgentTask
  role: AgentRole
  input: Record<string, unknown>
  platform: AiPlatform
  model: string
  aiOptions: AiOptions
  keySource?: AiKeySource | null
  chapterId?: number | null
  streamCallbacks?: AiStreamCallbacks
}

export interface StructuredAgentResult {
  data: Record<string, unknown>
  raw: string
  degraded: boolean
  usage?: AiContentResult['usage']
}

/** 生成只包含本次实际使用信息的日志上下文快照，并限制体积。 */
const buildLogContext = (context: ConfirmedContext): Record<string, unknown> => {
  const raw = JSON.stringify(context)
  if (raw.length <= 8000) return JSON.parse(raw) as Record<string, unknown>
  return { truncated: true, snapshot: raw.slice(0, 8000) }
}

/** 写入提案/审查日志；日志失败不影响主流程。 */
const recordProposal = async (
  options: AgentRunOptions,
  context: ConfirmedContext,
  output: unknown
): Promise<void> => {
  try {
    await AiProposalLog.create({
      novelId: options.novelId,
      userId: options.userId,
      agent: options.role,
      proposalType: options.task,
      inputContext: buildLogContext(context),
      output,
      userAction: 'pending'
    })
  } catch (error) {
    console.warn(`写入智能体提案日志失败(${options.task}):`, error instanceof Error ? error.message : error)
  }
}

class AgentOrchestrator {
  /** 加载归属校验后的 confirmed 上下文。 */
  async loadContext(options: Pick<AgentRunOptions, 'novelId' | 'userId' | 'role'>): Promise<ConfirmedContext> {
    const context = await novelMemoryService.getConfirmedContext(options.novelId, options.userId, options.role)
    if (!context) throw new Error('小说不存在或无权访问')
    return context
  }

  /** 执行灵感或审查任务，JSON 失败重试一次，再降级保留原文。 */
  async runStructured(options: AgentRunOptions): Promise<StructuredAgentResult> {
    const context = await this.loadContext(options)
    const prompt = buildAgentPrompt(options.role, options.task, context, options.input)
    const firstStartedAt = Date.now()
    let result = await aiService.generateContent(prompt, options.platform, options.model, options.streamCallbacks, {
      ...options.aiOptions,
      enableJsonMode: true,
      temperature: options.role === 'reviewer' ? 0.2 : 0.8,
      maxTokens: options.role === 'reviewer' ? 2000 : 3000
    })

    try {
      const data = parseAgentJson(result.content)
      if (!validateAgentResult(options.task, data)) throw new Error('AI 返回结构缺少必需字段')
      await recordProposal(options, context, data)
      await this.recordCall(options, prompt, result.content, result.usage, firstStartedAt)
      return { data, raw: result.content, degraded: false, usage: result.usage }
    } catch (firstError) {
      await this.recordCall(options, prompt, result.content, result.usage, firstStartedAt, { parseError: true })
      const repairPrompt = `${prompt}\n\n上一次输出无法通过结构校验。请重新输出严格符合 Schema 的单个 JSON 对象，不要解释。`
      const repairStartedAt = Date.now()
      try {
        result = await aiService.generateContent(repairPrompt, options.platform, options.model, undefined, {
          ...options.aiOptions,
          enableJsonMode: false,
          temperature: 0.2,
          maxTokens: options.role === 'reviewer' ? 2000 : 3000
        })
        const data = parseAgentJson(result.content)
        if (!validateAgentResult(options.task, data)) throw new Error('AI 重试结果仍缺少必需字段')
        await recordProposal(options, context, data)
        await this.recordCall(options, repairPrompt, result.content, result.usage, repairStartedAt, { repair: true })
        return { data, raw: result.content, degraded: false, usage: result.usage }
      } catch {
        const data = {
          degraded: true,
          raw: result.content,
          error: firstError instanceof Error ? firstError.message : '结构化输出解析失败'
        }
        await recordProposal(options, context, data)
        await this.recordCall(options, repairPrompt, result.content, result.usage, repairStartedAt, { repair: true, degraded: true })
        return { data, raw: result.content, degraded: true, usage: result.usage }
      }
    }
  }

  /** 把每次真实发给模型的调用写入用量日志。 */
  private async recordCall(
    options: AgentRunOptions,
    promptText: string,
    resultText: string | undefined,
    usage: AiContentResult['usage'],
    startedAt: number,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await recordAiUsage({
      userId: options.userId,
      novelId: options.novelId,
      chapterId: options.chapterId ?? null,
      action: options.task,
      platform: options.platform,
      model: options.model,
      status: 'success',
      startedAt,
      promptText,
      resultText,
      usage,
      keySource: options.keySource,
      metadata
    })
  }

  /** 执行写作任务并返回纯文本，保持现有流式体验。 */
  async runWriter(options: AgentRunOptions): Promise<AiContentResult> {
    const context = await this.loadContext(options)
    const prompt = buildAgentPrompt('writer', options.task, context, options.input)
    const startedAt = Date.now()
    const result = await aiService.generateContent(prompt, options.platform, options.model, options.streamCallbacks, {
      ...options.aiOptions,
      enableJsonMode: false,
      temperature: 0.7,
      maxTokens: options.task === 'summarize' ? 500 : 6000
    })
    await recordProposal(options, context, { content: result.content })
    await this.recordCall(options, prompt, result.content, result.usage, startedAt)
    return result
  }
}

export default new AgentOrchestrator()
