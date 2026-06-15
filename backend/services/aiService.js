const axios = require('axios')
const util = require('util')
const { estimateTokens } = require('../utils/tokenEstimate')
const { DEFAULT_AI_PLATFORM, DEFAULT_AI_MODEL } = require('../constants/aiDefaults')

const PLATFORM_BASE_URLS = {
  aliyun: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  zhipu: 'https://api.z.ai/api/paas/v4/chat/completions',
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions'
}

const PLATFORM_ENV_KEYS = {
  aliyun: process.env.DASHSCOPE_API_KEY,
  zhipu: process.env.GLM_AI_KEY,
  deepseek: process.env.DEEPSEEK_API_KEY,
  openai: process.env.OPENAI_API_KEY
}

class AIService {
  constructor() {
    this.platforms = {
      aliyun: {
        baseURL: PLATFORM_BASE_URLS.aliyun,
        apiKey: PLATFORM_ENV_KEYS.aliyun
      },
      zhipu: {
        baseURL: PLATFORM_BASE_URLS.zhipu,
        apiKey: PLATFORM_ENV_KEYS.zhipu
      }
    }
  }

  getPlatformConfig(platform, aiOptions = {}) {
    const platformMap = {
      'aliyun': 'aliyun',
      'glm': 'zhipu',
      'zhipu': 'zhipu',
      'deepseek': 'deepseek',
      'openai': 'openai',
      'custom': 'custom'
    }

    const normalizedPlatform = platformMap[platform.toLowerCase()]

    if (!normalizedPlatform) {
      throw new Error('不支持的AI平台')
    }

    if (normalizedPlatform === 'custom') {
      if (!aiOptions.customBaseURL) {
        throw new Error('自定义平台必须提供API地址')
      }
      return {
        baseURL: aiOptions.customBaseURL,
        apiKey: aiOptions.apiKey || ''
      }
    }

    const defaultBaseURL = PLATFORM_BASE_URLS[normalizedPlatform] || this.platforms[normalizedPlatform]?.baseURL
    const defaultApiKey = PLATFORM_ENV_KEYS[normalizedPlatform] || this.platforms[normalizedPlatform]?.apiKey

    return {
      baseURL: aiOptions.customBaseURL || defaultBaseURL,
      apiKey: (aiOptions.apiKey && aiOptions.apiKey.trim()) || defaultApiKey || ''
    }
  }

  async generateContent(prompt, platform = DEFAULT_AI_PLATFORM, model = DEFAULT_AI_MODEL, onChunk, aiOptions = {}) {
    try {
      const { baseURL, apiKey } = this.getPlatformConfig(platform, aiOptions)
      console.log('API配置 - platform:', platform, 'baseURL:', baseURL, 
        'apiKey来源:', aiOptions?.apiKey ? '用户输入' : (apiKey ? '环境变量' : '无'),
        'apiKey长度:', apiKey?.length || 0)

      if (!apiKey) {
        throw new Error('API密钥未配置，请在AI设置页面填写密钥，或设置环境变量 GLM_AI_KEY')
      }

      if (!baseURL) {
        throw new Error('API地址未配置')
      }

      return await this.callOpenAICompatibleAPI(baseURL, apiKey, prompt, model, onChunk)
    } catch (error) {
      console.error('生成内容失败:', error)
      throw error
    }
  }

  estimateTokens(text) {
    return estimateTokens(text, 4)
  }

  normalizeUsage(usage, prompt, content) {
    if (usage) {
      const promptTokens = Number(usage.prompt_tokens ?? usage.promptTokens) || 0
      const completionTokens = Number(usage.completion_tokens ?? usage.completionTokens) || 0
      const totalTokens = Number(usage.total_tokens ?? usage.totalTokens) || (promptTokens + completionTokens)

      return {
        promptTokens,
        completionTokens,
        totalTokens,
        isEstimated: false
      }
    }

    const promptTokens = this.estimateTokens(prompt)
    const completionTokens = this.estimateTokens(content)
    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      isEstimated: true
    }
  }

  createResult(prompt, content, usage) {
    return {
      content,
      usage: this.normalizeUsage(usage, prompt, content)
    }
  }

  async callOpenAICompatibleAPI(baseURL, apiKey, prompt, model = 'qwen3.5-plus', onChunk) {
    try {
      console.log('调用AI API, baseURL:', baseURL, 'model:', model, 'stream:', !!onChunk)
      console.log('提示词长度:', prompt?.length || 0)

      const requestData = {
        model: model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 4095,
        temperature: 0.7
      }

      if (onChunk) {
        requestData.stream = true
      }

      console.log('请求数据:', JSON.stringify({ ...requestData, messages: `[${requestData.messages.length}条消息]` }))

      const response = await axios.post(
        baseURL,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          responseType: onChunk ? 'stream' : 'json',
          timeout: 120000
        }
      )

      if (onChunk) {
        return new Promise((resolve, reject) => {
          let fullContent = ''
          let buffer = ''
          let usage = null

          response.data.on('data', (chunk) => {
            try {
              const chunkStr = chunk.toString()
              buffer += chunkStr
              const lines = buffer.split('\n')
              buffer = lines.pop() || ''

              for (const line of lines) {
                const trimmedLine = line.trim()
                if (trimmedLine.startsWith('data: ')) {
                  const dataStr = trimmedLine.substring(6).trim()
                  if (dataStr && dataStr !== '[DONE]') {
                    try {
                      const data = JSON.parse(dataStr)
                      if (data.usage) {
                        usage = data.usage
                      }
                      if (data.choices && data.choices.length > 0) {
                        const delta = data.choices[0].delta
                        if (delta && delta.content) {
                          const contentChunk = delta.content
                          fullContent += contentChunk
                          onChunk(contentChunk)
                          console.log('收到流式数据块, 长度:', contentChunk.length)
                        }
                      }
                    } catch (parseError) {
                      console.error('解析流式数据失败:', parseError.message, '原始数据:', dataStr.substring(0, 100))
                    }
                  }
                }
              }
            } catch (error) {
              console.error('处理流式数据失败:', error)
            }
          })

          response.data.on('end', () => {
            console.log('流式响应结束, 总内容长度:', fullContent.length)
            if (!fullContent) {
              reject(new Error('生成内容为空'))
            } else {
              resolve(this.createResult(prompt, fullContent, usage))
            }
          })

          response.data.on('error', (error) => {
            console.error('流式响应错误:', error)
            reject(error)
          })
        })
      } else {
        if (response.data.choices && response.data.choices.length > 0) {
          const content = response.data.choices[0].message?.content
          if (!content) {
            throw new Error('生成内容为空')
          }
          return this.createResult(prompt, content, response.data.usage)
        } else {
          throw new Error('生成内容为空')
        }
      }
    } catch (error) {
      console.error('调用AI API失败:', error.message)
      if (error.response) {
        console.error('响应状态:', error.response.status)
        console.error('响应Content-Type:', error.response.headers?.['content-type'])
        
        const raw = error.response.data
        let responseData = ''
        
        if (!raw) {
          responseData = '[空响应体]'
        } else if (typeof raw === 'string') {
          responseData = raw.substring(0, 500)
        } else if (Buffer.isBuffer(raw)) {
          responseData = raw.toString('utf-8').substring(0, 500)
        } else if (raw._readableState !== undefined || typeof raw.read === 'function') {
          responseData = '[流式响应对象, 无法直接读取]'
        } else if (typeof raw === 'object') {
          try {
            const str = JSON.stringify(raw)
            if (str === '{}' || str === 'undefined') {
              responseData = util.inspect(raw, { depth: 2, maxArrayLength: 5 }).substring(0, 500)
            } else {
              responseData = str.substring(0, 500)
            }
          } catch (_) {
            responseData = util.inspect(raw, { depth: 1 }).substring(0, 500)
          }
        }
        
        console.error('响应数据:', responseData)
        
        let errorMsg = ''
        if (raw && typeof raw === 'object' && !raw._readableState) {
          errorMsg = raw?.error?.message || raw?.message || responseData
        } else if (responseData && responseData !== '[空响应体]' && responseData !== '[流式响应对象, 无法直接读取]') {
          errorMsg = responseData
        } else {
          errorMsg = `请求参数: model=${error.config?.data ? JSON.parse(error.config.data).model : '?'}`
        }
        
        throw new Error(`AI API错误(${error.response.status}): ${errorMsg}`)
      }
      throw error
    }
  }

  optimizePrompt(prompt) {
    const optimizedPrompt = `请根据以下要求生成高质量的小说章节：\n\n${prompt}\n\n要求：\n1. 情节紧凑，引人入胜\n2. 人物刻画生动，有鲜明的性格特点\n3. 场景描写细腻，有画面感\n4. 语言流畅，符合所选题材和风格\n5. 避免俗套情节，力求创新\n6. 章节长度适中，内容充实`

    return optimizedPrompt
  }

  async generateChapter(prompt, chapterTitle, platform = 'aliyun', model = 'qwen3.5-plus', onChunk, aiOptions = {}) {
    const optimizedPrompt = this.optimizePrompt(prompt)

    const fullPrompt = chapterTitle
      ? `请为小说生成一个章节，标题为"${chapterTitle}"。${optimizedPrompt}`
      : `请为小说生成一个章节。${optimizedPrompt}`

    const chapterContent = await this.generateContent(fullPrompt, platform, model, onChunk, aiOptions)

    const plotPrompt = `请为以下章节内容生成一个简洁的剧情大概（100-200字），用于后续续写：\n${chapterContent.content}`
    const plot = await this.generateContent(plotPrompt, platform, model, null, aiOptions)

    return { content: chapterContent.content, plot: plot.content }
  }

  async continueChapter(lastContent, lastPlot, prompt, platform = 'aliyun', model = 'qwen3.5-plus', onChunk, aiOptions = {}) {
    if (!lastContent || !lastContent.trim()) {
      throw new Error('上次内容不能为空')
    }

    let fullPrompt = ''
    if (prompt) {
      if (lastPlot) {
        fullPrompt = `请根据以下内容和剧情大概进行续写：\n\n【原有内容】\n${lastContent}\n\n【剧情大概】\n${lastPlot}\n\n【续写要求】\n${prompt}`
      } else {
        fullPrompt = `请根据以下内容进行续写：\n\n【原有内容】\n${lastContent}\n\n【续写要求】\n${prompt}`
      }
    } else {
      if (lastPlot) {
        fullPrompt = `请根据以下内容和剧情大概进行续写：\n\n【原有内容】\n${lastContent}\n\n【剧情大概】\n${lastPlot}`
      } else {
        fullPrompt = `请根据以下内容进行续写：\n\n【原有内容】\n${lastContent}`
      }
    }

    console.log('续写章节 - 提示词长度:', fullPrompt.length)

    const continuedContent = await this.generateContent(fullPrompt, platform, model, onChunk, aiOptions)

    const newPlotPrompt = `请为以下续写内容生成一个简洁的剧情大概（100-200字），用于后续续写：\n${continuedContent.content}`
    const newPlot = await this.generateContent(newPlotPrompt, platform, model, null, aiOptions)

    return { content: continuedContent.content, plot: newPlot.content }
  }

  async polishContent(content, prompt, platform = 'aliyun', model = 'qwen3.5-plus', onChunk, aiOptions = {}) {
    const fullPrompt = prompt
      ? `请润色以下内容：\n${content}\n\n要求：${prompt}`
      : `请润色以下内容，使其更加流畅、生动：\n${content}`

    return await this.generateContent(fullPrompt, platform, model, onChunk, aiOptions)
  }

  async generateSetting(type, prompt, platform = 'aliyun', model = 'qwen3.5-plus', onChunk, aiOptions = {}) {
    let typeText = ''
    switch (type) {
      case 'character':
        typeText = '人物设定'
        break
      case 'world':
        typeText = '世界观设定'
        break
      case 'item':
        typeText = '道具设定'
        break
      default:
        typeText = '设定'
    }

    const fullPrompt = `请生成一个${typeText}。${prompt}`
    return await this.generateContent(fullPrompt, platform, model, onChunk, aiOptions)
  }

  async generateOutline(novelType, corePlot, length, platform = 'aliyun', model = 'qwen3.5-plus', onChunk, aiOptions = {}) {
    const fullPrompt = `请为${novelType}小说生成一个大纲，核心剧情是：${corePlot}。要求${length}。`
    return await this.generateContent(fullPrompt, platform, model, onChunk, aiOptions)
  }

  async generateCreative(prompt, type, platform = 'aliyun', model = 'qwen3.5-plus', onChunk, aiOptions = {}) {
    return await this.generateContent(prompt, platform, model, onChunk, aiOptions)
  }
}

module.exports = new AIService()
