export interface ModelOption {
  value: string
  label: string
  recommendation: number
  badge?: string
  bestFor: string
  description: string
}

export interface PlatformOption {
  label: string
  models: ModelOption[]
  defaultBaseURL: string
  envKeyHint: string
}

export const PLATFORM_META: Record<string, { icon: string; description: string }> = {
  aliyun: { icon: '☁️', description: '通义千问大模型平台' },
  zhipu: { icon: '🔮', description: 'GLM 系列大模型平台' },
  deepseek: { icon: '🚀', description: '长上下文推理与高性价比创作' },
  openai: { icon: '🤖', description: 'OpenAI GPT 系列旗舰模型' },
  custom: { icon: '⚙️', description: 'OpenAI 兼容的自定义接口' }
}

export const MODEL_CATALOG_UPDATED_AT = '2026-05-02'

export const DEFAULT_AI_PLATFORM = 'zhipu'
export const DEFAULT_AI_MODEL = 'glm-5-turbo'
export const LEGACY_DEFAULT_AI_PLATFORM = 'aliyun'
export const AI_CONFIG_STORAGE_VERSION = '2'
export const AI_ENABLE_DEEP_THINKING_KEY = 'aiEnableDeepThinking'

const LEGACY_DEFAULT_MODEL_PREFIXES = ['qwen']

export const readStoredAiConfig = (): { platform: string; model: string; enableDeepThinking: boolean } => {
  const version = localStorage.getItem('aiConfigVersion')
  let platform = localStorage.getItem('aiPlatform')
  let model = localStorage.getItem('aiModel')

  if (version !== AI_CONFIG_STORAGE_VERSION) {
    const isLegacyDefault =
      (!platform || platform === LEGACY_DEFAULT_AI_PLATFORM) &&
      (!model || LEGACY_DEFAULT_MODEL_PREFIXES.some((prefix) => model?.startsWith(prefix)))

    if (isLegacyDefault) {
      platform = DEFAULT_AI_PLATFORM
      model = DEFAULT_AI_MODEL
      localStorage.setItem('aiPlatform', platform)
      localStorage.setItem('aiModel', model)
    }

    localStorage.setItem('aiConfigVersion', AI_CONFIG_STORAGE_VERSION)
  }

  return {
    platform: platform || DEFAULT_AI_PLATFORM,
    model: model || DEFAULT_AI_MODEL,
    enableDeepThinking: localStorage.getItem(AI_ENABLE_DEEP_THINKING_KEY) === 'true'
  }
}

export const PLATFORM_CONFIG: Record<string, PlatformOption> = {
  aliyun: {
    label: '阿里云百炼',
    models: [
      {
        value: 'qwen3.5-plus',
        label: 'Qwen3.5 Plus',
        recommendation: 95,
        badge: '推荐',
        bestFor: '长篇网文、人物一致性、设定注入',
        description: '纯文本效果接近 Max，速度和成本更适合持续创作。'
      },
      {
        value: 'qwen3-max',
        label: 'Qwen3 Max',
        recommendation: 92,
        badge: '高质量',
        bestFor: '复杂世界观、关键章节、剧情转折',
        description: '旗舰模型，适合高质量章节和复杂推理。'
      },
      {
        value: 'qwen3.5-flash',
        label: 'Qwen3.5 Flash',
        recommendation: 88,
        badge: '高性价比',
        bestFor: '日常续写、草稿、批量生成',
        description: '速度快、成本低，适合高频创作和草稿迭代。'
      },
      {
        value: 'qwen-plus',
        label: 'Qwen Plus（兼容）',
        recommendation: 78,
        bestFor: '旧配置兼容',
        description: '兼容旧版配置，新项目建议优先使用 Qwen3.5 Plus。'
      }
    ],
    defaultBaseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    envKeyHint: 'DASHSCOPE_API_KEY'
  },
  zhipu: {
    label: '智谱 AI / Z.ai',
    models: [
      {
        value: 'glm-5',
        label: 'GLM-5',
        recommendation: 93,
        badge: 'Agent 推荐',
        bestFor: '网文智能体、规划、复杂设定',
        description: '面向智能体工程和长链路任务，适合规划型创作。'
      },
      {
        value: 'glm-5-turbo',
        label: 'GLM-5 Turbo',
        recommendation: 90,
        badge: '推荐',
        bestFor: '日常章节生成、续写、设定扩写',
        description: '能力和成本更均衡，适合默认创作模型。'
      },
      {
        value: 'glm-4.5',
        label: 'GLM-4.5',
        recommendation: 84,
        bestFor: '工具调用、推理、老项目兼容',
        description: '强化 Agent、推理和代码能力，仍适合复杂任务。'
      },
      {
        value: 'glm-4-flash',
        label: 'GLM-4 Flash（兼容）',
        recommendation: 70,
        bestFor: '低成本测试',
        description: '旧版轻量模型，适合连通性测试和低成本草稿。'
      }
    ],
    defaultBaseURL: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    envKeyHint: 'GLM_AI_KEY'
  },
  deepseek: {
    label: 'DeepSeek',
    models: [
      {
        value: 'deepseek-v4-pro',
        label: 'DeepSeek V4 Pro',
        recommendation: 94,
        badge: '高质量',
        bestFor: '长上下文、复杂推理、关键章节',
        description: 'V4 Pro 适合高质量创作和复杂剧情推演。'
      },
      {
        value: 'deepseek-v4-flash',
        label: 'DeepSeek V4 Flash',
        recommendation: 91,
        badge: '推荐',
        bestFor: '日常创作、低延迟、成本敏感',
        description: 'V4 Flash 是 DeepSeek 当前推荐的通用高性价比模型。'
      },
      {
        value: 'deepseek-reasoner',
        label: 'DeepSeek Reasoner（兼容）',
        recommendation: 76,
        bestFor: '旧配置兼容、推理模式',
        description: '兼容旧模型名，官方提示未来会迁移到 V4 系列。'
      },
      {
        value: 'deepseek-chat',
        label: 'DeepSeek Chat（兼容）',
        recommendation: 72,
        bestFor: '旧配置兼容、普通对话',
        description: '兼容旧模型名，新配置建议使用 deepseek-v4-flash。'
      }
    ],
    defaultBaseURL: 'https://api.deepseek.com/v1/chat/completions',
    envKeyHint: 'DEEPSEEK_API_KEY'
  },
  openai: {
    label: 'OpenAI',
    models: [
      {
        value: 'gpt-5.5',
        label: 'GPT-5.5',
        recommendation: 98,
        badge: '旗舰',
        bestFor: '高质量长篇、复杂剧情、最终定稿',
        description: '旗舰模型，适合高质量创作和复杂推理。'
      },
      {
        value: 'gpt-5.4-mini',
        label: 'GPT-5.4 Mini',
        recommendation: 92,
        badge: '推荐',
        bestFor: '日常创作、续写、成本平衡',
        description: '能力、速度和成本均衡，适合作为默认创作模型。'
      },
      {
        value: 'gpt-5.4-nano',
        label: 'GPT-5.4 Nano',
        recommendation: 82,
        bestFor: '模板扩写、摘要、低成本草稿',
        description: '低成本高吞吐，适合批量草稿和轻量任务。'
      },
      {
        value: 'gpt-4.1-mini',
        label: 'GPT-4.1 Mini（兼容）',
        recommendation: 75,
        bestFor: '旧配置兼容、普通文本任务',
        description: '兼容旧项目配置，新创作建议使用 GPT-5.x 系列。'
      }
    ],
    defaultBaseURL: 'https://api.openai.com/v1/chat/completions',
    envKeyHint: 'OPENAI_API_KEY'
  },
  custom: {
    label: '自定义（OpenAI 兼容）',
    models: [],
    defaultBaseURL: '',
    envKeyHint: '自定义密钥'
  }
}

export const getRecommendedModel = (platform: string) => {
  const models = PLATFORM_CONFIG[platform]?.models || []
  return [...models].sort((a, b) => b.recommendation - a.recommendation)[0]
}
