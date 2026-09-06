const request = require('supertest')

// 设置测试环境
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret'

// 模拟数据库和服务
jest.mock('../../src/config/db', () => {
  return {
    __esModule: true,
    default: {},
    authenticate: jest.fn().mockResolvedValue(true),
    connectDatabase: jest.fn().mockResolvedValue(true),
    getDatabaseStatus: jest.fn().mockReturnValue({
      connected: true,
      lastCheckedAt: new Date().toISOString(),
      lastError: null
    })
  }
})

jest.mock('../../src/models', () => {
  const User = {
    findOne: jest.fn(),
    create: jest.fn(),
    findByPk: jest.fn()
  }
  
  const Novel = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn()
  }
  
  const Chapter = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    count: jest.fn()
  }

  const GenerationHistory = {
    create: jest.fn().mockResolvedValue(true)
  }

  const AiRequestLog = {
    create: jest.fn().mockResolvedValue(true)
  }
  
  // 模拟返回值
  User.findByPk.mockResolvedValue({
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    createdAt: new Date(),
    update: jest.fn().mockResolvedValue(true)
  })
  
  User.findOne
    .mockResolvedValueOnce(null) // 注册时用户不存在
    .mockResolvedValueOnce({
      id: 1,
      username: 'testuser',
      validatePassword: jest.fn().mockReturnValue(true)
    }) // 登录时用户存在
  
  User.create.mockResolvedValue({
    id: 1,
    username: 'testuser',
    password: 'temp',
    setPassword: jest.fn().mockResolvedValue(true),
    save: jest.fn().mockResolvedValue(true)
  })
  
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
    update: jest.fn().mockResolvedValue(true)
  })
  
  Novel.create.mockResolvedValue({
    id: 1,
    name: '新小说',
    description: '新描述',
    userId: 1
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
  
  Chapter.create.mockResolvedValue({
    id: 1,
    novelId: 1,
    title: '新章节',
    content: '新内容',
    plot: '新剧情',
    order: 0
  })
  
  Chapter.count.mockResolvedValue(0)
  
  return { User, Novel, Chapter, GenerationHistory, AiRequestLog }
})

jest.mock('../../src/services/aiCredentialService', () => ({
  getUserAiConfig: jest.fn().mockResolvedValue({
    platform: 'deepseek',
    model: 'test-model',
    apiKey: 'test-api-key',
    hasUserApiKey: true
  }),
  getActiveAiConfigSummary: jest.fn(),
  getAiConfigStatus: jest.fn(),
  saveUserAiConfig: jest.fn()
}))

jest.mock('../../src/services/aiService', () => {
  return {
    __esModule: true,
    default: {
    generateContent: jest.fn().mockResolvedValue('测试生成的内容'),
    estimateTokens: jest.fn().mockReturnValue(10),
    generateChapter: jest.fn().mockResolvedValue({
      content: '测试生成的章节内容',
      plot: '测试剧情摘要'
    }),
    continueChapter: jest.fn().mockResolvedValue({
      content: '测试续写的内容',
      plot: '测试剧情摘要'
    }),
    polishContent: jest.fn().mockResolvedValue('测试润色后的内容'),
    generateSetting: jest.fn().mockResolvedValue('测试生成的设定'),
    generateOutline: jest.fn().mockResolvedValue('测试生成的大纲'),
    generateCreative: jest.fn().mockResolvedValue('测试生成的创意')
    }
  }
})

jest.mock('../../src/services/novelAgent', () => {
  return {
    __esModule: true,
    default: {
    generateChapter: jest.fn().mockResolvedValue({
      content: '测试生成的章节内容',
      plot: '测试剧情摘要'
    }),
    continueChapter: jest.fn().mockResolvedValue({
      content: '测试续写的内容',
      plot: '测试剧情摘要'
    }),
    polishChapter: jest.fn().mockResolvedValue('测试润色后的内容'),
    generateOutline: jest.fn().mockResolvedValue('测试生成的大纲')
    }
  }
})

jest.mock('../../src/routes/creative', () => {
  const express = require('express')
  return { __esModule: true, default: express.Router() }
})

const app = require('../../src/app').default

describe('集成测试', () => {
  let token

  beforeAll(async () => {
    // 注册用户
    await request(app)
      .post('/api/user/register')
      .send({
        username: 'testuser',
        password: 'password123',
        confirmPassword: 'password123'
      })

    // 登录获取 token
    const loginResponse = await request(app)
      .post('/api/user/login')
      .send({
        username: 'testuser',
        password: 'password123'
      })

    token = loginResponse.body.token || 'test-token'
  })

  describe('用户相关接口', () => {
    it('应该获取用户信息', async () => {
      const response = await request(app)
        .get('/api/user/info')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.username).toBe('testuser')
    })

    it('应该更新用户信息', async () => {
      const response = await request(app)
        .put('/api/user/info')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'updated@example.com'
        })

      expect(response.status).toBe(200)
      expect(response.body.message).toBe('用户信息更新成功')
    })
  })

  describe('小说相关接口', () => {
    it('应该创建小说', async () => {
      const response = await request(app)
        .post('/api/novel')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: '新小说',
          description: '新描述'
        })

      expect(response.status).toBe(201)
      expect(response.body.name).toBe('新小说')
    })

    it('应该获取小说列表', async () => {
      const response = await request(app)
        .get('/api/novel')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.length).toBe(1)
    })

    it('应该创建章节', async () => {
      const response = await request(app)
        .post('/api/novel/1/chapters')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: '新章节',
          content: '新内容',
          plot: '新剧情'
        })

      expect(response.status).toBe(201)
      expect(response.body.title).toBe('新章节')
    })

    it('应该获取章节列表', async () => {
      const response = await request(app)
        .get('/api/novel/1/chapters')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.length).toBe(1)
    })
  })

  describe('AI 相关接口', () => {
    it('应该生成章节', async () => {
      const response = await request(app)
        .post('/api/ai/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({
          prompt: '测试提示词',
          chapterTitle: '测试章节标题'
        })

      expect(response.status).toBe(200)
    })

    it('应该润色内容', async () => {
      const response = await request(app)
        .post('/api/ai/polish')
        .set('Authorization', `Bearer ${token}`)
        .send({
          content: '需要润色的内容',
          prompt: '润色提示词'
        })

      expect(response.status).toBe(200)
    })
  })

  describe('健康检查', () => {
    it('应该返回健康状态', async () => {
      const response = await request(app)
        .get('/api/health')

      expect(response.status).toBe(200)
      expect(response.body.status).toBe('ok')
    })
  })
})
