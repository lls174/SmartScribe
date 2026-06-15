import { Router } from 'express'
import type { Request } from 'express'
import { body } from 'express-validator'
import type {
  AiContentResult,
  AiStreamPhase,
  AiUsage,
  AiPlatform,
  CreativeRequest,
  GenerateRequest,
  ContinueRequest,
  OutlineRequest,
  PolishRequest,
  SettingRequest
} from '../../../shared/types'
import novelAgent from '../services/novelAgent'
import contextManager from '../services/contextManager'
import aiService, { type AiOptions, type AiStreamCallbacks } from '../services/aiService'
import novelMemoryService from '../services/novelMemoryService'
import { AiRequestLog, GenerationHistory } from '../models'
import { verifyToken } from '../middleware/auth'
import { validateRequest } from '../middleware/validate'
import { DEFAULT_AI_MODEL, DEFAULT_AI_PLATFORM } from '../constants/aiDefaults'
import { SETTING_TYPE_MAP } from '../constants/aiSettingTypes'
import { getActiveAiConfigSummary, getAiConfigStatus, getUserAiConfig, saveUserAiConfig } from '../services/aiCredentialService'

const router = Router()

interface LoggableAiResult {
  content: string
  usage?: AiUsage | null
}

interface AiLogParams {
  req: Request
  action: string
  platform: string
  model: string
  status: 'success' | 'failed'
  startedAt: number
  promptText: string
  result?: string | LoggableAiResult
  error?: unknown
  metadata?: Record<string, unknown>
}

const getErrorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error)

async function resolveAiExecutionConfig(
  userId: number | undefined,
  requestedPlatform?: string,
  requestedModel?: string,
  enableDeepThinking?: boolean
): Promise<{
  platform: AiPlatform
  model: string
  aiOptions: AiOptions & { apiKey: string; customBaseURL?: string }
}> {
  const config = await getUserAiConfig(userId, requestedPlatform, requestedModel)
  return {
    platform: config.platform,
    model: config.model,
    aiOptions: {
      apiKey: config.apiKey,
      customBaseURL: config.customBaseURL,
      enableDeepThinking: enableDeepThinking === true
    }
  }
}

async function loadNovelMemory(req: { body: { novelId?: number | string }; userId?: number }): Promise<string> {
  if (!req.body.novelId || !req.userId) {
    return ''
  }
  const memory = await novelMemoryService.getNovelMemory(req.body.novelId, req.userId)
  return novelMemoryService.formatNovelMemory(memory)
}

async function buildNovelContext(req: { body: GenerateRequest | ContinueRequest | PolishRequest | OutlineRequest; userId?: number }): Promise<string> {
  const { novelMeta, chapters, currentChapterId } = req.body
  const novelMemory = await loadNovelMemory(req)
  return contextManager.buildNovelContext(novelMeta, chapters, currentChapterId, novelMemory)
}

function flushSse(res: import('express').Response): void {
  if (typeof (res as import('express').Response & { flush?: () => void }).flush === 'function') {
    ;(res as import('express').Response & { flush: () => void }).flush()
  }
}

function setupSSE(res: import('express').Response, req: import('express').Request): {
  isConnectionClosed: () => boolean
  streamCallbacks: AiStreamCallbacks
} {
  let closed = false
  let currentPhase: AiStreamPhase | null = null
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()
  req.on('close', () => {
    closed = true
  })

  const emitPhase = (phase: AiStreamPhase): void => {
    if (closed || currentPhase === phase) return
    currentPhase = phase
    res.write(`data: ${JSON.stringify({ status: phase })}\n\n`)
    flushSse(res)
  }

  emitPhase('waiting')

  const streamCallbacks: AiStreamCallbacks = {
    onPhase: emitPhase,
    onChunk: (chunk: string): void => {
      if (!closed) {
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`)
        flushSse(res)
      }
    }
  }

  return { isConnectionClosed: () => closed, streamCallbacks }
}

function parseNullableId(value: unknown): number | null {
  const parsed = value ? parseInt(String(value), 10) : null
  return Number.isFinite(parsed) ? parsed : null
}

async function recordGenerationHistory({
  req,
  action,
  prompt,
  params,
  result
}: {
  req: import('express').Request
  action: string
  prompt?: string | null
  params: Record<string, unknown>
  result?: string | null
}): Promise<void> {
  try {
    await GenerationHistory.create({
      userId: req.userId!,
      novelId: parseNullableId(req.body.novelId),
      chapterId: parseNullableId(req.body.chapterId),
      action,
      prompt: prompt ?? null,
      params,
      result: result ?? null
    })
  } catch (logError) {
    console.warn(`写入生成历史失败(${action}):`, getErrorMessage(logError))
  }
}

async function writeAiRequestLog({ req, action, platform, model, status, startedAt, promptText, result, error, metadata }: AiLogParams): Promise<void> {
  if (!req.userId) {
    return
  }

  try {
    const resultContent = typeof result === 'string' ? result : (result?.content || '')
    const usage = typeof result === 'object' && result?.usage
      ? result.usage
      : {
        promptTokens: aiService.estimateTokens(promptText),
        completionTokens: aiService.estimateTokens(resultContent),
        totalTokens: aiService.estimateTokens(promptText) + aiService.estimateTokens(resultContent),
        isEstimated: true
      }

    await AiRequestLog.create({
      userId: req.userId,
      novelId: parseNullableId(req.body.novelId),
      chapterId: parseNullableId(req.body.chapterId),
      action,
      platform,
      model,
      status,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      isEstimated: usage.isEstimated,
      durationMs: Date.now() - startedAt,
      promptLength: promptText?.length || 0,
      resultLength: resultContent?.length || 0,
      errorMessage: error ? getErrorMessage(error).slice(0, 1000) : null,
      metadata: metadata ?? null
    })
  } catch (logError) {
    console.warn(`写入AI请求日志失败(${action}):`, getErrorMessage(logError))
  }
}

const commonAiValidators = [
  body('platform').optional().trim(),
  body('model').optional().trim(),
  body('enableDeepThinking').optional().isBoolean()
]

router.get('/config',
  verifyToken,
  async (req, res) => {
    const summary = await getActiveAiConfigSummary(req.userId!)
    const platform = typeof req.query.platform === 'string' ? req.query.platform : undefined

    if (platform) {
      const platformStatus = await getAiConfigStatus(req.userId!, platform)
      res.json({ ...summary, platformStatus })
      return
    }

    res.json(summary)
  }
)

router.post('/config',
  verifyToken,
  body('platform').optional().trim(),
  body('apiKey').optional().trim(),
  body('model').optional().trim(),
  body('customBaseURL').optional().trim(),
  validateRequest,
  async (req, res) => {
    const status = await saveUserAiConfig(req.userId!, req.body.platform, req.body.apiKey, req.body.model, req.body.customBaseURL)
    res.json(status)
  }
)

router.post('/generate',
  verifyToken,
  body('prompt').trim().notEmpty().withMessage('提示词不能为空'),
  body('chapterTitle').optional().trim(),
  ...commonAiValidators,
  body('novelMeta').optional(),
  body('chapters').optional(),
  body('currentChapterId').optional(),
  validateRequest,
  async (req, res) => {
    const startedAt = Date.now()
    try {
      const payload = req.body as GenerateRequest
      const { platform, model, aiOptions } = await resolveAiExecutionConfig(req.userId, payload.platform, payload.model, payload.enableDeepThinking)
      const { isConnectionClosed, streamCallbacks } = setupSSE(res, req)
      const novelContext = await buildNovelContext({ body: payload, userId: req.userId })
      const userPrompt = {
        genre: payload.genre,
        style: payload.style,
        corePlot: typeof payload.prompt === 'string' ? payload.prompt : payload.corePlot,
        characters: payload.characters,
        wordCount: payload.wordCount,
        chapterTitle: payload.chapterTitle,
        other: payload.other
      }
      const result = await novelAgent.generateChapter(novelContext, userPrompt, platform, model, streamCallbacks, aiOptions)
      if (!isConnectionClosed()) {
        res.write(`data: ${JSON.stringify({ done: true, plot: result.plot })}\n\n`)
        res.end()
      }
      void recordGenerationHistory({ req, action: 'generate', prompt: payload.prompt, params: { platform, model, ...userPrompt }, result: result.content })
      void writeAiRequestLog({ req, action: 'generate', platform, model, status: 'success', startedAt, promptText: payload.prompt, result, metadata: { chapterTitle: payload.chapterTitle, genre: payload.genre, style: payload.style, wordCount: payload.wordCount } })
    } catch (error) {
      console.error('生成章节失败:', error)
      await writeAiRequestLog({ req, action: 'generate', platform: req.body.platform || DEFAULT_AI_PLATFORM, model: req.body.model || DEFAULT_AI_MODEL, status: 'failed', startedAt, promptText: req.body.prompt || '', error })
      if (!res.headersSent) res.status(500).json({ message: getErrorMessage(error) || '生成章节失败' })
    }
  }
)

router.post('/continue',
  verifyToken,
  body('prompt').optional().trim(),
  body('lastContent').optional().trim(),
  body('lastPlot').optional().trim(),
  ...commonAiValidators,
  body('novelMeta').optional(),
  body('chapters').optional(),
  body('currentChapterId').optional(),
  validateRequest,
  async (req, res) => {
    const startedAt = Date.now()
    try {
      const payload = req.body as ContinueRequest
      const { platform, model, aiOptions } = await resolveAiExecutionConfig(req.userId, payload.platform, payload.model, payload.enableDeepThinking)
      let novelContext = await buildNovelContext({ body: payload, userId: req.userId })
      if (!novelContext.trim() && payload.lastContent) {
        novelContext = contextManager.buildNovelContext(null, [{ id: 1, title: '上一章', content: payload.lastContent, plot: payload.lastPlot }], 1)
      }
      if (!novelContext.trim()) return res.status(400).json({ message: '缺少上下文信息，无法续写' })
      const { isConnectionClosed, streamCallbacks } = setupSSE(res, req)
      const result = await novelAgent.continueChapter(novelContext, { customPrompt: payload.prompt, wordCount: payload.wordCount }, platform, model, streamCallbacks, aiOptions)
      if (!isConnectionClosed()) {
        res.write(`data: ${JSON.stringify({ done: true, plot: result.plot })}\n\n`)
        res.end()
      }
      void recordGenerationHistory({ req, action: 'continue', prompt: payload.prompt, params: { platform, model, lastPlot: payload.lastPlot, wordCount: payload.wordCount }, result: result.content })
      void writeAiRequestLog({ req, action: 'continue', platform, model, status: 'success', startedAt, promptText: `${payload.prompt || ''}\n${payload.lastContent || ''}\n${payload.lastPlot || ''}`, result, metadata: { wordCount: payload.wordCount } })
    } catch (error) {
      console.error('续写章节失败:', error)
      await writeAiRequestLog({ req, action: 'continue', platform: req.body.platform || DEFAULT_AI_PLATFORM, model: req.body.model || DEFAULT_AI_MODEL, status: 'failed', startedAt, promptText: `${req.body.prompt || ''}\n${req.body.lastContent || ''}\n${req.body.lastPlot || ''}`, error })
      if (!res.headersSent) res.status(500).json({ message: getErrorMessage(error) || '续写章节失败' })
    }
  }
)

router.post('/polish',
  verifyToken,
  body('content').trim().notEmpty().withMessage('内容不能为空'),
  body('prompt').optional().trim(),
  ...commonAiValidators,
  body('novelMeta').optional(),
  body('chapters').optional(),
  body('currentChapterId').optional(),
  validateRequest,
  async (req, res) => {
    const startedAt = Date.now()
    try {
      const payload = req.body as PolishRequest
      const { platform, model, aiOptions } = await resolveAiExecutionConfig(req.userId, payload.platform, payload.model, payload.enableDeepThinking)
      const { isConnectionClosed, streamCallbacks } = setupSSE(res, req)
      const novelContext = await buildNovelContext({ body: payload, userId: req.userId })
      const result = await novelAgent.polishChapter(novelContext, { customPrompt: payload.prompt, content: payload.content }, platform, model, streamCallbacks, aiOptions)
      if (!isConnectionClosed()) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
        res.end()
      }
      void recordGenerationHistory({ req, action: 'polish', prompt: payload.prompt, params: { platform, model, beforeContent: payload.beforeContent, beforePlot: payload.beforePlot, chapterTitle: payload.chapterTitle }, result: result.content })
      void writeAiRequestLog({ req, action: 'polish', platform, model, status: 'success', startedAt, promptText: `${payload.prompt || ''}\n${payload.content || ''}`, result, metadata: { contentLength: payload.content.length } })
    } catch (error) {
      console.error('润色内容失败:', error)
      await writeAiRequestLog({ req, action: 'polish', platform: req.body.platform || DEFAULT_AI_PLATFORM, model: req.body.model || DEFAULT_AI_MODEL, status: 'failed', startedAt, promptText: `${req.body.prompt || ''}\n${req.body.content || ''}`, error })
      if (!res.headersSent) res.status(500).json({ message: getErrorMessage(error) || '润色内容失败' })
    }
  }
)

router.post('/setting',
  verifyToken,
  body('type').trim().notEmpty().withMessage('设定类型不能为空'),
  body('prompt').trim().notEmpty().withMessage('提示词不能为空'),
  ...commonAiValidators,
  validateRequest,
  async (req, res) => {
    const startedAt = Date.now()
    try {
      const payload = req.body as SettingRequest
      const { platform, model, aiOptions } = await resolveAiExecutionConfig(req.userId, payload.platform, payload.model, payload.enableDeepThinking)
      const typeText = SETTING_TYPE_MAP[payload.type] || '设定'
      const systemPrompt = contextManager.buildSystemPrompt('generate')
      const novelMemory = await loadNovelMemory({ body: payload, userId: req.userId })
      const fullPrompt = `${systemPrompt}${novelMemory ? `\n\n${novelMemory}` : ''}\n\n请生成一个${typeText}。${payload.prompt}`
      const { isConnectionClosed, streamCallbacks } = setupSSE(res, req)
      const result = await aiService.generateContent(fullPrompt, platform, model, streamCallbacks, aiOptions)
      if (!isConnectionClosed()) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
        res.end()
      }
      void writeAiRequestLog({ req, action: 'setting', platform, model, status: 'success', startedAt, promptText: fullPrompt, result, metadata: { type: payload.type } })
    } catch (error) {
      console.error('生成设定失败:', error)
      await writeAiRequestLog({ req, action: 'setting', platform: req.body.platform || DEFAULT_AI_PLATFORM, model: req.body.model || DEFAULT_AI_MODEL, status: 'failed', startedAt, promptText: req.body.prompt || '', error, metadata: { type: req.body.type } })
      if (!res.headersSent) res.status(500).json({ message: getErrorMessage(error) || '生成设定失败' })
    }
  }
)

router.post('/outline',
  verifyToken,
  body('novelType').trim().notEmpty().withMessage('小说类型不能为空'),
  body('corePlot').trim().notEmpty().withMessage('核心剧情不能为空'),
  body('length').optional().trim(),
  ...commonAiValidators,
  validateRequest,
  async (req, res) => {
    const startedAt = Date.now()
    try {
      const payload = req.body as OutlineRequest
      const { platform, model, aiOptions } = await resolveAiExecutionConfig(req.userId, payload.platform, payload.model, payload.enableDeepThinking)
      const novelContext = await buildNovelContext({ body: payload, userId: req.userId })
      const userPrompt = `小说类型：${payload.novelType}\n核心剧情：${payload.corePlot}\n${payload.length ? '篇幅要求：' + payload.length : ''}`
      const { isConnectionClosed, streamCallbacks } = setupSSE(res, req)
      const result = await novelAgent.generateOutline(novelContext, userPrompt, platform, model, streamCallbacks, aiOptions)
      if (!isConnectionClosed()) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
        res.end()
      }
      void writeAiRequestLog({ req, action: 'outline', platform, model, status: 'success', startedAt, promptText: userPrompt, result, metadata: { novelType: payload.novelType, length: payload.length } })
    } catch (error) {
      console.error('生成大纲失败:', error)
      await writeAiRequestLog({ req, action: 'outline', platform: req.body.platform || DEFAULT_AI_PLATFORM, model: req.body.model || DEFAULT_AI_MODEL, status: 'failed', startedAt, promptText: `${req.body.novelType || ''}\n${req.body.corePlot || ''}`, error })
      if (!res.headersSent) res.status(500).json({ message: getErrorMessage(error) || '生成大纲失败' })
    }
  }
)

router.post('/creative',
  verifyToken,
  body('prompt').trim().notEmpty().withMessage('提示词不能为空'),
  body('type').trim().notEmpty().withMessage('创意类型不能为空'),
  ...commonAiValidators,
  validateRequest,
  async (req, res) => {
    const startedAt = Date.now()
    try {
      const payload = req.body as CreativeRequest
      const { platform, model, aiOptions } = await resolveAiExecutionConfig(req.userId, payload.platform, payload.model, payload.enableDeepThinking)
      const { isConnectionClosed, streamCallbacks } = setupSSE(res, req)
      const result = await aiService.generateContent(payload.prompt, platform, model, streamCallbacks, aiOptions)
      if (!isConnectionClosed()) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
        res.end()
      }
      void recordGenerationHistory({ req, action: 'creative', prompt: payload.prompt, params: { platform, model, type: payload.type }, result: result.content })
      void writeAiRequestLog({ req, action: 'creative', platform, model, status: 'success', startedAt, promptText: payload.prompt, result, metadata: { type: payload.type } })
    } catch (error) {
      console.error('生成创意失败:', error)
      await writeAiRequestLog({ req, action: 'creative', platform: req.body.platform || DEFAULT_AI_PLATFORM, model: req.body.model || DEFAULT_AI_MODEL, status: 'failed', startedAt, promptText: req.body.prompt || '', error, metadata: { type: req.body.type } })
      if (!res.headersSent) res.status(500).json({ message: getErrorMessage(error) || '生成创意失败' })
    }
  }
)

export default router
