const express = require('express')
const router = express.Router()
const { Feedback } = require('../models')

/**
 * 验证JWT token的中间件
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @param {Function} next - 下一个中间件函数
 * @returns {void}
 */
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) {
    return res.status(401).json({ message: '未授权' })
  }

  try {
    // 测试环境下，使用测试token
    if (process.env.NODE_ENV === 'test' && token === 'test-token') {
      req.userId = 1
      return next()
    }
    
    // 实际环境下，验证JWT token
    const jwt = require('jsonwebtoken')
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.userId = decoded.userId
    next()
  } catch (error) {
    console.error('Token验证失败:', error)
    return res.status(401).json({ message: '无效的token' })
  }
}

/**
 * 提交反馈
 * @route POST /api/feedback
 * @description 提交用户反馈
 * @param {string} type - 反馈类型
 * @param {string} content - 反馈内容
 * @returns {Object} - 提交结果
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const { type, content } = req.body
    const feedback = await Feedback.create({ 
      type, 
      content, 
      userId: req.userId 
    })
    res.status(201).json({ message: '反馈提交成功' })
  } catch (error) {
    console.error('提交反馈失败:', error)
    res.status(500).json({ message: '提交反馈失败' })
  }
})

/**
 * 获取反馈列表
 * @route GET /api/feedback
 * @description 获取所有反馈列表（管理员功能）
 * @returns {Array} - 反馈列表
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    // 检查管理员权限
    const isAdmin = req.headers['x-admin-key'] === process.env.ADMIN_PASSWORD
    if (!isAdmin) {
      return res.status(403).json({ message: '需要管理员权限' })
    }

    const feedbacks = await Feedback.findAll({ 
      order: [['createdAt', 'DESC']]
    })
    res.json(feedbacks)
  } catch (error) {
    console.error('获取反馈列表失败:', error)
    res.status(500).json({ message: '获取反馈列表失败' })
  }
})

module.exports = router