/**
 * 用户路由
 * 处理用户相关的请求，包括注册、登录、获取用户信息、更新用户信息、修改密码
 */
const express = require('express')
const router = express.Router()
const { User } = require('../models')
const jwt = require('jsonwebtoken')
const { body } = require('express-validator')
const { verifyToken } = require('../middleware/auth')
const { validateRequest } = require('../middleware/validate')
const { loginRegisterLimiter } = require('../middleware/rateLimit')
const { asyncHandler } = require('../utils/asyncHandler')
const { getJwtSecret } = require('../config/jwt')
const { NOT_FOUND, AUTH } = require('../constants/messages')

/**
 * 用户注册
 * @route POST /api/user/register
 * @description 创建新用户
 * @param {string} username - 用户名（3-20个字符）
 * @param {string} password - 密码（6-20个字符）
 * @param {string} confirmPassword - 确认密码（必须与密码一致）
 * @returns {Object} - 注册结果
 */
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
    const { username, password } = req.body

    // 检查用户名是否已存在
    const existingUser = await User.findOne({ where: { username } })
    if (existingUser) {
      return res.status(400).json({ message: '用户名已存在' })
    }

    // 创建新用户（先以临时密码创建，再异步加密）
    const user = await User.create({ username, password: 'temp' })
    await user.setPassword(password)
    await user.save()
    res.status(201).json({ message: '注册成功' })
  }, '注册失败')
)

/**
 * 用户登录
 * @route POST /api/user/login
 * @description 用户登录并获取JWT token
 * @param {string} username - 用户名
 * @param {string} password - 密码
 * @returns {Object} - 登录结果，包含token和userId
 */
router.post('/login',
  loginRegisterLimiter,
  body('username').trim().notEmpty().withMessage('用户名不能为空'),
  body('password').notEmpty().withMessage('密码不能为空'),
  validateRequest,
  asyncHandler(async (req, res) => {
    const { username, password } = req.body

    // 查找用户
    const user = await User.findOne({ where: { username } })
    if (!user) {
      return res.status(401).json({ message: '用户名或密码错误' })
    }

    if (user.status === 'banned') {
      return res.status(403).json({ message: AUTH.BANNED })
    }

    // 验证密码
    if (!(await user.validatePassword(password))) {
      return res.status(401).json({ message: '用户名或密码错误' })
    }

    // 生成token
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

/**
 * 获取用户信息
 * @route GET /api/user/info
 * @description 获取当前登录用户的信息
 * @returns {Object} - 用户信息
 */
router.get('/info', verifyToken, asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.userId, {
    attributes: ['id', 'username', 'email', 'role', 'status', 'bannedAt', 'banReason', 'createdAt']
  })
  if (!user) {
    return res.status(404).json({ message: NOT_FOUND.USER })
  }

  res.json(user)
}, '获取用户信息失败'))

/**
 * 更新用户信息
 * @route PUT /api/user/info
 * @description 更新当前登录用户的信息
 * @param {string} username - 用户名（3-20个字符，可选）
 * @param {string} email - 邮箱地址（可选）
 * @returns {Object} - 更新结果
 */
router.put('/info',
  verifyToken,
  body('username').optional().trim().isLength({ min: 3, max: 20 }).withMessage('用户名长度必须在3-20个字符之间'),
  body('email').optional().isEmail().withMessage('请输入有效的邮箱地址'),
  validateRequest,
  asyncHandler(async (req, res) => {
    const { username, email } = req.body
    const user = await User.findByPk(req.userId)
    if (!user) {
      return res.status(404).json({ message: NOT_FOUND.USER })
    }

    // 检查用户名是否已被其他用户使用
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ where: { username } })
      if (existingUser) {
        return res.status(400).json({ message: '用户名已存在' })
      }
    }

    // 更新用户信息
    await user.update({ username, email })

    res.json({ message: '用户信息更新成功' })
  }, '更新用户信息失败')
)

/**
 * 修改密码
 * @route PUT /api/user/password
 * @description 修改当前登录用户的密码
 * @param {string} currentPassword - 当前密码
 * @param {string} newPassword - 新密码（6-20个字符）
 * @returns {Object} - 修改结果
 */
router.put('/password',
  verifyToken,
  body('currentPassword').notEmpty().withMessage('当前密码不能为空'),
  body('newPassword').isLength({ min: 6, max: 20 }).withMessage('新密码长度必须在6-20个字符之间'),
  validateRequest,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body
    const user = await User.findByPk(req.userId)
    if (!user) {
      return res.status(404).json({ message: NOT_FOUND.USER })
    }

    // 验证当前密码
    if (!(await user.validatePassword(currentPassword))) {
      return res.status(400).json({ message: '当前密码错误' })
    }

    // 更新密码
    await user.setPassword(newPassword)
    await user.save()
    res.json({ message: '密码修改成功' })
  }, '修改密码失败')
)

module.exports = router
