const aiService = require('./aiService')
const contextManager = require('./contextManager')

class NovelAgent {
  combineUsage(...results) {
    const usageItems = results.map((result) => result?.usage).filter(Boolean)
    if (!usageItems.length) {
      return null
    }

    return usageItems.reduce((total, usage) => ({
      promptTokens: total.promptTokens + usage.promptTokens,
      completionTokens: total.completionTokens + usage.completionTokens,
      totalTokens: total.totalTokens + usage.totalTokens,
      isEstimated: total.isEstimated || usage.isEstimated
    }), {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      isEstimated: false
    })
  }

  async generateChapter(novelContext, userPrompt, platform, model, onChunk, aiOptions) {
    const systemPrompt = contextManager.buildSystemPrompt('generate')
    const taskPrompt = contextManager.buildGenerationPrompt(userPrompt)
    const fullPrompt = this.composeAgentPrompt({
      task: 'generate',
      systemPrompt,
      novelContext,
      taskPrompt
    })

    const contentResult = await aiService.generateContent(fullPrompt, platform, model, onChunk, aiOptions)
    const content = contentResult.content
    
    let plot = ''
    let plotResult = null
    try {
      plotResult = await this.generatePlotSummary(content, platform, model, aiOptions)
      plot = plotResult.content
    } catch (error) {
      console.warn('剧情摘要生成失败，使用本地摘要:', error.message)
      plot = contextManager.extractSummary(content, 200)
    }

    return { content, plot, usage: this.combineUsage(contentResult, plotResult) }
  }

  async continueChapter(novelContext, userPrompt, platform, model, onChunk, aiOptions) {
    const systemPrompt = contextManager.buildSystemPrompt('continue')
    const taskPrompt = contextManager.buildContinuePrompt(userPrompt)
    const fullPrompt = this.composeAgentPrompt({
      task: 'continue',
      systemPrompt,
      novelContext,
      taskPrompt
    })

    const contentResult = await aiService.generateContent(fullPrompt, platform, model, onChunk, aiOptions)
    const content = contentResult.content
    
    let plot = ''
    let plotResult = null
    try {
      plotResult = await this.generatePlotSummary(content, platform, model, aiOptions)
      plot = plotResult.content
    } catch (error) {
      console.warn('续写剧情摘要生成失败，使用本地摘要:', error.message)
      plot = contextManager.extractSummary(content, 200)
    }

    return { content, plot, usage: this.combineUsage(contentResult, plotResult) }
  }

  async polishChapter(novelContext, userPrompt, platform, model, onChunk, aiOptions) {
    const systemPrompt = contextManager.buildSystemPrompt('polish')
    const taskPrompt = contextManager.buildPolishPrompt(userPrompt)
    const fullPrompt = this.composeAgentPrompt({
      task: 'polish',
      systemPrompt,
      novelContext,
      taskPrompt
    })

    return await aiService.generateContent(fullPrompt, platform, model, onChunk, aiOptions)
  }

  async generateOutline(novelContext, userPrompt, platform, model, onChunk, aiOptions) {
    const systemPrompt = contextManager.buildSystemPrompt('outline')
    const taskPrompt = `请根据以下信息生成小说大纲：\n${userPrompt}`
    const fullPrompt = this.composeAgentPrompt({
      task: 'outline',
      systemPrompt,
      novelContext,
      taskPrompt
    })

    return await aiService.generateContent(fullPrompt, platform, model, onChunk, aiOptions)
  }

  assembleMemoryContext(novelContext) {
    if (!novelContext || !novelContext.trim()) {
      return ''
    }

    return `【记忆管理器】\n以下为本次创作必须遵守的小说记忆、人物卡、内容设定和章节上下文。请优先保持人物动机、关系、世界规则、时间线一致。\n\n${novelContext}`
  }

  planWritingTask(task, taskPrompt) {
    const taskNameMap = {
      generate: '新章节生成',
      continue: '章节续写',
      polish: '内容润色',
      outline: '大纲规划'
    }

    return `【分层规划器】\n任务类型：${taskNameMap[task] || '创作任务'}\n请在内心先完成以下规划，再直接输出最终正文，不要输出规划过程：\n1. 明确本次场景目标、冲突来源、情绪曲线和信息揭示点。\n2. 从人物卡中筛选相关角色，确保语言、行为和成长线一致。\n3. 从内容设定中筛选世界规则、禁忌和文风约束，避免自相矛盾。\n4. 生成时保持网文节奏：开头有钩子，中段有推进，结尾有期待。\n\n【用户创作要求】\n${taskPrompt}`
  }

  buildReviewGuidance(task) {
    const common = [
      '输出前进行一致性自检：人物称呼、能力边界、关系状态、时间顺序不得与记忆冲突。',
      '避免复述设定原文，设定应自然体现在情节、动作和对话里。',
      '避免水文、重复句式和无意义心理描写。'
    ]

    if (task === 'polish') {
      common.push('润色必须保留原文事实和剧情走向，不新增重大设定。')
    }

    return `【一致性审校器】\n${common.map((item, index) => `${index + 1}. ${item}`).join('\n')}`
  }

  composeAgentPrompt({ task, systemPrompt, novelContext, taskPrompt }) {
    const memoryContext = this.assembleMemoryContext(novelContext)
    const planningPrompt = this.planWritingTask(task, taskPrompt)
    const reviewGuidance = this.buildReviewGuidance(task)

    return this.composePrompt(systemPrompt, memoryContext, `${planningPrompt}\n\n${reviewGuidance}`)
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
      return {
        content: content ? contextManager.extractSummary(content, 200) : '',
        usage: null
      }
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
