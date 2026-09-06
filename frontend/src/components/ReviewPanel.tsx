import { useEffect, useState } from 'react'
import { Alert, Button, Card, Checkbox, Drawer, Empty, Space, Spin, Tag, Typography } from 'antd'
import type { ChapterReview, ReviewIssue } from '@/types/collaboration'

const { Paragraph, Text } = Typography

const SEVERITY_META = {
  blocker: { color: 'red', label: '硬冲突' },
  major: { color: 'orange', label: '重要问题' },
  minor: { color: 'blue', label: '可选优化' }
} as const

interface ReviewPanelProps {
  open: boolean
  loading: boolean
  review: ChapterReview | null
  revising: boolean
  onClose: () => void
  onReview: () => void
  onRevise: (issues: ReviewIssue[]) => void
}

/** 审查智能体只给出可勾选问题，是否返修由用户决定。 */
export default function ReviewPanel({
  open,
  loading,
  review,
  revising,
  onClose,
  onReview,
  onRevise
}: ReviewPanelProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => {
    setSelectedIds(review?.issues.filter((item) => item.severity !== 'minor').map((item) => item.id) || [])
  }, [review])

  const selectedIssues = review?.issues.filter((item) => selectedIds.includes(item.id)) || []

  return (
    <Drawer
      title="AI 审查报告（人工终审）"
      open={open}
      onClose={onClose}
      width={560}
      placement={window.innerWidth <= 768 ? 'bottom' : 'right'}
      height={window.innerWidth <= 768 ? '82vh' : undefined}
      extra={<Button onClick={onReview} loading={loading}>重新审查</Button>}
    >
      <Spin spinning={loading} tip="审查智能体正在对照人物卡、大纲和前文概括…">
        {!review ? (
          <Empty description="还没有审查报告">
            <Button type="primary" onClick={onReview}>开始审查</Button>
          </Empty>
        ) : (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Alert
              type={review.verdict === 'pass' ? 'success' : review.verdict === 'block' ? 'error' : 'warning'}
              showIcon
              message={review.verdict === 'pass' ? '未发现明显冲突' : '请人工确认以下问题'}
              description={review.summary}
            />
            {review.issues.map((issue) => {
              const meta = SEVERITY_META[issue.severity]
              return (
                <Card key={issue.id} size="small">
                  <Checkbox
                    checked={selectedIds.includes(issue.id)}
                    disabled={issue.fixableByWriter === false}
                    onChange={(event) => {
                      setSelectedIds((current) => event.target.checked
                        ? [...current, issue.id]
                        : current.filter((id) => id !== issue.id))
                    }}
                  >
                    <Space wrap>
                      <Tag color={meta.color}>{meta.label}</Tag>
                      <Tag>{issue.category}</Tag>
                      <Text>{issue.location || '位置未标注'}</Text>
                    </Space>
                  </Checkbox>
                  {issue.evidence && <Paragraph><Text strong>原文：</Text>{issue.evidence}</Paragraph>}
                  {issue.expected && <Paragraph><Text strong>依据：</Text>{issue.expected}</Paragraph>}
                  <Paragraph><Text strong>建议：</Text>{issue.suggestion}</Paragraph>
                </Card>
              )
            })}
            <Alert type="info" message="审查意见不会自动改文，也不会阻止您保存。" />
            <Button
              type="primary"
              block
              disabled={selectedIssues.length === 0}
              loading={revising}
              onClick={() => onRevise(selectedIssues)}
            >
              按已勾选意见交给写作智能体返修
            </Button>
          </Space>
        )}
      </Spin>
    </Drawer>
  )
}
