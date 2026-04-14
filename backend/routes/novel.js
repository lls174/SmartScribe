const express = require('express')
const router = express.Router()
const { Novel, Chapter } = require('../models')
const { Op, Sequelize } = require('sequelize')
const { body, validationResult } = require('express-validator')
const { verifyToken } = require('../middleware/auth')

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
 * 更新章节标题
 * @route PUT /api/novel/chapters/:id
 * @description 更新章节标题
 * @param {number} id - 章节ID
 * @param {string} title - 章节标题（必填）
 * @returns {Object} - 更新结果
 */
router.put('/chapters/:id', 
  verifyToken,
  body('title').trim().notEmpty().withMessage('章节标题不能为空'),
  async (req, res) => {
    try {
      // 验证请求参数
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg })
      }

      const { id } = req.params
      const { title } = req.body
      const chapter = await Chapter.findOne({
        include: [{ model: Novel, where: { userId: req.userId } }],
        where: { id: parseInt(id) }
      })
      if (!chapter) {
        return res.status(404).json({ message: '章节不存在' })
      }
      await chapter.update({ title })
      
      res.json({ message: '更新成功' })
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