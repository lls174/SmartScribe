const request = require('supertest')
const express = require('express')
const feedbackRoutes = require('../../src/routes/feedback').default
const { Feedback } = require('../../src/models')

// 模拟 Feedback 模型
jest.mock('../../src/models', () => {
  const Feedback = {
    create: jest.fn(),
    findAll: jest.fn()
  }
  
  // 模拟返回值
  Feedback.create.mockResolvedValue({
    id: 1,
    type: 'bug',
    content: '测试反馈',
    userId: 1
  })
  
  Feedback.findAll.mockResolvedValue([
    {
      id: 1,
      type: 'bug',
      content: '测试反馈',
      userId: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ])
  
  return { Feedback }
})

const app = express()
app.use(express.json())
app.use('/api/feedback', feedbackRoutes)

describe('Feedback Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /api/feedback', () => {
    it('应该提交反馈成功并返回 201 状态码', async () => {
      const response = await request(app)
        .post('/api/feedback')
        .set('Authorization', 'Bearer test-token')
        .send({
          type: 'bug',
          content: '测试反馈内容'
        })

      expect(response.status).toBe(201)
      expect(response.body.message).toBe('反馈提交成功')
      expect(Feedback.create).toHaveBeenCalledWith({ 
        type: 'bug', 
        content: '测试反馈内容', 
        userId: 1 
      })
    })

    it('应该在未提供 token 时返回 401 状态码', async () => {
      const response = await request(app)
        .post('/api/feedback')
        .send({
          type: 'bug',
          content: '测试反馈内容'
        })

      expect(response.status).toBe(401)
      expect(response.body.message).toBe('未授权')
    })

    it('应该在提交失败时返回 500 状态码', async () => {
      // 模拟创建失败
      Feedback.create.mockRejectedValue(new Error('创建失败'))

      const response = await request(app)
        .post('/api/feedback')
        .set('Authorization', 'Bearer test-token')
        .send({
          type: 'bug',
          content: '测试反馈内容'
        })

      expect(response.status).toBe(500)
      expect(response.body.message).toBe('提交反馈失败')
    })
  })

  describe('GET /api/feedback', () => {
    it('应该返回反馈列表', async () => {
      const response = await request(app)
        .get('/api/feedback')
        .set('Authorization', 'Bearer test-token')

      expect(response.status).toBe(200)
      expect(response.body.length).toBe(1)
      expect(response.body[0].type).toBe('bug')
      expect(Feedback.findAll).toHaveBeenCalledWith({ 
        order: [['createdAt', 'DESC']]
      })
    })

    it('应该在未提供 token 时返回 401 状态码', async () => {
      const response = await request(app)
        .get('/api/feedback')

      expect(response.status).toBe(401)
      expect(response.body.message).toBe('未授权')
    })

    it('应该在获取失败时返回 500 状态码', async () => {
      // 模拟查询失败
      Feedback.findAll.mockRejectedValue(new Error('查询失败'))

      const response = await request(app)
        .get('/api/feedback')
        .set('Authorization', 'Bearer test-token')

      expect(response.status).toBe(500)
      expect(response.body.message).toBe('获取反馈列表失败')
    })
  })
})
