export const estimateTokens = (text: unknown, charsPerToken = 4): number => {
  if (!text || typeof text !== 'string') {
    return 0
  }
  return Math.ceil(text.length / charsPerToken)
}
