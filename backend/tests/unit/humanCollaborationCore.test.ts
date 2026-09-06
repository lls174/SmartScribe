import type { CharacterCard, Novel, NovelSetting } from '../../src/models'
import { parseAgentJson, validateAgentResult } from '../../src/services/agentSchemas'
import { calculateGuideStatus, getNextAction, resolveStage } from '../../src/services/guideEngine'
import { buildJsonModeRequestBody } from '../../src/services/aiService'

describe('人机协作 Phase 1-3 核心', () => {
  test('向导阶段默认向前推进且允许显式回退', () => {
    expect(resolveStage('characters')).toBe('outline')
    expect(resolveStage('writing')).toBe('writing')
    expect(resolveStage('writing', 'worldview')).toBe('worldview')
    expect(getNextAction('inspiration').step).toBe('worldview')
    expect(getNextAction('writing').step).toBe('writing')
  })

  test('完备度只统计已确认设定和人物', () => {
    const novel = {
      creationStage: 'characters',
      description: '少年寻找失落城邦',
      completeness: 0,
      update: jest.fn()
    } as unknown as Novel
    const setting = {
      reviewStatus: 'confirmed',
      worldview: '群岛世界',
      genreStyle: '冒险',
      powerSystem: '潮汐术',
      taboos: '不可复活',
      styleGuide: null,
      overallOutline: '三幕式冒险'
    } as unknown as NovelSetting
    const characters = [{ reviewStatus: 'confirmed' }] as unknown as CharacterCard[]

    const status = calculateGuideStatus(novel, setting, characters)
    expect(status.completeness).toBe(1)
    expect(status.missingItems).toEqual([])
    expect(status.nextAction.step).toBe('outline')
    expect(status.nextAction.aiAction).toBe('propose_outline')
  })

  test('可解析 Markdown 包裹 JSON 并校验审查结构', () => {
    const parsed = parseAgentJson('```json\n{"verdict":"pass","summary":"通过","issues":[]}\n```')
    expect(validateAgentResult('review_chapter', parsed)).toBe(true)
    expect(validateAgentResult('review_summary', { verdict: 'pass', summary: '概括准确', issues: [] })).toBe(true)
  })

  test('校验全量设定与人物字段提案结构', () => {
    expect(validateAgentResult('setting_all', { settings: { worldview: '群岛世界' } })).toBe(true)
    expect(validateAgentResult('character_field', { field: 'personality', content: '谨慎而坚定' })).toBe(true)
  })

  test('仅已知平台启用 JSON mode', () => {
    expect(buildJsonModeRequestBody('deepseek', true)).toEqual({ response_format: { type: 'json_object' } })
    expect(buildJsonModeRequestBody('custom', true)).toEqual({})
    expect(buildJsonModeRequestBody('openai', false)).toEqual({})
  })
})
