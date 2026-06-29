import { Router } from 'express'
import { Op, Sequelize } from 'sequelize'
import { body } from 'express-validator'
import type { NovelSnapshot } from '../../../shared/types'
import { CharacterCard, Chapter, GenerationHistory, Novel, NovelSetting, NovelVersion } from '../models'
import { verifyToken } from '../middleware/auth'
import { validateRequest } from '../middleware/validate'
import { asyncHandler } from '../utils/asyncHandler'
import { parsePagination } from '../utils/pagination'
import { isMissingTableError } from '../utils/dbErrors'
import { findOwnedChapter, findOwnedNovel } from '../services/novelQueryService'
import { COMMON, NOT_FOUND } from '../constants/messages'

const router = Router()

const CHARACTER_FIELDS = ['name', 'role', 'identity', 'personality', 'appearance', 'relationship', 'secret', 'arc', 'notes', 'priority', 'isActive'] as const
const SETTING_FIELDS = ['worldview', 'genreStyle', 'powerSystem', 'timeline', 'plotRules', 'taboos', 'styleGuide', 'notes', 'overallOutline'] as const

const toNumber = (value: string | number | undefined): number => parseInt(String(value), 10)
const optionalString = (value: unknown): string | null | undefined => {
  if (typeof value === 'undefined') return undefined
  return typeof value === 'string' ? value : null
}

const buildNovelSnapshot = (novel: Novel, chapters: Chapter[]): NovelSnapshot => ({
  novel: {
    id: novel.id,
    name: novel.name,
    description: novel.description,
    createdAt: novel.createdAt.toISOString(),
    updatedAt: novel.updatedAt.toISOString()
  },
  chapters: chapters.map((chapter) => ({
    id: chapter.id,
    order: chapter.order,
    title: chapter.title,
    content: chapter.content,
    plot: chapter.plot,
    outline: chapter.outline,
    createdAt: chapter.createdAt.toISOString(),
    updatedAt: chapter.updatedAt.toISOString()
  }))
})

const buildCharacterPatch = (body: Record<string, unknown>): Partial<Pick<CharacterCard, typeof CHARACTER_FIELDS[number]>> => ({
  name: typeof body.name === 'string' ? body.name : undefined,
  role: optionalString(body.role),
  identity: optionalString(body.identity),
  personality: optionalString(body.personality),
  appearance: optionalString(body.appearance),
  relationship: optionalString(body.relationship),
  secret: optionalString(body.secret),
  arc: optionalString(body.arc),
  notes: optionalString(body.notes),
  priority: typeof body.priority === 'number' ? body.priority : undefined,
  isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined
})

const buildSettingPatch = (body: Record<string, unknown>): Partial<Pick<NovelSetting, typeof SETTING_FIELDS[number]>> => ({
  worldview: optionalString(body.worldview),
  genreStyle: optionalString(body.genreStyle),
  powerSystem: optionalString(body.powerSystem),
  timeline: optionalString(body.timeline),
  plotRules: optionalString(body.plotRules),
  taboos: optionalString(body.taboos),
  styleGuide: optionalString(body.styleGuide),
  notes: optionalString(body.notes),
  overallOutline: optionalString(body.overallOutline)
})

const buildNovelPatch = (body: Record<string, unknown>): Partial<Pick<Novel, 'name' | 'description'>> => ({
  name: typeof body.name === 'string' ? body.name : undefined,
  description: optionalString(body.description)
})

const buildChapterPatch = (body: Record<string, unknown>): Partial<Pick<Chapter, 'title' | 'content' | 'plot' | 'outline'>> => ({
  title: optionalString(body.title),
  content: typeof body.content === 'string' ? body.content : undefined,
  plot: optionalString(body.plot),
  outline: optionalString(body.outline)
})

router.post('/',
  verifyToken,
  body('name').trim().notEmpty().withMessage('小说名称不能为空'),
  body('description').optional().trim(),
  validateRequest,
  asyncHandler(async (req, res) => {
    const { name, description } = req.body as { name: string; description?: string }
    const novel = await Novel.create({ name, description: description ?? null, userId: req.userId!, deletedAt: null })
    res.status(201).json(novel)
  }, '创建小说失败')
)

router.get('/', verifyToken, asyncHandler(async (req, res) => {
  const novels = await Novel.findAll({
    where: { userId: req.userId!, isDeleted: false },
    order: [['createdAt', 'DESC']]
  })
  res.json(novels)
}, '获取小说列表失败'))

router.get('/:id', verifyToken, asyncHandler(async (req, res) => {
  const novel = await findOwnedNovel(req.params.id, req.userId!)
  if (!novel) {
    return res.status(404).json({ message: NOT_FOUND.NOVEL })
  }
  res.json(novel)
}, '获取小说详情失败'))

router.get('/:novelId/characters', verifyToken, asyncHandler(async (req, res) => {
  const novel = await findOwnedNovel(req.params.novelId, req.userId!)
  if (!novel) {
    return res.status(404).json({ message: NOT_FOUND.NOVEL })
  }
  const cards = await CharacterCard.findAll({
    where: { novelId: novel.id },
    order: [['priority', 'DESC'], ['updatedAt', 'DESC']]
  })
  res.json(cards)
}, '获取人物卡失败'))

router.post('/:novelId/characters',
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
    const novel = await findOwnedNovel(req.params.novelId, req.userId!)
    if (!novel) {
      return res.status(404).json({ message: NOT_FOUND.NOVEL })
    }
    const payload = req.body as Record<string, unknown>
    const card = await CharacterCard.create({
      novelId: novel.id,
      name: String(payload.name),
      role: typeof payload.role === 'string' ? payload.role : null,
      identity: typeof payload.identity === 'string' ? payload.identity : null,
      personality: typeof payload.personality === 'string' ? payload.personality : null,
      appearance: typeof payload.appearance === 'string' ? payload.appearance : null,
      relationship: typeof payload.relationship === 'string' ? payload.relationship : null,
      secret: typeof payload.secret === 'string' ? payload.secret : null,
      arc: typeof payload.arc === 'string' ? payload.arc : null,
      notes: typeof payload.notes === 'string' ? payload.notes : null,
      priority: typeof payload.priority === 'number' ? payload.priority : 5,
      isActive: typeof payload.isActive === 'boolean' ? payload.isActive : true
    })
    res.status(201).json(card)
  }, '创建人物卡失败')
)

router.put('/:novelId/characters/:cardId',
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
    const novel = await findOwnedNovel(req.params.novelId, req.userId!)
    if (!novel) return res.status(404).json({ message: NOT_FOUND.NOVEL })

    const card = await CharacterCard.findOne({ where: { id: toNumber(req.params.cardId), novelId: novel.id } })
    if (!card) return res.status(404).json({ message: NOT_FOUND.CHARACTER_CARD })

    await card.update(buildCharacterPatch(req.body as Record<string, unknown>))
    res.json(card)
  }, '更新人物卡失败')
)

router.delete('/:novelId/characters/:cardId', verifyToken, asyncHandler(async (req, res) => {
  const novel = await findOwnedNovel(req.params.novelId, req.userId!)
  if (!novel) return res.status(404).json({ message: NOT_FOUND.NOVEL })

  const deleted = await CharacterCard.destroy({ where: { id: toNumber(req.params.cardId), novelId: novel.id } })
  if (!deleted) return res.status(404).json({ message: NOT_FOUND.CHARACTER_CARD })
  res.json({ message: '人物卡已删除' })
}, '删除人物卡失败'))

router.get('/:novelId/setting', verifyToken, asyncHandler(async (req, res) => {
  const novel = await findOwnedNovel(req.params.novelId, req.userId!)
  if (!novel) return res.status(404).json({ message: NOT_FOUND.NOVEL })
  const [setting] = await NovelSetting.findOrCreate({ where: { novelId: novel.id }, defaults: { novelId: novel.id } })
  res.json(setting)
}, '获取内容设定失败'))

router.put('/:novelId/setting',
  verifyToken,
  ...SETTING_FIELDS.map((field) => body(field).optional().trim()),
  validateRequest,
  asyncHandler(async (req, res) => {
    const novel = await findOwnedNovel(req.params.novelId, req.userId!)
    if (!novel) return res.status(404).json({ message: NOT_FOUND.NOVEL })
    const patch = buildSettingPatch(req.body as Record<string, unknown>)
    const [setting] = await NovelSetting.findOrCreate({ where: { novelId: novel.id }, defaults: { novelId: novel.id, ...patch } })
    if (Object.keys(patch).length > 0) {
      await setting.update(patch)
    }
    res.json(setting)
  }, '保存内容设定失败')
)

router.put('/:id',
  verifyToken,
  body('name').optional().trim().notEmpty().withMessage('小说名称不能为空'),
  body('description').optional().trim(),
  validateRequest,
  asyncHandler(async (req, res) => {
    const novel = await findOwnedNovel(req.params.id, req.userId!)
    if (!novel) return res.status(404).json({ message: NOT_FOUND.NOVEL })
    const patch = buildNovelPatch(req.body as Record<string, unknown>)
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ message: COMMON.NO_UPDATE_FIELDS })
    }
    await novel.update(patch)
    res.json(novel)
  }, '更新小说失败')
)

router.post('/:novelId/versions',
  verifyToken,
  body('label').optional().trim(),
  validateRequest,
  asyncHandler(async (req, res) => {
    const novelId = toNumber(req.params.novelId)
    const novel = await findOwnedNovel(novelId, req.userId!)
    if (!novel) return res.status(404).json({ message: NOT_FOUND.NOVEL })
    const chapters = await Chapter.findAll({ where: { novelId, isDeleted: false }, order: [['order', 'ASC']] })
    const snapshot = buildNovelSnapshot(novel, chapters)
    try {
      const version = await NovelVersion.create({
        userId: req.userId!,
        novelId,
        label: (req.body as { label?: string }).label ?? null,
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

router.get('/:novelId/versions', verifyToken, asyncHandler(async (req, res) => {
  const novelId = toNumber(req.params.novelId)
  const novel = await findOwnedNovel(novelId, req.userId!)
  if (!novel) return res.status(404).json({ message: NOT_FOUND.NOVEL })
  try {
    const versions = await NovelVersion.findAll({ where: { novelId, userId: req.userId! }, order: [['createdAt', 'DESC']] })
    res.json(versions)
  } catch (error) {
    if (isMissingTableError(error)) return res.json([])
    throw error
  }
}, '获取版本列表失败'))

router.get('/:novelId/versions/:versionId', verifyToken, asyncHandler(async (req, res) => {
  try {
    const version = await NovelVersion.findOne({
      where: { id: toNumber(req.params.versionId), novelId: toNumber(req.params.novelId), userId: req.userId! }
    })
    if (!version) return res.status(404).json({ message: NOT_FOUND.VERSION })
    res.json(version)
  } catch (error) {
    if (isMissingTableError(error)) return res.status(404).json({ message: NOT_FOUND.VERSION })
    throw error
  }
}, '获取版本详情失败'))

router.post('/:novelId/versions/:versionId/restore', verifyToken, asyncHandler(async (req, res) => {
  const novelId = toNumber(req.params.novelId)
  const novel = await findOwnedNovel(novelId, req.userId!)
  if (!novel) return res.status(404).json({ message: NOT_FOUND.NOVEL })

  let version: NovelVersion | null = null
  try {
    version = await NovelVersion.findOne({ where: { id: toNumber(req.params.versionId), novelId, userId: req.userId! } })
  } catch (error) {
    if (isMissingTableError(error)) {
      return res.status(503).json({ message: '版本功能未初始化，请先在后端执行 npm run db:init 创建数据表' })
    }
    throw error
  }
  if (!version) return res.status(404).json({ message: NOT_FOUND.VERSION })

  try {
    const currentChapters = await Chapter.findAll({ where: { novelId, isDeleted: false }, order: [['order', 'ASC']] })
    await NovelVersion.create({
      userId: req.userId!,
      novelId,
      label: `自动备份-切换前-${new Date().toLocaleString()}`,
      snapshot: buildNovelSnapshot(novel, currentChapters)
    })
  } catch (backupError) {
    console.warn('切换前备份失败:', backupError instanceof Error ? backupError.message : backupError)
  }

  const snapshot: NovelSnapshot = version.snapshot
  const snapshotNovel: Partial<NonNullable<NovelSnapshot['novel']>> = snapshot.novel ?? {}
  const snapshotChapters = Array.isArray(snapshot.chapters) ? snapshot.chapters : []
  await novel.update({
    name: typeof snapshotNovel.name === 'string' ? snapshotNovel.name : novel.name,
    description: typeof snapshotNovel.description !== 'undefined' ? snapshotNovel.description : novel.description
  })

  const existingChapters = await Chapter.findAll({ where: { novelId } })
  const byId = new Map(existingChapters.map((chapter) => [chapter.id, chapter]))
  const snapshotIds = new Set<number>()

  for (const sc of snapshotChapters) {
    const scId = typeof sc.id === 'number' ? sc.id : null
    const scOrder = typeof sc.order === 'number' ? sc.order : 0
    if (scId && byId.has(scId)) {
      snapshotIds.add(scId)
      const chapter = byId.get(scId)!
      await chapter.update({
        title: typeof sc.title !== 'undefined' ? sc.title : chapter.title,
        content: typeof sc.content === 'string' ? sc.content : chapter.content,
        plot: typeof sc.plot !== 'undefined' ? sc.plot : chapter.plot,
        order: scOrder,
        isDeleted: false,
        deletedAt: null
      })
    } else {
      const created = await Chapter.create({
        novelId,
        title: sc.title ?? null,
        content: sc.content || '',
        plot: sc.plot ?? null,
        order: scOrder,
        isDeleted: false,
        deletedAt: null
      })
      snapshotIds.add(created.id)
    }
  }

  for (const chapter of existingChapters) {
    if (!snapshotIds.has(chapter.id) && !chapter.isDeleted) {
      await chapter.update({ isDeleted: true, deletedAt: new Date() })
    }
  }
  res.json({ message: '版本切换成功' })
}, '切换版本失败'))

router.get('/:novelId/history', verifyToken, asyncHandler(async (req, res) => {
  const novelId = toNumber(req.params.novelId)
  const { page, limit, offset } = parsePagination(req, { defaultLimit: 20 })
  const novel = await findOwnedNovel(novelId, req.userId!)
  if (!novel) return res.status(404).json({ message: NOT_FOUND.NOVEL })
  try {
    const { count, rows } = await GenerationHistory.findAndCountAll({
      where: { userId: req.userId!, novelId },
      order: [['createdAt', 'DESC']],
      limit,
      offset
    })
    res.json({ page, limit, total: count, histories: rows })
  } catch (error) {
    if (isMissingTableError(error)) return res.json({ page, limit, total: 0, histories: [] })
    throw error
  }
}, '获取生成历史失败'))

router.delete('/:id', verifyToken, asyncHandler(async (req, res) => {
  const novel = await findOwnedNovel(req.params.id, req.userId!, { includeDeleted: true })
  if (!novel) return res.status(404).json({ message: NOT_FOUND.NOVEL })
  await novel.update({ isDeleted: true, deletedAt: new Date() })
  res.json({ message: COMMON.DELETED })
}, '删除小说失败'))

router.get('/trash/novels', verifyToken, asyncHandler(async (req, res) => {
  const novels = await Novel.findAll({ where: { userId: req.userId!, isDeleted: true }, order: [['deletedAt', 'DESC']] })
  res.json(novels)
}, '获取回收站小说列表失败'))

router.put('/trash/novels/:id/restore', verifyToken, asyncHandler(async (req, res) => {
  const novel = await findOwnedNovel(req.params.id, req.userId!, { includeDeleted: true })
  if (!novel) return res.status(404).json({ message: NOT_FOUND.NOVEL })
  await novel.update({ isDeleted: false, deletedAt: null })
  res.json({ message: COMMON.RESTORED })
}, '恢复小说失败'))

router.delete('/trash/novels/:id/permanent', verifyToken, asyncHandler(async (req, res) => {
  const novel = await findOwnedNovel(req.params.id, req.userId!, { includeDeleted: true })
  if (!novel) return res.status(404).json({ message: NOT_FOUND.NOVEL })
  await Chapter.destroy({ where: { novelId: req.params.id } })
  await novel.destroy()
  res.json({ message: COMMON.PERMANENT_DELETED })
}, '永久删除小说失败'))

router.post('/:novelId/chapters',
  verifyToken,
  body('title').optional().trim(),
  body('content').optional().trim(),
  body('plot').optional().trim(),
  validateRequest,
  asyncHandler(async (req, res) => {
    const novelId = toNumber(req.params.novelId)
    const { title, content = '', plot } = req.body as { title?: string; content?: string; plot?: string }
    const novel = await findOwnedNovel(novelId, req.userId!, { includeDeleted: true })
    if (!novel) return res.status(404).json({ message: NOT_FOUND.NOVEL })
    const chapterCount = await Chapter.count({ where: { novelId, isDeleted: false } })
    const chapter = await Chapter.create({ novelId, title: title ?? null, content, plot: plot ?? null, order: chapterCount })
    res.status(201).json(chapter)
  }, '创建章节失败')
)

router.put('/chapters/order', verifyToken, asyncHandler(async (req, res) => {
  const { sourceChapterId, targetChapterId } = req.body as { sourceChapterId: number; targetChapterId: number }
  const sourceChapter = await findOwnedChapter(sourceChapterId, req.userId!)
  const targetChapter = await findOwnedChapter(targetChapterId, req.userId!)
  if (!sourceChapter || !targetChapter) return res.status(404).json({ message: NOT_FOUND.CHAPTER })
  if (sourceChapter.novelId !== targetChapter.novelId) {
    return res.status(400).json({ message: '只能在同一本小说内调整章节顺序' })
  }

  const sourceOrder = sourceChapter.order
  const targetOrder = targetChapter.order
  const novelId = sourceChapter.novelId
  if (sourceOrder < targetOrder) {
    await Chapter.update({ order: Sequelize.literal('`order` - 1') }, { where: { novelId, order: { [Op.between]: [sourceOrder + 1, targetOrder] } } })
  } else if (sourceOrder > targetOrder) {
    await Chapter.update({ order: Sequelize.literal('`order` + 1') }, { where: { novelId, order: { [Op.between]: [targetOrder, sourceOrder - 1] } } })
  }
  await sourceChapter.update({ order: targetOrder })
  res.json({ message: '章节顺序更新成功' })
}, '更新章节顺序失败'))

router.delete('/chapters/:id', verifyToken, asyncHandler(async (req, res) => {
  const chapter = await findOwnedChapter(req.params.id, req.userId!)
  if (!chapter) return res.status(404).json({ message: NOT_FOUND.CHAPTER })
  await chapter.update({ isDeleted: true, deletedAt: new Date() })
  res.json({ message: COMMON.DELETED })
}, '删除章节失败'))

router.get('/trash/chapters', verifyToken, asyncHandler(async (req, res) => {
  const chapters = await Chapter.findAll({
    include: [{ model: Novel, where: { userId: req.userId! } }],
    where: { isDeleted: true },
    order: [['deletedAt', 'DESC']]
  })
  res.json(chapters)
}, '获取回收站章节列表失败'))

router.put('/trash/chapters/:id/restore', verifyToken, asyncHandler(async (req, res) => {
  const chapter = await findOwnedChapter(req.params.id, req.userId!)
  if (!chapter) return res.status(404).json({ message: NOT_FOUND.CHAPTER })
  await chapter.update({ isDeleted: false, deletedAt: null })
  res.json({ message: COMMON.RESTORED })
}, '恢复章节失败'))

router.delete('/trash/chapters/:id/permanent', verifyToken, asyncHandler(async (req, res) => {
  const chapter = await findOwnedChapter(req.params.id, req.userId!)
  if (!chapter) return res.status(404).json({ message: NOT_FOUND.CHAPTER })
  await chapter.destroy()
  res.json({ message: COMMON.PERMANENT_DELETED })
}, '永久删除章节失败'))

router.put('/chapters/:id',
  verifyToken,
  body('title').optional().trim().notEmpty().withMessage('章节标题不能为空'),
  body('content').optional().trim().notEmpty().withMessage('章节内容不能为空'),
  body('plot').optional().trim(),
  body('outline').optional().trim(),
  validateRequest,
  asyncHandler(async (req, res) => {
    const chapter = await findOwnedChapter(req.params.id, req.userId!)
    if (!chapter) return res.status(404).json({ message: NOT_FOUND.CHAPTER })
    const patch = buildChapterPatch(req.body as Record<string, unknown>)
    if (Object.keys(patch).length === 0) return res.status(400).json({ message: COMMON.NO_UPDATE_FIELDS })
    await chapter.update(patch)
    res.json({ message: '更新成功', chapter })
  }, '更新章节失败')
)

router.get('/:novelId/chapters', verifyToken, asyncHandler(async (req, res) => {
  const novelId = toNumber(req.params.novelId)
  const novel = await findOwnedNovel(novelId, req.userId!)
  if (!novel) return res.status(404).json({ message: NOT_FOUND.NOVEL })
  const chapters = await Chapter.findAll({ where: { novelId, isDeleted: false }, order: [['order', 'ASC']] })
  res.json(chapters)
}, '获取章节列表失败'))

export default router
