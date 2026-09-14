import type { AiKeySource, AiTokenSource, AiUsage } from '../../../shared/types'
import { getOfficialPrice, isDeepSeekPeakHour } from '../data/officialAiPrices'
import { AiModelPrice, AiRequestLog } from '../models'
import { getUserAiConfig } from './aiCredentialService'
import { countTokensForLog } from './tokenizerService'
import { costFromTokens, moneyToStore, toDecimal } from '../utils/decimalMoney'
import { toTokenInt } from '../utils/intTokens'

const DEFAULT_USD_CNY = '7.2'

export interface RecordAiUsageParams {
  userId: number
  novelId?: number | null
  chapterId?: number | null
  action: string
  platform: string
  model: string
  status: 'success' | 'failed'
  startedAt: number
  promptText: string
  resultText?: string
  usage?: AiUsage | null
  keySource?: AiKeySource | null
  error?: unknown
  metadata?: Record<string, unknown>
}

interface ResolvedUsage {
  promptTokens: number
  cachedPromptTokens: number
  uncachedPromptTokens: number
  completionTokens: number
  totalTokens: number
  tokenSource: AiTokenSource
  isEstimated: boolean
  flags: string[]
}

interface CostSnapshot {
  costAmount: string
  costCurrency: string | null
  costAmountCny: string
  fxRateUsed: string | null
  fxRateSource: string | null
  inputPrice: string | null
  cachedInputPrice: string | null
  outputPrice: string | null
  costFlag: string | null
}

const pushFlag = (flags: string[], flag: string): void => {
  if (!flags.includes(flag)) flags.push(flag)
}

/** 从官方 usage 或本地 tokenizer 得到拆账后的 token。 */
export const resolveUsageForLog = async (
  platform: string,
  model: string,
  promptText: string,
  resultText: string,
  usage?: AiUsage | null
): Promise<ResolvedUsage> => {
  const flags: string[] = []
  const hasOfficial = Boolean(usage && usage.isEstimated === false && (usage.promptTokens > 0 || usage.completionTokens > 0))

  if (hasOfficial && usage) {
    let promptTokens = toTokenInt(usage.promptTokens)
    let cachedPromptTokens = toTokenInt(usage.cachedPromptTokens)
    if (cachedPromptTokens > promptTokens) {
      cachedPromptTokens = promptTokens
      pushFlag(flags, 'cache_tokens_inconsistent')
    }
    const uncachedPromptTokens = promptTokens - cachedPromptTokens
    const completionTokens = toTokenInt(usage.completionTokens)
    const totalTokens = toTokenInt(usage.totalTokens) || (promptTokens + completionTokens)
    return {
      promptTokens,
      cachedPromptTokens,
      uncachedPromptTokens,
      completionTokens,
      totalTokens,
      tokenSource: 'api',
      isEstimated: false,
      flags
    }
  }

  const promptCount = await countTokensForLog(platform, model, promptText || '')
  const resultCount = await countTokensForLog(platform, model, resultText || '')
  const tokenSource: AiTokenSource = promptCount.source === 'tokenizer' && resultCount.source === 'tokenizer'
    ? 'tokenizer'
    : 'heuristic'
  pushFlag(flags, 'estimated_tokens')
  return {
    promptTokens: promptCount.tokens,
    cachedPromptTokens: 0,
    uncachedPromptTokens: promptCount.tokens,
    completionTokens: resultCount.tokens,
    totalTokens: promptCount.tokens + resultCount.tokens,
    tokenSource,
    isEstimated: true,
    flags
  }
}

const resolveFx = (): { rate: string; source: string; flag?: string } => {
  const raw = process.env.USD_CNY_RATE?.trim()
  if (raw && /^\d+(\.\d+)?$/.test(raw)) {
    return { rate: moneyToStore(raw), source: 'env:USD_CNY_RATE' }
  }
  return { rate: moneyToStore(DEFAULT_USD_CNY), source: 'default:7.2', flag: 'fx_default' }
}

interface BillablePrice {
  inputPerMillion: string
  cachedInputPerMillion: string | null
  outputPerMillion: string
  currency: 'CNY' | 'USD'
  peakDoubles: boolean
}

/** 手工价优先，其次官方人民币价，最后才用社区价（避免美元被当成人民币）。 */
const resolveBillablePrice = async (platform: string, model: string, at: Date): Promise<BillablePrice | null> => {
  const row = await AiModelPrice.findOne({ where: { platform, modelId: model } })
  if (row?.source === 'manual') {
    return {
      inputPerMillion: String(row.inputPerMillion),
      cachedInputPerMillion: row.cachedInputPerMillion == null ? null : String(row.cachedInputPerMillion),
      outputPerMillion: String(row.outputPerMillion),
      currency: row.currency === 'USD' ? 'USD' : 'CNY',
      peakDoubles: false
    }
  }
  const official = getOfficialPrice(platform, model, at)
  if (official) {
    return {
      inputPerMillion: official.inputPerMillion,
      cachedInputPerMillion: official.cachedInputPerMillion,
      outputPerMillion: official.outputPerMillion,
      currency: official.currency,
      peakDoubles: official.peakDoubles
    }
  }
  if (!row) return null
  return {
    inputPerMillion: String(row.inputPerMillion),
    cachedInputPerMillion: row.cachedInputPerMillion == null ? null : String(row.cachedInputPerMillion),
    outputPerMillion: String(row.outputPerMillion),
    currency: row.currency === 'USD' ? 'USD' : 'CNY',
    peakDoubles: false
  }
}

/** 官方闲时价在高峰时段按 2 倍计入。 */
const applyPeakPrices = (price: BillablePrice, platform: string, at: Date): BillablePrice => {
  if (!price.peakDoubles || platform !== 'deepseek' || !isDeepSeekPeakHour(at)) return price
  return {
    ...price,
    inputPerMillion: moneyToStore(toDecimal(price.inputPerMillion).mul(2)),
    cachedInputPerMillion: price.cachedInputPerMillion
      ? moneyToStore(toDecimal(price.cachedInputPerMillion).mul(2))
      : null,
    outputPerMillion: moneyToStore(toDecimal(price.outputPerMillion).mul(2))
  }
}

/** 按快照单价计算原币种与人民币花费。 */
export const computeCostSnapshot = async (
  platform: string,
  model: string,
  keySource: AiKeySource | null,
  usage: ResolvedUsage,
  startedAt = Date.now()
): Promise<CostSnapshot> => {
  const flags = [...usage.flags]
  if (keySource === 'user' || platform === 'custom' || !keySource) {
    return {
      costAmount: moneyToStore(0),
      costCurrency: null,
      costAmountCny: moneyToStore(0),
      fxRateUsed: null,
      fxRateSource: null,
      inputPrice: null,
      cachedInputPrice: null,
      outputPrice: null,
      costFlag: flags.length ? flags.join(',') : null
    }
  }

  const at = new Date(startedAt)
  const rawPrice = await resolveBillablePrice(platform, model, at)
  if (!rawPrice) {
    pushFlag(flags, 'missing_price')
    return {
      costAmount: moneyToStore(0),
      costCurrency: null,
      costAmountCny: moneyToStore(0),
      fxRateUsed: null,
      fxRateSource: null,
      inputPrice: null,
      cachedInputPrice: null,
      outputPrice: null,
      costFlag: flags.join(',')
    }
  }
  const price = applyPeakPrices(rawPrice, platform, at)

  let cachedPrice = price.cachedInputPerMillion
  if (usage.cachedPromptTokens > 0 && (cachedPrice === null || cachedPrice === undefined || cachedPrice === '')) {
    cachedPrice = price.inputPerMillion
    pushFlag(flags, 'cache_price_missing')
  }

  const amount = costFromTokens(usage.uncachedPromptTokens, price.inputPerMillion)
    .plus(costFromTokens(usage.cachedPromptTokens, cachedPrice || 0))
    .plus(costFromTokens(usage.completionTokens, price.outputPerMillion))

  const costAmount = moneyToStore(amount)
  const currency = price.currency === 'USD' ? 'USD' : 'CNY'

  if (currency === 'CNY') {
    return {
      costAmount,
      costCurrency: 'CNY',
      costAmountCny: costAmount,
      fxRateUsed: moneyToStore(1),
      fxRateSource: 'identity',
      inputPrice: moneyToStore(price.inputPerMillion),
      cachedInputPrice: price.cachedInputPerMillion ? moneyToStore(price.cachedInputPerMillion) : null,
      outputPrice: moneyToStore(price.outputPerMillion),
      costFlag: flags.length ? flags.join(',') : null
    }
  }

  const fx = resolveFx()
  if (fx.flag) pushFlag(flags, fx.flag)
  const cny = toDecimal(costAmount).mul(toDecimal(fx.rate))
  return {
    costAmount,
    costCurrency: 'USD',
    costAmountCny: moneyToStore(cny),
    fxRateUsed: fx.rate,
    fxRateSource: fx.source,
    inputPrice: moneyToStore(price.inputPerMillion),
    cachedInputPrice: price.cachedInputPerMillion ? moneyToStore(price.cachedInputPerMillion) : null,
    outputPrice: moneyToStore(price.outputPerMillion),
    costFlag: flags.length ? flags.join(',') : null
  }
}

const getErrorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error)

/** 统一写入 AI 用量日志，含 token 拆账、keySource 与花费快照。 */
export const recordAiUsage = async (params: RecordAiUsageParams): Promise<void> => {
  if (!params.userId) return
  try {
    const keySource = params.keySource ?? (await resolveKeySource(params.userId, params.platform, params.model))
    const usage = await resolveUsageForLog(
      params.platform,
      params.model,
      params.promptText || '',
      params.resultText || '',
      params.usage
    )
    const cost = await computeCostSnapshot(params.platform, params.model, keySource, usage, params.startedAt)
    await AiRequestLog.create({
      userId: params.userId,
      novelId: params.novelId ?? null,
      chapterId: params.chapterId ?? null,
      action: params.action,
      platform: params.platform,
      model: params.model,
      status: params.status,
      keySource,
      tokenSource: usage.tokenSource,
      promptTokens: usage.promptTokens,
      cachedPromptTokens: usage.cachedPromptTokens,
      uncachedPromptTokens: usage.uncachedPromptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      isEstimated: usage.isEstimated,
      costAmount: cost.costAmount,
      costCurrency: cost.costCurrency,
      costAmountCny: cost.costAmountCny,
      fxRateUsed: cost.fxRateUsed,
      fxRateSource: cost.fxRateSource,
      inputPrice: cost.inputPrice,
      cachedInputPrice: cost.cachedInputPrice,
      outputPrice: cost.outputPrice,
      costFlag: cost.costFlag,
      durationMs: Date.now() - params.startedAt,
      promptLength: params.promptText?.length || 0,
      resultLength: params.resultText?.length || 0,
      errorMessage: params.error ? getErrorMessage(params.error).slice(0, 1000) : null,
      metadata: params.metadata ?? null
    })
  } catch (error) {
    console.warn(`写入AI请求日志失败(${params.action}):`, getErrorMessage(error))
  }
}

/** 根据当前凭证解析本次请求的密钥来源，失败时不抛错以免打断主流程。 */
export const resolveKeySource = async (
  userId: number | undefined,
  platform: string,
  model: string
): Promise<AiKeySource | null> => {
  if (!userId) return null
  try {
    const config = await getUserAiConfig(userId, platform, model)
    if (config.hasUserApiKey) return 'user'
    if (config.apiKey) return 'env'
    return null
  } catch {
    return null
  }
}
