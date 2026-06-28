import { buildApiUrl, getCsrfToken } from './api'
import { createRafChunkBatcher, feedSseText } from '@/utils/sseClient'
import type { AiStreamPhase } from '@app-types/index'

import { DEFAULT_AI_MODEL, DEFAULT_AI_PLATFORM, readStoredAiConfig } from '@/data/aiModelCatalog'

interface AIRequestConfig {
  platform?: string
  model?: string
  enableDeepThinking?: boolean
}

export interface NovelContext {
  novelId?: number
  novelMeta?: {
    name?: string
    description?: string
    genre?: string
    style?: string
    totalChapters?: number
  }
  chapters?: Array<{
    id: number
    title?: string
    content?: string
    plot?: string
  }>
  currentChapterId?: number
}

/**
 * 解析最终使用的 AI 配置：优先入参，其次 localStorage，最后默认值
 */
const resolveAIConfig = (aiConfig?: AIRequestConfig) => {
  const stored = readStoredAiConfig()
  return {
    platform: aiConfig?.platform || stored.platform || DEFAULT_AI_PLATFORM,
    model: aiConfig?.model || stored.model || DEFAULT_AI_MODEL,
    enableDeepThinking: aiConfig?.enableDeepThinking ?? stored.enableDeepThinking
  }
}

const withResolvedAiConfig = (body: Record<string, unknown>, aiConfig?: AIRequestConfig) => {
  const resolved = resolveAIConfig(aiConfig)
  return {
    ...body,
    platform: resolved.platform,
    model: resolved.model,
    enableDeepThinking: resolved.enableDeepThinking
  }
}

/**
 * 基于 XMLHttpRequest 的 SSE 流式请求底层实现
 * 统一处理鉴权头、CSRF、SSE data 解析、错误处理
 */
const createSSERequest = (
  url: string,
  body: Record<string, unknown>,
  onChunk: ((chunk: string) => void) | undefined,
  onPhase: ((phase: AiStreamPhase) => void) | undefined,
  onDone: ((data: { plot: string }) => void) | undefined,
  resolve: (value: { content: string; plot: string }) => void,
  reject: (error: Error) => void,
  csrfToken?: string
): XMLHttpRequest => {
  const xhr = new XMLHttpRequest()
  xhr.open('POST', url)
  xhr.setRequestHeader('Content-Type', 'application/json')

  const token = localStorage.getItem('token')
  if (token) {
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
  }

  if (csrfToken) {
    xhr.setRequestHeader('X-CSRF-Token', csrfToken)
  }

  xhr.responseType = 'text'

  let fullContent = ''
  let plot = ''
  let settled = false
  const sseLineBuffer = { value: '' }
  const chunkBatcher = onChunk
    ? createRafChunkBatcher((batch) => {
        fullContent += batch
        onChunk(batch)
      })
    : null

  const fail = (error: Error): void => {
    if (settled) return
    settled = true
    xhr.abort()
    reject(error)
  }

  const succeed = (): void => {
    if (settled) return
    settled = true
    resolve({ content: fullContent, plot })
  }

  const handleSseEvent = (data: { content?: string; plot?: string; done?: boolean; error?: string; status?: AiStreamPhase }) => {
    if (data.error) {
      fail(new Error(data.error))
      return
    }
    if (data.status) {
      onPhase?.(data.status)
    }
    if (data.content) {
      if (chunkBatcher) {
        chunkBatcher.push(data.content)
      } else {
        fullContent += data.content
      }
    }
    if (data.plot) {
      plot = data.plot
    }
    if (data.done) {
      onDone?.({ plot })
    }
  }

  xhr.timeout = 120000

  xhr.onprogress = () => {
    const responseText = xhr.responseText
    if (!responseText) return
    // 仅处理新增片段，配合行缓冲避免半行 JSON 被丢弃
    const processedLength = (xhr as XMLHttpRequest & { _sseProcessedLength?: number })._sseProcessedLength || 0
    const newData = responseText.slice(processedLength)
    ;(xhr as XMLHttpRequest & { _sseProcessedLength?: number })._sseProcessedLength = responseText.length
    if (newData) {
      feedSseText(sseLineBuffer, newData, handleSseEvent)
    }
  }

  xhr.onload = () => {
    if (settled) return
    // 处理末尾未换行的事件
    if (sseLineBuffer.value.trim()) {
      feedSseText(sseLineBuffer, '\n', handleSseEvent)
    }
    if (settled) return
    chunkBatcher?.flushNow()
    if (xhr.status >= 200 && xhr.status < 300) {
      if (!fullContent.trim()) {
        fail(new Error('生成内容为空，请检查 backend/.env 中的 AI 密钥或设置页配置'))
        return
      }
      succeed()
    } else {
      try {
        const errorData = JSON.parse(xhr.responseText)
        fail(new Error(errorData.message || `请求失败: ${xhr.status}`))
      } catch {
        fail(new Error(`请求失败: ${xhr.status}`))
      }
    }
  }

  xhr.onerror = () => {
    fail(new Error('网络错误，请检查后端是否已启动（npm run dev）及 Vite 代理配置'))
  }

  xhr.ontimeout = () => {
    fail(new Error('AI 生成超时，请稍后重试'))
  }

  xhr.send(JSON.stringify(body))
  return xhr
}

/**
 * 发起一次 SSE 流式请求（自动获取 CSRF Token 并封装为 Promise）
 */
const streamRequest = (
  path: string,
  body: Record<string, unknown>,
  onChunk?: (chunk: string) => void,
  onPhase?: (phase: AiStreamPhase) => void,
  onDone?: (data: { plot: string }) => void
): Promise<{ content: string; plot: string }> => {
  return new Promise((resolve, reject) => {
    getCsrfToken()
      .then((csrfToken) => {
        createSSERequest(buildApiUrl(path), body, onChunk, onPhase, onDone, resolve, reject, csrfToken ?? undefined)
      })
      .catch(() => {
        reject(new Error('获取CSRF Token失败'))
      })
  })
}

/**
 * 仅返回文本内容的流式请求（润色/设定/大纲/创意等场景）
 */
const streamTextRequest = (
  path: string,
  body: Record<string, unknown>,
  onChunk?: (chunk: string) => void,
  onPhase?: (phase: AiStreamPhase) => void,
  onDone?: () => void
): Promise<string> => {
  return streamRequest(path, body, onChunk, onPhase, () => onDone?.()).then((result) => result.content)
}

export const aiService = {
  generateChapter: async (
    prompt: string,
    chapterTitle?: string,
    onChunk?: (chunk: string) => void,
    onPhase?: (phase: AiStreamPhase) => void,
    onDone?: (plot: string) => void,
    aiConfig?: AIRequestConfig,
    novelContext?: NovelContext,
    generationParams?: {
      genre?: string
      style?: string
      corePlot?: string
      characters?: string
      wordCount?: string
      other?: string
    }
  ): Promise<{ content: string; plot: string }> => {
    return streamRequest(
      '/ai/generate',
      withResolvedAiConfig({
        prompt,
        chapterTitle,
        novelId: novelContext?.novelId,
        novelMeta: novelContext?.novelMeta,
        chapters: novelContext?.chapters,
        currentChapterId: novelContext?.currentChapterId,
        genre: generationParams?.genre,
        style: generationParams?.style,
        corePlot: generationParams?.corePlot,
        characters: generationParams?.characters,
        wordCount: generationParams?.wordCount,
        other: generationParams?.other
      }, aiConfig),
      onChunk,
      onPhase,
      (data) => onDone?.(data.plot)
    )
  },

  continueChapter: async (
    lastContent: string,
    lastPlot: string,
    prompt?: string,
    onChunk?: (chunk: string) => void,
    onPhase?: (phase: AiStreamPhase) => void,
    onDone?: (plot: string) => void,
    aiConfig?: AIRequestConfig,
    novelContext?: NovelContext,
    wordCount?: string
  ): Promise<{ content: string; plot: string }> => {
    return streamRequest(
      '/ai/continue',
      withResolvedAiConfig({
        lastContent,
        lastPlot,
        prompt,
        novelId: novelContext?.novelId,
        chapterId: novelContext?.currentChapterId,
        novelMeta: novelContext?.novelMeta,
        chapters: novelContext?.chapters,
        currentChapterId: novelContext?.currentChapterId,
        wordCount
      }, aiConfig),
      onChunk,
      onPhase,
      (data) => onDone?.(data.plot)
    )
  },

  polishContent: async (
    content: string,
    prompt?: string,
    onChunk?: (chunk: string) => void,
    onPhase?: (phase: AiStreamPhase) => void,
    onDone?: () => void,
    aiConfig?: AIRequestConfig,
    novelContext?: NovelContext,
    historyMeta?: {
      beforeContent?: string
      beforePlot?: string
      chapterTitle?: string
    }
  ): Promise<string> => {
    return streamTextRequest(
      '/ai/polish',
      withResolvedAiConfig({
        content,
        prompt,
        novelId: novelContext?.novelId,
        chapterId: novelContext?.currentChapterId,
        beforeContent: historyMeta?.beforeContent,
        beforePlot: historyMeta?.beforePlot,
        chapterTitle: historyMeta?.chapterTitle,
        novelMeta: novelContext?.novelMeta,
        chapters: novelContext?.chapters,
        currentChapterId: novelContext?.currentChapterId
      }, aiConfig),
      onChunk,
      onPhase,
      onDone
    )
  },

  generateSetting: async (
    type: 'character' | 'world' | 'item',
    prompt: string,
    onChunk?: (chunk: string) => void,
    onPhase?: (phase: AiStreamPhase) => void,
    onDone?: () => void,
    aiConfig?: AIRequestConfig
  ): Promise<string> => {
    return streamTextRequest(
      '/ai/setting',
      withResolvedAiConfig({ type, prompt }, aiConfig),
      onChunk,
      onPhase,
      onDone
    )
  },

  generateOutline: async (
    novelType: string,
    corePlot: string,
    length: string,
    onChunk?: (chunk: string) => void,
    onPhase?: (phase: AiStreamPhase) => void,
    onDone?: () => void,
    aiConfig?: AIRequestConfig
  ): Promise<string> => {
    return streamTextRequest(
      '/ai/outline',
      withResolvedAiConfig({ novelType, corePlot, length }, aiConfig),
      onChunk,
      onPhase,
      onDone
    )
  },

  generateCreative: async (
    prompt: string,
    type: string,
    onChunk?: (chunk: string) => void,
    onPhase?: (phase: AiStreamPhase) => void,
    onDone?: () => void,
    aiConfig?: AIRequestConfig
  ): Promise<string> => {
    return streamTextRequest(
      '/ai/creative',
      withResolvedAiConfig({ prompt, type }, aiConfig),
      onChunk,
      onPhase,
      onDone
    )
  }
}
