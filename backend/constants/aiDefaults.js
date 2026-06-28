/**
 * AI 平台/模型默认值
 * 统一默认 platform 与 model，避免在路由与 service 中重复硬编码
 */
const DEFAULT_AI_PLATFORM = 'deepseek'
const DEFAULT_AI_MODEL = 'deepseek-v4-flash'

module.exports = { DEFAULT_AI_PLATFORM, DEFAULT_AI_MODEL }
