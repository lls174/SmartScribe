const request = require('supertest')
const express = require('express')
const userRoutes = require('../../src/routes/user').default
const { User } = require('../../src/models')
const jwt = require('jsonwebtoken')

// 模拟 User 模型
jest.mock('../../src/models', () => {
  const User = {
    findOne: jest.fn(),
    create: jest.fn(),
    findByPk: jest.fn(),
    update: jest.fn()
  }
  
  User.findByPk.mockResolvedValue({
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    createdAt: new Date(),
    update: jest.fn().mockResolvedValue(true)
  })
  
  return { User }
})

const app = express()
app.use(express.json())
app.use('/api/user', userRoutes)

describe('User Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /api/user/register', () => {
    it('应该注册成功并返回 201 状态码', async () => {
      // 模拟用户不存在
      User.findOne.mockResolvedValue(null)
      // 模拟创建用户
      User.create.mockResolvedValue({
        id: 1,
        username: 'newuser',
        password: 'temp',
        setPassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true)
      })

      const response = await request(app)
        .post('/api/user/register')
        .send({
          username: 'newuser',
          password: 'password123',
          confirmPassword: 'password123'
        })

      expect(response.status).toBe(201)
      expect(response.body.message).toBe('注册成功')
      expect(User.findOne).toHaveBeenCalledWith({ where: { username: 'newuser' } })
      expect(User.create).toHaveBeenCalledWith({
        username: 'newuser',
        password: 'temp',
        email: null,
        bannedAt: null,
        banReason: null
      })
    })

    it('应该在用户名已存在时返回 400 状态码', async () => {
      // 模拟用户已存在
      User.findOne.mockResolvedValue({ id: 1, username: 'existinguser' })

      const response = await request(app)
        .post('/api/user/register')
        .send({
          username: 'existinguser',
          password: 'password123',
          confirmPassword: 'password123'
        })

      expect(response.status).toBe(400)
      expect(response.body.message).toBe('用户名已存在')
    })

    it('应该在参数验证失败时返回 400 状态码', async () => {
      const response = await request(app)
        .post('/api/user/register')
        .send({
          username: 'ab', // 用户名太短
          password: '123', // 密码太短
          confirmPassword: '1234' // 密码不一致
        })

      expect(response.status).toBe(400)
    })
  })

  describe('POST /api/user/login', () => {
    it('应该登录成功并返回 token', async () => {
      // 模拟用户存在
      User.findOne.mockResolvedValue({
        id: 1,
        username: 'testuser',
        validatePassword: jest.fn().mockReturnValue(true)
      })

      // 模拟 JWT 签名
      const originalSign = jwt.sign
      jwt.sign = jest.fn().mockReturnValue('test-token')

      const response = await request(app)
        .post('/api/user/login')
        .send({
          username: 'testuser',
          password: 'password123'
        })

      expect(response.status).toBe(200)
      expect(response.body.token).toBe('test-token')
      expect(response.body.userId).toBe(1)

      // 恢复原始 JWT 签名
      jwt.sign = originalSign
    })

    it('应该在用户名不存在时返回 401 状态码', async () => {
      // 模拟用户不存在
      User.findOne.mockResolvedValue(null)

      const response = await request(app)
        .post('/api/user/login')
        .send({
          username: 'nonexistent',
          password: 'password123'
        })

      expect(response.status).toBe(401)
      expect(response.body.message).toBe('用户名或密码错误')
    })

    it('应该在密码错误时返回 401 状态码', async () => {
      // 模拟用户存在但密码错误
      User.findOne.mockResolvedValue({
        id: 1,
        username: 'testuser',
        validatePassword: jest.fn().mockReturnValue(false)
      })

      const response = await request(app)
        .post('/api/user/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword'
        })

      expect(response.status).toBe(401)
      expect(response.body.message).toBe('用户名或密码错误')
    })
  })

  describe('GET /api/user/info', () => {
    it('应该返回用户信息', async () => {
      const response = await request(app)
        .get('/api/user/info')
        .set('Authorization', 'Bearer test-token')

      expect(response.status).toBe(200)
      expect(response.body.username).toBe('testuser')
      expect(response.body.email).toBe('test@example.com')
    })

    it('应该在未授权时返回 401 状态码', async () => {
      const response = await request(app)
        .get('/api/user/info')

      expect(response.status).toBe(401)
      expect(response.body.message).toBe('未授权')
    })
  })

  describe('PUT /api/user/info', () => {
    it('应该更新用户信息成功', async () => {
      // 模拟用户名不存在
      User.findOne.mockResolvedValue(null)

      const response = await request(app)
        .put('/api/user/info')
        .set('Authorization', 'Bearer test-token')
        .send({
          username: 'updateduser',
          email: 'updated@example.com'
        })

      expect(response.status).toBe(200)
      expect(response.body.message).toBe('用户信息更新成功')
    })

    it('应该在用户名已存在时返回 400 状态码', async () => {
      // 模拟用户名已存在
      User.findOne.mockResolvedValue({ id: 2, username: 'existinguser' })

      const response = await request(app)
        .put('/api/user/info')
        .set('Authorization', 'Bearer test-token')
        .send({
          username: 'existinguser'
        })

      expect(response.status).toBe(400)
      expect(response.body.message).toBe('用户名已存在')
    })
  })

  describe('PUT /api/user/password', () => {
    it('应该修改密码成功', async () => {
      User.findByPk.mockResolvedValue({
        id: 1,
        validatePassword: jest.fn().mockReturnValue(true),
        setPassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true)
      })

      const response = await request(app)
        .put('/api/user/password')
        .set('Authorization', 'Bearer test-token')
        .send({
          currentPassword: 'oldpassword',
          newPassword: 'newpassword123'
        })

      expect(response.status).toBe(200)
      expect(response.body.message).toBe('密码修改成功')
    })

    it('应该在当前密码错误时返回 400 状态码', async () => {
      User.findByPk.mockResolvedValue({
        id: 1,
        validatePassword: jest.fn().mockReturnValue(false)
      })

      const response = await request(app)
        .put('/api/user/password')
        .set('Authorization', 'Bearer test-token')
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123'
        })

      expect(response.status).toBe(400)
      expect(response.body.message).toBe('当前密码错误')
    })
  })
})