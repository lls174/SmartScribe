const express = require('express')
const router = express.Router()
const novelAgent = require('../services/novelAgent')
const contextManager = require('../services/contextManager')
const aiService = require('../services/aiService')
const { body, validationResult } = require('express-validator')
const { verifyToken } = require('../middleware/auth')

function buildNovelContext(req) {
  const { novelMeta, chapters, currentChapterId } = req.body
  return contextManager.buildNovelContext(novelMeta, chapters, currentChapterId)
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
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg })
      }

      const { 
        prompt, chapterTitle, 
        platform = 'aliyun', model = 'qwen-turbo',
        apiKey, customBaseURL,
        genre, style, corePlot, characters, wordCount, other
      } = req.body

      const { isConnectionClosed, onChunk } = setupSSE(res, req)
      const novelContext = buildNovelContext(req)
      const aiOptions = { apiKey, customBaseURL }

      const userPrompt = {
        genre, style, corePlot, characters, wordCount, chapterTitle, other,
        ...((typeof prompt === 'string') ? { corePlot: prompt } : {})
      }

      const result = await novelAgent.generateChapter(novelContext, userPrompt, platform, model, onChunk, aiOptions)

      if (!isConnectionClosed) {
        res.write(`data: ${JSON.stringify({ done: true, plot: result.plot })}\n\n`)
        res.end()
      }
    } catch (error) {
      console.error('生成章节失败:', error)
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
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg })
      }

      const { 
        prompt, lastContent, lastPlot, 
        platform = 'aliyun', model = 'qwen-turbo',
        apiKey, customBaseURL,
        wordCount
      } = req.body

      let novelContext = buildNovelContext(req)

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

      if (!isConnectionClosed) {
        res.write(`data: ${JSON.stringify({ done: true, plot: result.plot })}\n\n`)
        res.end()
      }
    } catch (error) {
      console.error('续写章节失败:', error)
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
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg })
      }

      const { 
        content, prompt, 
        platform = 'aliyun', model = 'qwen-turbo',
        apiKey, customBaseURL
      } = req.body

      const novelContext = buildNovelContext(req)
      const { isConnectionClosed, onChunk } = setupSSE(res, req)
      const aiOptions = { apiKey, customBaseURL }

      const userPrompt = { customPrompt: prompt }

      const polishedContent = await novelAgent.polishChapter(novelContext, userPrompt, platform, model, onChunk, aiOptions)

      if (!isConnectionClosed) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
        res.end()
      }
    } catch (error) {
      console.error('润色内容失败:', error)
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
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg })
      }

      const { type, prompt, platform = 'aliyun', model = 'qwen-turbo', apiKey, customBaseURL } = req.body

      const typeMap = { character: '人物设定', world: '世界观设定', item: '道具设定' }
      const typeText = typeMap[type] || '设定'

      const systemPrompt = contextManager.buildSystemPrompt('generate')
      const fullPrompt = `${systemPrompt}\n\n请生成一个${typeText}。${prompt}`

      const { isConnectionClosed, onChunk } = setupSSE(res, req)
      const aiOptions = { apiKey, customBaseURL }

      const result = await aiService.generateContent(fullPrompt, platform, model, onChunk, aiOptions)

      if (!isConnectionClosed) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
        res.end()
      }
    } catch (error) {
      console.error('生成设定失败:', error)
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
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg })
      }

      const { novelType, corePlot, length, platform = 'aliyun', model = 'qwen-turbo', apiKey, customBaseURL } = req.body

      const novelContext = buildNovelContext(req)
      const userPrompt = `小说类型：${novelType}\n核心剧情：${corePlot}\n${length ? '篇幅要求：' + length : ''}`

      const { isConnectionClosed, onChunk } = setupSSE(res, req)
      const aiOptions = { apiKey, customBaseURL }

      const result = await novelAgent.generateOutline(novelContext, userPrompt, platform, model, onChunk, aiOptions)

      if (!isConnectionClosed) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
        res.end()
      }
    } catch (error) {
      console.error('生成大纲失败:', error)
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
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg })
      }

      const { prompt, type, platform = 'aliyun', model = 'qwen-turbo', apiKey, customBaseURL } = req.body

      const { isConnectionClosed, onChunk } = setupSSE(res, req)
      const aiOptions = { apiKey, customBaseURL }

      const result = await aiService.generateContent(prompt, platform, model, onChunk, aiOptions)

      if (!isConnectionClosed) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
        res.end()
      }
    } catch (error) {
      console.error('生成创意失败:', error)
      if (!res.headersSent) {
        res.status(500).json({ message: error.message || '生成创意失败' })
      }
    }
  }
)

module.exports = router
