/**
 * Token 估算工具
 * 统一按「字符数 / 每 token 字符数」估算 token 数
 *
 * @param {string} text - 文本内容
 * @param {number} [charsPerToken=4] - 每个 token 约对应的字符数
 * @returns {number}
 */
const estimateTokens = (text, charsPerToken = 4) => {
  if (!text || typeof text !== 'string') {
    return 0
  }
  return Math.ceil(text.length / charsPerToken)
}

module.exports = { estimateTokens }
