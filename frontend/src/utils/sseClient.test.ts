import { describe, expect, it, vi } from 'vitest'
import { createRafChunkBatcher, feedSseText } from './sseClient'

describe('feedSseText', () => {
  it('保留跨 chunk 的不完整 SSE 行', () => {
    const lineBuffer = { value: '' }
    const events: Array<{ content?: string }> = []

    feedSseText(lineBuffer, 'data: {"content":"你', (event) => events.push(event))
    expect(events).toHaveLength(0)

    feedSseText(lineBuffer, '好"}\n\n', (event) => events.push(event))
    expect(events).toEqual([{ content: '你好' }])
  })

  it('忽略 [DONE] 标记', () => {
    const lineBuffer = { value: '' }
    const events: unknown[] = []
    feedSseText(lineBuffer, 'data: [DONE]\n\n', (event) => events.push(event))
    expect(events).toHaveLength(0)
  })

  it('解析 status 状态事件', () => {
    const lineBuffer = { value: '' }
    const events: Array<{ status?: string }> = []

    feedSseText(lineBuffer, 'data: {"status":"thinking"}\n\n', (event) => events.push(event))
    feedSseText(lineBuffer, 'data: {"status":"generating"}\n\n', (event) => events.push(event))

    expect(events).toEqual([{ status: 'thinking' }, { status: 'generating' }])
  })
})

describe('createRafChunkBatcher', () => {
  it('合并同一帧内的多次 push', () => {
    const rafCallbacks: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})

    const flushed: string[] = []
    const batcher = createRafChunkBatcher((text) => flushed.push(text))
    batcher.push('a')
    batcher.push('b')
    rafCallbacks[0]?.(0)
    expect(flushed).toEqual(['ab'])

    vi.unstubAllGlobals()
  })
})
