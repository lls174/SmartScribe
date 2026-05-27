import api, { buildApiUrl } from './api'

let csrfToken: string | null = null

const getCsrfToken = async (): Promise<string | null> => {
  if (csrfToken) {
    return csrfToken
  }
  
  try {
    const response = await api.get('/csrf-token')
    csrfToken = response.data.csrfToken
    return csrfToken
  } catch (error) {
    console.error('获取CSRF Token失败:', error)
    return null
  }
}

interface AIRequestConfig {
  platform?: string
  model?: string
  apiKey?: string
  customBaseURL?: string
}

export interface NovelContext {
  novelId?: number
  novelMeta?: {
    name?: string
    description?: string
    genre?: string
    style?: string
    totalChapters?: number
  }
  chapters?: Array<{
    id: number
    title?: string
    content?: string
    plot?: string
  }>
  currentChapterId?: number
}

const createSSERequest = (
  url: string,
  body: Record<string, unknown>,
  onChunk?: (chunk: string) => void,
  onDone?: (data: any) => void,
  resolve?: (value: any) => void,
  reject?: (error: Error) => void,
  csrfToken?: string
): XMLHttpRequest => {
  const xhr = new XMLHttpRequest()
  xhr.open('POST', url)
  xhr.setRequestHeader('Content-Type', 'application/json')
  
  const token = localStorage.getItem('token')
  if (token) {
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
  }
  
  if (csrfToken) {
    xhr.setRequestHeader('X-CSRF-Token', csrfToken)
  }
  
  xhr.responseType = 'text'
  
  let fullContent = ''
  let plot = ''
  let buffer = ''
  
  xhr.onprogress = () => {
    const responseText = xhr.responseText
    const newData = responseText.substring(buffer.length)
    buffer = responseText
    
    if (newData) {
      const lines = newData.split('\n')
      
      for (const line of lines) {
        const trimmedLine = line.trim()
        if (trimmedLine.startsWith('data: ')) {
          const dataStr = trimmedLine.substring(6)
          if (dataStr) {
            try {
              const data = JSON.parse(dataStr)
              if (data.content) {
                fullContent += data.content
                onChunk?.(data.content)
              }
              if (data.plot) {
                plot = data.plot
              }
              if (data.done) {
                onDone?.({
                  plot
                })
              }
            } catch (error) {
              console.error('解析SSE数据失败:', error)
            }
          }
        }
      }
    }
  }
  
  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      resolve?.( { content: fullContent, plot })
    } else {
      try {
        const errorData = JSON.parse(xhr.responseText)
        reject?.(new Error(errorData.message || `请求失败: ${xhr.status}`))
      } catch {
        reject?.(new Error(`请求失败: ${xhr.status}`))
      }
    }
  }
  
  xhr.onerror = () => {
    reject?.(new Error('网络错误，请检查网络连接'))
  }
  
  xhr.send(JSON.stringify(body))
  return xhr
}

export const aiService = {
  generateChapter: async (
    prompt: string, 
    chapterTitle?: string,
    onChunk?: (chunk: string) => void,
    onDone?: (plot: string) => void,
    aiConfig?: AIRequestConfig,
    novelContext?: NovelContext,
    generationParams?: {
      genre?: string
      style?: string
      corePlot?: string
      characters?: string
      wordCount?: string
      other?: string
    }
  ): Promise<{ content: string; plot: string }> => {
    const platform = aiConfig?.platform || localStorage.getItem('aiPlatform') || 'aliyun'
    const model = aiConfig?.model || localStorage.getItem('aiModel') || 'qwen3.5-plus'
    
    return new Promise((resolve, reject) => {
      getCsrfToken().then(csrfToken => {
        createSSERequest(
          buildApiUrl('/ai/generate'),
          {
            prompt,
            chapterTitle,
            platform,
            model,
            apiKey: aiConfig?.apiKey || '',
            customBaseURL: aiConfig?.customBaseURL || '',
            novelId: novelContext?.novelId,
            novelMeta: novelContext?.novelMeta,
            chapters: novelContext?.chapters,
            currentChapterId: novelContext?.currentChapterId,
            genre: generationParams?.genre,
            style: generationParams?.style,
            corePlot: generationParams?.corePlot,
            characters: generationParams?.characters,
            wordCount: generationParams?.wordCount,
            other: generationParams?.other
          },
          onChunk,
          (data) => onDone?.(data.plot),
          resolve,
          reject,
          csrfToken ?? undefined
        )
      }).catch(() => {
        reject(new Error('获取CSRF Token失败'))
      })
    })
  },

  continueChapter: async (
    lastContent: string, 
    lastPlot: string,
    prompt?: string,
    onChunk?: (chunk: string) => void,
    onDone?: (plot: string) => void,
    aiConfig?: AIRequestConfig,
    novelContext?: NovelContext,
    wordCount?: string
  ): Promise<{ content: string; plot: string }> => {
    const platform = aiConfig?.platform || localStorage.getItem('aiPlatform') || 'aliyun'
    const model = aiConfig?.model || localStorage.getItem('aiModel') || 'qwen3.5-plus'
    
    return new Promise((resolve, reject) => {
      getCsrfToken().then(csrfToken => {
        createSSERequest(
          buildApiUrl('/ai/continue'),
          {
            lastContent,
            lastPlot,
            prompt,
            platform,
            model,
            apiKey: aiConfig?.apiKey || '',
            customBaseURL: aiConfig?.customBaseURL || '',
            novelId: novelContext?.novelId,
            chapterId: novelContext?.currentChapterId,
            novelMeta: novelContext?.novelMeta,
            chapters: novelContext?.chapters,
            currentChapterId: novelContext?.currentChapterId,
            wordCount
          },
          onChunk,
          (data) => onDone?.(data.plot),
          resolve,
          reject,
          csrfToken ?? undefined
        )
      }).catch(() => {
        reject(new Error('获取CSRF Token失败'))
      })
    })
  },

  polishContent: async (
    content: string, 
    prompt?: string,
    onChunk?: (chunk: string) => void,
    onDone?: () => void,
    aiConfig?: AIRequestConfig,
    novelContext?: NovelContext,
    historyMeta?: {
      beforeContent?: string
      beforePlot?: string
      chapterTitle?: string
    }
  ): Promise<string> => {
    const platform = aiConfig?.platform || localStorage.getItem('aiPlatform') || 'aliyun'
    const model = aiConfig?.model || localStorage.getItem('aiModel') || 'qwen3.5-plus'
    
    return new Promise((resolve, reject) => {
      getCsrfToken().then(csrfToken => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', buildApiUrl('/ai/polish'))
        xhr.setRequestHeader('Content-Type', 'application/json')
        
        const token = localStorage.getItem('token')
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        }
        
        if (csrfToken) {
          xhr.setRequestHeader('X-CSRF-Token', csrfToken)
        }
        
        xhr.responseType = 'text'
        
        let fullContent = ''
        let buffer = ''
        
        xhr.onprogress = () => {
          const responseText = xhr.responseText
          const newData = responseText.substring(buffer.length)
          buffer = responseText
          
          if (newData) {
            const lines = newData.split('\n')
            
            for (const line of lines) {
              const trimmedLine = line.trim()
              if (trimmedLine.startsWith('data: ')) {
                const dataStr = trimmedLine.substring(6)
                if (dataStr) {
                  try {
                    const data = JSON.parse(dataStr)
                    if (data.content) {
                      fullContent += data.content
                      onChunk?.(data.content)
                    }
                    if (data.done) {
                      onDone?.()
                    }
                  } catch (error) {
                    console.error('解析SSE数据失败:', error)
                  }
                }
              }
            }
          }
        }
        
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(fullContent)
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText)
              reject(new Error(errorData.message || `请求失败: ${xhr.status}`))
            } catch {
              reject(new Error(`请求失败: ${xhr.status}`))
            }
          }
        }
        
        xhr.onerror = () => {
          reject(new Error('网络错误，请检查网络连接'))
        }
        
        xhr.send(JSON.stringify({
          content,
          prompt,
          platform,
          model,
          apiKey: aiConfig?.apiKey || '',
          customBaseURL: aiConfig?.customBaseURL || '',
          novelId: novelContext?.novelId,
          chapterId: novelContext?.currentChapterId,
          beforeContent: historyMeta?.beforeContent,
          beforePlot: historyMeta?.beforePlot,
          chapterTitle: historyMeta?.chapterTitle,
          novelMeta: novelContext?.novelMeta,
          chapters: novelContext?.chapters,
          currentChapterId: novelContext?.currentChapterId
        }))
      }).catch(() => {
        reject(new Error('获取CSRF Token失败'))
      })
    })
  },

  generateSetting: async (
    type: 'character' | 'world' | 'item', 
    prompt: string,
    onChunk?: (chunk: string) => void,
    onDone?: () => void,
    aiConfig?: AIRequestConfig
  ): Promise<string> => {
    const platform = aiConfig?.platform || localStorage.getItem('aiPlatform') || 'aliyun'
    const model = aiConfig?.model || localStorage.getItem('aiModel') || 'qwen3.5-plus'
    
    return new Promise((resolve, reject) => {
      getCsrfToken().then(csrfToken => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', buildApiUrl('/ai/setting'))
        xhr.setRequestHeader('Content-Type', 'application/json')
        
        const token = localStorage.getItem('token')
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        }
        
        if (csrfToken) {
          xhr.setRequestHeader('X-CSRF-Token', csrfToken)
        }
        
        xhr.responseType = 'text'
        
        let fullContent = ''
        let buffer = ''
        
        xhr.onprogress = () => {
          const responseText = xhr.responseText
          const newData = responseText.substring(buffer.length)
          buffer = responseText
          
          if (newData) {
            const lines = newData.split('\n')
            
            for (const line of lines) {
              const trimmedLine = line.trim()
              if (trimmedLine.startsWith('data: ')) {
                const dataStr = trimmedLine.substring(6)
                if (dataStr) {
                  try {
                    const data = JSON.parse(dataStr)
                    if (data.content) {
                      fullContent += data.content
                      onChunk?.(data.content)
                    }
                    if (data.done) {
                      onDone?.()
                    }
                  } catch (error) {
                    console.error('解析SSE数据失败:', error)
                  }
                }
              }
            }
          }
        }
        
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(fullContent)
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText)
              reject(new Error(errorData.message || `请求失败: ${xhr.status}`))
            } catch {
              reject(new Error(`请求失败: ${xhr.status}`))
            }
          }
        }
        
        xhr.onerror = () => {
          reject(new Error('网络错误，请检查网络连接'))
        }
        
        xhr.send(JSON.stringify({
          type,
          prompt,
          platform,
          model,
          apiKey: aiConfig?.apiKey || '',
          customBaseURL: aiConfig?.customBaseURL || ''
        }))
      }).catch(() => {
        reject(new Error('获取CSRF Token失败'))
      })
    })
  },

  generateOutline: async (
    novelType: string, 
    corePlot: string, 
    length: string,
    onChunk?: (chunk: string) => void,
    onDone?: () => void,
    aiConfig?: AIRequestConfig
  ): Promise<string> => {
    const platform = aiConfig?.platform || localStorage.getItem('aiPlatform') || 'aliyun'
    const model = aiConfig?.model || localStorage.getItem('aiModel') || 'qwen3.5-plus'
    
    return new Promise((resolve, reject) => {
      getCsrfToken().then(csrfToken => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', buildApiUrl('/ai/outline'))
        xhr.setRequestHeader('Content-Type', 'application/json')
        
        const token = localStorage.getItem('token')
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        }
        
        if (csrfToken) {
          xhr.setRequestHeader('X-CSRF-Token', csrfToken)
        }
        
        xhr.responseType = 'text'
        
        let fullContent = ''
        let buffer = ''
        
        xhr.onprogress = () => {
          const responseText = xhr.responseText
          const newData = responseText.substring(buffer.length)
          buffer = responseText
          
          if (newData) {
            const lines = newData.split('\n')
            
            for (const line of lines) {
              const trimmedLine = line.trim()
              if (trimmedLine.startsWith('data: ')) {
                const dataStr = trimmedLine.substring(6)
                if (dataStr) {
                  try {
                    const data = JSON.parse(dataStr)
                    if (data.content) {
                      fullContent += data.content
                      onChunk?.(data.content)
                    }
                    if (data.done) {
                      onDone?.()
                    }
                  } catch (error) {
                    console.error('解析SSE数据失败:', error)
                  }
                }
              }
            }
          }
        }
        
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(fullContent)
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText)
              reject(new Error(errorData.message || `请求失败: ${xhr.status}`))
            } catch {
              reject(new Error(`请求失败: ${xhr.status}`))
            }
          }
        }
        
        xhr.onerror = () => {
          reject(new Error('网络错误，请检查网络连接'))
        }
        
        xhr.send(JSON.stringify({
          novelType,
          corePlot,
          length,
          platform,
          model,
          apiKey: aiConfig?.apiKey || '',
          customBaseURL: aiConfig?.customBaseURL || ''
        }))
      }).catch(() => {
        reject(new Error('获取CSRF Token失败'))
      })
    })
  },

  generateCreative: async (
    prompt: string, 
    type: string,
    onChunk?: (chunk: string) => void,
    onDone?: () => void,
    aiConfig?: AIRequestConfig
  ): Promise<string> => {
    const platform = aiConfig?.platform || localStorage.getItem('aiPlatform') || 'aliyun'
    const model = aiConfig?.model || localStorage.getItem('aiModel') || 'qwen3.5-plus'
    
    return new Promise((resolve, reject) => {
      getCsrfToken().then(csrfToken => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', buildApiUrl('/ai/creative'))
        xhr.setRequestHeader('Content-Type', 'application/json')
        
        const token = localStorage.getItem('token')
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        }
        
        if (csrfToken) {
          xhr.setRequestHeader('X-CSRF-Token', csrfToken)
        }
        
        xhr.responseType = 'text'
        
        let fullContent = ''
        let buffer = ''
        
        xhr.onprogress = () => {
          const responseText = xhr.responseText
          const newData = responseText.substring(buffer.length)
          buffer = responseText
          
          if (newData) {
            const lines = newData.split('\n')
            
            for (const line of lines) {
              const trimmedLine = line.trim()
              if (trimmedLine.startsWith('data: ')) {
                const dataStr = trimmedLine.substring(6)
                if (dataStr) {
                  try {
                    const data = JSON.parse(dataStr)
                    if (data.content) {
                      fullContent += data.content
                      onChunk?.(data.content)
                    }
                    if (data.done) {
                      onDone?.()
                    }
                  } catch (error) {
                    console.error('解析SSE数据失败:', error)
                  }
                }
              }
            }
          }
        }
        
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(fullContent)
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText)
              reject(new Error(errorData.message || `请求失败: ${xhr.status}`))
            } catch {
              reject(new Error(`请求失败: ${xhr.status}`))
            }
          }
        }
        
        xhr.onerror = () => {
          reject(new Error('网络错误，请检查网络连接'))
        }
        
        xhr.send(JSON.stringify({
          prompt,
          type,
          platform,
          model,
          apiKey: aiConfig?.apiKey || '',
          customBaseURL: aiConfig?.customBaseURL || ''
        }))
      }).catch(() => {
        reject(new Error('获取CSRF Token失败'))
      })
    })
  }
}
