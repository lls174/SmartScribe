const express = require('express')
const router = express.Router()
const creativeService = require('../services/creativeService')
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

router.post('/create', 
  verifyToken,
  body('title').trim().notEmpty().withMessage('标题不能为空'),
  body('type').trim().notEmpty().withMessage('类型不能为空'),
  body('content').trim().notEmpty().withMessage('内容不能为空'),
  body('genre').optional().trim(),
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg })
      }

      const { title, type, genre, content } = req.body
      const creative = await creativeService.createCreative(req.userId, title, type, genre, content)
      
      res.status(201).json({ message: '创意保存成功', creative })
    } catch (error) {
      console.error('保存创意失败:', error)
      res.status(500).json({ message: '保存创意失败' })
    }
  }
)

router.get('/list', 
  verifyToken,
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1
      const limit = parseInt(req.query.limit) || 10
      
      const result = await creativeService.getCreativesByUserId(req.userId, page, limit)
      res.json(result)
    } catch (error) {
      console.error('获取创意列表失败:', error)
      res.status(500).json({ message: '获取创意列表失败' })
    }
  }
)

router.get('/:id', 
  verifyToken,
  async (req, res) => {
    try {
      const { id } = req.params
      const creative = await creativeService.getCreativeById(id, req.userId)
      
      if (!creative) {
        return res.status(404).json({ message: '创意不存在' })
      }
      
      res.json(creative)
    } catch (error) {
      console.error('获取创意详情失败:', error)
      res.status(500).json({ message: '获取创意详情失败' })
    }
  }
)

router.put('/:id', 
  verifyToken,
  body('title').optional().trim(),
  body('content').optional().trim(),
  body('genre').optional().trim(),
  async (req, res) => {
    try {
      const { id } = req.params
      const { title, content, genre } = req.body
      
      const updated = await creativeService.updateCreative(id, req.userId, { title, content, genre })
      
      if (updated) {
        res.json({ message: '创意更新成功' })
      } else {
        res.status(404).json({ message: '创意不存在' })
      }
    } catch (error) {
      console.error('更新创意失败:', error)
      res.status(500).json({ message: '更新创意失败' })
    }
  }
)

router.delete('/:id', 
  verifyToken,
  async (req, res) => {
    try {
      const { id } = req.params
      const deleted = await creativeService.deleteCreative(id, req.userId)
      
      if (deleted) {
        res.json({ message: '创意删除成功' })
      } else {
        res.status(404).json({ message: '创意不存在' })
      }
    } catch (error) {
      console.error('删除创意失败:', error)
      res.status(500).json({ message: '删除创意失败' })
    }
  }
)

module.exports = router
