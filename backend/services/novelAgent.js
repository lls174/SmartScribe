const aiService = require('./aiService')
const contextManager = require('./contextManager')

class NovelAgent {
  async generateChapter(novelContext, userPrompt, platform, model, onChunk, aiOptions) {
    const systemPrompt = contextManager.buildSystemPrompt('generate')
    const taskPrompt = contextManager.buildGenerationPrompt(userPrompt)
    const fullPrompt = this.composePrompt(systemPrompt, novelContext, taskPrompt)

    const content = await aiService.generateContent(fullPrompt, platform, model, onChunk, aiOptions)
    
    let plot = ''
    try {
      plot = await this.generatePlotSummary(content, platform, model, aiOptions)
    } catch (error) {
      console.warn('剧情摘要生成失败，使用本地摘要:', error.message)
      plot = contextManager.extractSummary(content, 200)
    }

    return { content, plot }
  }

  async continueChapter(novelContext, userPrompt, platform, model, onChunk, aiOptions) {
    const systemPrompt = contextManager.buildSystemPrompt('continue')
    const taskPrompt = contextManager.buildContinuePrompt(userPrompt)
    const fullPrompt = this.composePrompt(systemPrompt, novelContext, taskPrompt)

    const content = await aiService.generateContent(fullPrompt, platform, model, onChunk, aiOptions)
    
    let plot = ''
    try {
      plot = await this.generatePlotSummary(content, platform, model, aiOptions)
    } catch (error) {
      console.warn('续写剧情摘要生成失败，使用本地摘要:', error.message)
      plot = contextManager.extractSummary(content, 200)
    }

    return { content, plot }
  }

  async polishChapter(novelContext, userPrompt, platform, model, onChunk, aiOptions) {
    const systemPrompt = contextManager.buildSystemPrompt('polish')
    const taskPrompt = contextManager.buildPolishPrompt(userPrompt)
    const fullPrompt = this.composePrompt(systemPrompt, novelContext, taskPrompt)

    return await aiService.generateContent(fullPrompt, platform, model, onChunk, aiOptions)
  }

  async generateOutline(novelContext, userPrompt, platform, model, onChunk, aiOptions) {
    const systemPrompt = contextManager.buildSystemPrompt('outline')
    const taskPrompt = `请根据以下信息生成小说大纲：\n${userPrompt}`
    const fullPrompt = this.composePrompt(systemPrompt, novelContext, taskPrompt)

    return await aiService.generateContent(fullPrompt, platform, model, onChunk, aiOptions)
  }

  composePrompt(systemPrompt, novelContext, taskPrompt) {
    let prompt = systemPrompt

    if (novelContext && typeof novelContext === 'string' && novelContext.trim()) {
      prompt += '\n\n' + novelContext
    }

    prompt += '\n\n' + taskPrompt

    console.log('NovelAgent - 组合提示词完成, 总长度:', prompt.length, 
      '估算Token:', contextManager.estimateTokens(prompt))

    return prompt
  }

  async generatePlotSummary(content, platform, model, aiOptions) {
    if (!content || content.length < 100) {
      return content ? contextManager.extractSummary(content, 200) : ''
    }

    const summaryPrompt = `请用100-200字概括以下章节的核心剧情，包含关键事件、人物行动和情节转折，用于后续章节续写参考：\n\n${content}`

    try {
      return await aiService.generateContent(summaryPrompt, platform, model, null, aiOptions)
    } catch (error) {
      console.error('生成剧情摘要失败:', error.message)
      throw error
    }
  }
}

module.exports = new NovelAgent()
