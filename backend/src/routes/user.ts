import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { body } from 'express-validator'
import { Op, fn, col } from 'sequelize'
import { AiRequestLog, User } from '../models'
import { verifyToken } from '../middleware/auth'
import { validateRequest } from '../middleware/validate'
import { loginRegisterLimiter } from '../middleware/rateLimit'
import { asyncHandler } from '../utils/asyncHandler'
import { getJwtSecret } from '../config/jwt'
import { AUTH, NOT_FOUND } from '../constants/messages'

const router = Router()

router.post('/register',
  loginRegisterLimiter,
  body('username').trim().isLength({ min: 3, max: 20 }).withMessage('用户名长度必须在3-20个字符之间'),
  body('password').isLength({ min: 6, max: 20 }).withMessage('密码长度必须在6-20个字符之间'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('密码和确认密码不一致')
    }
    return true
  }),
  validateRequest,
  asyncHandler(async (req, res) => {
    const { username, password } = req.body as { username: string; password: string }
    const existingUser = await User.findOne({ where: { username } })
    if (existingUser) {
      return res.status(400).json({ message: '用户名已存在' })
    }

    const user = await User.create({ username, password: 'temp', email: null, bannedAt: null, banReason: null })
    await user.setPassword(password)
    await user.save()
    res.status(201).json({ message: '注册成功' })
  }, '注册失败')
)

router.post('/login',
  loginRegisterLimiter,
  body('username').trim().notEmpty().withMessage('用户名不能为空'),
  body('password').notEmpty().withMessage('密码不能为空'),
  validateRequest,
  asyncHandler(async (req, res) => {
    const { username, password } = req.body as { username: string; password: string }
    const user = await User.findOne({ where: { username } })
    if (!user) {
      return res.status(401).json({ message: '用户名或密码错误' })
    }

    if (user.status === 'banned') {
      return res.status(403).json({ message: AUTH.BANNED })
    }

    if (!(await user.validatePassword(password))) {
      return res.status(401).json({ message: '用户名或密码错误' })
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, getJwtSecret(), { expiresIn: '7d' })
    res.json({
      token,
      userId: user.id,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt
      }
    })
  }, '登录失败')
)

router.get('/info', verifyToken, asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.userId!, {
    attributes: ['id', 'username', 'email', 'role', 'status', 'bannedAt', 'banReason', 'createdAt']
  })
  if (!user) {
    return res.status(404).json({ message: NOT_FOUND.USER })
  }
  res.json(user)
}, '获取用户信息失败'))

router.put('/info',
  verifyToken,
  body('username').optional().trim().isLength({ min: 3, max: 20 }).withMessage('用户名长度必须在3-20个字符之间'),
  body('email').optional().isEmail().withMessage('请输入有效的邮箱地址'),
  validateRequest,
  asyncHandler(async (req, res) => {
    const { username, email } = req.body as { username?: string; email?: string }
    const user = await User.findByPk(req.userId!)
    if (!user) {
      return res.status(404).json({ message: NOT_FOUND.USER })
    }

    if (username && username !== user.username) {
      const existingUser = await User.findOne({ where: { username } })
      if (existingUser) {
        return res.status(400).json({ message: '用户名已存在' })
      }
    }

    await user.update({ username, email })
    res.json({ message: '用户信息更新成功' })
  }, '更新用户信息失败')
)

router.put('/password',
  verifyToken,
  body('currentPassword').notEmpty().withMessage('当前密码不能为空'),
  body('newPassword').isLength({ min: 6, max: 20 }).withMessage('新密码长度必须在6-20个字符之间'),
  validateRequest,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string }
    const user = await User.findByPk(req.userId!)
    if (!user) {
      return res.status(404).json({ message: NOT_FOUND.USER })
    }

    if (!(await user.validatePassword(currentPassword))) {
      return res.status(400).json({ message: '当前密码错误' })
    }

    await user.setPassword(newPassword)
    await user.save()
    res.json({ message: '密码修改成功' })
  }, '修改密码失败')
)

const startOfToday = (): Date => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

const startOfMonth = (): Date => {
  const date = new Date()
  date.setDate(1)
  date.setHours(0, 0, 0, 0)
  return date
}

const sumTokens = (rows: Array<Record<string, unknown>>): {
  promptTokens: number
  cachedPromptTokens: number
  completionTokens: number
  totalTokens: number
} => ({
  promptTokens: Number(rows[0]?.promptTokens) || 0,
  cachedPromptTokens: Number(rows[0]?.cachedPromptTokens) || 0,
  completionTokens: Number(rows[0]?.completionTokens) || 0,
  totalTokens: Number(rows[0]?.totalTokens) || 0
})

router.get('/usage/summary', verifyToken, asyncHandler(async (req, res) => {
  const userId = req.userId!
  const tokenAttrs = [
    [fn('SUM', col('promptTokens')), 'promptTokens'],
    [fn('SUM', col('cachedPromptTokens')), 'cachedPromptTokens'],
    [fn('SUM', col('completionTokens')), 'completionTokens'],
    [fn('SUM', col('totalTokens')), 'totalTokens']
  ] as const

  const [todayRows, monthRows, totalRows, officialCount, estimatedCount, breakdown] = await Promise.all([
    AiRequestLog.findAll({ attributes: [...tokenAttrs], where: { userId, createdAt: { [Op.gte]: startOfToday() } }, raw: true }) as unknown as Array<Record<string, unknown>>,
    AiRequestLog.findAll({ attributes: [...tokenAttrs], where: { userId, createdAt: { [Op.gte]: startOfMonth() } }, raw: true }) as unknown as Array<Record<string, unknown>>,
    AiRequestLog.findAll({ attributes: [...tokenAttrs], where: { userId }, raw: true }) as unknown as Array<Record<string, unknown>>,
    AiRequestLog.count({ where: { userId, isEstimated: false } }),
    AiRequestLog.count({ where: { userId, isEstimated: true } }),
    AiRequestLog.findAll({
      attributes: [
        'platform',
        'model',
        [fn('SUM', col('promptTokens')), 'promptTokens'],
        [fn('SUM', col('cachedPromptTokens')), 'cachedPromptTokens'],
        [fn('SUM', col('completionTokens')), 'completionTokens'],
        [fn('SUM', col('totalTokens')), 'totalTokens'],
        [fn('COUNT', col('id')), 'requestCount']
      ],
      where: { userId },
      group: ['platform', 'model'],
      raw: true
    }) as unknown as Array<Record<string, unknown>>
  ])

  res.json({
    today: sumTokens(todayRows),
    month: sumTokens(monthRows),
    total: sumTokens(totalRows),
    officialCount,
    estimatedCount,
    breakdown: breakdown.map((row) => ({
      platform: String(row.platform || ''),
      model: String(row.model || ''),
      promptTokens: Number(row.promptTokens) || 0,
      cachedPromptTokens: Number(row.cachedPromptTokens) || 0,
      completionTokens: Number(row.completionTokens) || 0,
      totalTokens: Number(row.totalTokens) || 0,
      requestCount: Number(row.requestCount) || 0
    }))
  })
}, '获取用量汇总失败'))

router.get('/usage/logs', verifyToken, asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '10'), 10) || 10))
  const { rows, count } = await AiRequestLog.findAndCountAll({
    where: { userId: req.userId! },
    order: [['createdAt', 'DESC']],
    limit,
    offset: (page - 1) * limit,
    attributes: [
      'id', 'action', 'platform', 'model', 'promptTokens', 'cachedPromptTokens',
      'uncachedPromptTokens', 'completionTokens', 'totalTokens', 'isEstimated',
      'tokenSource', 'keySource', 'createdAt'
    ]
  })
  res.json({ items: rows, total: count, page, limit })
}, '获取用量明细失败'))

export default router
