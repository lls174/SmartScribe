const express = require('express')
const router = express.Router()
const novelAgent = require('../services/novelAgent')
const contextManager = require('../services/contextManager')
const aiService = require('../services/aiService')
const novelMemoryService = require('../services/novelMemoryService')
const { GenerationHistory, AiRequestLog } = require('../models')
const { body } = require('express-validator')
const { verifyToken } = require('../middleware/auth')
const { validateRequest } = require('../middleware/validate')
const { DEFAULT_AI_PLATFORM, DEFAULT_AI_MODEL } = require('../constants/aiDefaults')
const { SETTING_TYPE_MAP } = require('../constants/aiSettingTypes')

async function loadNovelMemory(req) {
  if (!req.body.novelId) {
    return ''
  }

  const memory = await novelMemoryService.getNovelMemory(req.body.novelId, req.userId)
  return novelMemoryService.formatNovelMemory(memory)
}

async function buildNovelContext(req) {
  const { novelMeta, chapters, currentChapterId } = req.body
  const novelMemory = await loadNovelMemory(req)
  return contextManager.buildNovelContext(novelMeta, chapters, currentChapterId, novelMemory)
}

function setupSSE(res, req) {
  let isConnectionClosed = false
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  req.on('close', () => {
    isConnectionClosed = true
  })

  const onChunk = (chunk) => {
    if (!isConnectionClosed) {
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`)
    }
  }

  return { isConnectionClosed, onChunk }
}

function parseNullableId(value) {
  const parsed = value ? parseInt(value, 10) : null
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * 记录生成历史（失败不阻塞主流程，仅告警）
 */
async function recordGenerationHistory({ req, action, prompt, params, result }) {
  try {
    await GenerationHistory.create({
      userId: req.userId,
      novelId: parseNullableId(req.body.novelId),
      chapterId: parseNullableId(req.body.chapterId),
      action,
      prompt,
      params,
      result
    })
  } catch (logError) {
    console.warn(`写入生成历史失败(${action}):`, logError.message || logError)
  }
}

async function writeAiRequestLog({ req, action, platform, model, status, startedAt, promptText, result, error, metadata }) {
  if (!req.userId) {
    return
  }

  try {
    const resultContent = typeof result === 'string' ? result : (result?.content || '')
    const usage = result?.usage || {
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
      errorMessage: error ? (error.message || String(error)).slice(0, 1000) : null,
      metadata
    })
  } catch (logError) {
    console.warn(`写入AI请求日志失败(${action}):`, logError.message || logError)
  }
}

router.post('/generate', 
  verifyToken,
  body('prompt').trim().notEmpty().withMessage('提示词不能为空'),
  body('chapterTitle').optional().trim(),
  body('platform').optional().trim(),
  body('model').optional().trim(),
  body('apiKey').optional().trim(),
  body('customBaseURL').optional().trim(),
  body('novelMeta').optional(),
  body('chapters').optional(),
  body('currentChapterId').optional(),
  validateRequest,
  async (req, res) => {
    const startedAt = Date.now()
    try {
      const { 
        prompt, chapterTitle, 
        platform = DEFAULT_AI_PLATFORM, model = DEFAULT_AI_MODEL,
        apiKey, customBaseURL,
        genre, style, corePlot, characters, wordCount, other
      } = req.body

      const { isConnectionClosed, onChunk } = setupSSE(res, req)
      const novelContext = await buildNovelContext(req)
      const aiOptions = { apiKey, customBaseURL }

      const userPrompt = {
        genre, style, corePlot, characters, wordCount, chapterTitle, other,
        ...((typeof prompt === 'string') ? { corePlot: prompt } : {})
      }

      const result = await novelAgent.generateChapter(novelContext, userPrompt, platform, model, onChunk, aiOptions)

      await recordGenerationHistory({
        req,
        action: 'generate',
        prompt,
        params: { platform, model, chapterTitle, genre, style, corePlot, characters, wordCount, other },
        result: result?.content
      })

      await writeAiRequestLog({
        req,
        action: 'generate',
        platform,
        model,
        status: 'success',
        startedAt,
        promptText: prompt,
        result,
        metadata: { chapterTitle, genre, style, wordCount }
      })

      if (!isConnectionClosed) {
        res.write(`data: ${JSON.stringify({ done: true, plot: result.plot })}\n\n`)
        res.end()
      }
    } catch (error) {
      console.error('生成章节失败:', error)
      await writeAiRequestLog({
        req,
        action: 'generate',
        platform: req.body.platform || DEFAULT_AI_PLATFORM,
        model: req.body.model || DEFAULT_AI_MODEL,
        status: 'failed',
        startedAt,
        promptText: req.body.prompt || '',
        error
      })
      if (!res.headersSent) {
        res.status(500).json({ message: error.message || '生成章节失败' })
      }
    }
  }
)

router.post('/continue', 
  verifyToken,
  body('prompt').optional().trim(),
  body('lastContent').optional().trim(),
  body('lastPlot').optional().trim(),
  body('platform').optional().trim(),
  body('model').optional().trim(),
  body('apiKey').optional().trim(),
  body('customBaseURL').optional().trim(),
  body('novelMeta').optional(),
  body('chapters').optional(),
  body('currentChapterId').optional(),
  validateRequest,
  async (req, res) => {
    const startedAt = Date.now()
    try {
      const { 
        prompt, lastContent, lastPlot, 
        platform = DEFAULT_AI_PLATFORM, model = DEFAULT_AI_MODEL,
        apiKey, customBaseURL,
        wordCount
      } = req.body

      let novelContext = await buildNovelContext(req)

      if (!novelContext.trim() && lastContent) {
        novelContext = contextManager.buildNovelContext(
          null,
          [{ id: 1, title: '上一章', content: lastContent, plot: lastPlot }],
          1
        )
      }

      if (!novelContext.trim()) {
        return res.status(400).json({ message: '缺少上下文信息，无法续写' })
      }

      const { isConnectionClosed, onChunk } = setupSSE(res, req)
      const aiOptions = { apiKey, customBaseURL }

      const userPrompt = { customPrompt: prompt, wordCount }

      const result = await novelAgent.continueChapter(novelContext, userPrompt, platform, model, onChunk, aiOptions)

      await recordGenerationHistory({
        req,
        action: 'continue',
        prompt,
        params: { platform, model, lastPlot, wordCount },
        result: result?.content
      })

      await writeAiRequestLog({
        req,
        action: 'continue',
        platform,
        model,
        status: 'success',
        startedAt,
        promptText: `${prompt || ''}\n${lastContent || ''}\n${lastPlot || ''}`,
        result,
        metadata: { wordCount }
      })

      if (!isConnectionClosed) {
        res.write(`data: ${JSON.stringify({ done: true, plot: result.plot })}\n\n`)
        res.end()
      }
    } catch (error) {
      console.error('续写章节失败:', error)
      await writeAiRequestLog({
        req,
        action: 'continue',
        platform: req.body.platform || DEFAULT_AI_PLATFORM,
        model: req.body.model || DEFAULT_AI_MODEL,
        status: 'failed',
        startedAt,
        promptText: `${req.body.prompt || ''}\n${req.body.lastContent || ''}\n${req.body.lastPlot || ''}`,
        error
      })
      if (!res.headersSent) {
        res.status(500).json({ message: error.message || '续写章节失败' })
      }
    }
  }
)

router.post('/polish', 
  verifyToken,
  body('content').trim().notEmpty().withMessage('内容不能为空'),
  body('prompt').optional().trim(),
  body('platform').optional().trim(),
  body('model').optional().trim(),
  body('apiKey').optional().trim(),
  body('customBaseURL').optional().trim(),
  body('novelMeta').optional(),
  body('chapters').optional(),
  body('currentChapterId').optional(),
  validateRequest,
  async (req, res) => {
    const startedAt = Date.now()
    try {
      const { 
        content, prompt, 
        platform = DEFAULT_AI_PLATFORM, model = DEFAULT_AI_MODEL,
        apiKey, customBaseURL
      } = req.body

      const novelContext = await buildNovelContext(req)
      const { isConnectionClosed, onChunk } = setupSSE(res, req)
      const aiOptions = { apiKey, customBaseURL }

      const userPrompt = { customPrompt: prompt, content }

      const polishedContent = await novelAgent.polishChapter(novelContext, userPrompt, platform, model, onChunk, aiOptions)

      const { beforeContent, beforePlot, chapterTitle } = req.body
      await recordGenerationHistory({
        req,
        action: 'polish',
        prompt,
        params: { platform, model, beforeContent, beforePlot, chapterTitle },
        result: polishedContent.content
      })

      await writeAiRequestLog({
        req,
        action: 'polish',
        platform,
        model,
        status: 'success',
        startedAt,
        promptText: `${prompt || ''}\n${content || ''}`,
        result: polishedContent,
        metadata: { contentLength: content.length }
      })

      if (!isConnectionClosed) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
        res.end()
      }
    } catch (error) {
      console.error('润色内容失败:', error)
      await writeAiRequestLog({
        req,
        action: 'polish',
        platform: req.body.platform || DEFAULT_AI_PLATFORM,
        model: req.body.model || DEFAULT_AI_MODEL,
        status: 'failed',
        startedAt,
        promptText: `${req.body.prompt || ''}\n${req.body.content || ''}`,
        error
      })
      if (!res.headersSent) {
        res.status(500).json({ message: error.message || '润色内容失败' })
      }
    }
  }
)

router.post('/setting', 
  verifyToken,
  body('type').trim().notEmpty().withMessage('设定类型不能为空'),
  body('prompt').trim().notEmpty().withMessage('提示词不能为空'),
  body('platform').optional().trim(),
  body('model').optional().trim(),
  body('apiKey').optional().trim(),
  body('customBaseURL').optional().trim(),
  validateRequest,
  async (req, res) => {
    const startedAt = Date.now()
    try {
      const { type, prompt, platform = DEFAULT_AI_PLATFORM, model = DEFAULT_AI_MODEL, apiKey, customBaseURL } = req.body

      const typeText = SETTING_TYPE_MAP[type] || '设定'

      const systemPrompt = contextManager.buildSystemPrompt('generate')
      const novelMemory = await loadNovelMemory(req)
      const fullPrompt = `${systemPrompt}${novelMemory ? `\n\n${novelMemory}` : ''}\n\n请生成一个${typeText}。${prompt}`

      const { isConnectionClosed, onChunk } = setupSSE(res, req)
      const aiOptions = { apiKey, customBaseURL }

      const result = await aiService.generateContent(fullPrompt, platform, model, onChunk, aiOptions)

      await writeAiRequestLog({
        req,
        action: 'setting',
        platform,
        model,
        status: 'success',
        startedAt,
        promptText: fullPrompt,
        result,
        metadata: { type }
      })

      if (!isConnectionClosed) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
        res.end()
      }
    } catch (error) {
      console.error('生成设定失败:', error)
      await writeAiRequestLog({
        req,
        action: 'setting',
        platform: req.body.platform || DEFAULT_AI_PLATFORM,
        model: req.body.model || DEFAULT_AI_MODEL,
        status: 'failed',
        startedAt,
        promptText: req.body.prompt || '',
        error,
        metadata: { type: req.body.type }
      })
      if (!res.headersSent) {
        res.status(500).json({ message: error.message || '生成设定失败' })
      }
    }
  }
)

router.post('/outline', 
  verifyToken,
  body('novelType').trim().notEmpty().withMessage('小说类型不能为空'),
  body('corePlot').trim().notEmpty().withMessage('核心剧情不能为空'),
  body('length').optional().trim(),
  body('platform').optional().trim(),
  body('model').optional().trim(),
  body('apiKey').optional().trim(),
  body('customBaseURL').optional().trim(),
  validateRequest,
  async (req, res) => {
    const startedAt = Date.now()
    try {
      const { novelType, corePlot, length, platform = DEFAULT_AI_PLATFORM, model = DEFAULT_AI_MODEL, apiKey, customBaseURL } = req.body

      const novelContext = await buildNovelContext(req)
      const userPrompt = `小说类型：${novelType}\n核心剧情：${corePlot}\n${length ? '篇幅要求：' + length : ''}`

      const { isConnectionClosed, onChunk } = setupSSE(res, req)
      const aiOptions = { apiKey, customBaseURL }

      const result = await novelAgent.generateOutline(novelContext, userPrompt, platform, model, onChunk, aiOptions)

      await writeAiRequestLog({
        req,
        action: 'outline',
        platform,
        model,
        status: 'success',
        startedAt,
        promptText: userPrompt,
        result,
        metadata: { novelType, length }
      })

      if (!isConnectionClosed) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
        res.end()
      }
    } catch (error) {
      console.error('生成大纲失败:', error)
      await writeAiRequestLog({
        req,
        action: 'outline',
        platform: req.body.platform || DEFAULT_AI_PLATFORM,
        model: req.body.model || DEFAULT_AI_MODEL,
        status: 'failed',
        startedAt,
        promptText: `${req.body.novelType || ''}\n${req.body.corePlot || ''}`,
        error
      })
      if (!res.headersSent) {
        res.status(500).json({ message: error.message || '生成大纲失败' })
      }
    }
  }
)

router.post('/creative', 
  verifyToken,
  body('prompt').trim().notEmpty().withMessage('提示词不能为空'),
  body('type').trim().notEmpty().withMessage('创意类型不能为空'),
  body('platform').optional().trim(),
  body('model').optional().trim(),
  body('apiKey').optional().trim(),
  body('customBaseURL').optional().trim(),
  validateRequest,
  async (req, res) => {
    const startedAt = Date.now()
    try {
      const { prompt, type, platform = DEFAULT_AI_PLATFORM, model = DEFAULT_AI_MODEL, apiKey, customBaseURL } = req.body

      const { isConnectionClosed, onChunk } = setupSSE(res, req)
      const aiOptions = { apiKey, customBaseURL }

      const result = await aiService.generateContent(prompt, platform, model, onChunk, aiOptions)

      await recordGenerationHistory({
        req,
        action: 'creative',
        prompt,
        params: { platform, model, type },
        result: result.content
      })

      await writeAiRequestLog({
        req,
        action: 'creative',
        platform,
        model,
        status: 'success',
        startedAt,
        promptText: prompt,
        result,
        metadata: { type }
      })

      if (!isConnectionClosed) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
        res.end()
      }
    } catch (error) {
      console.error('生成创意失败:', error)
      await writeAiRequestLog({
        req,
        action: 'creative',
        platform: req.body.platform || DEFAULT_AI_PLATFORM,
        model: req.body.model || DEFAULT_AI_MODEL,
        status: 'failed',
        startedAt,
        promptText: req.body.prompt || '',
        error,
        metadata: { type: req.body.type }
      })
      if (!res.headersSent) {
        res.status(500).json({ message: error.message || '生成创意失败' })
      }
    }
  }
)

module.exports = router
