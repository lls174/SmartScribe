import axios, { AxiosError, type AxiosResponse } from 'axios'
import util from 'util'
import { Readable } from 'stream'
import type { AiContentResult, AiPlatform, AiStreamPhase, AiUsage, SettingType } from '../../../shared/types'
import { DEFAULT_AI_MODEL, DEFAULT_AI_PLATFORM } from '../constants/aiDefaults'
import { estimateTokens } from '../utils/tokenEstimate'
import { consumeSseBuffer, extractStreamContent, extractStreamReasoning, type OpenAiStreamChunk } from '../utils/sseParser'

export interface AiOptions {
  apiKey?: string
  customBaseURL?: string
  enableDeepThinking?: boolean
}

export interface AiStreamCallbacks {
  onChunk?: (chunk: string) => void
  onPhase?: (phase: AiStreamPhase) => void
}

type LegacyChunkCallback = ((chunk: string) => void) | null | undefined

interface PlatformConfig {
  baseURL?: string
  apiKey: string
}

interface OpenAIUsage {
  prompt_tokens?: number
  promptTokens?: number
  completion_tokens?: number
  completionTokens?: number
  total_tokens?: number
  totalTokens?: number
}

type ChatRequestBody = Record<string, unknown> & {
  model: string
  messages: Array<{ role: 'user'; content: string }>
  max_tokens: number
  temperature: number
  stream?: boolean
}

const normalizeStreamCallbacks = (input?: LegacyChunkCallback | AiStreamCallbacks): AiStreamCallbacks => {
  if (!input) return {}
  if (typeof input === 'function') return { onChunk: input }
  return input
}

const normalizePlatformKey = (platform: string): AiPlatform | null => {
  const platformMap: Record<string, AiPlatform> = {
    aliyun: 'aliyun',
    glm: 'zhipu',
    zhipu: 'zhipu',
    deepseek: 'deepseek',
    openai: 'openai',
    custom: 'custom'
  }
  return platformMap[platform.toLowerCase()] ?? null
}

/** 按用户选择控制各平台「深度思考」开关，默认关闭以优先低延迟 */
const buildThinkingRequestBody = (platform: string, enableDeepThinking: boolean): Record<string, unknown> => {
  const normalizedPlatform = normalizePlatformKey(platform)
  if (normalizedPlatform === 'zhipu' || normalizedPlatform === 'deepseek') {
    // DeepSeek V4 默认开启 thinking，未显式 disabled 时正文会进入 reasoning_content 导致流式结果为空
    return { thinking: { type: enableDeepThinking ? 'enabled' : 'disabled' } }
  }
  if (normalizedPlatform === 'aliyun') {
    return { enable_thinking: enableDeepThinking }
  }
  return {}
}

interface ChatCompletionMessage {
  content?: string
  reasoning_content?: string
}

interface ChatCompletionResponse {
  usage?: OpenAIUsage
  choices?: Array<{
    message?: ChatCompletionMessage
  }>
}

const PLATFORM_BASE_URLS: Record<Exclude<AiPlatform, 'custom'>, string> = {
  aliyun: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  // 智谱官方 OpenAI 兼容端点（文档推荐 open.bigmodel.cn）
  zhipu: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  deepseek: 'https://api.deepseek.com/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions'
}

const getPlatformEnvKeys = (): Record<Exclude<AiPlatform, 'custom'>, string | undefined> => ({
  aliyun: normalizeApiKey(process.env.DASHSCOPE_API_KEY),
  zhipu: normalizeApiKey(process.env.GLM_AI_KEY),
  deepseek: normalizeApiKey(process.env.DEEPSEEK_API_KEY),
  openai: normalizeApiKey(process.env.OPENAI_API_KEY)
})

const getErrorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error)

const normalizeApiKey = (apiKey: string | undefined): string => {
  if (!apiKey) return ''
  return apiKey.trim().replace(/^Bearer\s+/i, '')
}

const readStreamToString = (stream: Readable): Promise<string> => new Promise((resolve, reject) => {
  const chunks: Buffer[] = []
  stream.on('data', (chunk: Buffer | string) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  })
  stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
  stream.on('error', reject)
})

class AIService {
  getPlatformConfig(platform: string, aiOptions: AiOptions = {}): PlatformConfig {
    const platformMap: Record<string, AiPlatform> = {
      aliyun: 'aliyun',
      glm: 'zhipu',
      zhipu: 'zhipu',
      deepseek: 'deepseek',
      openai: 'openai',
      custom: 'custom'
    }

    const normalizedPlatform = platformMap[platform.toLowerCase()]

    if (!normalizedPlatform) {
      throw new Error('不支持的AI平台')
    }

    if (normalizedPlatform === 'custom') {
      if (!aiOptions.customBaseURL) {
        throw new Error('自定义平台必须提供API地址')
      }
      return { baseURL: aiOptions.customBaseURL, apiKey: aiOptions.apiKey || '' }
    }

    const defaultBaseURL = PLATFORM_BASE_URLS[normalizedPlatform]
    const defaultApiKey = getPlatformEnvKeys()[normalizedPlatform]

    return {
      baseURL: aiOptions.customBaseURL || defaultBaseURL,
      apiKey: normalizeApiKey(aiOptions.apiKey) || defaultApiKey || ''
    }
  }

  async generateContent(
    prompt: string,
    platform: string = DEFAULT_AI_PLATFORM,
    model: string = DEFAULT_AI_MODEL,
    streamCallbacks?: LegacyChunkCallback | AiStreamCallbacks,
    aiOptions: AiOptions = {}
  ): Promise<AiContentResult> {
    try {
      const { baseURL, apiKey } = this.getPlatformConfig(platform, aiOptions)

      if (!apiKey) {
        throw new Error('API密钥未配置，请在 AI 设置页面填写密钥，或设置对应服务商的环境变量')
      }

      if (!baseURL) {
        throw new Error('API地址未配置')
      }

      return this.callOpenAICompatibleAPI(
        baseURL,
        apiKey,
        prompt,
        platform,
        model,
        normalizeStreamCallbacks(streamCallbacks),
        aiOptions
      )
    } catch (error) {
      console.error('生成内容失败:', error)
      throw error
    }
  }

  estimateTokens(text: unknown): number {
    return estimateTokens(text, 4)
  }

  normalizeUsage(usage: OpenAIUsage | null | undefined, prompt: string, content: string): AiUsage {
    if (usage) {
      const promptTokens = Number(usage.prompt_tokens ?? usage.promptTokens) || 0
      const completionTokens = Number(usage.completion_tokens ?? usage.completionTokens) || 0
      const totalTokens = Number(usage.total_tokens ?? usage.totalTokens) || (promptTokens + completionTokens)
      return { promptTokens, completionTokens, totalTokens, isEstimated: false }
    }

    const promptTokens = this.estimateTokens(prompt)
    const completionTokens = this.estimateTokens(content)
    return { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens, isEstimated: true }
  }

  createResult(prompt: string, content: string, usage?: OpenAIUsage | null): AiContentResult {
    return { content, usage: this.normalizeUsage(usage, prompt, content) }
  }

  async callOpenAICompatibleAPI(
    baseURL: string,
    apiKey: string,
    prompt: string,
    platform: string = DEFAULT_AI_PLATFORM,
    model = DEFAULT_AI_MODEL,
    callbacks: AiStreamCallbacks = {},
    aiOptions: AiOptions = {}
  ): Promise<AiContentResult> {
    try {
      const enableDeepThinking = aiOptions.enableDeepThinking === true
      const requestData: ChatRequestBody = {
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4095,
        temperature: 0.7,
        ...buildThinkingRequestBody(platform, enableDeepThinking)
      }

      const shouldStream = !!(callbacks.onChunk || callbacks.onPhase)
      if (shouldStream) {
        requestData.stream = true
      }

      const response = await axios.post<ChatCompletionResponse | Readable>(baseURL, requestData, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        responseType: shouldStream ? 'stream' : 'json',
        timeout: 120000,
        validateStatus: () => true
      })

      if (response.status < 200 || response.status >= 300) {
        const detail = await this.extractHttpErrorMessage(response)
        throw new Error(`AI API错误(${response.status}): ${this.buildApiErrorHint(response.status, detail, platform)}`)
      }

      if (shouldStream) {
        return new Promise((resolve, reject) => {
          let fullContent = ''
          const lineBuffer = { value: '' }
          let usage: OpenAIUsage | null = null
          let hasEmittedThinking = false
          let hasEmittedGenerating = false
          const stream = response.data as Readable

          const emitPhase = (phase: AiStreamPhase): void => {
            callbacks.onPhase?.(phase)
          }

          const handlePayload = (payload: OpenAiStreamChunk): void => {
            if (payload.usage) {
              usage = payload.usage as OpenAIUsage
            }

            if (enableDeepThinking) {
              const reasoningChunk = extractStreamReasoning(payload)
              if (reasoningChunk && !hasEmittedThinking) {
                emitPhase('thinking')
                hasEmittedThinking = true
              }
            }

            const contentChunk = extractStreamContent(payload)
            if (contentChunk) {
              if (!hasEmittedGenerating) {
                emitPhase('generating')
                hasEmittedGenerating = true
              }
              fullContent += contentChunk
              callbacks.onChunk?.(contentChunk)
            }
          }

          stream.on('data', (chunk: Buffer) => {
            try {
              consumeSseBuffer(lineBuffer, chunk.toString(), handlePayload)
            } catch (error) {
              console.error('处理流式数据失败:', error)
            }
          })

          stream.on('end', () => {
            if (lineBuffer.value.trim()) {
              consumeSseBuffer(lineBuffer, '\n', handlePayload)
            }
            if (!fullContent) {
              reject(new Error('生成内容为空'))
            } else {
              resolve(this.createResult(prompt, fullContent, usage))
            }
          })

          stream.on('error', (error: Error) => {
            console.error('流式响应错误:', error)
            reject(error)
          })
        })
      }

      const data = response.data as ChatCompletionResponse
      const message = data.choices?.[0]?.message
      const content = message?.content?.trim()
      if (!content) {
        const reasoning = message?.reasoning_content?.trim()
        if (enableDeepThinking && reasoning) {
          return this.createResult(prompt, reasoning, data.usage)
        }
        throw new Error('生成内容为空')
      }
      return this.createResult(prompt, content, data.usage)
    } catch (error) {
      console.error('调用AI API失败:', getErrorMessage(error))
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(`AI API错误(${error.response.status}): ${this.formatAxiosError(error)}`)
      }
      throw error
    }
  }

  private async extractHttpErrorMessage(response: AxiosResponse): Promise<string> {
    const raw = response.data
    if (typeof raw === 'string') {
      return this.parseApiErrorText(raw)
    }
    if (Buffer.isBuffer(raw)) {
      return this.parseApiErrorText(raw.toString('utf-8'))
    }
    if (raw instanceof Readable) {
      return this.parseApiErrorText(await readStreamToString(raw))
    }
    if (raw && typeof raw === 'object') {
      const candidate = raw as { error?: { message?: string }; message?: string }
      return candidate.error?.message || candidate.message || JSON.stringify(raw).slice(0, 500)
    }
    return `HTTP ${response.status}`
  }

  private parseApiErrorText(text: string): string {
    const trimmed = text.trim()
    if (!trimmed) return '空响应体'
    try {
      const parsed = JSON.parse(trimmed) as { error?: { message?: string }; message?: string }
      return parsed.error?.message || parsed.message || trimmed.slice(0, 500)
    } catch {
      return trimmed.slice(0, 500)
    }
  }

  private buildApiErrorHint(status: number, detail: string, platform: string): string {
    if (status === 401) {
      const envHint = platform === 'deepseek'
        ? 'DEEPSEEK_API_KEY'
        : platform === 'zhipu'
          ? 'GLM_AI_KEY'
          : platform === 'aliyun'
            ? 'DASHSCOPE_API_KEY'
            : platform === 'openai'
              ? 'OPENAI_API_KEY'
              : '对应环境变量'
      return `${detail}。请检查 backend/.env 中的 ${envHint} 是否正确，或在设置页重新保存 ${platform} 密钥（已保存的个人密钥会覆盖环境变量）`
    }
    return detail
  }

  private formatAxiosError(error: AxiosError): string {
    const raw = error.response?.data
    let responseData = ''

    if (!raw) {
      responseData = '[空响应体]'
    } else if (typeof raw === 'string') {
      responseData = raw.substring(0, 500)
    } else if (Buffer.isBuffer(raw)) {
      responseData = raw.toString('utf-8').substring(0, 500)
    } else if (raw instanceof Readable) {
      responseData = '[流式响应对象, 无法直接读取]'
    } else if (typeof raw === 'object') {
      try {
        const str = JSON.stringify(raw)
        responseData = (str === '{}' || str === 'undefined')
          ? util.inspect(raw, { depth: 2, maxArrayLength: 5 }).substring(0, 500)
          : str.substring(0, 500)
      } catch {
        responseData = util.inspect(raw, { depth: 1 }).substring(0, 500)
      }
    }

    if (raw && typeof raw === 'object' && !(raw instanceof Readable)) {
      const candidate = raw as { error?: { message?: string }; message?: string }
      return candidate.error?.message || candidate.message || responseData
    }

    if (responseData && responseData !== '[空响应体]' && responseData !== '[流式响应对象, 无法直接读取]') {
      return responseData
    }

    const configData = typeof error.config?.data === 'string'
      ? (JSON.parse(error.config.data) as { model?: string })
      : undefined
    return `请求参数: model=${configData?.model || '?'}`
  }

  optimizePrompt(prompt: string): string {
    return `请根据以下要求生成高质量的小说章节：\n\n${prompt}\n\n要求：\n1. 情节紧凑，引人入胜\n2. 人物刻画生动，有鲜明的性格特点\n3. 场景描写细腻，有画面感\n4. 语言流畅，符合所选题材和风格\n5. 避免俗套情节，力求创新\n6. 章节长度适中，内容充实`
  }

  async generateChapter(prompt: string, chapterTitle?: string, platform = DEFAULT_AI_PLATFORM, model = DEFAULT_AI_MODEL, streamCallbacks?: LegacyChunkCallback | AiStreamCallbacks, aiOptions: AiOptions = {}): Promise<{ content: string; plot: string }> {
    const optimizedPrompt = this.optimizePrompt(prompt)
    const fullPrompt = chapterTitle
      ? `请为小说生成一个章节，标题为"${chapterTitle}"。${optimizedPrompt}`
      : `请为小说生成一个章节。${optimizedPrompt}`
    const chapterContent = await this.generateContent(fullPrompt, platform, model, streamCallbacks, aiOptions)
    const plotPrompt = `请为以下章节内容生成一个简洁的剧情大概（100-200字），用于后续续写：\n${chapterContent.content}`
    const plot = await this.generateContent(plotPrompt, platform, model, null, aiOptions)
    return { content: chapterContent.content, plot: plot.content }
  }

  async continueChapter(lastContent: string, lastPlot?: string, prompt?: string, platform = DEFAULT_AI_PLATFORM, model = DEFAULT_AI_MODEL, streamCallbacks?: LegacyChunkCallback | AiStreamCallbacks, aiOptions: AiOptions = {}): Promise<{ content: string; plot: string }> {
    if (!lastContent || !lastContent.trim()) {
      throw new Error('上次内容不能为空')
    }
    const fullPrompt = prompt
      ? `请根据以下内容${lastPlot ? '和剧情大概' : ''}进行续写：\n\n【原有内容】\n${lastContent}${lastPlot ? `\n\n【剧情大概】\n${lastPlot}` : ''}\n\n【续写要求】\n${prompt}`
      : `请根据以下内容${lastPlot ? '和剧情大概' : ''}进行续写：\n\n【原有内容】\n${lastContent}${lastPlot ? `\n\n【剧情大概】\n${lastPlot}` : ''}`
    const continuedContent = await this.generateContent(fullPrompt, platform, model, streamCallbacks, aiOptions)
    const newPlotPrompt = `请为以下续写内容生成一个简洁的剧情大概（100-200字），用于后续续写：\n${continuedContent.content}`
    const newPlot = await this.generateContent(newPlotPrompt, platform, model, null, aiOptions)
    return { content: continuedContent.content, plot: newPlot.content }
  }

  async polishContent(content: string, prompt?: string, platform = DEFAULT_AI_PLATFORM, model = DEFAULT_AI_MODEL, streamCallbacks?: LegacyChunkCallback | AiStreamCallbacks, aiOptions: AiOptions = {}): Promise<AiContentResult> {
    const fullPrompt = prompt
      ? `请润色以下内容：\n${content}\n\n要求：${prompt}`
      : `请润色以下内容，使其更加流畅、生动：\n${content}`
    return this.generateContent(fullPrompt, platform, model, streamCallbacks, aiOptions)
  }

  async generateSetting(type: SettingType, prompt: string, platform = DEFAULT_AI_PLATFORM, model = DEFAULT_AI_MODEL, streamCallbacks?: LegacyChunkCallback | AiStreamCallbacks, aiOptions: AiOptions = {}): Promise<AiContentResult> {
    const typeText = type === 'character' ? '人物设定' : type === 'world' ? '世界观设定' : '道具设定'
    return this.generateContent(`请生成一个${typeText}。${prompt}`, platform, model, streamCallbacks, aiOptions)
  }

  async generateOutline(novelType: string, corePlot: string, length: string, platform = DEFAULT_AI_PLATFORM, model = DEFAULT_AI_MODEL, streamCallbacks?: LegacyChunkCallback | AiStreamCallbacks, aiOptions: AiOptions = {}): Promise<AiContentResult> {
    return this.generateContent(`请为${novelType}小说生成一个大纲，核心剧情是：${corePlot}。要求${length}。`, platform, model, streamCallbacks, aiOptions)
  }

  async generateCreative(prompt: string, _type: string, platform = DEFAULT_AI_PLATFORM, model = DEFAULT_AI_MODEL, streamCallbacks?: LegacyChunkCallback | AiStreamCallbacks, aiOptions: AiOptions = {}): Promise<AiContentResult> {
    return this.generateContent(prompt, platform, model, streamCallbacks, aiOptions)
  }
}

export default new AIService()
