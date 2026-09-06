import { useState } from 'react'
import { Descriptions, Form, Input, Select, Space, Tag, Typography } from 'antd'
import AiProposalField from '@components/AiProposalField'
import type { InspirationProposal } from '@/types/collaboration'

const { Paragraph, Text } = Typography

interface InspirationStepProps {
  loading: boolean
  proposals: InspirationProposal[]
  error?: string
  onGenerate: (input: { keywords: string; length: string }) => void
  onAdopt: (proposal: InspirationProposal) => void
}

/** 灵感定位步骤，仅收集最少输入并把 AI 结果作为候选方案展示。 */
export default function InspirationStep({
  loading,
  proposals,
  error,
  onGenerate,
  onAdopt
}: InspirationStepProps) {
  const [keywords, setKeywords] = useState('')
  const [length, setLength] = useState('中篇（30-50章）')

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Form layout="vertical">
        <Form.Item label="你现在有什么想法？（可留空）">
          <Input.TextArea
            rows={3}
            value={keywords}
            onChange={(event) => setKeywords(event.target.value)}
            placeholder="关键词、情绪、参考方向，例如：赛博修仙、群像、成长"
          />
        </Form.Item>
        <Form.Item label="目标篇幅">
          <Select
            value={length}
            onChange={setLength}
            options={['短篇（10章内）', '中篇（30-50章）', '长篇（100章以上）'].map((value) => ({ value, label: value }))}
          />
        </Form.Item>
      </Form>
      <AiProposalField
        title="灵感智能体提案"
        description="AI 会给出三套方向。采纳只会填入草稿，您仍可修改后再确认。"
        proposals={proposals}
        loading={loading}
        error={error}
        onGenerate={() => onGenerate({ keywords, length })}
        onAdopt={onAdopt}
        renderProposal={(proposal) => (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space wrap>
              <Text strong>{proposal.titleSuggestion}</Text>
              <Tag color="blue">{proposal.genre}</Tag>
              <Tag>{proposal.style}</Tag>
            </Space>
            <Paragraph>{proposal.logline}</Paragraph>
            <Descriptions size="small" column={1}>
              <Descriptions.Item label="核心冲突">{proposal.coreConflict}</Descriptions.Item>
              {proposal.targetAudience && <Descriptions.Item label="目标读者">{proposal.targetAudience}</Descriptions.Item>}
            </Descriptions>
            {proposal.reasoning && <Text type="secondary">推荐理由：{proposal.reasoning}</Text>}
          </Space>
        )}
      />
    </Space>
  )
}
