import Decimal from 'decimal.js'

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP })

const MILLION = new Decimal(1_000_000)

/** 把未知输入收成 Decimal，非法值视为 0。 */
export const toDecimal = (value: unknown): Decimal => {
  if (value instanceof Decimal) return value
  if (value === null || value === undefined || value === '') return new Decimal(0)
  try {
    return new Decimal(String(value))
  } catch {
    return new Decimal(0)
  }
}

/** 金额 half-up 到 8 位小数后以字符串入库。 */
export const moneyToStore = (value: Decimal | string | number): string => {
  return toDecimal(value).toDecimalPlaces(8, Decimal.ROUND_HALF_UP).toFixed(8)
}

/** 人民币展示 4 位，美元展示 6 位。 */
export const formatMoney = (value: unknown, currency: 'CNY' | 'USD' = 'CNY'): string => {
  const places = currency === 'USD' ? 6 : 4
  return toDecimal(value).toDecimalPlaces(places, Decimal.ROUND_HALF_UP).toFixed(places)
}

/** token × 每百万单价 / 1_000_000，再 half-up 到 8 位。 */
export const costFromTokens = (tokens: number, pricePerMillion: unknown): Decimal => {
  const safeTokens = Number.isFinite(tokens) ? Math.trunc(tokens) : 0
  return new Decimal(safeTokens).div(MILLION).mul(toDecimal(pricePerMillion)).toDecimalPlaces(8, Decimal.ROUND_HALF_UP)
}

export { Decimal }
