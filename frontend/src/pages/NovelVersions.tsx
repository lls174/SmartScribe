import React, { useEffect, useMemo, useState } from 'react'
import { Button, Card, Col, Form, Input, Modal, Popconfirm, Row, Space, Table, Tag, Typography, message } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import { novelService } from '@services/novelService'

const { Title, Paragraph, Text } = Typography

const safeStringify = (value: any) => {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

const NovelVersions: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const novelId = Number(id)

  const [loading, setLoading] = useState(false)
  const [versions, setVersions] = useState<any[]>([])
  const [novel, setNovel] = useState<any>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm] = Form.useForm()

  const [compareOpen, setCompareOpen] = useState(false)
  const [left, setLeft] = useState<any>(null)
  const [right, setRight] = useState<any>(null)

  const [viewOpen, setViewOpen] = useState(false)
  const [viewing, setViewing] = useState<any>(null)

  const load = async () => {
    if (!Number.isFinite(novelId)) return
    setLoading(true)
    try {
      const [novelData, versionData] = await Promise.all([
        novelService.getNovel(novelId),
        novelService.getVersions(novelId)
      ])
      setNovel(novelData)
      setVersions(versionData)
    } catch (e) {
      console.error(e)
      message.error('加载版本列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [novelId])

  const columns = useMemo(() => ([
    {
      title: '版本ID',
      dataIndex: 'id',
      key: 'id',
      width: 90
    },
    {
      title: '标签',
      dataIndex: 'label',
      key: 'label',
      render: (label: string | null) => label ? <Tag color="cyan">{label}</Tag> : <Text type="secondary">-</Text>
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => v ? new Date(v).toLocaleString() : '-'
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Popconfirm
            title="切换到此版本？"
            description="将用该版本快照覆盖当前小说内容（会自动创建切换前备份版本）。"
            okText="确定切换"
            cancelText="取消"
            onConfirm={async () => {
              try {
                await novelService.restoreVersion(novelId, record.id)
                message.success('版本切换成功')
                navigate(`/novel/${id}`)
              } catch (e) {
                console.error(e)
                message.error('版本切换失败（如首次使用请先执行后端 npm run db:init）')
              }
            }}
          >
            <Button type="text">切换</Button>
          </Popconfirm>
          <Button type="text" onClick={() => {
            setViewing(record)
            setViewOpen(true)
          }}>
            查看
          </Button>
          <Button type="text" onClick={() => {
            setLeft(record)
            setCompareOpen(true)
          }}>
            设为左侧
          </Button>
          <Button type="text" onClick={() => {
            setRight(record)
            setCompareOpen(true)
          }}>
            设为右侧
          </Button>
        </Space>
      )
    }
  ]), [id, navigate, novelId])

  const leftSnapshot = left?.snapshot
  const rightSnapshot = right?.snapshot

  const metaDiff = useMemo(() => {
    const l = leftSnapshot?.novel
    const r = rightSnapshot?.novel
    if (!l || !r) return null
    return {
      nameChanged: l.name !== r.name,
      descriptionChanged: l.description !== r.description
    }
  }, [leftSnapshot, rightSnapshot])

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={2} style={{ margin: 0 }}>版本管理</Title>
          <Paragraph style={{ marginBottom: 0 }}>
            {novel ? `《${novel.name}》` : `小说ID: ${id}`}
          </Paragraph>
        </Col>
        <Col>
          <Space>
            <Button onClick={() => navigate(`/novel/${id}`)}>返回创作</Button>
            <Button onClick={() => navigate(`/novel/${id}/history`)}>生成历史</Button>
            <Button type="primary" onClick={() => setCreateOpen(true)}>创建版本</Button>
          </Space>
        </Col>
      </Row>

      <Card>
        <Table
          loading={loading}
          columns={columns as any}
          dataSource={versions.map(v => ({ ...v, key: v.id }))}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="创建版本"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        footer={null}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={async (values) => {
            try {
              await novelService.createVersion(novelId, values.label)
              message.success('版本创建成功')
              setCreateOpen(false)
              createForm.resetFields()
              load()
            } catch (e) {
              console.error(e)
              message.error('版本创建失败')
            }
          }}
        >
          <Form.Item label="版本标签" name="label">
            <Input placeholder="例如：第一章完成 / 结构调整前" />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setCreateOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit">创建</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="版本对比"
        open={compareOpen}
        onCancel={() => setCompareOpen(false)}
        width={1000}
        footer={null}
      >
        <Row gutter={16} style={{ marginBottom: 12 }}>
          <Col span={12}>
            <Card size="small" title="左侧版本" extra={left ? <Tag>#{left.id}</Tag> : null}>
              <Text type="secondary">{left?.label || '未选择'}</Text>
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small" title="右侧版本" extra={right ? <Tag>#{right.id}</Tag> : null}>
              <Text type="secondary">{right?.label || '未选择'}</Text>
            </Card>
          </Col>
        </Row>

        {!leftSnapshot || !rightSnapshot ? (
          <Paragraph type="secondary">请先在列表里分别选择“左侧/右侧版本”。</Paragraph>
        ) : (
          <>
            <Card size="small" style={{ marginBottom: 12 }} title="元信息差异">
              <Space>
                <Tag color={metaDiff?.nameChanged ? 'red' : 'green'}>标题{metaDiff?.nameChanged ? '有变化' : '无变化'}</Tag>
                <Tag color={metaDiff?.descriptionChanged ? 'red' : 'green'}>简介{metaDiff?.descriptionChanged ? '有变化' : '无变化'}</Tag>
              </Space>
            </Card>

            <Row gutter={16}>
              <Col span={12}>
                <Card size="small" title="左侧快照(JSON)">
                  <pre style={{ maxHeight: 420, overflow: 'auto', margin: 0 }}>{safeStringify(leftSnapshot)}</pre>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" title="右侧快照(JSON)">
                  <pre style={{ maxHeight: 420, overflow: 'auto', margin: 0 }}>{safeStringify(rightSnapshot)}</pre>
                </Card>
              </Col>
            </Row>
          </>
        )}
      </Modal>

      <Modal
        title={`版本详情 ${viewing ? `#${viewing.id}` : ''}`}
        open={viewOpen}
        onCancel={() => setViewOpen(false)}
        width={900}
        footer={null}
      >
        {viewing ? (
          <pre style={{ maxHeight: 600, overflow: 'auto', margin: 0 }}>{safeStringify(viewing.snapshot)}</pre>
        ) : null}
      </Modal>
    </div>
  )
}

export default NovelVersions

