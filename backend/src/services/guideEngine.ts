import type { CreationStage, GuideMissingItem, GuideStatus } from '../../../shared/types'
import { CharacterCard, Novel, NovelSetting } from '../models'

const STAGES: CreationStage[] = ['inspiration', 'worldview', 'characters', 'outline', 'writing']

const STAGE_ACTIONS: Record<CreationStage, GuideStatus['nextAction']> = {
  inspiration: { label: '生成并确认创作灵感', step: 'inspiration', agent: 'inspiration', aiAction: 'propose_inspiration' },
  worldview: { label: '完善并确认世界观', step: 'worldview', agent: 'inspiration', aiAction: 'propose_setting' },
  characters: { label: '创建并确认人物卡', step: 'characters', agent: 'inspiration', aiAction: 'propose_characters' },
  outline: { label: '生成并确认故事大纲', step: 'outline', agent: 'inspiration', aiAction: 'propose_outline' },
  writing: { label: '开始撰写正文', step: 'writing', agent: 'writer', aiAction: 'write_generate' }
}

/** 返回指定阶段的相邻阶段；显式指定时允许用户主动回退。 */
export const resolveStage = (current: CreationStage, requested?: CreationStage): CreationStage => {
  if (requested && STAGES.includes(requested)) return requested
  return STAGES[Math.min(STAGES.indexOf(current) + 1, STAGES.length - 1)]
}

/** 当前阶段对应的下一步建议；写作阶段停在自身，避免越界。 */
export const getNextAction = (stage: CreationStage): GuideStatus['nextAction'] => {
  return STAGE_ACTIONS[resolveStage(stage)]
}

/** 计算向导完备度和软提示，不对写作或阶段推进做硬阻断。 */
export const calculateGuideStatus = (
  novel: Novel,
  setting: NovelSetting | null,
  confirmedCharacters: CharacterCard[]
): GuideStatus => {
  const stage = novel.creationStage as CreationStage
  const missingItems: GuideMissingItem[] = []
  let score = 0

  if (novel.description?.trim()) score += 0.15
  else missingItems.push({ type: 'inspiration', severity: 'warning', message: '尚未确认故事定位或核心梗概' })

  if (setting?.reviewStatus === 'confirmed') {
    if (setting.worldview?.trim()) score += 0.15
    else missingItems.push({ type: 'setting', field: 'worldview', severity: 'warning', message: '世界观尚未填写' })
    if (setting.genreStyle?.trim()) score += 0.1
    else missingItems.push({ type: 'setting', field: 'genreStyle', severity: 'info', message: '题材与风格尚未填写' })
    if (setting.powerSystem?.trim()) score += 0.05
    else missingItems.push({ type: 'setting', field: 'powerSystem', severity: 'info', message: '力量体系尚未填写' })
    if (setting.taboos?.trim() || setting.styleGuide?.trim()) score += 0.05
  } else {
    missingItems.push({ type: 'setting', severity: 'warning', message: '小说设定尚未人工确认' })
  }

  if (confirmedCharacters.length > 0) score += 0.25
  else missingItems.push({ type: 'character', severity: 'warning', message: '建议至少确认 1 张主要人物卡' })

  if (setting?.reviewStatus === 'confirmed' && setting.overallOutline?.trim()) score += 0.25
  else missingItems.push({ type: 'outline', severity: 'warning', message: '整体大纲尚未确认' })

  const completeness = Math.min(1, Number(score.toFixed(2)))
  return {
    stage,
    completeness,
    missingItems,
    nextAction: getNextAction(stage),
    warnings: missingItems.filter((item) => item.severity === 'warning').map((item) => item.message)
  }
}

/** 从数据库读取并缓存小说当前向导状态。 */
export const getGuideStatus = async (novel: Novel): Promise<GuideStatus> => {
  const [setting, characters] = await Promise.all([
    NovelSetting.findOne({ where: { novelId: novel.id } }),
    CharacterCard.findAll({ where: { novelId: novel.id, reviewStatus: 'confirmed' } })
  ])
  const status = calculateGuideStatus(novel, setting, characters)
  if (novel.completeness !== status.completeness) {
    await novel.update({ completeness: status.completeness })
  }
  return status
}
