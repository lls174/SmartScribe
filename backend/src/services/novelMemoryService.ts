import { CharacterCard, Novel, NovelSetting } from '../models'

interface NovelMemory {
  novel: Record<string, unknown>
  characters: Array<Record<string, unknown>>
  setting: Record<string, unknown> | null
}

class NovelMemoryService {
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

    const [characters, setting] = await Promise.all([
      CharacterCard.findAll({
        where: { novelId: novel.id, isActive: true },
        order: [['priority', 'DESC'], ['updatedAt', 'DESC']],
        limit: 20
      }),
      NovelSetting.findOne({ where: { novelId: novel.id } })
    ])

    return {
      novel: novel.toJSON(),
      characters: characters.map((card) => card.toJSON()),
      setting: setting ? setting.toJSON() : null
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
