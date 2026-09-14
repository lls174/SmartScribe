import axios from 'axios'
import { Op } from 'sequelize'
import type { AiPriceSource } from '../../../shared/types'
import { listOfficialPrices } from '../data/officialAiPrices'
import { AiModelAlias, AiModelCatalog, AiModelPrice } from '../models'
import { moneyToStore } from '../utils/decimalMoney'

const LITELLM_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json'

interface LiteLlmPrice {
  input_cost_per_token?: number
  output_cost_per_token?: number
  cache_read_input_token_cost?: number
  litellm_provider?: string
}

const perMillionFromUnit = (unitCost?: number): string | null => {
  if (typeof unitCost !== 'number' || !Number.isFinite(unitCost)) return null
  return moneyToStore(unitCost * 1_000_000)
}

const providerToPlatform = (provider?: string): string | null => {
  if (!provider) return null
  const map: Record<string, string> = {
    openai: 'openai',
    deepseek: 'deepseek',
    dashscope: 'aliyun',
    alibaba: 'aliyun',
    zhipu: 'zhipu'
  }
  return map[provider.toLowerCase()] ?? null
}

/** 按平台精确匹配目录 id 或别名。 */
const matchExact = async (
  modelId: string,
  platformHint: string | null
): Promise<{ platform: string; modelId: string } | null> => {
  const exact = await AiModelCatalog.findOne({
    where: platformHint ? { platform: platformHint, modelId } : { modelId }
  })
  if (exact) return { platform: exact.platform, modelId: exact.modelId }

  const alias = await AiModelAlias.findOne({
    where: platformHint ? { platform: platformHint, alias: modelId } : { alias: modelId }
  })
  if (alias) return { platform: alias.platform, modelId: alias.modelId }
  return null
}

/** 精确匹配目录 modelId 或别名；仅当 provider 属于本平台时才去掉前缀。 */
const matchCatalog = async (
  key: string,
  entry: LiteLlmPrice
): Promise<{ platform: string; modelId: string } | null> => {
  const platformHint = providerToPlatform(entry.litellm_provider)
  const matched = await matchExact(key, platformHint)
  if (matched) return matched
  if (!platformHint || !key.includes('/')) return null
  const bare = key.slice(key.lastIndexOf('/') + 1)
  if (!bare || bare === key) return null
  return matchExact(bare, platformHint)
}

/** 从 LiteLLM 社区价表同步，不覆盖手工价。 */
export const syncCommunityPrices = async (): Promise<{ updated: number; skippedManual: number; unmatched: number }> => {
  const response = await axios.get(LITELLM_URL, { timeout: 20000, validateStatus: () => true })
  if (response.status < 200 || response.status >= 300 || !response.data || typeof response.data !== 'object') {
    throw new Error(`拉取社区价格失败(${response.status})`)
  }

  const table = response.data as Record<string, LiteLlmPrice>
  const now = new Date()
  let updated = 0
  let skippedManual = 0
  let unmatched = 0

  for (const [key, entry] of Object.entries(table)) {
    if (key.startsWith('sample_spec') || !entry || typeof entry !== 'object') continue
    const input = perMillionFromUnit(entry.input_cost_per_token)
    const output = perMillionFromUnit(entry.output_cost_per_token)
    if (!input || !output) continue
    const matched = await matchCatalog(key, entry)
    if (!matched) {
      unmatched += 1
      continue
    }
    const existing = await AiModelPrice.findOne({
      where: { platform: matched.platform, modelId: matched.modelId }
    })
    if (existing?.source === 'manual') {
      skippedManual += 1
      continue
    }
    if (existing?.source === 'official') {
      continue
    }
    const cached = perMillionFromUnit(entry.cache_read_input_token_cost)
    // LiteLLM 单价一律是美元 / token，国内平台也按 USD 入库，计费时再折人民币
    const currency = 'USD'
    if (existing) {
      await existing.update({
        inputPerMillion: input,
        outputPerMillion: output,
        cachedInputPerMillion: cached,
        currency,
        source: 'community',
        syncedAt: now
      })
    } else {
      await AiModelPrice.create({
        platform: matched.platform,
        modelId: matched.modelId,
        inputPerMillion: input,
        outputPerMillion: output,
        cachedInputPerMillion: cached,
        currency,
        source: 'community',
        syncedAt: now,
        notes: 'LiteLLM community'
      })
    }
    updated += 1
  }

  return { updated, skippedManual, unmatched }
}

/** 写入官方人民币价，不覆盖手工价。 */
export const syncOfficialPrices = async (): Promise<{ updated: number; skippedManual: number }> => {
  const now = new Date()
  let updated = 0
  let skippedManual = 0
  for (const item of listOfficialPrices(now)) {
    const existing = await AiModelPrice.findOne({
      where: { platform: item.platform, modelId: item.modelId }
    })
    if (existing?.source === 'manual') {
      skippedManual += 1
      continue
    }
    const payload = {
      inputPerMillion: moneyToStore(item.inputPerMillion),
      outputPerMillion: moneyToStore(item.outputPerMillion),
      cachedInputPerMillion: moneyToStore(item.cachedInputPerMillion),
      currency: item.currency,
      source: 'official' as AiPriceSource,
      syncedAt: now,
      notes: item.notes
    }
    if (existing) {
      await existing.update(payload)
    } else {
      await AiModelPrice.create({
        platform: item.platform,
        modelId: item.modelId,
        ...payload
      })
    }
    updated += 1
  }
  return { updated, skippedManual }
}

export const upsertManualPrice = async (payload: {
  platform: string
  modelId: string
  inputPerMillion: string
  outputPerMillion: string
  cachedInputPerMillion?: string | null
  currency: 'CNY' | 'USD'
  notes?: string
}): Promise<AiModelPrice> => {
  const [row] = await AiModelPrice.findOrCreate({
    where: { platform: payload.platform, modelId: payload.modelId },
    defaults: {
      platform: payload.platform,
      modelId: payload.modelId,
      inputPerMillion: moneyToStore(payload.inputPerMillion),
      outputPerMillion: moneyToStore(payload.outputPerMillion),
      cachedInputPerMillion: payload.cachedInputPerMillion ? moneyToStore(payload.cachedInputPerMillion) : null,
      currency: payload.currency,
      source: 'manual' as AiPriceSource,
      syncedAt: new Date(),
      notes: payload.notes ?? null
    }
  })
  await row.update({
    inputPerMillion: moneyToStore(payload.inputPerMillion),
    outputPerMillion: moneyToStore(payload.outputPerMillion),
    cachedInputPerMillion: payload.cachedInputPerMillion ? moneyToStore(payload.cachedInputPerMillion) : null,
    currency: payload.currency,
    source: 'manual',
    syncedAt: new Date(),
    notes: payload.notes ?? row.notes
  })
  return row
}

export const listPrices = async (): Promise<AiModelPrice[]> => {
  return AiModelPrice.findAll({
    where: { platform: { [Op.ne]: '' } },
    order: [['platform', 'ASC'], ['modelId', 'ASC']]
  })
}
