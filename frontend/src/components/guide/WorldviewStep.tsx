import { useEffect, useState } from 'react'
import { Button, Col, Form, Input, Row, Space, message } from 'antd'
import { ThunderboltOutlined } from '@ant-design/icons'
import type { NovelSetting } from '@app-types/index'
import type { NovelSettingPayload } from '@services/novelService'

const SETTING_FIELDS: Array<{
  name: keyof NovelSettingPayload
  label: string
  placeholder: string
}> = [
  { name: 'worldview', label: '世界观', placeholder: '世界背景、地域、组织与基础规则' },
  { name: 'genreStyle', label: '题材与风格', placeholder: '题材定位、叙事视角与读者爽点' },
  { name: 'powerSystem', label: '力量/能力体系', placeholder: '能力来源、层级、边界与代价' },
  { name: 'timeline', label: '时间线', placeholder: '关键历史事件与故事当前阶段' },
  { name: 'plotRules', label: '剧情规则', placeholder: '主线方向、必须遵守的逻辑与伏笔' },
  { name: 'taboos', label: '禁忌与雷区', placeholder: '不能出现的桥段、冲突与风格雷区' },
  { name: 'styleGuide', label: '文风指南', placeholder: '句式、节奏、对话比例与描写密度' },
  { name: 'notes', label: '补充备注', placeholder: '其他长期影响生成的设定' }
]

interface WorldviewStepProps {
  setting: NovelSetting | null
  onSave: (values: NovelSettingPayload) => Promise<void>
  onProposeField: (field: string, currentValue: string) => Promise<string>
  onProposeAll: () => Promise<Record<string, string>>
}

/** 世界观逐字段协作表单：AI 只填入草稿，用户确认保存后才进入小说记忆。 */
export default function WorldviewStep({ setting, onSave, onProposeField, onProposeAll }: WorldviewStepProps) {
  const [form] = Form.useForm<NovelSettingPayload>()
  const [saving, setSaving] = useState(false)
  const [generatingField, setGeneratingField] = useState<string>()
  const [generatingAll, setGeneratingAll] = useState(false)

  useEffect(() => {
    form.setFieldsValue(setting || {})
  }, [form, setting])

  const generateField = async (field: keyof NovelSettingPayload) => {
    try {
      setGeneratingField(String(field))
      const currentValue = String(form.getFieldValue(field) || '')
      const result = await onProposeField(String(field), currentValue)
      form.setFieldValue(field, result)
      message.success('AI 草稿已填入，请审核后保存')
    } catch (error) {
      message.error(error instanceof Error ? error.message : '生成设定失败')
    } finally {
      setGeneratingField(undefined)
    }
  }

  const save = async () => {
    try {
      setSaving(true)
      await onSave(await form.validateFields())
      message.success('世界观设定已确认')
    } finally {
      setSaving(false)
    }
  }

  const generateAll = async () => {
    try {
      setGeneratingAll(true)
      form.setFieldsValue(await onProposeAll())
      message.success('全部设定草稿已填入，请逐项审核')
    } catch (error) {
      message.error(error instanceof Error ? error.message : '批量生成设定失败')
    } finally {
      setGeneratingAll(false)
    }
  }

  return (
    <Form form={form} layout="vertical">
      <Button
        style={{ marginBottom: 16 }}
        icon={<ThunderboltOutlined />}
        loading={generatingAll}
        onClick={generateAll}
      >
        AI 一键生成全部设定草稿
      </Button>
      <Row gutter={16}>
        {SETTING_FIELDS.map((field) => (
          <Col xs={24} lg={12} key={String(field.name)}>
            <Form.Item
              name={field.name}
              label={(
                <Space>
                  <span>{field.label}</span>
                  <Button
                    type="link"
                    size="small"
                    icon={<ThunderboltOutlined />}
                    loading={generatingField === field.name}
                    onClick={() => generateField(field.name)}
                  >
                    AI 帮写
                  </Button>
                </Space>
              )}
            >
              <Input.TextArea rows={4} placeholder={field.placeholder} />
            </Form.Item>
          </Col>
        ))}
      </Row>
      <Button type="primary" loading={saving} onClick={save}>保存并确认设定</Button>
    </Form>
  )
}
