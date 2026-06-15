import React, { useEffect, useMemo, useState } from 'react'
import { Button, Card, Col, Modal, Row, Space, Table, Tag, Typography, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import { novelService } from '@services/novelService'
import { useNovelId } from '@hooks/useNovelId'
import { usePagination } from '@hooks/usePagination'
import { useModal } from '@hooks/useModal'
import { formatDateTime, getApiErrorMessage } from '@utils/index'

const { Title, Paragraph, Text } = Typography

const actionLabel = (action: string) => {
  if (action === 'generate') return { text: '生成章节', color: 'blue' as const }
  if (action === 'continue') return { text: '续写章节', color: 'purple' as const }
  if (action === 'polish') return { text: '内容润色', color: 'gold' as const }
  if (action === 'creative') return { text: '创意生成', color: 'cyan' as const }
  return { text: action, color: 'default' as const }
}

const NovelHistory: React.FC = () => {
  const { id, novelId, isValid } = useNovelId()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const { page, limit, getTablePagination } = usePagination(20)
  const [total, setTotal] = useState(0)
  const [histories, setHistories] = useState<any[]>([])
  const [novel, setNovel] = useState<any>(null)

  const viewModal = useModal()
  const [viewing, setViewing] = useState<any>(null)

  const load = async () => {
    if (!isValid) return
    setLoading(true)
    try {
      const [novelData, historyData] = await Promise.all([
        novelService.getNovel(novelId),
        novelService.getGenerationHistory(novelId, page, limit)
      ])
      setNovel(novelData)
      setHistories(historyData.histories)
      setTotal(historyData.total)
    } catch (e) {
      console.error(e)
      message.error(getApiErrorMessage(e, '加载生成历史失败'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [novelId, page, limit])

  const columns = useMemo(() => ([
    {
      title: '类型',
      dataIndex: 'action',
      key: 'action',
      width: 120,
      render: (action: string) => {
        const info = actionLabel(action)
        return <Tag color={info.color}>{info.text}</Tag>
      }
    },
    {
      title: '章节ID',
      dataIndex: 'chapterId',
      key: 'chapterId',
      width: 90,
      render: (v: any) => v ?? <Text type="secondary">-</Text>
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 190,
      render: (v: string) => formatDateTime(v)
    },
    {
      title: '操作',
      key: 'actionBtn',
      render: (_: any, record: any) => (
        <Space>
          <Button type="text" onClick={() => {
            setViewing(record)
            viewModal.show()
          }}>
            查看详情
          </Button>
        </Space>
      )
    }
  ]), [viewModal])

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={2} style={{ margin: 0 }}>生成历史</Title>
          <Paragraph style={{ marginBottom: 0 }}>
            {novel ? `《${novel.name}》` : `小说ID: ${id}`}
          </Paragraph>
        </Col>
        <Col>
          <Space>
            <Button onClick={() => navigate(`/novel/${id}`)}>返回创作</Button>
            <Button onClick={() => navigate(`/novel/${id}/versions`)}>版本管理</Button>
          </Space>
        </Col>
      </Row>

      <Card>
        <Table
          loading={loading}
          columns={columns as any}
          dataSource={histories.map(h => ({ ...h, key: h.id }))}
          pagination={getTablePagination(total)}
        />
      </Card>

      <Modal
        title={viewing ? `${actionLabel(viewing.action).text}（#${viewing.id}）` : '详情'}
        open={viewModal.open}
        onCancel={viewModal.hide}
        width={900}
        footer={null}
      >
        {viewing ? (
          <>
            <Card size="small" title="Prompt" style={{ marginBottom: 12 }}>
              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{viewing.prompt || '-'}</pre>
            </Card>
            <Card size="small" title="结果">
              <pre style={{ whiteSpace: 'pre-wrap', margin: 0, maxHeight: 420, overflow: 'auto' }}>{viewing.result || '-'}</pre>
            </Card>
          </>
        ) : null}
      </Modal>
    </div>
  )
}

export default NovelHistory

