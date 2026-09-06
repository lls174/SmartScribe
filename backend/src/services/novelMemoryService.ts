import type { AgentRole, ConfirmedContext } from '../../../shared/types'
import { CharacterCard, Chapter, Novel, NovelSetting } from '../models'

interface NovelMemory {
  novel: Record<string, unknown>
  characters: Array<Record<string, unknown>>
  setting: Record<string, unknown> | null
  chapters: Array<Record<string, unknown>>
}

class NovelMemoryService {
  /** 按智能体角色读取已确认记忆，严格排除未采纳提案。 */
  async getConfirmedContext(novelId: number | string, userId: number, agentRole: AgentRole): Promise<ConfirmedContext | null> {
    const parsedNovelId = parseInt(String(novelId), 10)
    if (!Number.isFinite(parsedNovelId)) return null

    const novel = await Novel.findOne({ where: { id: parsedNovelId, userId, isDeleted: false } })
    if (!novel) return null

    const characterWhere: { novelId: number; reviewStatus: 'confirmed'; isActive?: boolean } = {
      novelId: novel.id,
      reviewStatus: 'confirmed'
    }
    if (agentRole === 'writer') characterWhere.isActive = true

    const [characters, setting, chapters] = await Promise.all([
      CharacterCard.findAll({ where: characterWhere, order: [['priority', 'DESC'], ['updatedAt', 'DESC']], limit: 20 }),
      NovelSetting.findOne({ where: { novelId: novel.id, reviewStatus: 'confirmed' } }),
      Chapter.findAll({
        where: { novelId: novel.id, isDeleted: false },
        order: [['order', 'ASC']],
        attributes: ['id', 'title', 'order', 'outline', 'plot', 'stalePlot']
      })
    ])

    const settingJson = setting?.toJSON() as Record<string, unknown> | undefined
    const settingFields = ['worldview', 'genreStyle', 'powerSystem', 'timeline', 'plotRules', 'taboos', 'styleGuide', 'notes'] as const
    const settings = Object.fromEntries(settingFields.flatMap((field) => {
      const value = settingJson?.[field]
      return typeof value === 'string' && value.trim() ? [[field, value]] : []
    }))

    return {
      novel: {
        id: novel.id,
        name: novel.name,
        description: novel.description,
        creationStage: novel.creationStage
      },
      settings,
      characters: characters.map((card) => ({
        id: card.id,
        name: card.name,
        role: card.role,
        identity: card.identity,
        personality: card.personality,
        appearance: card.appearance,
        relationship: card.relationship,
        secret: card.secret,
        arc: card.arc,
        priority: card.priority,
        isActive: card.isActive
      })),
      outline: setting?.overallOutline || undefined,
      chapterOutlines: chapters
        .filter((chapter) => Boolean(chapter.outline?.trim()))
        .map((chapter) => ({ id: chapter.id, title: chapter.title, order: chapter.order, outline: chapter.outline })),
      chapterSummaries: chapters
        .filter((chapter) => Boolean(chapter.plot?.trim()))
        .map((chapter) => ({ id: chapter.id, title: chapter.title, order: chapter.order, plot: chapter.plot, stalePlot: chapter.stalePlot }))
    }
  }

  /** 将 confirmed 上下文格式化为 Prompt 可读文本。 */
  formatConfirmedContext(context: ConfirmedContext | null): string {
    if (!context) return ''
    const sections = [
      `【小说】${context.novel.name}${context.novel.description ? `\n${context.novel.description}` : ''}`,
      Object.keys(context.settings).length ? `【已确认设定】\n${JSON.stringify(context.settings, null, 2)}` : '',
      context.characters.length ? `【已确认人物】\n${JSON.stringify(context.characters, null, 2)}` : '',
      context.outline ? `【整体大纲】\n${context.outline}` : '',
      context.chapterSummaries.length ? `【章节概括链】\n${JSON.stringify(context.chapterSummaries, null, 2)}` : ''
    ]
    return sections.filter(Boolean).join('\n\n')
  }

  async getNovelMemory(novelId: number | string, userId: number): Promise<NovelMemory | null> {
    const parsedNovelId = parseInt(String(novelId), 10)
    if (!Number.isFinite(parsedNovelId)) {
      return null
    }

    const novel = await Novel.findOne({
      where: { id: parsedNovelId, userId, isDeleted: false }
    })

    if (!novel) {
      return null
    }

    const [characters, setting, chapters] = await Promise.all([
      CharacterCard.findAll({
        where: { novelId: novel.id, isActive: true },
        order: [['priority', 'DESC'], ['updatedAt', 'DESC']],
        limit: 20
      }),
      NovelSetting.findOne({ where: { novelId: novel.id } }),
      Chapter.findAll({
        where: { novelId: novel.id, isDeleted: false },
        order: [['order', 'ASC']],
        attributes: ['title', 'outline', 'order']
      })
    ])

    return {
      novel: novel.toJSON(),
      characters: characters.map((card) => card.toJSON()),
      setting: setting ? setting.toJSON() : null,
      chapters: chapters.map((chapter) => chapter.toJSON())
    }
  }

  formatNovelMemory(memory: NovelMemory | null): string {
    if (!memory) {
      return ''
    }

    const sections: string[] = []
    const setting = memory.setting

    if (setting) {
      const settingLines = [
        ['世界观', setting.worldview],
        ['题材与风格', setting.genreStyle],
        ['力量/能力体系', setting.powerSystem],
        ['时间线', setting.timeline],
        ['剧情规则', setting.plotRules],
        ['禁忌与雷区', setting.taboos],
        ['文风指南', setting.styleGuide],
        ['补充备注', setting.notes]
      ]
        .filter(([, value]) => value && String(value).trim())
        .map(([label, value]) => `${label}：${value}`)

      if (settingLines.length) {
        sections.push(`【内容设定】\n${settingLines.join('\n')}`)
      }

      if (setting.overallOutline && String(setting.overallOutline).trim()) {
        sections.push(`【整体大纲】\n${String(setting.overallOutline).trim()}`)
      }
    }

    if (memory.chapters?.length) {
      const chapterOutlineLines = memory.chapters
        .filter((chapter) => chapter.outline && String(chapter.outline).trim())
        .map((chapter, index) => {
          const title = chapter.title ? String(chapter.title) : `第${index + 1}章`
          return `${index + 1}. ${title}\n${String(chapter.outline).trim()}`
        })

      if (chapterOutlineLines.length) {
        sections.push(`【章节大纲】\n${chapterOutlineLines.join('\n\n')}`)
      }
    }

    if (memory.characters.length) {
      const characterLines = memory.characters.map((card, index) => {
        const details = [
          card.role ? `定位：${card.role}` : '',
          card.identity ? `身份：${card.identity}` : '',
          card.personality ? `性格：${card.personality}` : '',
          card.appearance ? `外貌：${card.appearance}` : '',
          card.relationship ? `关系：${card.relationship}` : '',
          card.secret ? `秘密：${card.secret}` : '',
          card.arc ? `成长线：${card.arc}` : '',
          card.notes ? `备注：${card.notes}` : ''
        ].filter(Boolean)

        return `${index + 1}. ${String(card.name)}${details.length ? `\n${details.join('\n')}` : ''}`
      })

      sections.push(`【人物卡】\n${characterLines.join('\n\n')}`)
    }

    return sections.join('\n\n')
  }
}

export default new NovelMemoryService()
