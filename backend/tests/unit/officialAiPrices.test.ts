import { costFromTokens, moneyToStore } from '../../src/utils/decimalMoney'
import {
  getOfficialPrice,
  isDeepSeekPeakHour,
  isDeepSeekProBilledAsFlash
} from '../../src/data/officialAiPrices'

describe('DeepSeek 官方人民币价', () => {
  it('Flash 闲时价为 1 / 0.02 / 4 元每百万', () => {
    const price = getOfficialPrice('deepseek', 'deepseek-v4-flash', new Date('2026-09-13T16:00:00.000Z'))
    expect(price?.inputPerMillion).toBe('1')
    expect(price?.cachedInputPerMillion).toBe('0.02')
    expect(price?.outputPerMillion).toBe('4')
    expect(price?.currency).toBe('CNY')
  })

  it('旧社区美元高峰价当人民币会少算约 3.3 倍', () => {
    const tokens = 100_000
    const communityUsdAsCny = costFromTokens(tokens, '0.3')
    const officialCny = costFromTokens(tokens, '1')
    expect(moneyToStore(communityUsdAsCny)).toBe('0.03000000')
    expect(moneyToStore(officialCny)).toBe('0.10000000')
  })

  it('工作日北京 9 点和 14 点是高峰，周末不是', () => {
    expect(isDeepSeekPeakHour(new Date('2026-09-14T01:00:00.000Z'))).toBe(true)
    expect(isDeepSeekPeakHour(new Date('2026-09-14T06:00:00.000Z'))).toBe(true)
    expect(isDeepSeekPeakHour(new Date('2026-09-14T04:30:00.000Z'))).toBe(false)
    expect(isDeepSeekPeakHour(new Date('2026-09-12T01:00:00.000Z'))).toBe(false)
  })

  it('2026-09-14 12:00 起 Pro 按 Flash 计价', () => {
    expect(isDeepSeekProBilledAsFlash(new Date('2026-09-14T03:59:00.000Z'))).toBe(false)
    expect(isDeepSeekProBilledAsFlash(new Date('2026-09-14T04:00:00.000Z'))).toBe(true)
    const before = getOfficialPrice('deepseek', 'deepseek-v4-pro', new Date('2026-09-14T03:59:00.000Z'))
    const after = getOfficialPrice('deepseek', 'deepseek-v4-pro', new Date('2026-09-14T04:00:00.000Z'))
    expect(before?.inputPerMillion).toBe('4.5')
    expect(after?.inputPerMillion).toBe('1')
  })
})
