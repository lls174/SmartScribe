/** DeepSeek 官方人民币闲时价（每百万 token，2026-09-10 起）。高峰为 2 倍。 */
const FLASH_OFF_PEAK = {
  inputPerMillion: '1',
  cachedInputPerMillion: '0.02',
  outputPerMillion: '4'
}

/** V4 Pro 在改道 Flash 之前的官方闲时价。 */
const PRO_OFF_PEAK = {
  inputPerMillion: '4.5',
  cachedInputPerMillion: '0.15',
  outputPerMillion: '13.5'
}

/** 2026-09-14 12:00 北京时间之后，deepseek-v4-pro 按 Flash 计费。 */
const PRO_BILLS_AS_FLASH_AT = Date.parse('2026-09-14T04:00:00.000Z')

const FLASH_MODEL_IDS = [
  'deepseek-flash',
  'deepseek-v4-flash',
  'deepseek-v4-flash-vision-exp',
  'deepseek-chat',
  'deepseek-reasoner'
] as const

export interface OfficialModelPrice {
  platform: 'deepseek'
  modelId: string
  inputPerMillion: string
  cachedInputPerMillion: string
  outputPerMillion: string
  currency: 'CNY'
  peakDoubles: boolean
  notes: string
}

/** 判断北京时间是否处于 DeepSeek 高峰：工作日 9–12、14–18。 */
export const isDeepSeekPeakHour = (at: Date): boolean => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    weekday: 'short',
    hour: 'numeric',
    hourCycle: 'h23'
  }).formatToParts(at)
  const weekday = parts.find((part) => part.type === 'weekday')?.value
  const hour = Number(parts.find((part) => part.type === 'hour')?.value)
  if (!Number.isFinite(hour) || weekday === 'Sat' || weekday === 'Sun') return false
  return (hour >= 9 && hour < 12) || (hour >= 14 && hour < 18)
}

/** Pro 是否已按官方公告改道 Flash 计价。 */
export const isDeepSeekProBilledAsFlash = (at: Date): boolean => at.getTime() >= PRO_BILLS_AS_FLASH_AT

const toOfficial = (
  modelId: string,
  band: typeof FLASH_OFF_PEAK,
  notes: string
): OfficialModelPrice => ({
  platform: 'deepseek',
  modelId,
  inputPerMillion: band.inputPerMillion,
  cachedInputPerMillion: band.cachedInputPerMillion,
  outputPerMillion: band.outputPerMillion,
  currency: 'CNY',
  peakDoubles: true,
  notes
})

/** 读取某模型的官方价；没有则返回 null。 */
export const getOfficialPrice = (platform: string, modelId: string, at = new Date()): OfficialModelPrice | null => {
  if (platform !== 'deepseek') return null
  const id = modelId.trim()
  if (FLASH_MODEL_IDS.includes(id as (typeof FLASH_MODEL_IDS)[number])) {
    return toOfficial(id, FLASH_OFF_PEAK, 'DeepSeek 官方人民币闲时价；高峰自动 ×2')
  }
  if (id === 'deepseek-v4-pro') {
    if (isDeepSeekProBilledAsFlash(at)) {
      return toOfficial(id, FLASH_OFF_PEAK, '2026-09-14 12:00 起按 Flash 官方闲时价；高峰自动 ×2')
    }
    return toOfficial(id, PRO_OFF_PEAK, 'DeepSeek V4 Pro 官方人民币闲时价；高峰自动 ×2')
  }
  return null
}

/** 同步入库用的官方价清单（按当前时间展开）。 */
export const listOfficialPrices = (at = new Date()): OfficialModelPrice[] => {
  const ids = [...FLASH_MODEL_IDS, 'deepseek-v4-pro']
  return ids
    .map((modelId) => getOfficialPrice('deepseek', modelId, at))
    .filter((item): item is OfficialModelPrice => Boolean(item))
}
