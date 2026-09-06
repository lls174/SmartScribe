import api, { buildApiUrl, getCsrfToken } from './api'
import { createRafChunkBatcher, feedSseText } from '@/utils/sseClient'
import type { AppSseEvent } from '@/utils/sseClient'
import type { AiStreamPhase } from '@app-types/index'
import type {
  ChapterReview,
  CharacterProposal,
  InspirationProposal,
  PlotReview,
  ReviewIssue
} from '@/types/collaboration'

import { DEFAULT_AI_MODEL, DEFAULT_AI_PLATFORM, readStoredAiConfig } from '@/data/aiModelCatalog'

interface AIRequestConfig {
  platform?: string
  model?: string
  enableDeepThinking?: boolean
}

interface StreamResult {
  content: string
  plot: string
  result?: unknown
}

const activeRequests = new Map<string, XMLHttpRequest>()

/** 将后端结构化降级结果转换为可读错误，同时保留服务端给出的原因。 */
const assertStructuredResult = (data: unknown): void => {
  if (!data || typeof data !== 'object' || !('degraded' in data) || !(data as { degraded?: boolean }).degraded) return
  const error = (data as { error?: string }).error
  throw new Error(error || 'AI 返回格式不稳定，请重试或改为手动填写')
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
  onResult: ((data: unknown) => void) | undefined,
  resolve: (value: StreamResult) => void,
  reject: (error: Error) => void,
  csrfToken?: string,
  requestKey?: string
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
  let structuredResult: unknown
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
    if (requestKey) activeRequests.delete(requestKey)
    reject(error)
  }

  const succeed = (): void => {
    if (settled) return
    settled = true
    if (requestKey) activeRequests.delete(requestKey)
    resolve({ content: fullContent, plot, result: structuredResult })
  }

  /** 同时兼容旧正文事件和 V2.3 的结构化 result 事件。 */
  const handleSseEvent = (data: AppSseEvent) => {
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
    if (data.type === 'result') {
      structuredResult = data.data
      onResult?.(data.data)
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
      if (!fullContent.trim() && structuredResult === undefined) {
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

  xhr.onabort = () => {
    if (settled) return
    settled = true
    if (requestKey) activeRequests.delete(requestKey)
    reject(new Error('请求已取消'))
  }

  xhr.ontimeout = () => {
    fail(new Error('AI 生成超时，请稍后重试'))
  }

  xhr.send(JSON.stringify(body))
  if (requestKey) {
    activeRequests.get(requestKey)?.abort()
    activeRequests.set(requestKey, xhr)
  }
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
  onDone?: (data: { plot: string }) => void,
  onResult?: (data: unknown) => void,
  requestKey?: string
): Promise<StreamResult> => {
  return new Promise((resolve, reject) => {
    getCsrfToken()
      .then((csrfToken) => {
        createSSERequest(buildApiUrl(path), body, onChunk, onPhase, onDone, onResult, resolve, reject, csrfToken ?? undefined, requestKey)
      })
      .catch(() => {
        reject(new Error('获取CSRF Token失败'))
      })
  })
}

/**
 * 请求结构化智能体结果。最终以 result 事件为准，解析失败时保留 rawContent 供人工处理。
 */
const streamStructuredRequest = async <T>(
  path: string,
  body: Record<string, unknown>,
  onChunk?: (chunk: string) => void,
  requestKey?: string
): Promise<{ data: T; rawContent: string }> => {
  const response = await streamRequest(path, body, onChunk, undefined, undefined, undefined, requestKey)
  if (response.result !== undefined) {
    return { data: response.result as T, rawContent: response.content }
  }

  try {
    return { data: JSON.parse(response.content) as T, rawContent: response.content }
  } catch {
    throw new Error('AI 返回的结构化内容无法解析，原始内容已保留，请重试')
  }
}

/**
 * 仅返回文本内容的流式请求（润色/设定/大纲/创意等场景）
 */
const streamTextRequest = (
  path: string,
  body: Record<string, unknown>,
  onChunk?: (chunk: string) => void,
  onPhase?: (phase: AiStreamPhase) => void,
  onDone?: () => void,
  requestKey?: string
): Promise<string> => {
  return streamRequest(path, body, onChunk, onPhase, () => onDone?.(), undefined, requestKey).then((result) => result.content)
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
      (data) => onDone?.(data.plot),
      undefined,
      `write-${novelContext?.novelId || 'standalone'}`
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
      (data) => onDone?.(data.plot),
      undefined,
      `write-${novelContext?.novelId || 'standalone'}`
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
      onDone,
      `write-${novelContext?.novelId || 'standalone'}`
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
  },

  /** 取消指定业务键对应的流式请求，避免旧响应覆盖新页面状态。 */
  cancelRequest: (requestKey: string): void => {
    activeRequests.get(requestKey)?.abort()
    activeRequests.delete(requestKey)
  },

  proposeInspiration: async (
    novelId: number,
    input: { keywords?: string; length?: string },
    onChunk?: (chunk: string) => void
  ): Promise<InspirationProposal[]> => {
    const response = await streamStructuredRequest<{
      options?: Array<{
        title: string
        genre: string
        premise: string
        coreConflict: string
        sellingPoints?: string[]
        reasoning?: string
      }>
    } | InspirationProposal[]>(
      '/ai/propose/inspiration',
      withResolvedAiConfig({ novelId, userHint: [input.keywords, input.length].filter(Boolean).join('；') }),
      onChunk,
      `inspiration-${novelId}`
    )
    assertStructuredResult(response.data)
    if (Array.isArray(response.data)) return response.data
    return (response.data.options || []).map((option) => ({
      titleSuggestion: option.title,
      genre: option.genre,
      style: option.sellingPoints?.join('、') || '待确认',
      logline: option.premise,
      coreConflict: option.coreConflict,
      reasoning: option.reasoning
    }))
  },

  proposeSetting: async (
    novelId: number,
    field: string,
    currentValue = ''
  ): Promise<string> => {
    const response = await streamStructuredRequest<{ content?: string; value?: string } | string>(
      '/ai/propose/setting',
      withResolvedAiConfig({ novelId, field, userHint: currentValue ? `请在现有草稿基础上优化：${currentValue}` : '' }),
      undefined,
      `setting-${novelId}-${field}`
    )
    assertStructuredResult(response.data)
    if (typeof response.data === 'string') return response.data
    return response.data.value || response.data.content || response.rawContent
  },

  proposeAllSettings: async (novelId: number, hint = ''): Promise<Record<string, string>> => {
    const response = await streamStructuredRequest<{ settings?: Record<string, string> }>(
      '/ai/propose/setting/all',
      withResolvedAiConfig({ novelId, userHint: hint }),
      undefined,
      `setting-all-${novelId}`
    )
    assertStructuredResult(response.data)
    return response.data.settings || {}
  },

  proposeCharacters: async (novelId: number, hint = ''): Promise<CharacterProposal[]> => {
    const response = await streamStructuredRequest<{ characters?: CharacterProposal[] } | CharacterProposal[]>(
      '/ai/propose/characters',
      withResolvedAiConfig({ novelId, userHint: hint }),
      undefined,
      `characters-${novelId}`
    )
    assertStructuredResult(response.data)
    return Array.isArray(response.data) ? response.data : response.data.characters || []
  },

  proposeCharacterField: async (
    novelId: number,
    field: string,
    characterDraft: Record<string, unknown>
  ): Promise<string> => {
    const response = await streamStructuredRequest<{ content?: string }>(
      '/ai/propose/character-field',
      withResolvedAiConfig({ novelId, field, userHint: JSON.stringify(characterDraft) }),
      undefined,
      `character-field-${novelId}-${field}`
    )
    assertStructuredResult(response.data)
    return response.data.content || response.rawContent
  },

  proposeOutline: async (novelId: number, hint = ''): Promise<string> => {
    const response = await streamStructuredRequest<{ outline?: string; overallOutline?: string } | string>(
      '/ai/propose/outline',
      withResolvedAiConfig({ novelId, userHint: hint }),
      undefined,
      `outline-${novelId}`
    )
    assertStructuredResult(response.data)
    if (typeof response.data === 'string') return response.data
    return response.data.overallOutline || response.data.outline || response.rawContent
  },

  /** 审查结果较短，使用普通 JSON 请求，失败不会影响章节保存。 */
  reviewChapter: async (novelId: number, chapterId: number | undefined, content: string): Promise<ChapterReview> => {
    const response = await api.post('/ai/review/chapter', withResolvedAiConfig({ novelId, chapterId, draft: content }))
    const data = response.data.data || response.data
    if (data.available === false) {
      throw new Error(data.message || '审查暂不可用')
    }
    return data as ChapterReview
  },

  reviseByReview: async (
    novelId: number,
    chapterId: number | undefined,
    content: string,
    selectedIssues: ReviewIssue[],
    onChunk?: (chunk: string) => void
  ): Promise<string> => {
    return streamTextRequest(
      '/ai/write/revise',
      withResolvedAiConfig({ novelId, chapterId, draft: content, selectedIssues }),
      onChunk
    )
  },

  summarizeChapter: async (
    novelId: number,
    chapterId: number,
    content: string,
    outline?: string
  ): Promise<string> => {
    const response = await api.post('/ai/write/summarize', withResolvedAiConfig({ novelId, chapterId, draft: content, outline }))
    const data = response.data.data || response.data
    return typeof data === 'string' ? data : data.plot || data.summary || ''
  },

  /** 对照正文检查章节概括是否漏写、写错或过期。 */
  reviewChapterSummary: async (
    novelId: number,
    chapterId: number,
    content: string,
    plot: string
  ): Promise<PlotReview> => {
    const response = await api.post('/ai/write/review-summary', withResolvedAiConfig({
      novelId,
      chapterId,
      draft: content,
      plot
    }))
    return response.data
  }
}
