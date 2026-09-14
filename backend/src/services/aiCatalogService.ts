import axios from 'axios'
import type { AiCatalogModel, AiCatalogResponse, AiPlatform } from '../../../shared/types'
import { AiModelCatalog } from '../models'
import { findSeedModel, SEED_CATALOG_MODELS } from '../data/aiModelSeed'
import { decideCapability } from './modelCapability'

const MODEL_LIST_URLS: Record<Exclude<AiPlatform, 'custom'>, string> = {
  aliyun: 'https://dashscope.aliyuncs.com/compatible-mode/v1/models',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4/models',
  deepseek: 'https://api.deepseek.com/models',
  openai: 'https://api.openai.com/v1/models'
}

const getEnvKey = (platform: Exclude<AiPlatform, 'custom'>): string | undefined => {
  const keys: Record<Exclude<AiPlatform, 'custom'>, string | undefined> = {
    aliyun: process.env.DASHSCOPE_API_KEY,
    zhipu: process.env.GLM_AI_KEY,
    deepseek: process.env.DEEPSEEK_API_KEY,
    openai: process.env.OPENAI_API_KEY
  }
  return keys[platform]
}

interface RemoteModel {
  id: string
  owned_by?: string
  [key: string]: unknown
}

const toPublicModel = (row: AiModelCatalog): AiCatalogModel => ({
  id: row.id,
  platform: row.platform,
  modelId: row.modelId,
  label: row.label,
  ownedBy: row.ownedBy,
  capability: row.capability,
  capabilitySource: row.capabilitySource,
  enabled: row.enabled,
  recommended: row.recommended,
  sortOrder: row.sortOrder,
  description: row.description,
  badge: row.badge,
  source: row.source,
  syncedAt: row.syncedAt ? row.syncedAt.toISOString() : null
})

/** 表空时用种子目录回退给设置页。 */
export const getEnabledCatalog = async (): Promise<AiCatalogResponse> => {
  const rows = await AiModelCatalog.findAll({
    where: { enabled: true },
    order: [['platform', 'ASC'], ['sortOrder', 'ASC'], ['modelId', 'ASC']]
  })
  if (!rows.length) {
    const platforms: AiCatalogResponse['platforms'] = {}
    for (const seed of SEED_CATALOG_MODELS) {
      const item: AiCatalogModel = {
        platform: seed.platform,
        modelId: seed.modelId,
        label: seed.label,
        capability: 'chat',
        capabilitySource: 'seed',
        enabled: true,
        recommended: Boolean(seed.recommended),
        sortOrder: seed.sortOrder,
        description: seed.description ?? null,
        badge: seed.badge ?? null,
        source: 'seed',
        syncedAt: null
      }
      platforms[seed.platform] = [...(platforms[seed.platform] || []), item]
    }
    return { platforms, syncedAt: null, fallback: true }
  }
  const platforms: AiCatalogResponse['platforms'] = {}
  let latest: Date | null = null
  for (const row of rows) {
    platforms[row.platform] = [...(platforms[row.platform] || []), toPublicModel(row)]
    if (row.syncedAt && (!latest || row.syncedAt > latest)) latest = row.syncedAt
  }
  return { platforms, syncedAt: latest ? latest.toISOString() : null, fallback: false }
}

const fetchPlatformModels = async (platform: Exclude<AiPlatform, 'custom'>): Promise<RemoteModel[]> => {
  const apiKey = getEnvKey(platform)?.trim()
  if (!apiKey) throw new Error(`${platform} 未配置服务端环境变量 Key`)
  const response = await axios.get(MODEL_LIST_URLS[platform], {
    headers: { Authorization: `Bearer ${apiKey}` },
    timeout: 20000,
    validateStatus: () => true
  })
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`${platform} 拉取模型失败(${response.status})`)
  }
  const data = response.data as { data?: RemoteModel[] }
  return Array.isArray(data.data) ? data.data.filter((item) => typeof item?.id === 'string') : []
}

/** 用服务端 Key 同步各平台模型列表。 */
export const syncOfficialModels = async (): Promise<{
  synced: number
  failures: Array<{ platform: string; message: string }>
}> => {
  const platforms: Array<Exclude<AiPlatform, 'custom'>> = ['aliyun', 'zhipu', 'deepseek', 'openai']
  const failures: Array<{ platform: string; message: string }> = []
  const now = new Date()
  let synced = 0

  for (const platform of platforms) {
    try {
      const remotes = await fetchPlatformModels(platform)
      const seen = new Set<string>()
      for (const remote of remotes) {
        const modelId = remote.id
        seen.add(modelId)
        const existing = await AiModelCatalog.findOne({ where: { platform, modelId } })
        const seed = findSeedModel(platform, modelId)
        const decided = existing?.capabilitySource === 'admin'
          ? { capability: existing.capability, source: existing.capabilitySource as 'admin' }
          : decideCapability(platform, modelId)
        const enabledDefault = decided.capability === 'chat' && (decided.source === 'seed' || decided.source === 'adapter')
        if (!existing) {
          await AiModelCatalog.create({
            platform,
            modelId,
            label: seed?.label || modelId,
            ownedBy: typeof remote.owned_by === 'string' ? remote.owned_by : null,
            capability: decided.capability,
            capabilitySource: decided.source,
            enabled: enabledDefault,
            recommended: Boolean(seed?.recommended),
            sortOrder: seed?.sortOrder ?? 100,
            description: seed?.description ?? null,
            badge: seed?.badge ?? null,
            rawPayload: remote,
            source: seed ? 'seed' : 'api',
            syncedAt: now
          })
        } else {
          await existing.update({
            ownedBy: typeof remote.owned_by === 'string' ? remote.owned_by : existing.ownedBy,
            capability: existing.capabilitySource === 'admin' ? existing.capability : decided.capability,
            capabilitySource: existing.capabilitySource === 'admin' ? 'admin' : decided.source,
            rawPayload: remote,
            source: existing.source === 'manual' ? 'manual' : (seed ? 'seed' : 'api'),
            syncedAt: now
          })
        }
        synced += 1
      }
      const stale = await AiModelCatalog.findAll({ where: { platform } })
      for (const row of stale) {
        if (!seen.has(row.modelId) && row.source !== 'manual') {
          await row.update({ enabled: false, syncedAt: now })
        }
      }
    } catch (error) {
      failures.push({
        platform,
        message: error instanceof Error ? error.message : String(error)
      })
    }
  }

  return { synced, failures }
}

/** 首次部署时写入种子目录，便于设置页立刻可用。 */
export const seedCatalogIfEmpty = async (): Promise<void> => {
  const count = await AiModelCatalog.count()
  if (count > 0) return
  for (const seed of SEED_CATALOG_MODELS) {
    await AiModelCatalog.create({
      platform: seed.platform,
      modelId: seed.modelId,
      label: seed.label,
      ownedBy: null,
      capability: 'chat',
      capabilitySource: 'seed',
      enabled: true,
      recommended: Boolean(seed.recommended),
      sortOrder: seed.sortOrder,
      description: seed.description ?? null,
      badge: seed.badge ?? null,
      rawPayload: null,
      source: 'seed',
      syncedAt: null
    })
  }
}
