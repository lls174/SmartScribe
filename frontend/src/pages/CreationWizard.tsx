import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Button, Card, Input, Space, Spin, Typography, message } from 'antd'
import { ArrowLeftOutlined, EditOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import GuideProgress from '@components/GuideProgress'
import InspirationStep from '@components/guide/InspirationStep'
import WorldviewStep from '@components/guide/WorldviewStep'
import CharactersStep from '@components/guide/CharactersStep'
import NovelOutlinePanel from '@components/NovelOutlinePanel'
import { novelService, type CharacterCardPayload, type NovelSettingPayload } from '@services/novelService'
import { aiService } from '@services/aiService'
import { useRequireAuth } from '@hooks/useRequireAuth'
import { getApiErrorMessage } from '@utils/index'
import type { CharacterCard, Chapter, Novel, NovelSetting } from '@app-types/index'
import type { CreationStage, GuideStatus, InspirationProposal } from '@/types/collaboration'
import '@styles/CreationWizard.css'

const { Title, Paragraph, Text } = Typography

const EMPTY_STATUS: GuideStatus = {
  stage: 'inspiration',
  completeness: 0,
  missingItems: []
}

/** 创作向导页面，负责串联五阶段数据；各智能体输出只有经用户确认后才写入小说。 */
export default function CreationWizard() {
  const { id } = useParams<{ id: string }>()
  const novelId = Number(id)
  const navigate = useNavigate()
  const { isReady } = useRequireAuth()
  const [loading, setLoading] = useState(true)
  const [novel, setNovel] = useState<Novel | null>(null)
  const [status, setStatus] = useState<GuideStatus>(EMPTY_STATUS)
  const [setting, setSetting] = useState<NovelSetting | null>(null)
  const [cards, setCards] = useState<CharacterCard[]>([])
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [proposals, setProposals] = useState<InspirationProposal[]>([])
  const [proposalLoading, setProposalLoading] = useState(false)
  const [proposalError, setProposalError] = useState('')
  const [outlineHint, setOutlineHint] = useState('')
  const [outlineGenerating, setOutlineGenerating] = useState(false)
  const refreshSequenceRef = useRef(0)

  /** 并行刷新向导所需数据，并丢弃过期请求结果。 */
  const refresh = useCallback(async () => {
    if (!novelId) return
    const sequence = ++refreshSequenceRef.current
    const [novelData, guideData, settingData, cardData, chapterData] = await Promise.all([
      novelService.getNovel(novelId),
      novelService.getGuideStatus(novelId),
      novelService.getNovelSetting(novelId),
      novelService.getCharacterCards(novelId),
      novelService.getChapters(novelId)
    ])
    if (sequence !== refreshSequenceRef.current) return
    setNovel(novelData)
    setStatus(guideData)
    setSetting(settingData)
    setCards(cardData)
    setChapters(chapterData)
  }, [novelId])

  useEffect(() => {
    if (!isReady || !novelId) return
    setLoading(true)
    refresh()
      .catch((error) => message.error(getApiErrorMessage(error, '加载创作向导失败')))
      .finally(() => setLoading(false))
  }, [isReady, novelId, refresh])

  useEffect(() => {
    return () => {
      refreshSequenceRef.current += 1
      aiService.cancelRequest(`inspiration-${novelId}`)
      aiService.cancelRequest(`characters-${novelId}`)
      aiService.cancelRequest(`outline-${novelId}`)
    }
  }, [novelId])

  /** 用户可自由切换阶段，后端只记录焦点步骤而不做硬阻断。 */
  const changeStage = async (stage: CreationStage) => {
    try {
      setStatus(await novelService.advanceStage(novelId, stage))
    } catch (error) {
      message.error(getApiErrorMessage(error, '切换创作阶段失败'))
    }
  }

  /** 前往建议的下一步；已在写作阶段则进入写作台，避免原地空跳。 */
  const goToNextAction = () => {
    if (status.stage === 'writing') {
      navigate(`/novel/${novelId}`)
      return
    }
    const order: CreationStage[] = ['inspiration', 'worldview', 'characters', 'outline', 'writing']
    const suggested = status.nextAction?.step
    const next = suggested && suggested !== status.stage
      ? suggested
      : order[Math.min(order.indexOf(status.stage) + 1, order.length - 1)]
    void changeStage(next)
  }

  /** 请求灵感智能体生成多套候选定位。 */
  const generateInspiration = async (input: { keywords: string; length: string }) => {
    try {
      setProposalLoading(true)
      setProposalError('')
      setProposals(await aiService.proposeInspiration(novelId, input))
    } catch (error) {
      setProposalError(error instanceof Error ? error.message : '灵感提案失败')
    } finally {
      setProposalLoading(false)
    }
  }

  /** 仅在用户点击采纳后，把标题和梗概写入 confirmed 数据。 */
  const adoptInspiration = async (proposal: InspirationProposal) => {
    try {
      setStatus(await novelService.confirmInspiration(novelId, proposal))
      message.success('灵感方案已确认，接下来完善世界观')
      await refresh()
      await changeStage('worldview')
    } catch (error) {
      message.error(getApiErrorMessage(error, '采纳灵感方案失败'))
    }
  }

  /** 保存人工审核后的设定，并推进到人物步骤。 */
  const saveSetting = async (values: NovelSettingPayload) => {
    const updated = await novelService.updateNovelSetting(novelId, values)
    setSetting(updated)
    const field: keyof NovelSettingPayload = values.worldview ? 'worldview' : 'genreStyle'
    await novelService.confirmField(novelId, {
      targetType: 'setting',
      field: String(field),
      value: String(values[field] || '')
    })
    await refresh()
    await changeStage('characters')
  }

  /** 将审核后的 AI 人物提案保存为正式人物卡。 */
  const createCharacter = async (payload: CharacterCardPayload) => {
    await novelService.createCharacterCard(novelId, { ...payload, reviewStatus: 'confirmed' } as CharacterCardPayload)
    await refresh()
  }

  /** 更新已有人物卡并刷新完备度。 */
  const updateCharacter = async (cardId: number, payload: CharacterCardPayload) => {
    await novelService.updateCharacterCard(novelId, cardId, { ...payload, reviewStatus: 'confirmed' } as CharacterCardPayload)
    await refresh()
  }

  /** 基于 confirmed 上下文生成整体大纲草稿，不自动定稿。 */
  const generateOutline = async () => {
    try {
      setOutlineGenerating(true)
      const overallOutline = await aiService.proposeOutline(novelId, outlineHint)
      const updated = await novelService.updateNovelSetting(novelId, { overallOutline })
      setSetting(updated)
      message.success('大纲草稿已填入，请继续人工审核并保存')
    } catch (error) {
      message.error(error instanceof Error ? error.message : '生成大纲失败')
    } finally {
      setOutlineGenerating(false)
    }
  }

  if (loading) {
    return <div className="creation-wizard creation-wizard--loading"><Spin size="large" /></div>
  }

  /** 根据当前阶段渲染对应工作区，避免同时挂载全部大型表单。 */
  const renderStep = () => {
    switch (status.stage) {
      case 'inspiration':
        return (
          <InspirationStep
            loading={proposalLoading}
            proposals={proposals}
            error={proposalError}
            onGenerate={generateInspiration}
            onAdopt={adoptInspiration}
          />
        )
      case 'worldview':
        return (
          <WorldviewStep
            setting={setting}
            onSave={saveSetting}
            onProposeField={(field, currentValue) => aiService.proposeSetting(novelId, field, currentValue)}
            onProposeAll={() => aiService.proposeAllSettings(novelId)}
          />
        )
      case 'characters':
        return (
          <CharactersStep
            cards={cards}
            onGenerate={(hint) => aiService.proposeCharacters(novelId, hint)}
            onGenerateField={(field, draft) => aiService.proposeCharacterField(novelId, field, draft)}
            onCreate={createCharacter}
            onUpdate={updateCharacter}
          />
        )
      case 'outline':
        return (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Card title="灵感智能体生成整体大纲">
              <Space.Compact style={{ width: '100%' }}>
                <Input value={outlineHint} onChange={(event) => setOutlineHint(event.target.value)} placeholder="可选：希望加强的主线、节奏或结局方向" />
                <Button type="primary" icon={<ThunderboltOutlined />} loading={outlineGenerating} onClick={generateOutline}>生成草稿</Button>
              </Space.Compact>
            </Card>
            <NovelOutlinePanel
              novelId={novelId}
              novelName={novel?.name}
              chapters={chapters}
              novelSetting={setting}
              onSettingUpdated={(updated) => {
                setSetting(updated)
                if (updated.overallOutline?.trim()) void changeStage('writing')
              }}
              onChaptersUpdated={refresh}
            />
          </Space>
        )
      case 'writing':
        return (
          <Card className="creation-wizard__ready">
            <EditOutlined className="creation-wizard__ready-icon" />
            <Title level={3}>设定已经可以支持写作</Title>
            <Paragraph>写作智能体会读取已确认的人物卡、世界观、大纲和之前章节概括。生成后仍由您终审。</Paragraph>
            <Button type="primary" size="large" onClick={() => navigate(`/novel/${novelId}`)}>进入写作台</Button>
          </Card>
        )
    }
  }

  return (
    <div className="creation-wizard">
      <div className="creation-wizard__header">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/creation')}>返回小说列表</Button>
        <div>
          <Title level={2}>{novel?.name || '创作向导'}</Title>
          <Text type="secondary">AI 提案，人类审核；所有步骤都可跳过或返回修改。</Text>
        </div>
      </div>
      <GuideProgress status={status} onStageChange={changeStage} />
      {status.completeness < 0.3 && status.stage === 'writing' && (
        <Alert type="error" showIcon message="当前设定较少，正文可能出现人物或世界观漂移，但仍可继续。" />
      )}
      <section className="creation-wizard__content">{renderStep()}</section>
      {status.nextAction && (
        <div className="creation-wizard__next">
          <Text>建议下一步：{status.nextAction.label}</Text>
          <Button type="primary" onClick={goToNextAction}>前往</Button>
        </div>
      )}
    </div>
  )
}
