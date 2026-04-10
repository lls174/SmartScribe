const express = require('express')
const router = express.Router()
const aiService = require('../services/aiService')
const { body, validationResult } = require('express-validator')

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1] || req.query.token
  if (!token) {
    return res.status(401).json({ message: '未授权' })
  }

  try {
    if (process.env.NODE_ENV === 'test' && token === 'test-token') {
      req.userId = 1
      return next()
    }
    
    const jwt = require('jsonwebtoken')
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.userId = decoded.userId
    next()
  } catch (error) {
    console.error('Token验证失败:', error)
    return res.status(401).json({ message: '无效的token' })
  }
}

const SUPPORTED_PLATFORMS = ['aliyun', 'glm', 'zhipu', 'deepseek', 'openai', 'custom']

router.post('/generate', 
  verifyToken,
  body('prompt').trim().notEmpty().withMessage('提示词不能为空'),
  body('chapterTitle').optional().trim(),
  body('platform').optional().trim(),
  body('model').optional().trim(),
  body('apiKey').optional().trim(),
  body('customBaseURL').optional().trim(),
  async (req, res) => {
    let isConnectionClosed = false
    
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg })
      }

      const { 
        prompt, chapterTitle, 
        platform = 'aliyun', model = 'qwen-turbo',
        apiKey, customBaseURL
      } = req.body

      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')

      req.on('close', () => {
        isConnectionClosed = true
        console.log('客户端断开连接')
      })

      const onChunk = (chunk) => {
        if (!isConnectionClosed) {
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`)
        }
      }

      const aiOptions = { apiKey, customBaseURL }
      const result = await aiService.generateChapter(prompt, chapterTitle, platform, model, onChunk, aiOptions)

      if (!isConnectionClosed) {
        res.write(`data: ${JSON.stringify({ done: true, plot: result.plot })}\n\n`)
        res.end()
      }

  } catch (error) {
    console.error('生成章节失败:', error)
    if (!isConnectionClosed && !res.headersSent) {
      res.status(500).json({ message: '生成章节失败' })
    }
  }
})

router.post('/continue', 
  verifyToken,
  body('prompt').optional().trim(),
  body('lastContent').trim().notEmpty().withMessage('上次内容不能为空'),
  body('lastPlot').optional().trim(),
  body('platform').optional().trim(),
  body('model').optional().trim(),
  body('apiKey').optional().trim(),
  body('customBaseURL').optional().trim(),
  async (req, res) => {
    let isConnectionClosed = false
    
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg })
      }

      const { 
        prompt, lastContent, lastPlot, 
        platform = 'aliyun', model = 'qwen-turbo',
        apiKey, customBaseURL
      } = req.body

      if (!lastContent || !lastContent.trim()) {
        return res.status(400).json({ message: '上次内容不能为空' })
      }

      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')

      req.on('close', () => {
        isConnectionClosed = true
        console.log('客户端断开连接')
      })

      const onChunk = (chunk) => {
        if (!isConnectionClosed) {
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`)
        }
      }

      const aiOptions = { apiKey, customBaseURL }
      const result = await aiService.continueChapter(lastContent, lastPlot, prompt, platform, model, onChunk, aiOptions)

      if (!isConnectionClosed) {
        res.write(`data: ${JSON.stringify({ done: true, plot: result.plot })}\n\n`)
        res.end()
      }

  } catch (error) {
    console.error('续写章节失败:', error)
    if (!isConnectionClosed && !res.headersSent) {
      res.status(500).json({ message: '续写章节失败' })
    }
  }
})

router.post('/polish', 
  verifyToken,
  body('content').trim().notEmpty().withMessage('内容不能为空'),
  body('prompt').optional().trim(),
  body('platform').optional().trim(),
  body('model').optional().trim(),
  body('apiKey').optional().trim(),
  body('customBaseURL').optional().trim(),
  async (req, res) => {
    let isConnectionClosed = false
    
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

      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')

      req.on('close', () => {
        isConnectionClosed = true
        console.log('客户端断开连接')
      })

      const onChunk = (chunk) => {
        if (!isConnectionClosed) {
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`)
        }
      }

      const aiOptions = { apiKey, customBaseURL }
      const polishedContent = await aiService.polishContent(content, prompt, platform, model, onChunk, aiOptions)

      if (!isConnectionClosed) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
        res.end()
      }

  } catch (error) {
    console.error('润色内容失败:', error)
    if (!isConnectionClosed && !res.headersSent) {
      res.status(500).json({ message: '润色内容失败' })
    }
  }
})

router.post('/setting', 
  verifyToken,
  body('type').trim().notEmpty().withMessage('设定类型不能为空'),
  body('prompt').trim().notEmpty().withMessage('提示词不能为空'),
  body('platform').optional().trim(),
  body('model').optional().trim(),
  body('apiKey').optional().trim(),
  body('customBaseURL').optional().trim(),
  async (req, res) => {
    let isConnectionClosed = false
    
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg })
      }

      const { 
        type, prompt, 
        platform = 'aliyun', model = 'qwen-turbo',
        apiKey, customBaseURL
      } = req.body

      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')

      req.on('close', () => {
        isConnectionClosed = true
        console.log('客户端断开连接')
      })

      const onChunk = (chunk) => {
        if (!isConnectionClosed) {
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`)
        }
      }

      const aiOptions = { apiKey, customBaseURL }
      const generatedSetting = await aiService.generateSetting(type, prompt, platform, model, onChunk, aiOptions)

      if (!isConnectionClosed) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
        res.end()
      }

  } catch (error) {
    console.error('生成设定失败:', error)
    if (!isConnectionClosed && !res.headersSent) {
      res.status(500).json({ message: '生成设定失败' })
    }
  }
})

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
    let isConnectionClosed = false
    
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg })
      }

      const { 
        novelType, corePlot, length, 
        platform = 'aliyun', model = 'qwen-turbo',
        apiKey, customBaseURL
      } = req.body

      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')

      req.on('close', () => {
        isConnectionClosed = true
        console.log('客户端断开连接')
      })

      const onChunk = (chunk) => {
        if (!isConnectionClosed) {
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`)
        }
      }

      const aiOptions = { apiKey, customBaseURL }
      const outline = await aiService.generateOutline(novelType, corePlot, length, platform, model, onChunk, aiOptions)

      if (!isConnectionClosed) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
        res.end()
      }

  } catch (error) {
    console.error('生成大纲失败:', error)
    if (!isConnectionClosed && !res.headersSent) {
      res.status(500).json({ message: '生成大纲失败' })
    }
  }
})

router.post('/creative', 
  verifyToken,
  body('prompt').trim().notEmpty().withMessage('提示词不能为空'),
  body('type').trim().notEmpty().withMessage('创意类型不能为空'),
  body('platform').optional().trim(),
  body('model').optional().trim(),
  body('apiKey').optional().trim(),
  body('customBaseURL').optional().trim(),
  async (req, res) => {
    let isConnectionClosed = false
    
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg })
      }

      const { 
        prompt, type, 
        platform = 'aliyun', model = 'qwen-turbo',
        apiKey, customBaseURL
      } = req.body

      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')

      req.on('close', () => {
        isConnectionClosed = true
        console.log('客户端断开连接')
      })

      const onChunk = (chunk) => {
        if (!isConnectionClosed) {
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`)
        }
      }

      const aiOptions = { apiKey, customBaseURL }
      const creativeContent = await aiService.generateCreative(prompt, type, platform, model, onChunk, aiOptions)

      if (!isConnectionClosed) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
        res.end()
      }

  } catch (error) {
    console.error('生成创意失败:', error)
    if (!isConnectionClosed && !res.headersSent) {
      res.status(500).json({ message: '生成创意失败' })
    }
  }
})

module.exports = router
