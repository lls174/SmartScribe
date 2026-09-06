import { useState } from 'react'
import { Button, Card, Col, Empty, Form, Input, InputNumber, List, Modal, Row, Space, Switch, Tag, message } from 'antd'
import { PlusOutlined, ThunderboltOutlined } from '@ant-design/icons'
import type { CharacterCard } from '@app-types/index'
import type { CharacterCardPayload } from '@services/novelService'
import type { CharacterProposal } from '@/types/collaboration'

interface CharactersStepProps {
  cards: CharacterCard[]
  onGenerate: (hint: string) => Promise<CharacterProposal[]>
  onGenerateField: (field: string, draft: CharacterCardPayload) => Promise<string>
  onCreate: (payload: CharacterCardPayload) => Promise<void>
  onUpdate: (cardId: number, payload: CharacterCardPayload) => Promise<void>
}

/** 人物体系步骤：AI 推荐角色后仍需用户逐张采纳，避免未经审核写入记忆库。 */
export default function CharactersStep({ cards, onGenerate, onGenerateField, onCreate, onUpdate }: CharactersStepProps) {
  const [form] = Form.useForm<CharacterCardPayload>()
  const [hint, setHint] = useState('')
  const [proposals, setProposals] = useState<CharacterProposal[]>([])
  const [generating, setGenerating] = useState(false)
  const [editing, setEditing] = useState<CharacterCard | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [generatingField, setGeneratingField] = useState<string>()

  const generate = async () => {
    try {
      setGenerating(true)
      setProposals(await onGenerate(hint))
    } catch (error) {
      message.error(error instanceof Error ? error.message : '生成人物失败')
    } finally {
      setGenerating(false)
    }
  }

  const openProposal = (proposal?: CharacterProposal, card?: CharacterCard) => {
    setEditing(card || null)
    form.resetFields()
    form.setFieldsValue(card || {
      ...proposal,
      priority: proposal?.priority || 5,
      isActive: true
    })
    setModalOpen(true)
  }

  const save = async () => {
    const values = await form.validateFields()
    if (editing) await onUpdate(editing.id, values)
    else await onCreate(values)
    setModalOpen(false)
    message.success(editing ? '人物卡已更新并确认' : '人物卡已采纳')
  }

  const generateField = async (field: keyof CharacterCardPayload) => {
    try {
      setGeneratingField(String(field))
      const content = await onGenerateField(String(field), form.getFieldsValue())
      form.setFieldValue(field, content)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '补全人物字段失败')
    } finally {
      setGeneratingField(undefined)
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title="让灵感智能体推荐角色阵容">
        <Space.Compact style={{ width: '100%' }}>
          <Input
            value={hint}
            onChange={(event) => setHint(event.target.value)}
            placeholder="可选：例如需要一位表面盟友、实际反派的女配角"
          />
          <Button type="primary" icon={<ThunderboltOutlined />} loading={generating} onClick={generate}>
            AI 生成人物
          </Button>
        </Space.Compact>
        <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
          {proposals.map((proposal, index) => (
            <Col xs={24} lg={12} key={`${proposal.name}-${index}`}>
              <Card size="small" title={proposal.name} extra={<Tag>{proposal.role || '待定位'}</Tag>}>
                <p>{proposal.identity}</p>
                <p>{proposal.personality}</p>
                {proposal.reasoning && <p className="guide-muted">推荐理由：{proposal.reasoning}</p>}
                <Button type="primary" onClick={() => openProposal(proposal)}>审核并采纳</Button>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Card
        title={`已确认人物卡（${cards.length}）`}
        extra={<Button icon={<PlusOutlined />} onClick={() => openProposal()}>手动新增</Button>}
      >
        <List
          dataSource={cards}
          locale={{ emptyText: <Empty description="建议先建立主角和关键冲突角色" /> }}
          renderItem={(card) => (
            <List.Item actions={[<Button key="edit" type="link" onClick={() => openProposal(undefined, card)}>编辑</Button>]}>
              <List.Item.Meta
                title={<Space><span>{card.name}</span><Tag>{card.role || '未分类'}</Tag></Space>}
                description={`${card.identity || '身份待补充'} · ${card.personality || '性格待补充'}`}
              />
            </List.Item>
          )}
        />
      </Card>

      <Modal
        title={editing ? '审核人物卡' : '采纳人物卡'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={save}
        okText="确认保存"
        width={720}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} md={12}><Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}><Input /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="role" label="角色定位"><Input /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="identity" label="身份"><Input /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item name="priority" label="优先级"><InputNumber min={1} max={10} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item name="isActive" label="启用" valuePropName="checked"><Switch /></Form.Item></Col>
            {(['personality', 'appearance', 'relationship', 'secret', 'arc', 'notes'] as const).map((name) => (
              <Col xs={24} md={12} key={name}>
                <Form.Item
                  name={name}
                  label={(
                    <Space>
                      <span>{{ personality: '性格', appearance: '外貌', relationship: '人物关系', secret: '秘密/动机', arc: '成长线', notes: '备注' }[name]}</span>
                      <Button
                        type="link"
                        size="small"
                        loading={generatingField === name}
                        onClick={() => generateField(name)}
                      >
                        AI 补全
                      </Button>
                    </Space>
                  )}
                >
                  <Input.TextArea rows={3} />
                </Form.Item>
              </Col>
            ))}
          </Row>
        </Form>
      </Modal>
    </Space>
  )
}
