const axios = require('axios')

const PLATFORM_BASE_URLS = {
  aliyun: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
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
      apiKey: aiOptions.apiKey || defaultApiKey
    }
  }

  async generateContent(prompt, platform = 'aliyun', model = 'qwen-turbo', onChunk, aiOptions = {}) {
    try {
      const { baseURL, apiKey } = this.getPlatformConfig(platform, aiOptions)

      if (!apiKey) {
        throw new Error('API密钥未配置，请在AI设置中填写密钥')
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

  async callOpenAICompatibleAPI(baseURL, apiKey, prompt, model = 'qwen-turbo', onChunk) {
    try {
      console.log('调用AI API, baseURL:', baseURL, 'model:', model, 'stream:', !!onChunk)

      const requestData = {
        model: model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 5000,
        temperature: 0.7
      }

      if (onChunk) {
        requestData.stream = true
        requestData.stream_options = { include_usage: true }
      }

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
              resolve(fullContent)
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
          return content
        } else {
          throw new Error('生成内容为空')
        }
      }
    } catch (error) {
      console.error('调用AI API失败:', error.message)
      if (error.response) {
        console.error('响应状态:', error.response.status)
        console.error('响应数据:', error.response.data)
      }
      throw error
    }
  }

  optimizePrompt(prompt) {
    const optimizedPrompt = `请根据以下要求生成高质量的小说章节：\n\n${prompt}\n\n要求：\n1. 情节紧凑，引人入胜\n2. 人物刻画生动，有鲜明的性格特点\n3. 场景描写细腻，有画面感\n4. 语言流畅，符合所选题材和风格\n5. 避免俗套情节，力求创新\n6. 章节长度适中，内容充实`

    return optimizedPrompt
  }

  async generateChapter(prompt, chapterTitle, platform = 'aliyun', model = 'qwen-turbo', onChunk, aiOptions = {}) {
    const optimizedPrompt = this.optimizePrompt(prompt)

    const fullPrompt = chapterTitle
      ? `请为小说生成一个章节，标题为"${chapterTitle}"。${optimizedPrompt}`
      : `请为小说生成一个章节。${optimizedPrompt}`

    const chapterContent = await this.generateContent(fullPrompt, platform, model, onChunk, aiOptions)

    const plotPrompt = `请为以下章节内容生成一个简洁的剧情大概（100-200字），用于后续续写：\n${chapterContent}`
    const plot = await this.generateContent(plotPrompt, platform, model, null, aiOptions)

    return { content: chapterContent, plot: plot }
  }

  async continueChapter(lastContent, lastPlot, prompt, platform = 'aliyun', model = 'qwen-turbo', onChunk, aiOptions = {}) {
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

    const newPlotPrompt = `请为以下续写内容生成一个简洁的剧情大概（100-200字），用于后续续写：\n${continuedContent}`
    const newPlot = await this.generateContent(newPlotPrompt, platform, model, null, aiOptions)

    return { content: continuedContent, plot: newPlot }
  }

  async polishContent(content, prompt, platform = 'aliyun', model = 'qwen-turbo', onChunk, aiOptions = {}) {
    const fullPrompt = prompt
      ? `请润色以下内容：\n${content}\n\n要求：${prompt}`
      : `请润色以下内容，使其更加流畅、生动：\n${content}`

    return await this.generateContent(fullPrompt, platform, model, onChunk, aiOptions)
  }

  async generateSetting(type, prompt, platform = 'aliyun', model = 'qwen-turbo', onChunk, aiOptions = {}) {
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

  async generateOutline(novelType, corePlot, length, platform = 'aliyun', model = 'qwen-turbo', onChunk, aiOptions = {}) {
    const fullPrompt = `请为${novelType}小说生成一个大纲，核心剧情是：${corePlot}。要求${length}。`
    return await this.generateContent(fullPrompt, platform, model, onChunk, aiOptions)
  }

  async generateCreative(prompt, type, platform = 'aliyun', model = 'qwen-turbo', onChunk, aiOptions = {}) {
    return await this.generateContent(prompt, platform, model, onChunk, aiOptions)
  }
}

module.exports = new AIService()
