export interface OpenAiStreamDelta {
  content?: string
  reasoning_content?: string
  role?: string
}

export interface OpenAiStreamChunk {
  usage?: Record<string, unknown>
  choices?: Array<{
    delta?: OpenAiStreamDelta
    finish_reason?: string | null
  }>
}

/** 从智谱/OpenAI 兼容 SSE 行提取增量正文（跳过 role-only / 思考 token） */
export const extractStreamContent = (data: OpenAiStreamChunk): string => {
  const choice = data.choices?.[0]
  if (!choice) return ''
  return choice.delta?.content || ''
}

/** 从智谱/OpenAI 兼容 SSE 行提取增量思考内容 */
export const extractStreamReasoning = (data: OpenAiStreamChunk): string => {
  const choice = data.choices?.[0]
  if (!choice) return ''
  return choice.delta?.reasoning_content || ''
}

export const parseSseDataPayload = (dataStr: string): OpenAiStreamChunk | null => {
  if (!dataStr || dataStr === '[DONE]') return null
  try {
    return JSON.parse(dataStr) as OpenAiStreamChunk
  } catch {
    return null
  }
}

export const consumeSseBuffer = (
  lineBuffer: { value: string },
  chunk: string,
  onPayload: (payload: OpenAiStreamChunk) => void
): void => {
  lineBuffer.value += chunk
  const lines = lineBuffer.value.split('\n')
  lineBuffer.value = lines.pop() || ''

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || !line.startsWith('data:')) continue
    const payload = parseSseDataPayload(line.slice(5).trim())
    if (payload) onPayload(payload)
  }
}
