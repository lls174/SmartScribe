const request = require('supertest')
const express = require('express')
const aiRoutes = require('../../src/routes/ai').default
const novelAgent = require('../../src/services/novelAgent').default
const aiService = require('../../src/services/aiService').default

// 模拟小说代理与 AI 服务
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

jest.mock('../../src/services/aiService', () => {
  return {
    __esModule: true,
    default: {
    generateContent: jest.fn().mockResolvedValue('测试生成的内容'),
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

const app = express()
app.use(express.json())
app.use('/api/ai', aiRoutes)

describe('AI Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /api/ai/generate', () => {
    it('应该生成章节成功', async () => {
      const response = await request(app)
        .post('/api/ai/generate')
        .set('Authorization', 'Bearer test-token')
        .send({
          prompt: '测试提示词',
          chapterTitle: '测试章节标题'
        })

      expect(response.status).toBe(200)
      expect(novelAgent.generateChapter).toHaveBeenCalled()
    })

    it('应该在参数验证失败时返回 400 状态码', async () => {
      const response = await request(app)
        .post('/api/ai/generate')
        .set('Authorization', 'Bearer test-token')
        .send({})

      expect(response.status).toBe(400)
      expect(response.body.message).toBe('提示词不能为空')
    })
  })

  describe('POST /api/ai/continue', () => {
    it('应该续写章节成功', async () => {
      const response = await request(app)
        .post('/api/ai/continue')
        .set('Authorization', 'Bearer test-token')
        .send({
          lastContent: '上次内容',
          lastPlot: '上次剧情',
          prompt: '续写提示词'
        })

      expect(response.status).toBe(200)
      expect(novelAgent.continueChapter).toHaveBeenCalled()
    })

    it('应该在参数验证失败时返回 400 状态码', async () => {
      const response = await request(app)
        .post('/api/ai/continue')
        .set('Authorization', 'Bearer test-token')
        .send({})

      expect(response.status).toBe(400)
      expect(response.body.message).toBe('缺少上下文信息，无法续写')
    })
  })

  describe('POST /api/ai/polish', () => {
    it('应该润色内容成功', async () => {
      const response = await request(app)
        .post('/api/ai/polish')
        .set('Authorization', 'Bearer test-token')
        .send({
          content: '需要润色的内容',
          prompt: '润色提示词'
        })

      expect(response.status).toBe(200)
      expect(novelAgent.polishChapter).toHaveBeenCalled()
    })

    it('应该在参数验证失败时返回 400 状态码', async () => {
      const response = await request(app)
        .post('/api/ai/polish')
        .set('Authorization', 'Bearer test-token')
        .send({})

      expect(response.status).toBe(400)
      expect(response.body.message).toBe('内容不能为空')
    })
  })

  describe('POST /api/ai/setting', () => {
    it('应该生成设定成功', async () => {
      const response = await request(app)
        .post('/api/ai/setting')
        .set('Authorization', 'Bearer test-token')
        .send({
          type: '角色设定',
          prompt: '设定提示词'
        })

      expect(response.status).toBe(200)
      expect(aiService.generateContent).toHaveBeenCalled()
    })

    it('应该在参数验证失败时返回 400 状态码', async () => {
      const response = await request(app)
        .post('/api/ai/setting')
        .set('Authorization', 'Bearer test-token')
        .send({})

      expect(response.status).toBe(400)
      expect(response.body.message).toBe('设定类型不能为空')
    })
  })

  describe('POST /api/ai/outline', () => {
    it('应该生成大纲成功', async () => {
      const response = await request(app)
        .post('/api/ai/outline')
        .set('Authorization', 'Bearer test-token')
        .send({
          novelType: '玄幻',
          corePlot: '核心剧情',
          length: '长大纲'
        })

      expect(response.status).toBe(200)
      expect(novelAgent.generateOutline).toHaveBeenCalled()
    })

    it('应该在参数验证失败时返回 400 状态码', async () => {
      const response = await request(app)
        .post('/api/ai/outline')
        .set('Authorization', 'Bearer test-token')
        .send({})

      expect(response.status).toBe(400)
      expect(response.body.message).toBe('小说类型不能为空')
    })
  })

  describe('POST /api/ai/creative', () => {
    it('应该生成创意成功', async () => {
      const response = await request(app)
        .post('/api/ai/creative')
        .set('Authorization', 'Bearer test-token')
        .send({
          prompt: '创意提示词',
          type: '情节创意'
        })

      expect(response.status).toBe(200)
      expect(aiService.generateContent).toHaveBeenCalled()
    })

    it('应该在参数验证失败时返回 400 状态码', async () => {
      const response = await request(app)
        .post('/api/ai/creative')
        .set('Authorization', 'Bearer test-token')
        .send({})

      expect(response.status).toBe(400)
      expect(response.body.message).toBe('提示词不能为空')
    })
  })
})
