import { Router } from 'express'
import { body } from 'express-validator'
import creativeService from '../services/creativeService'
import { verifyToken } from '../middleware/auth'
import { validateRequest } from '../middleware/validate'
import { asyncHandler } from '../utils/asyncHandler'
import { parsePagination } from '../utils/pagination'
import { NOT_FOUND } from '../constants/messages'

const router = Router()

router.post('/create',
  verifyToken,
  body('title').trim().notEmpty().withMessage('标题不能为空'),
  body('type').trim().notEmpty().withMessage('类型不能为空'),
  body('content').trim().notEmpty().withMessage('内容不能为空'),
  body('genre').optional().trim(),
  validateRequest,
  asyncHandler(async (req, res) => {
    const { title, type, genre, content } = req.body as {
      title: string
      type: string
      genre?: string
      content: string
    }
    const creative = await creativeService.createCreative(req.userId!, title, type, genre, content)
    res.status(201).json({ message: '创意保存成功', creative })
  }, '保存创意失败')
)

router.get('/list', verifyToken, asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req, { defaultLimit: 10 })
  const result = await creativeService.getCreativesByUserId(req.userId!, page, limit)
  res.json(result)
}, '获取创意列表失败'))

router.get('/:id', verifyToken, asyncHandler(async (req, res) => {
  const creative = await creativeService.getCreativeById(req.params.id, req.userId!)
  if (!creative) {
    return res.status(404).json({ message: NOT_FOUND.CREATIVE })
  }
  res.json(creative)
}, '获取创意详情失败'))

router.put('/:id',
  verifyToken,
  body('title').optional().trim(),
  body('content').optional().trim(),
  body('genre').optional().trim(),
  asyncHandler(async (req, res) => {
    const { title, content, genre } = req.body as { title?: string; content?: string; genre?: string }
    const updated = await creativeService.updateCreative(req.params.id, req.userId!, { title, content, genre })
    if (updated) {
      res.json({ message: '创意更新成功' })
    } else {
      res.status(404).json({ message: NOT_FOUND.CREATIVE })
    }
  }, '更新创意失败')
)

router.delete('/:id', verifyToken, asyncHandler(async (req, res) => {
  const deleted = await creativeService.deleteCreative(req.params.id, req.userId!)
  if (deleted) {
    res.json({ message: '创意删除成功' })
  } else {
    res.status(404).json({ message: NOT_FOUND.CREATIVE })
  }
}, '删除创意失败'))

export default router
