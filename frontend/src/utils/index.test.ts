import { describe, test, expect } from 'vitest'
import { formatDate, formatDateTime, getApiErrorMessage, safeStringify } from './index'

describe('formatDate', () => {
  test('格式化为 zh-CN 年月日', () => {
    const result = formatDate('2024-01-05T08:00:00Z')
    // 仅校验包含年份，避免受运行环境时区/格式影响
    expect(result).toContain('2024')
  })
})

describe('formatDateTime', () => {
  test('空值返回兜底字符', () => {
    expect(formatDateTime(undefined)).toBe('-')
    expect(formatDateTime(null)).toBe('-')
    expect(formatDateTime('')).toBe('-')
  })

  test('支持自定义兜底字符', () => {
    expect(formatDateTime(undefined, '')).toBe('')
    expect(formatDateTime(null, '无')).toBe('无')
  })

  test('非法日期返回兜底字符', () => {
    expect(formatDateTime('not-a-date')).toBe('-')
  })

  test('合法日期返回非兜底的字符串', () => {
    const result = formatDateTime('2024-01-05T08:00:00Z')
    expect(result).not.toBe('-')
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('getApiErrorMessage', () => {
  test('优先取 response.data.message', () => {
    const error = { response: { data: { message: '用户名已存在' } }, message: 'Request failed' }
    expect(getApiErrorMessage(error, '失败')).toBe('用户名已存在')
  })

  test('无 response 时取 error.message', () => {
    expect(getApiErrorMessage(new Error('网络错误'), '失败')).toBe('网络错误')
  })

  test('无任何信息时取 fallback', () => {
    expect(getApiErrorMessage({}, '操作失败')).toBe('操作失败')
    expect(getApiErrorMessage(null, '操作失败')).toBe('操作失败')
    expect(getApiErrorMessage('string error', '操作失败')).toBe('操作失败')
  })

  test('默认 fallback 为「操作失败」', () => {
    expect(getApiErrorMessage(null)).toBe('操作失败')
  })
})

describe('safeStringify', () => {
  test('普通对象序列化为带缩进 JSON', () => {
    expect(safeStringify({ a: 1 })).toBe('{\n  "a": 1\n}')
  })

  test('循环引用不抛错，回退为 String()', () => {
    const obj: Record<string, unknown> = {}
    obj.self = obj
    expect(() => safeStringify(obj)).not.toThrow()
  })
})
