import { Router } from 'express'
import { body } from 'express-validator'
import { Feedback } from '../models'
import { verifyToken, requireAdmin } from '../middleware/auth'
import { validateRequest } from '../middleware/validate'
import { asyncHandler } from '../utils/asyncHandler'
import { isMissingTableError } from '../utils/dbErrors'

const router = Router()

router.post('/',
  verifyToken,
  body('type').trim().notEmpty().withMessage('反馈类型不能为空'),
  body('content').trim().notEmpty().withMessage('反馈内容不能为空'),
  validateRequest,
  asyncHandler(async (req, res) => {
    const { type, content } = req.body as { type: string; content: string }
    try {
      await Feedback.create({ type, content, userId: req.userId! })
      res.status(201).json({ message: '反馈提交成功' })
    } catch (error) {
      if (isMissingTableError(error)) {
        return res.status(503).json({ message: '反馈功能未初始化，请在后端执行 npm run db:migrate:feedback' })
      }
      throw error
    }
  }, '提交反馈失败'))

router.get('/', verifyToken, requireAdmin, asyncHandler(async (_req, res) => {
  try {
    const feedbacks = await Feedback.findAll({ order: [['createdAt', 'DESC']] })
    res.json(feedbacks)
  } catch (error) {
    if (isMissingTableError(error)) {
      return res.json([])
    }
    throw error
  }
}, '获取反馈列表失败'))

export default router
