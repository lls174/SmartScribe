const express = require('express')
const { Op, fn, col } = require('sequelize')
const { body } = require('express-validator')
const { User, Feedback, AiRequestLog } = require('../models')
const { verifyToken, requireAdmin } = require('../middleware/auth')
const { validateRequest } = require('../middleware/validate')
const { asyncHandler } = require('../utils/asyncHandler')
const { parsePagination } = require('../utils/pagination')
const { NOT_FOUND } = require('../constants/messages')

const router = express.Router()

const getBootstrapKey = (req) => req.headers['x-admin-bootstrap-key'] || req.body.bootstrapKey

router.post('/bootstrap',
  body('username').trim().isLength({ min: 3, max: 20 }).withMessage('用户名长度必须在3-20个字符之间'),
  body('password').optional().isLength({ min: 6, max: 20 }).withMessage('密码长度必须在6-20个字符之间'),
  body('email').optional().isEmail().withMessage('请输入有效的邮箱地址'),
  validateRequest,
  asyncHandler(async (req, res) => {
    if (!process.env.ADMIN_BOOTSTRAP_KEY) {
      return res.status(503).json({ message: 'ADMIN_BOOTSTRAP_KEY 未配置' })
    }

    if (getBootstrapKey(req) !== process.env.ADMIN_BOOTSTRAP_KEY) {
      return res.status(403).json({ message: '初始化密钥无效' })
    }

    const { username, password, email } = req.body
    let user = await User.findOne({ where: { username } })

    if (!user) {
      if (!password) {
        return res.status(400).json({ message: '创建管理员时必须提供密码' })
      }

      user = await User.create({
        username,
        password: 'temp',
        email,
        role: 'admin',
        status: 'active'
      })
      await user.setPassword(password)
      await user.save()
    } else {
      await user.update({
        role: 'admin',
        status: 'active',
        bannedAt: null,
        banReason: null
      })
    }

    res.json({
      message: '管理员初始化成功',
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        status: user.status
      }
    })
  }, '初始化管理员失败')
)

router.use(verifyToken, requireAdmin)

router.get('/feedbacks', asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req)
  const { rows, count } = await Feedback.findAndCountAll({
    include: [{
      model: User,
      attributes: ['id', 'username']
    }],
    order: [['createdAt', 'DESC']],
    limit,
    offset
  })

  res.json({ items: rows, total: count, page, limit })
}, '获取反馈列表失败'))

router.get('/users', asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req)
  const { rows, count } = await User.findAndCountAll({
    attributes: ['id', 'username', 'email', 'role', 'status', 'bannedAt', 'banReason', 'createdAt', 'updatedAt'],
    order: [['createdAt', 'DESC']],
    limit,
    offset
  })

  const userIds = rows.map((user) => user.id)
  const usageRows = userIds.length
    ? await AiRequestLog.findAll({
      attributes: [
        'userId',
        [fn('COUNT', col('AiRequestLog.id')), 'requestCount'],
        [fn('SUM', col('totalTokens')), 'totalTokens']
      ],
      where: { userId: { [Op.in]: userIds } },
      group: ['userId'],
      raw: true
    })
    : []

  const usageMap = usageRows.reduce((map, row) => {
    map[row.userId] = {
      requestCount: Number(row.requestCount) || 0,
      totalTokens: Number(row.totalTokens) || 0
    }
    return map
  }, {})

  res.json({
    items: rows.map((user) => ({
      ...user.toJSON(),
      requestCount: usageMap[user.id]?.requestCount || 0,
      totalTokens: usageMap[user.id]?.totalTokens || 0
    })),
    total: count,
    page,
    limit
  })
}, '获取用户列表失败'))

router.post('/users/:id/ban',
  body('reason').optional().trim().isLength({ max: 200 }).withMessage('封禁原因不能超过200个字符'),
  validateRequest,
  asyncHandler(async (req, res) => {
    const userId = parseInt(req.params.id, 10)
    if (userId === req.userId) {
      return res.status(400).json({ message: '不能封禁当前管理员账号' })
    }

    const user = await User.findByPk(userId)
    if (!user) {
      return res.status(404).json({ message: NOT_FOUND.USER })
    }

    await user.update({
      status: 'banned',
      bannedAt: new Date(),
      banReason: req.body.reason || null
    })

    res.json({ message: '用户已封禁' })
  }, '封禁用户失败')
)

router.post('/users/:id/unban', asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id)
  if (!user) {
    return res.status(404).json({ message: NOT_FOUND.USER })
  }

  await user.update({
    status: 'active',
    bannedAt: null,
    banReason: null
  })

  res.json({ message: '用户已解封' })
}, '解封用户失败'))

router.get('/usage/summary', asyncHandler(async (req, res) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [totalRequests, successRequests, failedRequests, tokenRows, todayTokenRows] = await Promise.all([
    AiRequestLog.count(),
    AiRequestLog.count({ where: { status: 'success' } }),
    AiRequestLog.count({ where: { status: 'failed' } }),
    AiRequestLog.findAll({
      attributes: [[fn('SUM', col('totalTokens')), 'totalTokens']],
      raw: true
    }),
    AiRequestLog.findAll({
      attributes: [[fn('SUM', col('totalTokens')), 'totalTokens']],
      where: { createdAt: { [Op.gte]: today } },
      raw: true
    })
  ])

  res.json({
    totalRequests,
    successRequests,
    failedRequests,
    totalTokens: Number(tokenRows[0]?.totalTokens) || 0,
    todayTokens: Number(todayTokenRows[0]?.totalTokens) || 0
  })
}, '获取系统用量失败'))

router.get('/usage/logs', asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req)
  const where = {}

  if (req.query.userId) {
    where.userId = parseInt(req.query.userId, 10)
  }
  if (req.query.platform) {
    where.platform = req.query.platform
  }
  if (req.query.model) {
    where.model = req.query.model
  }
  if (req.query.status) {
    where.status = req.query.status
  }

  const { rows, count } = await AiRequestLog.findAndCountAll({
    where,
    include: [{
      model: User,
      attributes: ['id', 'username']
    }],
    order: [['createdAt', 'DESC']],
    limit,
    offset
  })

  res.json({ items: rows, total: count, page, limit })
}, '获取 AI 请求日志失败'))

module.exports = router
