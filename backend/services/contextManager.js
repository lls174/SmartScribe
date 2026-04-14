const aiService = require('./aiService')

class ContextManager {
  constructor() {
    this.MAX_CONTEXT_TOKENS = 6000
    this.CHARS_PER_TOKEN = 1.5
  }

  estimateTokens(text) {
    if (!text) return 0
    return Math.ceil(text.length / this.CHARS_PER_TOKEN)
  }

  truncateToTokenLimit(text, maxTokens) {
    if (!text) return ''
    const maxChars = Math.floor(maxTokens * this.CHARS_PER_TOKEN)
    if (text.length <= maxChars) return text
    return text.substring(0, maxChars) + '...(内容已截断)'
  }

  buildNovelContext(novelMeta, chapters, currentChapterId) {
    const parts = []

    if (novelMeta) {
      parts.push({
        priority: 10,
        content: this.formatNovelMeta(novelMeta),
        label: '小说元信息'
      })
    }

    if (chapters && chapters.length > 0) {
      const currentIndex = chapters.findIndex(c => c.id === currentChapterId)
      
      for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i]
        const isCurrent = chapter.id === currentChapterId
        const isRecent = Math.abs(i - currentIndex) <= 1 && currentIndex >= 0

        if (isCurrent) {
          parts.push({
            priority: 9,
            content: this.formatChapterFull(chapter, i),
            label: `当前章节(第${i + 1}章)`
          })
        } else if (isRecent) {
          parts.push({
            priority: 7,
            content: this.formatChapterSummary(chapter, i),
            label: `相邻章节(第${i + 1}章)`
          })
        } else {
          parts.push({
            priority: 3,
            content: this.formatChapterOutline(chapter, i),
            label: `远距章节(第${i + 1}章)`
          })
        }
      }
    }

    return this.assembleContext(parts)
  }

  assembleContext(parts) {
    parts.sort((a, b) => b.priority - a.priority)

    let context = ''
    let usedTokens = 0
    const reservedTokens = 2000

    for (const part of parts) {
      const partTokens = this.estimateTokens(part.content)
      
      if (usedTokens + partTokens <= this.MAX_CONTEXT_TOKENS - reservedTokens) {
        context += part.content + '\n\n'
        usedTokens += partTokens
      } else {
        const remainingTokens = this.MAX_CONTEXT_TOKENS - reservedTokens - usedTokens
        if (remainingTokens > 100) {
          const truncated = this.truncateToTokenLimit(part.content, remainingTokens)
          context += truncated + '\n\n'
          usedTokens += this.estimateTokens(truncated)
        }
        break
      }
    }

    return context.trim()
  }

  formatNovelMeta(meta) {
    let result = '【小说信息】\n'
    if (meta.name) result += `书名：${meta.name}\n`
    if (meta.description) result += `简介：${meta.description}\n`
    if (meta.genre) result += `题材：${meta.genre}\n`
    if (meta.style) result += `风格：${meta.style}\n`
    if (meta.totalChapters) result += `总章节数：${meta.totalChapters}\n`
    return result
  }

  formatChapterFull(chapter, index) {
    let result = `【第${index + 1}章：${chapter.title || '未命名'}】(当前章节-完整内容)\n`
    result += chapter.content || ''
    if (chapter.plot) {
      result += `\n\n[剧情摘要]${chapter.plot}`
    }
    return result
  }

  formatChapterSummary(chapter, index) {
    let result = `【第${index + 1}章：${chapter.title || '未命名'}】(相邻章节-摘要)\n`
    if (chapter.plot) {
      result += `剧情摘要：${chapter.plot}\n`
    }
    if (chapter.content) {
      const summary = this.extractSummary(chapter.content, 300)
      result += `内容概要：${summary}`
    }
    return result
  }

  formatChapterOutline(chapter, index) {
    let result = `【第${index + 1}章：${chapter.title || '未命名'}】\n`
    if (chapter.plot) {
      result += `剧情：${chapter.plot}`
    } else if (chapter.content) {
      result += `概要：${this.extractSummary(chapter.content, 100)}`
    }
    return result
  }

  extractSummary(text, maxChars) {
    if (!text) return ''
    if (text.length <= maxChars) return text

    const firstParagraph = text.substring(0, Math.floor(maxChars * 0.6))
    const lastParagraph = text.substring(text.length - Math.floor(maxChars * 0.3))
    return firstParagraph + '...中间省略...' + lastParagraph
  }

  buildSystemPrompt(task) {
    const basePrompt = `你是一位专业的网络小说创作智能体。你具备以下核心能力：

1. 【世界观构建】- 创建逻辑自洽、细节丰富的虚构世界
2. 【人物塑造】- 赋予角色独特性格、动机和成长弧线
3. 【情节编织】- 设计引人入胜、张弛有度的故事线
4. 【文笔打磨】- 运用精准、生动的语言表达

创作原则：
- 情节紧凑，避免注水和冗余描写
- 人物行为符合性格设定，拒绝脸谱化
- 场景描写有画面感，调动读者感官
- 对话自然有张力，推动情节发展
- 伏笔与呼应，保持叙事连贯性`

    const taskPrompts = {
      generate: `\n\n当前任务：生成新章节
请根据提供的小说信息和创作要求，生成一个完整的章节。
要求：
- 开头要有吸引力，迅速进入情境
- 中段推进情节，制造冲突或悬念
- 结尾留有钩子，引导读者继续阅读
- 字数符合要求，内容充实不注水`,

      continue: `\n\n当前任务：续写章节
请根据已有内容自然衔接续写，保持风格和叙事连贯。
要求：
- 无缝衔接上文，不重复已写内容
- 推进情节发展，不原地踏步
- 保持人物性格一致性
- 适度引入新元素或转折`,

      polish: `\n\n当前任务：润色内容
请对提供的内容进行文学性润色，提升表达质量。
要求：
- 优化句式结构，增强节奏感
- 丰富描写层次，提升画面感
- 修正逻辑漏洞和不自然表达
- 保持原文核心内容和风格不变`,

      outline: `\n\n当前任务：生成小说大纲
请根据提供的核心信息，生成结构完整的大纲。
要求：
- 明确主线和支线
- 标注关键转折点
- 规划人物成长弧线
- 控制节奏张弛有度`
    }

    return basePrompt + (taskPrompts[task] || '')
  }

  buildGenerationPrompt(params) {
    const { genre, style, corePlot, characters, wordCount, chapterTitle, other } = params
    let prompt = ''

    if (chapterTitle) prompt += `章节标题：${chapterTitle}\n`
    if (genre) prompt += `题材：${genre}\n`
    if (style) prompt += `风格：${style}\n`
    if (corePlot) prompt += `核心剧情：${corePlot}\n`
    if (characters) prompt += `登场人物：${characters}\n`
    if (wordCount) prompt += `目标字数：约${wordCount}字\n`
    if (other) prompt += `附加要求：${other}\n`

    return prompt
  }

  buildContinuePrompt(params) {
    const { customPrompt, wordCount } = params
    let prompt = '请自然衔接上文内容进行续写。\n'
    if (customPrompt) prompt += `续写方向：${customPrompt}\n`
    if (wordCount) prompt += `续写字数：约${wordCount}字\n`
    prompt += '注意：不要重复已有内容，直接从衔接点开始续写。'
    return prompt
  }

  buildPolishPrompt(params) {
    const { customPrompt } = params
    let prompt = '请对以下内容进行润色优化。\n'
    if (customPrompt) prompt += `润色方向：${customPrompt}\n`
    prompt += '注意：保持原文核心情节和风格不变，仅优化表达质量。'
    return prompt
  }
}

module.exports = new ContextManager()
