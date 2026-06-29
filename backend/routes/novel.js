const express = require('express')
const router = express.Router()
const { Novel, Chapter, NovelVersion, GenerationHistory, CharacterCard, NovelSetting } = require('../models')
const { Sequelize } = require('sequelize')
const { body } = require('express-validator')
const { verifyToken } = require('../middleware/auth')
const { validateRequest } = require('../middleware/validate')
const { asyncHandler } = require('../utils/asyncHandler')
const { parsePagination } = require('../utils/pagination')
const { buildPatch } = require('../utils/patchBuilder')
const { isMissingTableError } = require('../utils/dbErrors')
const { findOwnedNovel, findOwnedChapter } = require('../services/novelQueryService')
const { NOT_FOUND, COMMON } = require('../constants/messages')

const CHARACTER_FIELDS = ['name', 'role', 'identity', 'personality', 'appearance', 'relationship', 'secret', 'arc', 'notes', 'priority', 'isActive']
const SETTING_FIELDS = ['worldview', 'genreStyle', 'powerSystem', 'timeline', 'plotRules', 'taboos', 'styleGuide', 'notes', 'overallOutline']

// 构建小说+章节的版本快照
const buildNovelSnapshot = (novel, chapters) => ({
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
})

// 新建小说
router.post('/',
  verifyToken,
  body('name').trim().notEmpty().withMessage('小说名称不能为空'),
  body('description').optional().trim(),
  validateRequest,
  asyncHandler(async (req, res) => {
    const { name, description } = req.body
    const novel = await Novel.create({ name, description, userId: req.userId })

    res.status(201).json(novel)
  }, '创建小说失败')
)

// 获取小说列表（只获取未删除的）
router.get('/', verifyToken, asyncHandler(async (req, res) => {
  const novels = await Novel.findAll({
    where: { userId: req.userId, isDeleted: false },
    order: [['createdAt', 'DESC']]
  })

  res.json(novels)
}, '获取小说列表失败'))

// 获取小说详情（用于版本快照/历史）
router.get('/:id', verifyToken, asyncHandler(async (req, res) => {
  const novel = await findOwnedNovel(req.params.id, req.userId)
  if (!novel) {
    return res.status(404).json({ message: NOT_FOUND.NOVEL })
  }
  res.json(novel)
}, '获取小说详情失败'))

router.get('/:novelId/characters', verifyToken, asyncHandler(async (req, res) => {
  const novel = await findOwnedNovel(req.params.novelId, req.userId)
  if (!novel) {
    return res.status(404).json({ message: NOT_FOUND.NOVEL })
  }

  const cards = await CharacterCard.findAll({
    where: { novelId: novel.id },
    order: [['priority', 'DESC'], ['updatedAt', 'DESC']]
  })

  res.json(cards)
}, '获取人物卡失败'))

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
  validateRequest,
  asyncHandler(async (req, res) => {
    const novel = await findOwnedNovel(req.params.novelId, req.userId)
    if (!novel) {
      return res.status(404).json({ message: NOT_FOUND.NOVEL })
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
  }, '创建人物卡失败')
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
  validateRequest,
  asyncHandler(async (req, res) => {
    const novel = await findOwnedNovel(req.params.novelId, req.userId)
    if (!novel) {
      return res.status(404).json({ message: NOT_FOUND.NOVEL })
    }

    const card = await CharacterCard.findOne({
      where: {
        id: parseInt(req.params.cardId, 10),
        novelId: novel.id
      }
    })
    if (!card) {
      return res.status(404).json({ message: NOT_FOUND.CHARACTER_CARD })
    }

    await card.update(buildPatch(req.body, CHARACTER_FIELDS))
    res.json(card)
  }, '更新人物卡失败')
)

router.delete('/:novelId/characters/:cardId', verifyToken, asyncHandler(async (req, res) => {
  const novel = await findOwnedNovel(req.params.novelId, req.userId)
  if (!novel) {
    return res.status(404).json({ message: NOT_FOUND.NOVEL })
  }

  const deleted = await CharacterCard.destroy({
    where: {
      id: parseInt(req.params.cardId, 10),
      novelId: novel.id
    }
  })
  if (!deleted) {
    return res.status(404).json({ message: NOT_FOUND.CHARACTER_CARD })
  }

  res.json({ message: '人物卡已删除' })
}, '删除人物卡失败'))

router.get('/:novelId/setting', verifyToken, asyncHandler(async (req, res) => {
  const novel = await findOwnedNovel(req.params.novelId, req.userId)
  if (!novel) {
    return res.status(404).json({ message: NOT_FOUND.NOVEL })
  }

  const [setting] = await NovelSetting.findOrCreate({
    where: { novelId: novel.id },
    defaults: { novelId: novel.id }
  })

  res.json(setting)
}, '获取内容设定失败'))

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
  validateRequest,
  asyncHandler(async (req, res) => {
    const novel = await findOwnedNovel(req.params.novelId, req.userId)
    if (!novel) {
      return res.status(404).json({ message: NOT_FOUND.NOVEL })
    }

    const patch = buildPatch(req.body, SETTING_FIELDS)

    const [setting] = await NovelSetting.findOrCreate({
      where: { novelId: novel.id },
      defaults: { novelId: novel.id, ...patch }
    })

    if (Object.keys(patch).length > 0) {
      await setting.update(patch)
    }

    res.json(setting)
  }, '保存内容设定失败')
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
  validateRequest,
  asyncHandler(async (req, res) => {
    const novel = await findOwnedNovel(req.params.id, req.userId)
    if (!novel) {
      return res.status(404).json({ message: NOT_FOUND.NOVEL })
    }

    const patch = buildPatch(req.body, ['name', 'description'])

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ message: COMMON.NO_UPDATE_FIELDS })
    }

    await novel.update(patch)
    res.json(novel)
  }, '更新小说失败')
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
  validateRequest,
  asyncHandler(async (req, res) => {
    const { novelId } = req.params
    const novel = await findOwnedNovel(novelId, req.userId)
    if (!novel) {
      return res.status(404).json({ message: NOT_FOUND.NOVEL })
    }

    const chapters = await Chapter.findAll({
      where: { novelId: parseInt(novelId), isDeleted: false },
      order: [['order', 'ASC']]
    })

    const snapshot = buildNovelSnapshot(novel, chapters)

    try {
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
      throw error
    }
  }, '创建版本失败')
)

// 版本管理：获取版本列表
router.get('/:novelId/versions', verifyToken, asyncHandler(async (req, res) => {
  const { novelId } = req.params
  const novel = await findOwnedNovel(novelId, req.userId)
  if (!novel) {
    return res.status(404).json({ message: NOT_FOUND.NOVEL })
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
}, '获取版本列表失败'))

// 版本管理：获取某个版本详情
router.get('/:novelId/versions/:versionId', verifyToken, asyncHandler(async (req, res) => {
  const { novelId, versionId } = req.params
  let version = null
  try {
    version = await NovelVersion.findOne({
      where: { id: parseInt(versionId), novelId: parseInt(novelId), userId: req.userId }
    })
  } catch (error) {
    if (isMissingTableError(error)) {
      return res.status(404).json({ message: NOT_FOUND.VERSION })
    }
    throw error
  }
  if (!version) {
    return res.status(404).json({ message: NOT_FOUND.VERSION })
  }
  res.json(version)
}, '获取版本详情失败'))

/**
 * 版本管理：切换/恢复到某个版本
 * @route POST /api/novel/:novelId/versions/:versionId/restore
 * @description 将版本快照应用到当前小说（会自动创建一个“切换前备份版本”）
 */
router.post('/:novelId/versions/:versionId/restore', verifyToken, asyncHandler(async (req, res) => {
  const { novelId, versionId } = req.params

  const novel = await findOwnedNovel(novelId, req.userId)
  if (!novel) {
    return res.status(404).json({ message: NOT_FOUND.NOVEL })
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
    return res.status(404).json({ message: NOT_FOUND.VERSION })
  }

  // 切换前自动备份当前状态
  try {
    const currentChapters = await Chapter.findAll({
      where: { novelId: parseInt(novelId), isDeleted: false },
      order: [['order', 'ASC']]
    })

    const backupSnapshot = buildNovelSnapshot(novel, currentChapters)

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
}, '切换版本失败'))

/**
 * 生成历史：获取某本小说的生成历史
 * @route GET /api/novel/:novelId/history?page=&limit=
 */
router.get('/:novelId/history', verifyToken, asyncHandler(async (req, res) => {
  const { novelId } = req.params
  const { page, limit, offset } = parsePagination(req, { defaultLimit: 20 })

  const novel = await findOwnedNovel(novelId, req.userId)
  if (!novel) {
    return res.status(404).json({ message: NOT_FOUND.NOVEL })
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
}, '获取生成历史失败'))

/**
 * 删除小说（假删除）
 * @route DELETE /api/novel/:id
 * @description 软删除小说
 */
router.delete('/:id', verifyToken, asyncHandler(async (req, res) => {
  const novel = await findOwnedNovel(req.params.id, req.userId, { includeDeleted: true })
  if (!novel) {
    return res.status(404).json({ message: NOT_FOUND.NOVEL })
  }
  await novel.update({ isDeleted: true, deletedAt: new Date() })

  res.json({ message: COMMON.DELETED })
}, '删除小说失败'))

// 获取回收站中的小说列表
router.get('/trash/novels', verifyToken, asyncHandler(async (req, res) => {
  const novels = await Novel.findAll({
    where: { userId: req.userId, isDeleted: true },
    order: [['deletedAt', 'DESC']]
  })
  res.json(novels)
}, '获取回收站小说列表失败'))

// 恢复回收站中的小说
router.put('/trash/novels/:id/restore', verifyToken, asyncHandler(async (req, res) => {
  const novel = await findOwnedNovel(req.params.id, req.userId, { includeDeleted: true })
  if (!novel) {
    return res.status(404).json({ message: NOT_FOUND.NOVEL })
  }
  await novel.update({ isDeleted: false, deletedAt: null })

  res.json({ message: COMMON.RESTORED })
}, '恢复小说失败'))

// 永久删除小说
router.delete('/trash/novels/:id/permanent', verifyToken, asyncHandler(async (req, res) => {
  const { id } = req.params
  const novel = await findOwnedNovel(id, req.userId, { includeDeleted: true })
  if (!novel) {
    return res.status(404).json({ message: NOT_FOUND.NOVEL })
  }
  await Chapter.destroy({ where: { novelId: id } })
  await novel.destroy()

  res.json({ message: COMMON.PERMANENT_DELETED })
}, '永久删除小说失败'))

/**
 * 创建章节
 * @route POST /api/novel/:novelId/chapters
 * @description 为小说创建新章节
 */
router.post('/:novelId/chapters',
  verifyToken,
  body('title').optional().trim(),
  body('content').optional().trim(),
  body('plot').optional().trim(),
  validateRequest,
  asyncHandler(async (req, res) => {
    const { novelId } = req.params
    const { title, content = '', plot } = req.body
    const novel = await findOwnedNovel(novelId, req.userId, { includeDeleted: true })
    if (!novel) {
      return res.status(404).json({ message: NOT_FOUND.NOVEL })
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
  }, '创建章节失败')
)

// 更新章节顺序
router.put('/chapters/order', verifyToken, asyncHandler(async (req, res) => {
  const { sourceChapterId, targetChapterId } = req.body

  // 验证章节是否存在且属于当前用户
  const sourceChapter = await findOwnedChapter(sourceChapterId, req.userId)
  const targetChapter = await findOwnedChapter(targetChapterId, req.userId)

  if (!sourceChapter || !targetChapter) {
    return res.status(404).json({ message: NOT_FOUND.CHAPTER })
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
      } }
    )
  } else if (sourceOrder > targetOrder) {
    // 源章节向后移动，中间章节都加1
    await Chapter.update(
      { order: Sequelize.literal('order + 1') },
      { where: {
        novelId: novelId,
        order: { [Sequelize.Op.between]: [targetOrder, sourceOrder - 1] }
      } }
    )
  }

  // 更新源章节的order为目标位置
  await sourceChapter.update({ order: targetOrder })

  res.json({ message: '章节顺序更新成功' })
}, '更新章节顺序失败'))

/**
 * 删除章节（假删除）
 * @route DELETE /api/novel/chapters/:id
 * @description 软删除章节
 */
router.delete('/chapters/:id', verifyToken, asyncHandler(async (req, res) => {
  const chapter = await findOwnedChapter(req.params.id, req.userId)
  if (!chapter) {
    return res.status(404).json({ message: NOT_FOUND.CHAPTER })
  }
  await chapter.update({ isDeleted: true, deletedAt: new Date() })

  res.json({ message: COMMON.DELETED })
}, '删除章节失败'))

// 获取回收站中的章节列表
router.get('/trash/chapters', verifyToken, asyncHandler(async (req, res) => {
  const chapters = await Chapter.findAll({
    include: [{ model: Novel, where: { userId: req.userId } }],
    where: { isDeleted: true },
    order: [['deletedAt', 'DESC']]
  })
  res.json(chapters)
}, '获取回收站章节列表失败'))

// 恢复回收站中的章节
router.put('/trash/chapters/:id/restore', verifyToken, asyncHandler(async (req, res) => {
  const chapter = await findOwnedChapter(req.params.id, req.userId)
  if (!chapter) {
    return res.status(404).json({ message: NOT_FOUND.CHAPTER })
  }
  await chapter.update({ isDeleted: false, deletedAt: null })
  res.json({ message: COMMON.RESTORED })
}, '恢复章节失败'))

// 永久删除章节
router.delete('/trash/chapters/:id/permanent', verifyToken, asyncHandler(async (req, res) => {
  const chapter = await findOwnedChapter(req.params.id, req.userId)
  if (!chapter) {
    return res.status(404).json({ message: NOT_FOUND.CHAPTER })
  }
  await chapter.destroy()
  res.json({ message: COMMON.PERMANENT_DELETED })
}, '永久删除章节失败'))

/**
 * 更新章节（标题/内容/剧情摘要）
 * @route PUT /api/novel/chapters/:id
 * @description 更新章节字段（部分更新）
 */
router.put('/chapters/:id',
  verifyToken,
  body('title').optional().trim().notEmpty().withMessage('章节标题不能为空'),
  body('content').optional().trim().notEmpty().withMessage('章节内容不能为空'),
  body('plot').optional().trim(),
  validateRequest,
  asyncHandler(async (req, res) => {
    const chapter = await findOwnedChapter(req.params.id, req.userId)
    if (!chapter) {
      return res.status(404).json({ message: NOT_FOUND.CHAPTER })
    }

    const patch = buildPatch(req.body, ['title', 'content', 'plot', 'outline'])

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ message: COMMON.NO_UPDATE_FIELDS })
    }

    await chapter.update(patch)

    res.json({ message: '更新成功', chapter })
  }, '更新章节失败')
)

/**
 * 获取章节列表（只获取未删除的）
 * @route GET /api/novel/:novelId/chapters
 * @description 获取小说的章节列表
 */
router.get('/:novelId/chapters', verifyToken, asyncHandler(async (req, res) => {
  const { novelId } = req.params

  const novel = await findOwnedNovel(novelId, req.userId)
  if (!novel) {
    return res.status(404).json({ message: NOT_FOUND.NOVEL })
  }
  const chapters = await Chapter.findAll({
    where: { novelId: parseInt(novelId), isDeleted: false },
    order: [['order', 'ASC']]
  })

  res.json(chapters)
}, '获取章节列表失败'))

module.exports = router
