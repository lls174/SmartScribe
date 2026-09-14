import { costFromTokens, moneyToStore, toDecimal } from '../../src/utils/decimalMoney'
import { toTokenInt } from '../../src/utils/intTokens'

describe('token 与金额精度', () => {
  it('token 保持整数，不二次 round', () => {
    expect(toTokenInt(12.9)).toBe(12)
    expect(toTokenInt('33')).toBe(33)
    expect(toTokenInt('12.4')).toBe(12)
  })

  it('单次花费按百万单价 half-up 到 8 位', () => {
    const amount = costFromTokens(1234, '2.5')
    expect(moneyToStore(amount)).toBe('0.00308500')
  })

  it('汇总只加已入库金额，不用当前单价重算', () => {
    const sum = toDecimal('0.00308500').plus('1.20000000')
    expect(moneyToStore(sum)).toBe('1.20308500')
  })
})
