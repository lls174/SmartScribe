const request = require('supertest')
const express = require('express')
const novelRoutes = require('../../src/routes/novel').default
const { Novel, Chapter } = require('../../src/models')

// 模拟 Novel 和 Chapter 模型
jest.mock('../../src/models', () => {
  const Novel = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn()
  }
  
  const Chapter = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
    count: jest.fn()
  }
  
  // 模拟返回值
  Novel.findAll.mockResolvedValue([
    {
      id: 1,
      name: '测试小说',
      description: '测试描述',
      userId: 1,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ])
  
  Novel.findOne.mockResolvedValue({
    id: 1,
    name: '测试小说',
    userId: 1,
    update: jest.fn().mockResolvedValue(true),
    destroy: jest.fn().mockResolvedValue(true)
  })
  
  Chapter.findAll.mockResolvedValue([
    {
      id: 1,
      novelId: 1,
      title: '第一章',
      content: '测试内容',
      order: 0,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ])
  
  Chapter.findOne.mockResolvedValue({
    id: 1,
    novelId: 1,
    title: '第一章',
    content: '测试内容',
    order: 0,
    update: jest.fn().mockResolvedValue(true),
    destroy: jest.fn().mockResolvedValue(true)
  })
  
  Chapter.count.mockResolvedValue(0)
  
  return { Novel, Chapter }
})

const app = express()
app.use(express.json())
app.use('/api/novel', novelRoutes)

describe('Novel Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /api/novel', () => {
    it('应该创建小说成功并返回 201 状态码', async () => {
      // 模拟创建小说
      Novel.create.mockResolvedValue({
        id: 1,
        name: '新小说',
        description: '新描述',
        userId: 1
      })

      const response = await request(app)
        .post('/api/novel')
        .set('Authorization', 'Bearer test-token')
        .send({
          name: '新小说',
          description: '新描述'
        })

      expect(response.status).toBe(201)
      expect(response.body.name).toBe('新小说')
      expect(Novel.create).toHaveBeenCalledWith({
        name: '新小说',
        description: '新描述',
        userId: 1,
        deletedAt: null
      })
    })

    it('应该允许创建内容为空的草稿章节', async () => {
      const response = await request(app)
        .post('/api/novel')
        .set('Authorization', 'Bearer test-token')
        .send({})

      expect(response.status).toBe(400)
      expect(response.body.message).toBe('小说名称不能为空')
    })
  })

  describe('GET /api/novel', () => {
    it('应该返回小说列表', async () => {
      const response = await request(app)
        .get('/api/novel')
        .set('Authorization', 'Bearer test-token')

      expect(response.status).toBe(200)
      expect(response.body.length).toBe(1)
      expect(response.body[0].name).toBe('测试小说')
      expect(Novel.findAll).toHaveBeenCalledWith({
        where: { userId: 1, isDeleted: false },
        order: [['createdAt', 'DESC']]
      })
    })
  })

  describe('DELETE /api/novel/:id', () => {
    it('应该删除小说成功', async () => {
      const response = await request(app)
        .delete('/api/novel/1')
        .set('Authorization', 'Bearer test-token')

      expect(response.status).toBe(200)
      expect(response.body.message).toBe('删除成功')
      expect(Novel.findOne).toHaveBeenCalledWith({ where: { id: 1, userId: 1 } })
    })

    it('应该在小说不存在时返回 404 状态码', async () => {
      // 模拟小说不存在
      Novel.findOne.mockResolvedValue(null)

      const response = await request(app)
        .delete('/api/novel/999')
        .set('Authorization', 'Bearer test-token')

      expect(response.status).toBe(404)
      expect(response.body.message).toBe('小说不存在')
    })
  })

  describe('GET /api/novel/:novelId/chapters', () => {
    it('应该返回章节列表', async () => {
      // 模拟小说存在
      Novel.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        isDeleted: false
      })
      
      // 模拟章节列表
      Chapter.findAll.mockResolvedValue([
        {
          id: 1,
          novelId: 1,
          title: '第一章',
          content: '测试内容',
          order: 0,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ])

      const response = await request(app)
        .get('/api/novel/1/chapters')
        .set('Authorization', 'Bearer test-token')

      expect(response.status).toBe(200)
      expect(response.body.length).toBe(1)
      expect(response.body[0].title).toBe('第一章')
      expect(Chapter.findAll).toHaveBeenCalledWith({
        where: { novelId: 1, isDeleted: false },
        order: [['order', 'ASC']]
      })
    })

    it('应该在小说不存在时返回 404 状态码', async () => {
      // 模拟小说不存在
      Novel.findOne.mockResolvedValue(null)

      const response = await request(app)
        .get('/api/novel/999/chapters')
        .set('Authorization', 'Bearer test-token')

      expect(response.status).toBe(404)
      expect(response.body.message).toBe('小说不存在')
    })
  })

  describe('POST /api/novel/:novelId/chapters', () => {
    it('应该创建章节成功并返回 201 状态码', async () => {
      // 模拟小说存在
      Novel.findOne.mockResolvedValue({
        id: 1,
        userId: 1
      })
      
      // 模拟章节数量
      Chapter.count.mockResolvedValue(0)
      
      // 模拟创建章节
      Chapter.create.mockResolvedValue({
        id: 1,
        novelId: 1,
        title: '新章节',
        content: '新内容',
        plot: '新剧情',
        order: 0
      })

      const response = await request(app)
        .post('/api/novel/1/chapters')
        .set('Authorization', 'Bearer test-token')
        .send({
          title: '新章节',
          content: '新内容',
          plot: '新剧情'
        })

      expect(response.status).toBe(201)
      expect(response.body.title).toBe('新章节')
      expect(Chapter.create).toHaveBeenCalledWith({
        novelId: 1,
        title: '新章节',
        content: '新内容',
        plot: '新剧情',
        order: 0
      })
    })

    it('应该在参数验证失败时返回 400 状态码', async () => {
      // 模拟小说存在
      Novel.findOne.mockResolvedValue({
        id: 1,
        userId: 1
      })
      
      const response = await request(app)
        .post('/api/novel/1/chapters')
        .set('Authorization', 'Bearer test-token')
        .send({})

      expect(response.status).toBe(201)
      expect(Chapter.create).toHaveBeenCalledWith(expect.objectContaining({
        novelId: 1,
        content: ''
      }))
    })
  })

  describe('PUT /api/novel/chapters/order', () => {
    it('应该更新章节顺序成功', async () => {
      // 模拟两个章节
      Chapter.findOne
        .mockResolvedValueOnce({
          id: 1,
          novelId: 1,
          order: 0,
          update: jest.fn().mockResolvedValue(true)
        })
        .mockResolvedValueOnce({
          id: 2,
          novelId: 1,
          order: 1,
          update: jest.fn().mockResolvedValue(true)
        })

      const response = await request(app)
        .put('/api/novel/chapters/order')
        .set('Authorization', 'Bearer test-token')
        .send({
          sourceChapterId: 1,
          targetChapterId: 2
        })

      expect(response.status).toBe(200)
      expect(response.body.message).toBe('章节顺序更新成功')
    })

    it('应该在章节不存在时返回 404 状态码', async () => {
      // 模拟章节不存在
      Chapter.findOne.mockResolvedValue(null)

      const response = await request(app)
        .put('/api/novel/chapters/order')
        .set('Authorization', 'Bearer test-token')
        .send({
          sourceChapterId: 999,
          targetChapterId: 1000
        })

      expect(response.status).toBe(404)
      expect(response.body.message).toBe('章节不存在')
    })
  })

  describe('DELETE /api/novel/chapters/:id', () => {
    it('应该删除章节成功', async () => {
      // 模拟章节存在
      Chapter.findOne.mockResolvedValue({
        id: 1,
        novelId: 1,
        update: jest.fn().mockResolvedValue(true)
      })

      const response = await request(app)
        .delete('/api/novel/chapters/1')
        .set('Authorization', 'Bearer test-token')

      expect(response.status).toBe(200)
      expect(response.body.message).toBe('删除成功')
    })

    it('应该在章节不存在时返回 404 状态码', async () => {
      // 模拟章节不存在
      Chapter.findOne.mockResolvedValue(null)

      const response = await request(app)
        .delete('/api/novel/chapters/999')
        .set('Authorization', 'Bearer test-token')

      expect(response.status).toBe(404)
      expect(response.body.message).toBe('章节不存在')
    })
  })

  describe('PUT /api/novel/chapters/:id', () => {
    it('应该更新章节标题成功', async () => {
      // 模拟章节存在
      Chapter.findOne.mockResolvedValue({
        id: 1,
        novelId: 1,
        update: jest.fn().mockResolvedValue(true)
      })

      const response = await request(app)
        .put('/api/novel/chapters/1')
        .set('Authorization', 'Bearer test-token')
        .send({
          title: '更新的章节标题'
        })

      expect(response.status).toBe(200)
      expect(response.body.message).toBe('更新成功')
    })

    it('应该允许没有更新字段的兼容请求', async () => {
      // 模拟章节存在
      const update = jest.fn().mockResolvedValue(true)
      Chapter.findOne.mockResolvedValue({
        id: 1,
        novelId: 1,
        update
      })
      
      const response = await request(app)
        .put('/api/novel/chapters/1')
        .set('Authorization', 'Bearer test-token')
        .send({})

      expect(response.status).toBe(200)
      expect(update).toHaveBeenCalled()
    })
  })

  describe('章节按需加载', () => {
    it('轻量列表查询不读取正文列', async () => {
      const response = await request(app)
        .get('/api/novel/1/chapters?lightweight=true')
        .set('Authorization', 'Bearer test-token')

      expect(response.status).toBe(200)
      expect(Chapter.findAll).toHaveBeenCalledWith(expect.objectContaining({
        attributes: { exclude: ['content'] }
      }))
    })

    it('可以单独读取归属当前用户的章节全文', async () => {
      Chapter.findOne.mockResolvedValue({
        id: 1,
        novelId: 1,
        title: '第一章',
        content: '测试内容'
      })
      const response = await request(app)
        .get('/api/novel/chapters/1/detail')
        .set('Authorization', 'Bearer test-token')

      expect(response.status).toBe(200)
      expect(response.body.content).toBe('测试内容')
    })
  })
})
