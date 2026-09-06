import type { ReactNode } from 'react'
import { Alert, Button, Card, Empty, Space, Spin, Typography } from 'antd'
import { ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons'

const { Text } = Typography

interface AiProposalFieldProps<T> {
  title: string
  description?: string
  proposals: T[]
  loading: boolean
  error?: string
  onGenerate: () => void
  onAdopt: (proposal: T) => void
  renderProposal: (proposal: T, index: number) => ReactNode
}

/**
 * 统一承载“AI 提案—人工预览—采纳”的交互。
 * 组件只管理展示，提案写入数据库必须由上层在用户点击采纳后完成。
 */
export default function AiProposalField<T>({
  title,
  description,
  proposals,
  loading,
  error,
  onGenerate,
  onAdopt,
  renderProposal
}: AiProposalFieldProps<T>) {
  return (
    <Card
      className="ai-proposal-field"
      title={title}
      extra={(
        <Button
          icon={proposals.length ? <ReloadOutlined /> : <ThunderboltOutlined />}
          loading={loading}
          onClick={onGenerate}
        >
          {proposals.length ? '换一批' : 'AI 帮我想'}
        </Button>
      )}
    >
      {description && <Text type="secondary">{description}</Text>}
      {error && (
        <Alert
          style={{ marginTop: 12 }}
          type="warning"
          showIcon
          message={error}
          description="已保留 AI 原始输出（如有），您可以重试或改为手动填写。"
        />
      )}
      <Spin spinning={loading} tip="灵感智能体正在生成可审核选项…">
        <div className={`ai-proposal-field__list${ !loading && proposals.length === 0 ? ' ai-proposal-field__list--empty' : ''}`}>
          {!loading && proposals.length === 0 ? (
            <Empty className="ai-proposal-field__empty" image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有提案" />
          ) : proposals.map((proposal, index) => (
            <Card key={index} size="small" className="ai-proposal-field__item">
              {renderProposal(proposal, index)}
              <Space className="ai-proposal-field__actions">
                <Button type="primary" onClick={() => onAdopt(proposal)}>采纳并继续编辑</Button>
              </Space>
            </Card>
          ))}
        </div>
      </Spin>
    </Card>
  )
}
