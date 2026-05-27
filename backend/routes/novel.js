const express = require('express')
const router = express.Router()
const { Novel, Chapter, NovelVersion, GenerationHistory, CharacterCard, NovelSetting } = require('../models')
const { Op, Sequelize } = require('sequelize')
const { body, validationResult } = require('express-validator')
const { verifyToken } = require('../middleware/auth')

const isMissingTableError = (error) => {
  const code = error?.original?.code || error?.parent?.code
  const message = String(error?.original?.sqlMessage || error?.message || '')
  return code === 'ER_NO_SUCH_TABLE' || message.includes("doesn't exist") || message.includes('no such table')
}

const findOwnedNovel = async (novelId, userId) => {
  return await Novel.findOne({
    where: {
      id: parseInt(novelId, 10),
      userId,
      isDeleted: false
    }
  })
}

const validateRequest = (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ message: errors.array()[0].msg })
    return false
  }
  return true
}

// 新建小说
router.post('/', 
  verifyToken,
  body('name').trim().notEmpty().withMessage('小说名称不能为空'),
  body('description').optional().trim(),
  async (req, res) => {
    try {
      // 验证请求参数
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg })
      }

      const { name, description } = req.body
      const novel = await Novel.create({ name, description, userId: req.userId })
      
      res.status(201).json(novel)
    } catch (error) {
      console.error('创建小说失败:', error)
      res.status(500).json({ message: '创建小说失败' })
    }
  }
)

// 获取小说列表（只获取未删除的）
router.get('/', verifyToken, async (req, res) => {
  try {
    const novels = await Novel.findAll({ 
      where: { userId: req.userId, isDeleted: false },
      order: [['createdAt', 'DESC']]
    })

    res.json(novels)
  } catch (error) {
    console.error('获取小说列表失败:', error)
    res.status(500).json({ message: '获取小说列表失败' })
  }
})

// 获取小说详情（用于版本快照/历史）
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params
    const novel = await findOwnedNovel(id, req.userId)
    if (!novel) {
      return res.status(404).json({ message: '小说不存在' })
    }
    res.json(novel)
  } catch (error) {
    console.error('获取小说详情失败:', error)
    res.status(500).json({ message: '获取小说详情失败' })
  }
})

router.get('/:novelId/characters', verifyToken, async (req, res) => {
  try {
    const novel = await findOwnedNovel(req.params.novelId, req.userId)
    if (!novel) {
      return res.status(404).json({ message: '小说不存在' })
    }

    const cards = await CharacterCard.findAll({
      where: { novelId: novel.id },
      order: [['priority', 'DESC'], ['updatedAt', 'DESC']]
    })

    res.json(cards)
  } catch (error) {
    console.error('获取人物卡失败:', error)
    res.status(500).json({ message: '获取人物卡失败' })
  }
})

router.post(
  '/:novelId/characters',
  verifyToken,
  body('name').trim().notEmpty().withMessage('人物姓名不能为空'),
  body('role').optional().trim(),
  body('identity').optional().trim(),
  body('personality').optional().trim(),
  body('appearance').optional().trim(),
  body('relationship').optional().trim(),
  body('secret').optional().trim(),
  body('arc').optional().trim(),
  body('notes').optional().trim(),
  body('priority').optional().isInt({ min: 1, max: 10 }).withMessage('优先级必须在1-10之间'),
  body('isActive').optional().isBoolean().withMessage('启用状态格式不正确'),
  async (req, res) => {
    try {
      if (!validateRequest(req, res)) {
        return
      }

      const novel = await findOwnedNovel(req.params.novelId, req.userId)
      if (!novel) {
        return res.status(404).json({ message: '小说不存在' })
      }

      const card = await CharacterCard.create({
        novelId: novel.id,
        name: req.body.name,
        role: req.body.role,
        identity: req.body.identity,
        personality: req.body.personality,
        appearance: req.body.appearance,
        relationship: req.body.relationship,
        secret: req.body.secret,
        arc: req.body.arc,
        notes: req.body.notes,
        priority: req.body.priority ?? 5,
        isActive: req.body.isActive ?? true
      })

      res.status(201).json(card)
    } catch (error) {
      console.error('创建人物卡失败:', error)
      res.status(500).json({ message: '创建人物卡失败' })
    }
  }
)

router.put(
  '/:novelId/characters/:cardId',
  verifyToken,
  body('name').optional().trim().notEmpty().withMessage('人物姓名不能为空'),
  body('role').optional().trim(),
  body('identity').optional().trim(),
  body('personality').optional().trim(),
  body('appearance').optional().trim(),
  body('relationship').optional().trim(),
  body('secret').optional().trim(),
  body('arc').optional().trim(),
  body('notes').optional().trim(),
  body('priority').optional().isInt({ min: 1, max: 10 }).withMessage('优先级必须在1-10之间'),
  body('isActive').optional().isBoolean().withMessage('启用状态格式不正确'),
  async (req, res) => {
    try {
      if (!validateRequest(req, res)) {
        return
      }

      const novel = await findOwnedNovel(req.params.novelId, req.userId)
      if (!novel) {
        return res.status(404).json({ message: '小说不存在' })
      }

      const card = await CharacterCard.findOne({
        where: {
          id: parseInt(req.params.cardId, 10),
          novelId: novel.id
        }
      })
      if (!card) {
        return res.status(404).json({ message: '人物卡不存在' })
      }

      const fields = ['name', 'role', 'identity', 'personality', 'appearance', 'relationship', 'secret', 'arc', 'notes', 'priority', 'isActive']
      const patch = fields.reduce((result, field) => {
        if (typeof req.body[field] !== 'undefined') {
          result[field] = req.body[field]
        }
        return result
      }, {})

      await card.update(patch)
      res.json(card)
    } catch (error) {
      console.error('更新人物卡失败:', error)
      res.status(500).json({ message: '更新人物卡失败' })
    }
  }
)

router.delete('/:novelId/characters/:cardId', verifyToken, async (req, res) => {
  try {
    const novel = await findOwnedNovel(req.params.novelId, req.userId)
    if (!novel) {
      return res.status(404).json({ message: '小说不存在' })
    }

    const deleted = await CharacterCard.destroy({
      where: {
        id: parseInt(req.params.cardId, 10),
        novelId: novel.id
      }
    })
    if (!deleted) {
      return res.status(404).json({ message: '人物卡不存在' })
    }

    res.json({ message: '人物卡已删除' })
  } catch (error) {
    console.error('删除人物卡失败:', error)
    res.status(500).json({ message: '删除人物卡失败' })
  }
})

router.get('/:novelId/setting', verifyToken, async (req, res) => {
  try {
    const novel = await findOwnedNovel(req.params.novelId, req.userId)
    if (!novel) {
      return res.status(404).json({ message: '小说不存在' })
    }

    const [setting] = await NovelSetting.findOrCreate({
      where: { novelId: novel.id },
      defaults: { novelId: novel.id }
    })

    res.json(setting)
  } catch (error) {
    console.error('获取内容设定失败:', error)
    res.status(500).json({ message: '获取内容设定失败' })
  }
})

router.put(
  '/:novelId/setting',
  verifyToken,
  body('worldview').optional().trim(),
  body('genreStyle').optional().trim(),
  body('powerSystem').optional().trim(),
  body('timeline').optional().trim(),
  body('plotRules').optional().trim(),
  body('taboos').optional().trim(),
  body('styleGuide').optional().trim(),
  body('notes').optional().trim(),
  async (req, res) => {
    try {
      if (!validateRequest(req, res)) {
        return
      }

      const novel = await findOwnedNovel(req.params.novelId, req.userId)
      if (!novel) {
        return res.status(404).json({ message: '小说不存在' })
      }

      const fields = ['worldview', 'genreStyle', 'powerSystem', 'timeline', 'plotRules', 'taboos', 'styleGuide', 'notes']
      const patch = fields.reduce((result, field) => {
        if (typeof req.body[field] !== 'undefined') {
          result[field] = req.body[field]
        }
        return result
      }, {})

      const [setting] = await NovelSetting.findOrCreate({
        where: { novelId: novel.id },
        defaults: { novelId: novel.id, ...patch }
      })

      if (Object.keys(patch).length > 0) {
        await setting.update(patch)
      }

      res.json(setting)
    } catch (error) {
      console.error('保存内容设定失败:', error)
      res.status(500).json({ message: '保存内容设定失败' })
    }
  }
)

/**
 * 更新小说标题/简介
 * @route PUT /api/novel/:id
 * @description 更新小说的 name/description
 */
router.put(
  '/:id',
  verifyToken,
  body('name').optional().trim().notEmpty().withMessage('小说名称不能为空'),
  body('description').optional().trim(),
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg })
      }

      const { id } = req.params
      const { name, description } = req.body

      const novel = await Novel.findOne({ where: { id: parseInt(id), userId: req.userId, isDeleted: false } })
      if (!novel) {
        return res.status(404).json({ message: '小说不存在' })
      }

      const patch = {}
      if (typeof name !== 'undefined') patch.name = name
      if (typeof description !== 'undefined') patch.description = description

      if (Object.keys(patch).length === 0) {
        return res.status(400).json({ message: '缺少要更新的字段' })
      }

      await novel.update(patch)
      res.json(novel)
    } catch (error) {
      console.error('更新小说失败:', error)
      res.status(500).json({ message: '更新小说失败' })
    }
  }
)

/**
 * 版本管理：创建版本快照
 * @route POST /api/novel/:novelId/versions
 * body: { label?: string }
 */
router.post(
  '/:novelId/versions',
  verifyToken,
  body('label').optional().trim(),
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg })
      }

      const { novelId } = req.params
      const novel = await Novel.findOne({ where: { id: parseInt(novelId), userId: req.userId, isDeleted: false } })
      if (!novel) {
        return res.status(404).json({ message: '小说不存在' })
      }

      const chapters = await Chapter.findAll({
        where: { novelId: parseInt(novelId), isDeleted: false },
        order: [['order', 'ASC']]
      })

      const snapshot = {
        novel: {
          id: novel.id,
          name: novel.name,
          description: novel.description,
          createdAt: novel.createdAt,
          updatedAt: novel.updatedAt
        },
        chapters: chapters.map((c) => ({
          id: c.id,
          order: c.order,
          title: c.title,
          content: c.content,
          plot: c.plot,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt
        }))
      }

      const version = await NovelVersion.create({
        userId: req.userId,
        novelId: parseInt(novelId),
        label: req.body.label,
        snapshot
      })

      res.status(201).json(version)
    } catch (error) {
      if (isMissingTableError(error)) {
        return res.status(503).json({ message: '版本功能未初始化，请先在后端执行 npm run db:init 创建数据表' })
      }
      console.error('创建版本失败:', error)
      res.status(500).json({ message: '创建版本失败' })
    }
  }
)

// 版本管理：获取版本列表
router.get('/:novelId/versions', verifyToken, async (req, res) => {
  try {
    const { novelId } = req.params
    const novel = await Novel.findOne({ where: { id: parseInt(novelId), userId: req.userId, isDeleted: false } })
    if (!novel) {
      return res.status(404).json({ message: '小说不存在' })
    }

    try {
      const versions = await NovelVersion.findAll({
        where: { novelId: parseInt(novelId), userId: req.userId },
        order: [['createdAt', 'DESC']]
      })
      res.json(versions)
    } catch (error) {
      if (isMissingTableError(error)) {
        return res.json([])
      }
      throw error
    }
  } catch (error) {
    console.error('获取版本列表失败:', error)
    res.status(500).json({ message: '获取版本列表失败' })
  }
})

// 版本管理：获取某个版本详情
router.get('/:novelId/versions/:versionId', verifyToken, async (req, res) => {
  try {
    const { novelId, versionId } = req.params
    let version = null
    try {
      version = await NovelVersion.findOne({
        where: { id: parseInt(versionId), novelId: parseInt(novelId), userId: req.userId }
      })
    } catch (error) {
      if (isMissingTableError(error)) {
        return res.status(404).json({ message: '版本不存在' })
      }
      throw error
    }
    if (!version) {
      return res.status(404).json({ message: '版本不存在' })
    }
    res.json(version)
  } catch (error) {
    console.error('获取版本详情失败:', error)
    res.status(500).json({ message: '获取版本详情失败' })
  }
})

/**
 * 版本管理：切换/恢复到某个版本
 * @route POST /api/novel/:novelId/versions/:versionId/restore
 * @description 将版本快照应用到当前小说（会自动创建一个“切换前备份版本”）
 */
router.post('/:novelId/versions/:versionId/restore', verifyToken, async (req, res) => {
  try {
    const { novelId, versionId } = req.params

    const novel = await Novel.findOne({ where: { id: parseInt(novelId), userId: req.userId, isDeleted: false } })
    if (!novel) {
      return res.status(404).json({ message: '小说不存在' })
    }

    let version = null
    try {
      version = await NovelVersion.findOne({
        where: { id: parseInt(versionId), novelId: parseInt(novelId), userId: req.userId }
      })
    } catch (error) {
      if (isMissingTableError(error)) {
        return res.status(503).json({ message: '版本功能未初始化，请先在后端执行 npm run db:init 创建数据表' })
      }
      throw error
    }

    if (!version) {
      return res.status(404).json({ message: '版本不存在' })
    }

    // 切换前自动备份当前状态
    try {
      const currentChapters = await Chapter.findAll({
        where: { novelId: parseInt(novelId), isDeleted: false },
        order: [['order', 'ASC']]
      })

      const backupSnapshot = {
        novel: {
          id: novel.id,
          name: novel.name,
          description: novel.description,
          createdAt: novel.createdAt,
          updatedAt: novel.updatedAt
        },
        chapters: currentChapters.map((c) => ({
          id: c.id,
          order: c.order,
          title: c.title,
          content: c.content,
          plot: c.plot,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt
        }))
      }

      await NovelVersion.create({
        userId: req.userId,
        novelId: parseInt(novelId),
        label: `自动备份-切换前-${new Date().toLocaleString()}`,
        snapshot: backupSnapshot
      })
    } catch (backupError) {
      // 备份失败不阻塞恢复
      console.warn('切换前备份失败:', backupError.message || backupError)
    }

    const snapshot = version.snapshot || {}
    const snapshotNovel = snapshot.novel || {}
    const snapshotChapters = Array.isArray(snapshot.chapters) ? snapshot.chapters : []

    // 更新小说元信息
    await novel.update({
      name: typeof snapshotNovel.name === 'string' ? snapshotNovel.name : novel.name,
      description: typeof snapshotNovel.description !== 'undefined' ? snapshotNovel.description : novel.description
    })

    // 现有章节映射
    const existingChapters = await Chapter.findAll({
      where: { novelId: parseInt(novelId) }
    })
    const byId = new Map(existingChapters.map((c) => [c.id, c]))

    const snapshotIds = new Set()
    for (const sc of snapshotChapters) {
      if (!sc) continue
      const scId = typeof sc.id === 'number' ? sc.id : null
      const scOrder = typeof sc.order === 'number' ? sc.order : 0

      if (scId && byId.has(scId)) {
        snapshotIds.add(scId)
        const ch = byId.get(scId)
        await ch.update({
          title: typeof sc.title !== 'undefined' ? sc.title : ch.title,
          content: typeof sc.content === 'string' ? sc.content : ch.content,
          plot: typeof sc.plot !== 'undefined' ? sc.plot : ch.plot,
          order: scOrder,
          isDeleted: false,
          deletedAt: null
        })
      } else {
        // 如果旧版本里 id 不存在当前库（或无 id），就新建章节
        const created = await Chapter.create({
          novelId: parseInt(novelId),
          title: sc.title,
          content: sc.content || '',
          plot: sc.plot,
          order: scOrder,
          isDeleted: false,
          deletedAt: null
        })
        snapshotIds.add(created.id)
      }
    }

    // 将不在快照内的章节软删除（保留数据，方便回滚）
    for (const ch of existingChapters) {
      if (snapshotIds.has(ch.id)) continue
      if (!ch.isDeleted) {
        await ch.update({ isDeleted: true, deletedAt: new Date() })
      }
    }

    res.json({ message: '版本切换成功' })
  } catch (error) {
    console.error('切换版本失败:', error)
    res.status(500).json({ message: '切换版本失败' })
  }
})

/**
 * 生成历史：获取某本小说的生成历史
 * @route GET /api/novel/:novelId/history?page=&limit=
 */
router.get('/:novelId/history', verifyToken, async (req, res) => {
  try {
    const { novelId } = req.params
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const offset = (page - 1) * limit

    const novel = await Novel.findOne({ where: { id: parseInt(novelId), userId: req.userId, isDeleted: false } })
    if (!novel) {
      return res.status(404).json({ message: '小说不存在' })
    }

    try {
      const { count, rows } = await GenerationHistory.findAndCountAll({
        where: { userId: req.userId, novelId: parseInt(novelId) },
        order: [['createdAt', 'DESC']],
        limit,
        offset
      })
      res.json({ page, limit, total: count, histories: rows })
    } catch (error) {
      if (isMissingTableError(error)) {
        return res.json({ page, limit, total: 0, histories: [] })
      }
      throw error
    }
  } catch (error) {
    console.error('获取生成历史失败:', error)
    res.status(500).json({ message: '获取生成历史失败' })
  }
})

/**
 * 删除小说（假删除）
 * @route DELETE /api/novel/:id
 * @description 软删除小说
 * @param {number} id - 小说ID
 * @returns {Object} - 删除结果
 */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params
    const novel = await Novel.findOne({ where: { id: parseInt(id), userId: req.userId } })
    if (!novel) {
      return res.status(404).json({ message: '小说不存在' })
    }
    await novel.update({ isDeleted: true, deletedAt: new Date() })
    
    res.json({ message: '删除成功' })
  } catch (error) {
    console.error('删除小说失败:', error)
    res.status(500).json({ message: '删除小说失败' })
  }
})

// 获取回收站中的小说列表
router.get('/trash/novels', verifyToken, async (req, res) => {
  try {
    const novels = await Novel.findAll({ 
      where: { userId: req.userId, isDeleted: true },
      order: [['deletedAt', 'DESC']]
    })
    res.json(novels)
  } catch (error) {
    console.error('获取回收站小说列表失败:', error)
    res.status(500).json({ message: '获取回收站小说列表失败' })
  }
})

// 恢复回收站中的小说
router.put('/trash/novels/:id/restore', verifyToken, async (req, res) => {
  try {
    const { id } = req.params
    const novel = await Novel.findOne({ where: { id, userId: req.userId } })
    if (!novel) {
      return res.status(404).json({ message: '小说不存在' })
    }
    await novel.update({ isDeleted: false, deletedAt: null })
    
    res.json({ message: '恢复成功' })
  } catch (error) {
    console.error('恢复小说失败:', error)
    res.status(500).json({ message: '恢复小说失败' })
  }
})

// 永久删除小说
router.delete('/trash/novels/:id/permanent', verifyToken, async (req, res) => {
  try {
    const { id } = req.params
    const novel = await Novel.findOne({ where: { id, userId: req.userId } })
    if (!novel) {
      return res.status(404).json({ message: '小说不存在' })
    }
    await Chapter.destroy({ where: { novelId: id } })
    await novel.destroy()
    
    res.json({ message: '永久删除成功' })
  } catch (error) {
    console.error('永久删除小说失败:', error)
    res.status(500).json({ message: '永久删除小说失败' })
  }
})

/**
 * 创建章节
 * @route POST /api/novel/:novelId/chapters
 * @description 为小说创建新章节
 * @param {number} novelId - 小说ID
 * @param {string} title - 章节标题（可选）
 * @param {string} content - 章节内容（必填）
 * @param {string} plot - 剧情摘要（可选）
 * @returns {Object} - 创建的章节
 */
router.post('/:novelId/chapters', 
  verifyToken,
  body('title').optional().trim(),
  body('content').trim().notEmpty().withMessage('章节内容不能为空'),
  body('plot').optional().trim(),
  async (req, res) => {
    try {
      // 验证请求参数
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg })
      }

      const { novelId } = req.params
      const { title, content, plot } = req.body
      const novel = await Novel.findOne({ where: { id: parseInt(novelId), userId: req.userId } })
      if (!novel) {
        return res.status(404).json({ message: '小说不存在' })
      }
      
      // 获取当前小说的章节数量，用于设置新章节的顺序
      const chapterCount = await Chapter.count({ where: { novelId: parseInt(novelId), isDeleted: false } })
      
      const chapter = await Chapter.create({ 
        novelId: parseInt(novelId), 
        title, 
        content, 
        plot,
        order: chapterCount
      })
      
      res.status(201).json(chapter)
    } catch (error) {
      console.error('创建章节失败:', error)
      res.status(500).json({ message: '创建章节失败' })
    }
  }
)

// 更新章节顺序
router.put('/chapters/order', verifyToken, async (req, res) => {
  try {
    const { sourceChapterId, targetChapterId } = req.body
    
    // 验证章节是否存在且属于当前用户
    const sourceChapter = await Chapter.findOne({
      include: [{ model: Novel, where: { userId: req.userId } }],
      where: { id: sourceChapterId }
    })
    const targetChapter = await Chapter.findOne({
      include: [{ model: Novel, where: { userId: req.userId } }],
      where: { id: targetChapterId }
    })
    
    if (!sourceChapter || !targetChapter) {
      return res.status(404).json({ message: '章节不存在' })
    }
    
    if (sourceChapter.novelId !== targetChapter.novelId) {
      return res.status(400).json({ message: '只能在同一本小说内调整章节顺序' })
    }
    
    // 实现真正的章节顺序重排
    const sourceOrder = sourceChapter.order
    const targetOrder = targetChapter.order
    const novelId = sourceChapter.novelId
    
    if (sourceOrder < targetOrder) {
      // 源章节向前移动，中间章节都减1
      await Chapter.update(
        { order: Sequelize.literal('order - 1') },
        { where: {
          novelId: novelId,
          order: { [Sequelize.Op.between]: [sourceOrder + 1, targetOrder] }
        }}
      )
    } else if (sourceOrder > targetOrder) {
      // 源章节向后移动，中间章节都加1
      await Chapter.update(
        { order: Sequelize.literal('order + 1') },
        { where: {
          novelId: novelId,
          order: { [Sequelize.Op.between]: [targetOrder, sourceOrder - 1] }
        }}
      )
    }
    
    // 更新源章节的order为目标位置
    await sourceChapter.update({ order: targetOrder })
    
    res.json({ message: '章节顺序更新成功' })
  } catch (error) {
    console.error('更新章节顺序失败:', error)
    res.status(500).json({ message: '更新章节顺序失败' })
  }
})

/**
 * 删除章节（假删除）
 * @route DELETE /api/novel/chapters/:id
 * @description 软删除章节
 * @param {number} id - 章节ID
 * @returns {Object} - 删除结果
 */
router.delete('/chapters/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params
    const chapter = await Chapter.findOne({
      include: [{ model: Novel, where: { userId: req.userId } }],
      where: { id: parseInt(id) }
    })
    if (!chapter) {
      return res.status(404).json({ message: '章节不存在' })
    }
    await chapter.update({ isDeleted: true, deletedAt: new Date() })
    
    res.json({ message: '删除成功' })
  } catch (error) {
    console.error('删除章节失败:', error)
    res.status(500).json({ message: '删除章节失败' })
  }
})

// 获取回收站中的章节列表
router.get('/trash/chapters', verifyToken, async (req, res) => {
  try {
    const chapters = await Chapter.findAll({ 
      include: [{ model: Novel, where: { userId: req.userId } }],
      where: { isDeleted: true },
      order: [['deletedAt', 'DESC']]
    })
    res.json(chapters)
  } catch (error) {
    console.error('获取回收站章节列表失败:', error)
    res.status(500).json({ message: '获取回收站章节列表失败' })
  }
})

// 恢复回收站中的章节
router.put('/trash/chapters/:id/restore', verifyToken, async (req, res) => {
  try {
    const { id } = req.params
    const chapter = await Chapter.findOne({
      include: [{ model: Novel, where: { userId: req.userId } }],
      where: { id }
    })
    if (!chapter) {
      return res.status(404).json({ message: '章节不存在' })
    }
    await chapter.update({ isDeleted: false, deletedAt: null })
    res.json({ message: '恢复成功' })
  } catch (error) {
    console.error('恢复章节失败:', error)
    res.status(500).json({ message: '恢复章节失败' })
  }
})

// 永久删除章节
router.delete('/trash/chapters/:id/permanent', verifyToken, async (req, res) => {
  try {
    const { id } = req.params
    const chapter = await Chapter.findOne({
      include: [{ model: Novel, where: { userId: req.userId } }],
      where: { id }
    })
    if (!chapter) {
      return res.status(404).json({ message: '章节不存在' })
    }
    await chapter.destroy()
    res.json({ message: '永久删除成功' })
  } catch (error) {
    console.error('永久删除章节失败:', error)
    res.status(500).json({ message: '永久删除章节失败' })
  }
})

/**
 * 更新章节（标题/内容/剧情摘要）
 * @route PUT /api/novel/chapters/:id
 * @description 更新章节字段（部分更新）
 * @param {number} id - 章节ID
 * @returns {Object} - 更新结果
 */
router.put('/chapters/:id', 
  verifyToken,
  body('title').optional().trim().notEmpty().withMessage('章节标题不能为空'),
  body('content').optional().trim().notEmpty().withMessage('章节内容不能为空'),
  body('plot').optional().trim(),
  async (req, res) => {
    try {
      // 验证请求参数
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg })
      }

      const { id } = req.params
      const { title, content, plot } = req.body
      const chapter = await Chapter.findOne({
        include: [{ model: Novel, where: { userId: req.userId } }],
        where: { id: parseInt(id) }
      })
      if (!chapter) {
        return res.status(404).json({ message: '章节不存在' })
      }

      const patch = {}
      if (typeof title !== 'undefined') patch.title = title
      if (typeof content !== 'undefined') patch.content = content
      if (typeof plot !== 'undefined') patch.plot = plot

      if (Object.keys(patch).length === 0) {
        return res.status(400).json({ message: '缺少要更新的字段' })
      }

      await chapter.update(patch)
      
      res.json({ message: '更新成功', chapter })
    } catch (error) {
      console.error('更新章节失败:', error)
      res.status(500).json({ message: '更新章节失败' })
    }
  }
)

/**
 * 获取章节列表（只获取未删除的）
 * @route GET /api/novel/:novelId/chapters
 * @description 获取小说的章节列表
 * @param {number} novelId - 小说ID
 * @returns {Array} - 章节列表
 */
router.get('/:novelId/chapters', verifyToken, async (req, res) => {
  try {
    const { novelId } = req.params

    const novel = await Novel.findOne({ where: { id: parseInt(novelId), userId: req.userId, isDeleted: false } })
    if (!novel) {
      return res.status(404).json({ message: '小说不存在' })
    }
    const chapters = await Chapter.findAll({ 
      where: { novelId: parseInt(novelId), isDeleted: false },
      order: [['order', 'ASC']]
    })

    res.json(chapters)
  } catch (error) {
    console.error('获取章节列表失败:', error)
    res.status(500).json({ message: '获取章节列表失败' })
  }
})

module.exports = router