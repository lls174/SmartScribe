import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { body } from 'express-validator'
import { User } from '../models'
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

export default router
