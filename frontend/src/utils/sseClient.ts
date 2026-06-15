export interface AppSseEvent {
  content?: string
  plot?: string
  done?: boolean
  status?: 'waiting' | 'thinking' | 'generating'
}

/**
 * 增量解析 SSE 文本（智谱/OpenAI 兼容格式：data: {...}\n\n）
 * 必须保留跨 chunk 的不完整行，否则会出现「一段一段蹦字」。
 */
export const feedSseText = (
  lineBuffer: { value: string },
  chunk: string,
  onEvent: (event: AppSseEvent) => void
): void => {
  lineBuffer.value += chunk
  const lines = lineBuffer.value.split('\n')
  lineBuffer.value = lines.pop() || ''

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith(':')) continue
    if (!line.startsWith('data:')) continue

    const dataStr = line.slice(5).trim()
    if (!dataStr || dataStr === '[DONE]') continue

    try {
      onEvent(JSON.parse(dataStr) as AppSseEvent)
    } catch {
      // 等待下一个 chunk 补全 JSON
    }
  }
}

/** 将高频 chunk 合并到同一动画帧，减少 React 重绘卡顿 */
export const createRafChunkBatcher = (onFlush: (text: string) => void) => {
  let pending = ''
  let rafId: number | null = null

  const flush = (): void => {
    rafId = null
    if (!pending) return
    const batch = pending
    pending = ''
    onFlush(batch)
  }

  return {
    push(chunk: string): void {
      if (!chunk) return
      pending += chunk
      if (rafId === null) {
        rafId = requestAnimationFrame(flush)
      }
    },
    flushNow(): void {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      flush()
    }
  }
}
