import { Router } from 'express'
import { Op, fn, col } from 'sequelize'
import { body } from 'express-validator'
import { AiModelCatalog, AiModelPrice, AiRequestLog, Feedback, User } from '../models'
import { seedCatalogIfEmpty, syncOfficialModels } from '../services/aiCatalogService'
import { getSiteAiDefaults, setSiteAiDefaults } from '../services/aiCredentialService'
import { listPrices, syncCommunityPrices, syncOfficialPrices, upsertManualPrice } from '../services/aiPriceService'
import { moneyToStore } from '../utils/decimalMoney'
import { verifyToken, requireAdmin } from '../middleware/auth'
import { validateRequest } from '../middleware/validate'
import { asyncHandler } from '../utils/asyncHandler'
import { parsePagination } from '../utils/pagination'
import { NOT_FOUND } from '../constants/messages'

const router = Router()

const getBootstrapKey = (req: { headers: Record<string, unknown>; body: Record<string, unknown> }): unknown =>
  req.headers['x-admin-bootstrap-key'] || req.body.bootstrapKey

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

    const { username, password, email } = req.body as { username: string; password?: string; email?: string }
    let user = await User.findOne({ where: { username } })

    if (!user) {
      if (!password) {
        return res.status(400).json({ message: '创建管理员时必须提供密码' })
      }
      user = await User.create({
        username,
        password: 'temp',
        email: email ?? null,
        role: 'admin',
        status: 'active',
        bannedAt: null,
        banReason: null
      })
      await user.setPassword(password)
      await user.save()
    } else {
      await user.update({ role: 'admin', status: 'active', bannedAt: null, banReason: null })
    }

    res.json({
      message: '管理员初始化成功',
      user: { id: user.id, username: user.username, role: user.role, status: user.status }
    })
  }, '初始化管理员失败')
)

router.use(verifyToken, requireAdmin)

router.get('/feedbacks', asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req)
  const { rows, count } = await Feedback.findAndCountAll({
    include: [{ model: User, attributes: ['id', 'username'] }],
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
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
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
    }) as unknown as Array<{ userId: number; requestCount: string | number; totalTokens: string | number }>
    : []
  const paidRows = userIds.length
    ? await AiRequestLog.findAll({
      attributes: [
        'userId',
        [fn('SUM', col('costAmountCny')), 'paidCostCnyTotal']
      ],
      where: { userId: { [Op.in]: userIds }, keySource: 'env' },
      group: ['userId'],
      raw: true
    }) as unknown as Array<{ userId: number; paidCostCnyTotal: string | number }>
    : []
  const paidMonthRows = userIds.length
    ? await AiRequestLog.findAll({
      attributes: [
        'userId',
        [fn('SUM', col('costAmountCny')), 'paidCostCnyMonth']
      ],
      where: { userId: { [Op.in]: userIds }, keySource: 'env', createdAt: { [Op.gte]: monthStart } },
      group: ['userId'],
      raw: true
    }) as unknown as Array<{ userId: number; paidCostCnyMonth: string | number }>
    : []
  const userKeyRows = userIds.length
    ? await AiRequestLog.findAll({
      attributes: [
        'userId',
        [fn('SUM', col('totalTokens')), 'userKeyTokens']
      ],
      where: { userId: { [Op.in]: userIds }, keySource: 'user' },
      group: ['userId'],
      raw: true
    }) as unknown as Array<{ userId: number; userKeyTokens: string | number }>
    : []

  const usageMap = usageRows.reduce<Record<number, { requestCount: number; totalTokens: number }>>((map, row) => {
    map[row.userId] = {
      requestCount: Number(row.requestCount) || 0,
      totalTokens: Number(row.totalTokens) || 0
    }
    return map
  }, {})
  const paidMap = Object.fromEntries(paidRows.map((row) => [row.userId, moneyToStore(row.paidCostCnyTotal || 0)]))
  const paidMonthMap = Object.fromEntries(paidMonthRows.map((row) => [row.userId, moneyToStore(row.paidCostCnyMonth || 0)]))
  const userKeyMap = Object.fromEntries(userKeyRows.map((row) => [row.userId, Number(row.userKeyTokens) || 0]))

  res.json({
    items: rows.map((user) => ({
      ...user.toJSON(),
      requestCount: usageMap[user.id]?.requestCount || 0,
      totalTokens: usageMap[user.id]?.totalTokens || 0,
      paidCostCnyTotal: paidMap[user.id] || '0.00000000',
      paidCostCnyMonth: paidMonthMap[user.id] || '0.00000000',
      userKeyTokens: userKeyMap[user.id] || 0
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

    await user.update({ status: 'banned', bannedAt: new Date(), banReason: (req.body as { reason?: string }).reason || null })
    res.json({ message: '用户已封禁' })
  }, '封禁用户失败')
)

router.post('/users/:id/unban', asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id)
  if (!user) {
    return res.status(404).json({ message: NOT_FOUND.USER })
  }
  await user.update({ status: 'active', bannedAt: null, banReason: null })
  res.json({ message: '用户已解封' })
}, '解封用户失败'))

router.get('/usage/summary', asyncHandler(async (_req, res) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const monthStart = new Date(today)
  monthStart.setDate(1)
  const [totalRequests, successRequests, failedRequests, tokenRows, todayTokenRows, todayCostRows, monthCostRows, userKeyRequests] = await Promise.all([
    AiRequestLog.count(),
    AiRequestLog.count({ where: { status: 'success' } }),
    AiRequestLog.count({ where: { status: 'failed' } }),
    AiRequestLog.findAll({ attributes: [[fn('SUM', col('totalTokens')), 'totalTokens']], raw: true }) as unknown as Array<{ totalTokens: string | number | null }>,
    AiRequestLog.findAll({ attributes: [[fn('SUM', col('totalTokens')), 'totalTokens']], where: { createdAt: { [Op.gte]: today } }, raw: true }) as unknown as Array<{ totalTokens: string | number | null }>,
    AiRequestLog.findAll({ attributes: [[fn('SUM', col('costAmountCny')), 'cost']], where: { keySource: 'env', createdAt: { [Op.gte]: today } }, raw: true }) as unknown as Array<{ cost: string | number | null }>,
    AiRequestLog.findAll({ attributes: [[fn('SUM', col('costAmountCny')), 'cost']], where: { keySource: 'env', createdAt: { [Op.gte]: monthStart } }, raw: true }) as unknown as Array<{ cost: string | number | null }>,
    AiRequestLog.count({ where: { keySource: 'user' } })
  ])

  res.json({
    totalRequests,
    successRequests,
    failedRequests,
    totalTokens: Number(tokenRows[0]?.totalTokens) || 0,
    todayTokens: Number(todayTokenRows[0]?.totalTokens) || 0,
    todayPaidCostCny: moneyToStore(todayCostRows[0]?.cost || 0),
    monthPaidCostCny: moneyToStore(monthCostRows[0]?.cost || 0),
    userKeyRequestRatio: totalRequests ? Number((userKeyRequests / totalRequests).toFixed(4)) : 0
  })
}, '获取系统用量失败'))

router.get('/usage/logs', asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req)
  const where: Record<string, unknown> = {}
  if (req.query.userId) where.userId = parseInt(String(req.query.userId), 10)
  if (req.query.platform) where.platform = req.query.platform
  if (req.query.model) where.model = req.query.model
  if (req.query.status) where.status = req.query.status
  if (req.query.keySource) where.keySource = req.query.keySource
  if (req.query.costFlag) where.costFlag = { [Op.like]: `%${String(req.query.costFlag)}%` }

  const { rows, count } = await AiRequestLog.findAndCountAll({
    where,
    include: [{ model: User, attributes: ['id', 'username'] }],
    order: [['createdAt', 'DESC']],
    limit,
    offset
  })
  res.json({ items: rows, total: count, page, limit })
}, '获取 AI 请求日志失败'))

router.post('/models/sync', asyncHandler(async (_req, res) => {
  const result = await syncOfficialModels()
  res.json(result)
}, '同步模型目录失败'))

router.get('/models', asyncHandler(async (req, res) => {
  await seedCatalogIfEmpty()
  const where: Record<string, unknown> = {}
  if (req.query.capability) where.capability = req.query.capability
  if (req.query.platform) where.platform = req.query.platform
  if (req.query.enabled === 'true') where.enabled = true
  if (req.query.enabled === 'false') where.enabled = false
  const rows = await AiModelCatalog.findAll({
    where,
    order: [['platform', 'ASC'], ['sortOrder', 'ASC'], ['modelId', 'ASC']]
  })
  res.json({ items: rows })
}, '获取模型目录失败'))

router.post('/models',
  body('platform').isIn(['aliyun', 'zhipu', 'deepseek', 'openai']).withMessage('平台无效'),
  body('modelId').trim().notEmpty().withMessage('modelId 不能为空'),
  body('label').optional().trim(),
  validateRequest,
  asyncHandler(async (req, res) => {
    const { platform, modelId, label, description, badge } = req.body as {
      platform: 'aliyun' | 'zhipu' | 'deepseek' | 'openai'
      modelId: string
      label?: string
      description?: string
      badge?: string
    }
    const [row, created] = await AiModelCatalog.findOrCreate({
      where: { platform, modelId },
      defaults: {
        platform,
        modelId,
        label: label || modelId,
        ownedBy: null,
        capability: 'chat',
        capabilitySource: 'admin',
        enabled: true,
        recommended: false,
        sortOrder: 50,
        description: description ?? null,
        badge: badge ?? null,
        rawPayload: null,
        source: 'manual',
        syncedAt: new Date()
      }
    })
    if (!created) {
      return res.status(400).json({ message: '该模型已存在' })
    }
    res.status(201).json(row)
  }, '新增模型失败')
)

router.patch('/models/:id',
  body('enabled').optional().isBoolean(),
  body('recommended').optional().isBoolean(),
  body('label').optional().trim(),
  body('badge').optional().trim(),
  body('description').optional().trim(),
  body('capability').optional().isIn(['chat', 'other', 'unknown']),
  validateRequest,
  asyncHandler(async (req, res) => {
    const row = await AiModelCatalog.findByPk(req.params.id)
    if (!row) return res.status(404).json({ message: '模型不存在' })
    const payload = req.body as {
      enabled?: boolean
      recommended?: boolean
      label?: string
      badge?: string
      description?: string
      capability?: 'chat' | 'other' | 'unknown'
    }
    await row.update({
      enabled: payload.enabled ?? row.enabled,
      recommended: payload.recommended ?? row.recommended,
      label: payload.label ?? row.label,
      badge: payload.badge ?? row.badge,
      description: payload.description ?? row.description,
      capability: payload.capability ?? row.capability,
      capabilitySource: payload.capability ? 'admin' : row.capabilitySource
    })
    res.json(row)
  }, '更新模型失败')
)

router.post('/prices/sync', asyncHandler(async (_req, res) => {
  const official = await syncOfficialPrices()
  const community = await syncCommunityPrices()
  res.json({
    updated: official.updated + community.updated,
    skippedManual: official.skippedManual + community.skippedManual,
    unmatched: community.unmatched,
    official,
    community
  })
}, '同步模型单价失败'))

router.get('/prices', asyncHandler(async (_req, res) => {
  const items = await listPrices()
  const latest = items.reduce<Date | null>((max, item) => {
    if (!item.syncedAt) return max
    if (!max || item.syncedAt > max) return item.syncedAt
    return max
  }, null)
  res.json({ items, syncedAt: latest ? latest.toISOString() : null })
}, '获取模型单价失败'))

router.get('/ai-defaults', asyncHandler(async (_req, res) => {
  const defaults = await getSiteAiDefaults()
  res.json(defaults)
}, '获取站点默认模型失败'))

router.put('/ai-defaults',
  body('platform').isIn(['aliyun', 'zhipu', 'deepseek', 'openai']).withMessage('平台无效'),
  body('model').trim().notEmpty().withMessage('默认模型不能为空'),
  validateRequest,
  asyncHandler(async (req, res) => {
    const defaults = await setSiteAiDefaults(req.body.platform, req.body.model)
    res.json(defaults)
  }, '保存站点默认模型失败')
)

router.put('/prices',
  body('platform').trim().notEmpty(),
  body('modelId').trim().notEmpty(),
  body('inputPerMillion').notEmpty(),
  body('outputPerMillion').notEmpty(),
  body('currency').isIn(['CNY', 'USD']),
  validateRequest,
  asyncHandler(async (req, res) => {
    const row = await upsertManualPrice(req.body)
    res.json(row)
  }, '保存模型单价失败')
)

export default router
