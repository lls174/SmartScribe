import type { AiModelCapability } from '../../../shared/types'
import { findSeedModel } from '../data/aiModelSeed'

const OPENAI_OTHER_EXACT = new Set([
  'text-embedding-3-small',
  'text-embedding-3-large',
  'text-embedding-ada-002',
  'whisper-1',
  'tts-1',
  'tts-1-hd',
  'dall-e-2',
  'dall-e-3'
])

const OPENAI_OTHER_PREFIXES = ['text-embedding-', 'whisper-', 'tts-', 'dall-e-']

export interface CapabilityDecision {
  capability: AiModelCapability
  source: 'seed' | 'adapter'
}

/** 分平台判定能力，默认 unknown，禁止跨平台 id 子串猜测。 */
export const decideCapability = (platform: string, modelId: string): CapabilityDecision => {
  if (findSeedModel(platform, modelId)) {
    return { capability: 'chat', source: 'seed' }
  }
  if (platform === 'openai') {
    if (OPENAI_OTHER_EXACT.has(modelId) || OPENAI_OTHER_PREFIXES.some((prefix) => modelId.startsWith(prefix))) {
      return { capability: 'other', source: 'adapter' }
    }
    return { capability: 'unknown', source: 'adapter' }
  }
  if (platform === 'deepseek') {
    return { capability: 'chat', source: 'adapter' }
  }
  return { capability: 'unknown', source: 'adapter' }
}
