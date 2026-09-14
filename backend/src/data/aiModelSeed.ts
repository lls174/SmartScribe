import type { AiCatalogModel } from '../../../shared/types'

interface SeedModel {
  platform: AiCatalogModel['platform']
  modelId: string
  label: string
  badge?: string
  description?: string
  recommended?: boolean
  sortOrder: number
}

/** 设置页历史种子，同步时作为 chat + enabled 的底稿。 */
export const SEED_CATALOG_MODELS: SeedModel[] = [
  { platform: 'aliyun', modelId: 'qwen3.5-plus', label: 'Qwen3.5 Plus', badge: '推荐', description: '纯文本效果接近 Max，速度和成本更适合持续创作。', recommended: true, sortOrder: 10 },
  { platform: 'aliyun', modelId: 'qwen3-max', label: 'Qwen3 Max', badge: '高质量', description: '旗舰模型，适合高质量章节和复杂推理。', sortOrder: 20 },
  { platform: 'aliyun', modelId: 'qwen3.5-flash', label: 'Qwen3.5 Flash', badge: '高性价比', description: '速度快、成本低，适合高频创作和草稿迭代。', sortOrder: 30 },
  { platform: 'aliyun', modelId: 'qwen-plus', label: 'Qwen Plus（兼容）', description: '兼容旧版配置，新项目建议优先使用 Qwen3.5 Plus。', sortOrder: 40 },
  { platform: 'zhipu', modelId: 'glm-5', label: 'GLM-5', badge: 'Agent 推荐', description: '面向智能体工程和长链路任务，适合规划型创作。', sortOrder: 10 },
  { platform: 'zhipu', modelId: 'glm-5-turbo', label: 'GLM-5 Turbo', badge: '推荐', description: '能力和成本更均衡，适合默认创作模型。', recommended: true, sortOrder: 20 },
  { platform: 'zhipu', modelId: 'glm-4.5', label: 'GLM-4.5', description: '强化 Agent、推理和代码能力，仍适合复杂任务。', sortOrder: 30 },
  { platform: 'zhipu', modelId: 'glm-4-flash', label: 'GLM-4 Flash（兼容）', description: '旧版轻量模型，适合连通性测试和低成本草稿。', sortOrder: 40 },
  { platform: 'deepseek', modelId: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', badge: '高质量', description: 'V4 Pro 适合高质量创作和复杂剧情推演。', sortOrder: 10 },
  { platform: 'deepseek', modelId: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', badge: '推荐', description: 'V4 Flash 是 DeepSeek 当前推荐的通用高性价比模型。', recommended: true, sortOrder: 20 },
  { platform: 'deepseek', modelId: 'deepseek-reasoner', label: 'DeepSeek Reasoner（兼容）', description: '兼容旧模型名，官方提示未来会迁移到 V4 系列。', sortOrder: 30 },
  { platform: 'deepseek', modelId: 'deepseek-chat', label: 'DeepSeek Chat（兼容）', description: '兼容旧模型名，新配置建议使用 deepseek-v4-flash。', sortOrder: 40 },
  { platform: 'openai', modelId: 'gpt-5.5', label: 'GPT-5.5', badge: '旗舰', description: '旗舰模型，适合高质量创作和复杂推理。', sortOrder: 10 },
  { platform: 'openai', modelId: 'gpt-5.4-mini', label: 'GPT-5.4 Mini', badge: '推荐', description: '能力、速度和成本均衡，适合作为默认创作模型。', recommended: true, sortOrder: 20 },
  { platform: 'openai', modelId: 'gpt-5.4-nano', label: 'GPT-5.4 Nano', description: '低成本高吞吐，适合批量草稿和轻量任务。', sortOrder: 30 },
  { platform: 'openai', modelId: 'gpt-4.1-mini', label: 'GPT-4.1 Mini（兼容）', description: '兼容旧项目配置，新创作建议使用 GPT-5.x 系列。', sortOrder: 40 }
]

export const findSeedModel = (platform: string, modelId: string): SeedModel | undefined =>
  SEED_CATALOG_MODELS.find((item) => item.platform === platform && item.modelId === modelId)
