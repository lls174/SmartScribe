const express = require('express')
const router = express.Router()
const { Feedback } = require('../models')
const { verifyToken, requireAdmin } = require('../middleware/auth')

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
router.get('/', verifyToken, requireAdmin, async (req, res) => {
  try {
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