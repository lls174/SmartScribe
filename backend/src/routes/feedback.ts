import { Router } from 'express'
import { Feedback } from '../models'
import { verifyToken, requireAdmin } from '../middleware/auth'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

router.post('/', verifyToken, asyncHandler(async (req, res) => {
  const { type, content } = req.body as { type: string; content: string }
  await Feedback.create({ type, content, userId: req.userId! })
  res.status(201).json({ message: '反馈提交成功' })
}, '提交反馈失败'))

router.get('/', verifyToken, requireAdmin, asyncHandler(async (_req, res) => {
  const feedbacks = await Feedback.findAll({ order: [['createdAt', 'DESC']] })
  res.json(feedbacks)
}, '获取反馈列表失败'))

export default router
