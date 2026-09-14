import axios from 'axios'
import type { AiPlatform, AiTokenSource } from '../../../shared/types'
import { toTokenInt } from '../utils/intTokens'

export interface TokenCountResult {
  tokens: number
  source: AiTokenSource
}

const HEURISTIC_CHARS_PER_TOKEN = 1.6

interface TiktokenEncoder {
  encode: (text: string) => number[]
}

interface TiktokenModule {
  getEncoding: (name: string) => TiktokenEncoder
  encodingForModel: (model: string) => TiktokenEncoder
}

let tiktokenModule: TiktokenModule | null = null
const encodingCache = new Map<string, TiktokenEncoder>()

/** js-tiktoken 是 ESM，运行时动态加载以免 CJS require 失败。 */
const loadTiktoken = async (): Promise<TiktokenModule> => {
  if (!tiktokenModule) {
    tiktokenModule = await import('js-tiktoken') as unknown as TiktokenModule
  }
  return tiktokenModule
}

const normalizePlatform = (platform: string): AiPlatform | 'custom' => {
  const key = platform.toLowerCase()
  if (key === 'glm') return 'zhipu'
  if (key === 'aliyun' || key === 'zhipu' || key === 'deepseek' || key === 'openai' || key === 'custom') {
    return key
  }
  return 'custom'
}

/** 中英文混排的启发式计数，统一替代原先 1.5 / 4 两套比例。 */
const countHeuristic = (text: string): TokenCountResult => ({
  tokens: Math.ceil(text.length / HEURISTIC_CHARS_PER_TOKEN),
  source: 'heuristic'
})

const countTiktoken = async (model: string, text: string): Promise<TokenCountResult> => {
  const { getEncoding, encodingForModel } = await loadTiktoken()
  const cacheKey = model || 'cl100k_base'
  let encoder = encodingCache.get(cacheKey)
  if (!encoder) {
    try {
      encoder = encodingForModel(model as Parameters<typeof encodingForModel>[0])
    } catch {
      encoder = getEncoding('cl100k_base')
    }
    encodingCache.set(cacheKey, encoder)
  }
  return { tokens: encoder.encode(text).length, source: 'tokenizer' }
}

/** 百炼 tokenizer HTTP，只用于无官方 usage 的日志回退。 */
const countQwenHttp = async (model: string, text: string): Promise<TokenCountResult | null> => {
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim()
  if (!apiKey) return null
  try {
    const response = await axios.post(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/tokenizer',
      { model: model || 'qwen-plus', input: { texts: [text] } },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 4000,
        validateStatus: () => true
      }
    )
    if (response.status < 200 || response.status >= 300) return null
    const data = response.data as { usage?: { total_tokens?: number }; tokens?: number }
    const tokens = toTokenInt(data.usage?.total_tokens ?? data.tokens)
    if (tokens <= 0) return null
    return { tokens, source: 'tokenizer' }
  } catch {
    return null
  }
}

/**
 * 按平台回退计数。上下文裁剪只走同步路径（不会打 HTTP）。
 * 日志回退可对 Qwen 调用百炼 tokenizer。
 */
export const countTokens = (platform: string, model: string, text: string): TokenCountResult => {
  const content = typeof text === 'string' ? text : ''
  if (!content) return { tokens: 0, source: 'heuristic' }
  void platform
  void model
  return countHeuristic(content)
}

/** 日志回退：OpenAI/DeepSeek 用 tiktoken，Qwen 可打百炼 HTTP，其余启发式。 */
export const countTokensForLog = async (platform: string, model: string, text: string): Promise<TokenCountResult> => {
  const content = typeof text === 'string' ? text : ''
  if (!content) return { tokens: 0, source: 'heuristic' }
  const normalized = normalizePlatform(platform)
  if (normalized === 'openai' || normalized === 'deepseek') {
    try {
      return await countTiktoken(model, content)
    } catch {
      return countHeuristic(content)
    }
  }
  if (normalized === 'aliyun') {
    const remote = await countQwenHttp(model, content)
    if (remote) return remote
  }
  return countHeuristic(content)
}
