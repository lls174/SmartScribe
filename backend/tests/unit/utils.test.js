const { parsePagination } = require('../../src/utils/pagination')
const { buildPatch } = require('../../src/utils/patchBuilder')
const { isMissingTableError } = require('../../src/utils/dbErrors')
const { estimateTokens } = require('../../src/utils/tokenEstimate')
const { sendError, sendServerError } = require('../../src/utils/httpResponse')
const { asyncHandler } = require('../../src/utils/asyncHandler')

const createRes = () => {
  const res = {}
  res.statusCode = 200
  res.body = undefined
  res.headersSent = false
  res.status = jest.fn((code) => {
    res.statusCode = code
    return res
  })
  res.json = jest.fn((payload) => {
    res.body = payload
    return res
  })
  return res
}

describe('parsePagination', () => {
  test('默认值：page=1, limit=10, offset=0', () => {
    expect(parsePagination({ query: {} })).toEqual({ page: 1, limit: 10, offset: 0 })
  })

  test('解析合法 page/limit 并计算 offset', () => {
    expect(parsePagination({ query: { page: '3', limit: '20' } })).toEqual({
      page: 3,
      limit: 20,
      offset: 40
    })
  })

  test('page/limit 为 0（falsy）时回退默认值', () => {
    expect(parsePagination({ query: { page: '0', limit: '0' } })).toEqual({
      page: 1,
      limit: 10,
      offset: 0
    })
  })

  test('负数 page/limit 被裁剪到下限 1', () => {
    expect(parsePagination({ query: { page: '-3', limit: '-5' } })).toEqual({
      page: 1,
      limit: 1,
      offset: 0
    })
  })

  test('limit 超过上限时被裁剪到 maxLimit', () => {
    expect(parsePagination({ query: { limit: '500' } }).limit).toBe(100)
  })

  test('支持自定义 defaultLimit 与 maxLimit', () => {
    expect(parsePagination({ query: {} }, { defaultLimit: 20 }).limit).toBe(20)
    expect(parsePagination({ query: { limit: '50' } }, { maxLimit: 30 }).limit).toBe(30)
  })

  test('非法 page/limit 回退到默认值', () => {
    expect(parsePagination({ query: { page: 'abc', limit: 'xyz' } })).toEqual({
      page: 1,
      limit: 10,
      offset: 0
    })
  })
})

describe('buildPatch', () => {
  test('仅保留显式传入的允许字段', () => {
    const body = { name: 'a', description: 'b', extra: 'c' }
    expect(buildPatch(body, ['name', 'description'])).toEqual({ name: 'a', description: 'b' })
  })

  test('忽略 undefined 字段，但保留 null / 空字符串 / false', () => {
    const body = { name: undefined, description: null, title: '', active: false }
    expect(buildPatch(body, ['name', 'description', 'title', 'active'])).toEqual({
      description: null,
      title: '',
      active: false
    })
  })

  test('空 body 返回空对象', () => {
    expect(buildPatch(null, ['name'])).toEqual({})
    expect(buildPatch(undefined, ['name'])).toEqual({})
  })
})

describe('isMissingTableError', () => {
  test('识别 ER_NO_SUCH_TABLE code', () => {
    expect(isMissingTableError({ original: { code: 'ER_NO_SUCH_TABLE' } })).toBe(true)
    expect(isMissingTableError({ parent: { code: 'ER_NO_SUCH_TABLE' } })).toBe(true)
  })

  test('识别 doesn\'t exist / no such table 文案', () => {
    expect(isMissingTableError({ message: "Table 'x' doesn't exist" })).toBe(true)
    expect(isMissingTableError({ original: { sqlMessage: 'no such table: x' } })).toBe(true)
  })

  test('普通错误返回 false', () => {
    expect(isMissingTableError(new Error('boom'))).toBe(false)
    expect(isMissingTableError({})).toBe(false)
  })
})

describe('estimateTokens', () => {
  test('默认每 4 字符约 1 token，向上取整', () => {
    expect(estimateTokens('12345678')).toBe(2)
    expect(estimateTokens('12345')).toBe(2)
  })

  test('支持自定义字符/token 比例', () => {
    expect(estimateTokens('123', 1.5)).toBe(2)
  })

  test('空值或非字符串返回 0', () => {
    expect(estimateTokens('')).toBe(0)
    expect(estimateTokens(null)).toBe(0)
    expect(estimateTokens(undefined)).toBe(0)
    expect(estimateTokens(12345)).toBe(0)
  })
})

describe('httpResponse', () => {
  test('sendError 设置指定状态码与消息', () => {
    const res = createRes()
    sendError(res, 404, '不存在')
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ message: '不存在' })
  })

  test('sendServerError 返回 500 并记录日志', () => {
    const res = createRes()
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    sendServerError(res, new Error('boom'), '失败')
    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: '失败' })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('asyncHandler', () => {
  test('正常执行 handler', async () => {
    const res = createRes()
    const handler = asyncHandler(async (req, r) => {
      r.json({ ok: true })
    })
    await handler({}, res, jest.fn())
    expect(res.body).toEqual({ ok: true })
  })

  test('handler 抛错时返回 500 与指定文案', async () => {
    const res = createRes()
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const handler = asyncHandler(async () => {
      throw new Error('boom')
    }, '操作失败')
    await handler({}, res, jest.fn())
    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: '操作失败' })
    spy.mockRestore()
  })

  test('响应头已发送时交给 next', async () => {
    const res = createRes()
    res.headersSent = true
    const next = jest.fn()
    const handler = asyncHandler(async () => {
      throw new Error('boom')
    })
    await handler({}, res, next)
    expect(next).toHaveBeenCalled()
  })
})
