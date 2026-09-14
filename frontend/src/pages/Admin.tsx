import React, { useEffect, useState } from 'react'
import { Button, Card, Col, Form, Input, InputNumber, message, Modal, Row, Select, Space, Statistic, Switch, Table, Tabs, Tag, Typography } from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import { adminService } from '@services/adminService'
import { PLATFORM_CONFIG } from '@/data/aiModelCatalog'
import type { AdminUser, AiCatalogModel, AiModelPrice, AiRequestLog, Feedback, UsageSummary } from '@app-types/index'

const { Title, Text } = Typography

const PAGE_SIZE = 10

const Admin: React.FC = () => {
  const [summary, setSummary] = useState<UsageSummary | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [logs, setLogs] = useState<AiRequestLog[]>([])
  const [usersTotal, setUsersTotal] = useState(0)
  const [feedbacksTotal, setFeedbacksTotal] = useState(0)
  const [logsTotal, setLogsTotal] = useState(0)
  const [usersPage, setUsersPage] = useState(1)
  const [feedbacksPage, setFeedbacksPage] = useState(1)
  const [logsPage, setLogsPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [syncingModels, setSyncingModels] = useState(false)
  const [syncingPrices, setSyncingPrices] = useState(false)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [logsLoading, setLogsLoading] = useState(false)
  const [updatingModelId, setUpdatingModelId] = useState<number | null>(null)
  const [logFilters, setLogFilters] = useState<{ platform?: string; status?: string; keySource?: string; costFlag?: string }>({})
  const [catalog, setCatalog] = useState<AiCatalogModel[]>([])
  const [prices, setPrices] = useState<AiModelPrice[]>([])
  const [priceSyncedAt, setPriceSyncedAt] = useState<string | null>(null)
  const [capabilityFilter, setCapabilityFilter] = useState<string>()
  const [platformFilter, setPlatformFilter] = useState<string>()
  const [defaultPlatform, setDefaultPlatform] = useState('deepseek')
  const [defaultModel, setDefaultModel] = useState('')
  const [savingDefaults, setSavingDefaults] = useState(false)
  const [priceForm] = Form.useForm()

  const loadSummary = async () => {
    const data = await adminService.getUsageSummary()
    setSummary(data)
  }

  const loadUsers = async (page = usersPage) => {
    const data = await adminService.getUsers({ page, limit: PAGE_SIZE })
    setUsers(data.items)
    setUsersTotal(data.total)
    setUsersPage(data.page)
  }

  const loadFeedbacks = async (page = feedbacksPage) => {
    const data = await adminService.getFeedbacks({ page, limit: PAGE_SIZE })
    setFeedbacks(data.items)
    setFeedbacksTotal(data.total)
    setFeedbacksPage(data.page)
  }

  const loadLogs = async (page = logsPage) => {
    const data = await adminService.getAiRequestLogs({ page, limit: PAGE_SIZE, ...logFilters })
    setLogs(data.items)
    setLogsTotal(data.total)
    setLogsPage(data.page)
  }

  /** 按平台 / 能力筛选模型目录。 */
  const loadCatalog = async (filters?: { platform?: string; capability?: string }) => {
    const platform = filters && 'platform' in filters ? filters.platform : platformFilter
    const capability = filters && 'capability' in filters ? filters.capability : capabilityFilter
    const data = await adminService.getModels({
      ...(platform ? { platform } : {}),
      ...(capability ? { capability } : {})
    })
    setCatalog(data.items)
  }

  const loadPrices = async () => {
    const data = await adminService.getPrices()
    setPrices(data.items)
    setPriceSyncedAt(data.syncedAt)
  }

  /** 读取站点默认平台与模型。 */
  const loadAiDefaults = async () => {
    const data = await adminService.getAiDefaults()
    setDefaultPlatform(data.platform)
    setDefaultModel(data.model)
  }

  const refreshAll = async () => {
    setLoading(true)
    try {
      await Promise.all([loadSummary(), loadUsers(1), loadFeedbacks(1), loadLogs(1), loadCatalog(), loadPrices(), loadAiDefaults()])
    } catch (error) {
      message.error('加载管理后台数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshAll()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- 仅首屏加载；分页刷新由各表格事件独立触发

  const confirmBanUser = (user: AdminUser) => {
    let reason = ''
    Modal.confirm({
      title: `封禁用户 ${user.username}`,
      content: (
        <Input.TextArea
          rows={3}
          placeholder="请输入封禁原因（可选）"
          onChange={(event) => {
            reason = event.target.value
          }}
        />
      ),
      okText: '确认封禁',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        await adminService.banUser(user.id, reason)
        message.success('用户已封禁')
        await loadUsers()
      }
    })
  }

  const handleUnbanUser = async (user: AdminUser) => {
    await adminService.unbanUser(user.id)
    message.success('用户已解封')
    await loadUsers()
  }

  const userColumns: ColumnsType<AdminUser> = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '用户名', dataIndex: 'username' },
    { title: '角色', dataIndex: 'role', render: (role) => <Tag color={role === 'admin' ? 'purple' : 'blue'}>{role}</Tag> },
    { title: '状态', dataIndex: 'status', render: (status) => <Tag color={status === 'banned' ? 'red' : 'green'}>{status === 'banned' ? '已封禁' : '正常'}</Tag> },
    { title: '请求数', dataIndex: 'requestCount' },
    { title: '累计 Token', dataIndex: 'totalTokens' },
    { title: '本月代付(元)', dataIndex: 'paidCostCnyMonth', render: (value?: string) => value ? Number(value).toFixed(4) : '0' },
    { title: '累计代付(元)', dataIndex: 'paidCostCnyTotal', render: (value?: string) => value ? Number(value).toFixed(4) : '0' },
    { title: '自备 Key Token', dataIndex: 'userKeyTokens' },
    { title: '注册时间', dataIndex: 'createdAt', render: (value: string) => new Date(value).toLocaleString() },
    {
      title: '操作',
      render: (_, record) => record.status === 'banned'
        ? <Button size="small" onClick={() => handleUnbanUser(record)}>解封</Button>
        : <Button size="small" danger onClick={() => confirmBanUser(record)} disabled={record.role === 'admin'}>封禁</Button>
    }
  ]

  const feedbackColumns: ColumnsType<Feedback> = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '用户', render: (_, record) => record.User?.username || `用户 ${record.userId}` },
    { title: '类型', dataIndex: 'type', render: (type) => <Tag>{type}</Tag> },
    { title: '内容', dataIndex: 'content', ellipsis: true },
    { title: '提交时间', dataIndex: 'createdAt', render: (value: string) => new Date(value).toLocaleString() }
  ]

  const logColumns: ColumnsType<AiRequestLog> = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '用户', render: (_, record) => record.User?.username || `用户 ${record.userId}` },
    { title: '动作', dataIndex: 'action' },
    { title: '平台', dataIndex: 'platform' },
    { title: '模型', dataIndex: 'model' },
    { title: '状态', dataIndex: 'status', render: (status) => <Tag color={status === 'success' ? 'green' : 'red'}>{status === 'success' ? '成功' : '失败'}</Tag> },
    { title: '未命中/缓存/输出', render: (_, record) => `${record.uncachedPromptTokens ?? record.promptTokens}/${record.cachedPromptTokens || 0}/${record.completionTokens}` },
    { title: '原币花费', dataIndex: 'costAmount', render: (value?: string | null, record?: AiRequestLog) => value && record?.costCurrency ? `${value} ${record.costCurrency}` : '—' },
    { title: '汇率', dataIndex: 'fxRateUsed', render: (value?: string | null) => value || '—' },
    { title: '人民币', dataIndex: 'costAmountCny', render: (value?: string | null, record?: AiRequestLog) => record?.keySource === 'user' ? '—' : (value ? Number(value).toFixed(4) : '迁移前无单价') },
    { title: '密钥', dataIndex: 'keySource', render: (value?: string | null) => value === 'user' ? '自备' : value === 'env' ? '代付' : '-' },
    { title: '标记', dataIndex: 'costFlag', render: (value?: string | null) => value || '-' },
    { title: '耗时', dataIndex: 'durationMs', render: (value?: number) => value ? `${value}ms` : '-' },
    { title: '错误', dataIndex: 'errorMessage', ellipsis: true, render: (value?: string | null) => value || '-' },
    { title: '时间', dataIndex: 'createdAt', render: (value: string) => new Date(value).toLocaleString() }
  ]

  /** 保存未开启自备密钥用户使用的默认平台和模型。 */
  const handleSaveAiDefaults = async () => {
    if (!defaultModel.trim()) {
      message.error('请选择或填写默认模型')
      return
    }
    setSavingDefaults(true)
    try {
      const saved = await adminService.saveAiDefaults({ platform: defaultPlatform, model: defaultModel.trim() })
      setDefaultPlatform(saved.platform)
      setDefaultModel(saved.model)
      message.success('已保存站点默认平台和模型')
    } catch {
      message.error('保存站点默认失败')
    } finally {
      setSavingDefaults(false)
    }
  }

  const handleUsersPageChange = (pagination: TablePaginationConfig) => {
    loadUsers(pagination.current || 1)
  }

  const handleFeedbacksPageChange = (pagination: TablePaginationConfig) => {
    loadFeedbacks(pagination.current || 1)
  }

  /** 分页加载 AI 请求日志，带表格 loading。 */
  const handleLogsPageChange = async (pagination: TablePaginationConfig) => {
    setLogsLoading(true)
    try {
      await loadLogs(pagination.current || 1)
    } finally {
      setLogsLoading(false)
    }
  }

  /** 按当前筛选项刷新日志。 */
  const handleFilterLogs = async () => {
    setLogsLoading(true)
    try {
      await loadLogs(1)
    } catch {
      message.error('筛选日志失败')
    } finally {
      setLogsLoading(false)
    }
  }

  /** 按能力筛选模型目录。 */
  const handleFilterCatalog = async () => {
    setCatalogLoading(true)
    try {
      await loadCatalog()
    } catch {
      message.error('加载模型目录失败')
    } finally {
      setCatalogLoading(false)
    }
  }

  /** 从官方接口同步最新模型，请求可能较慢。 */
  const handleSyncModels = async () => {
    setSyncingModels(true)
    try {
      const result = await adminService.syncModels()
      message.success(`同步 ${result.synced} 个模型`)
      if (result.failures.length) {
        message.warning(result.failures.map((item) => `${item.platform}: ${item.message}`).join('；'))
      }
      await loadCatalog()
    } catch {
      message.error('同步模型失败，请确认服务端已配置对应平台 Key')
    } finally {
      setSyncingModels(false)
    }
  }

  /** 先写官方人民币价，再补社区美元价。 */
  const handleSyncPrices = async () => {
    setSyncingPrices(true)
    try {
      const result = await adminService.syncPrices()
      message.success(`更新 ${result.updated} 条，跳过手工 ${result.skippedManual} 条`)
      await loadPrices()
    } catch {
      message.error('刷新价格失败')
    } finally {
      setSyncingPrices(false)
    }
  }

  /** 切换模型启用或推荐标记。 */
  const handleUpdateModel = async (id: number, data: { enabled?: boolean; recommended?: boolean }) => {
    setUpdatingModelId(id)
    try {
      await adminService.updateModel(id, data)
      await loadCatalog()
    } catch {
      message.error('更新模型失败')
    } finally {
      setUpdatingModelId(null)
    }
  }

  /** 弹出手工新增模型对话框。 */
  const handleCreateModel = () => {
    let platform = 'deepseek'
    let modelId = ''
    let label = ''
    Modal.confirm({
      title: '手工新增模型',
      content: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Select defaultValue="deepseek" style={{ width: '100%' }} options={['aliyun', 'zhipu', 'deepseek', 'openai'].map((value) => ({ value, label: value }))} onChange={(value) => { platform = value }} />
          <Input placeholder="官方 model id" onChange={(event) => { modelId = event.target.value }} />
          <Input placeholder="展示名（可选）" onChange={(event) => { label = event.target.value }} />
        </Space>
      ),
      okText: '新增',
      cancelText: '取消',
      onOk: async () => {
        if (!modelId.trim()) {
          message.error('请填写模型 ID')
          return Promise.reject(new Error('missing model id'))
        }
        await adminService.createModel({ platform, modelId: modelId.trim(), label })
        message.success('已新增')
        await loadCatalog()
      }
    })
  }

  /** 弹出手工改价对话框，确认时走校验并显示 loading。 */
  const handleEditPrice = (record: AiModelPrice) => {
    priceForm.setFieldsValue(record)
    Modal.confirm({
      title: `改价 ${record.platform}/${record.modelId}`,
      content: (
        <Form form={priceForm} layout="vertical">
          <Form.Item name="inputPerMillion" label="输入单价/百万" rules={[{ required: true, message: '请填写输入单价' }]}>
            <InputNumber stringMode style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="cachedInputPerMillion" label="缓存单价/百万">
            <InputNumber stringMode style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="outputPerMillion" label="输出单价/百万" rules={[{ required: true, message: '请填写输出单价' }]}>
            <InputNumber stringMode style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="currency" label="币种" rules={[{ required: true, message: '请选择币种' }]}>
            <Select options={[{ value: 'CNY', label: 'CNY' }, { value: 'USD', label: 'USD' }]} />
          </Form.Item>
        </Form>
      ),
      okText: '保存',
      cancelText: '取消',
      onOk: async () => {
        const values = await priceForm.validateFields()
        await adminService.savePrice({
          platform: record.platform,
          modelId: record.modelId,
          inputPerMillion: String(values.inputPerMillion),
          outputPerMillion: String(values.outputPerMillion),
          cachedInputPerMillion: values.cachedInputPerMillion || null,
          currency: values.currency
        })
        message.success('已保存手工单价')
        await loadPrices()
      }
    })
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 1280, margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <div>
            <Title level={2}>管理后台</Title>
            <Text type="secondary">查看反馈、用户状态、系统用量、模型目录和平台代付花费。</Text>
          </div>
          <Button onClick={refreshAll} loading={loading}>刷新</Button>
        </Space>

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Card><Statistic title="总请求数" value={summary?.totalRequests || 0} /></Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card><Statistic title="成功请求" value={summary?.successRequests || 0} /></Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card><Statistic title="累计 Token" value={summary?.totalTokens || 0} /></Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card><Statistic title="今日 Token" value={summary?.todayTokens || 0} /></Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card><Statistic title="今日代付(元)" value={Number(summary?.todayPaidCostCny || 0)} precision={4} /></Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card><Statistic title="本月代付(元)" value={Number(summary?.monthPaidCostCny || 0)} precision={4} /></Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card><Statistic title="自备 Key 占比" value={Math.round((summary?.userKeyRequestRatio || 0) * 100)} suffix="%" /></Card>
          </Col>
        </Row>

        <Card>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Title level={4} style={{ marginBottom: 4 }}>站点默认模型</Title>
              <Text type="secondary">未开启「使用自己的密钥」的用户，将使用这里选择的平台和模型（走平台代付密钥）。</Text>
            </div>
            <Space wrap>
              <Select
                value={defaultPlatform}
                style={{ width: 180 }}
                options={['aliyun', 'zhipu', 'deepseek', 'openai'].map((value) => ({
                  value,
                  label: PLATFORM_CONFIG[value]?.label || value
                }))}
                onChange={(value) => {
                  setDefaultPlatform(value)
                  const firstModel = catalog.find((item) => item.platform === value && item.enabled)?.modelId
                  if (firstModel) setDefaultModel(firstModel)
                }}
              />
              <Select
                showSearch
                allowClear={false}
                value={defaultModel || undefined}
                placeholder="选择默认模型"
                style={{ minWidth: 280 }}
                options={catalog
                  .filter((item) => item.platform === defaultPlatform && item.enabled !== false)
                  .map((item) => ({ value: item.modelId, label: item.label || item.modelId }))}
                onChange={setDefaultModel}
              />
              <Button type="primary" onClick={handleSaveAiDefaults} loading={savingDefaults}>保存默认</Button>
            </Space>
          </Space>
        </Card>

        <Card>
          <Tabs
            items={[
              {
                key: 'users',
                label: '用户使用情况',
                children: (
                  <Table
                    rowKey="id"
                    columns={userColumns}
                    dataSource={users}
                    loading={loading}
                    pagination={{ current: usersPage, pageSize: PAGE_SIZE, total: usersTotal }}
                    onChange={handleUsersPageChange}
                    scroll={{ x: 900 }}
                  />
                )
              },
              {
                key: 'catalog',
                label: '模型目录',
                children: (
                  <>
                    <Space wrap style={{ marginBottom: 12 }}>
                      <Select
                        allowClear
                        placeholder="平台"
                        style={{ width: 140 }}
                        value={platformFilter}
                        options={['aliyun', 'zhipu', 'deepseek', 'openai'].map((value) => ({ value, label: value }))}
                        onChange={setPlatformFilter}
                      />
                      <Select allowClear placeholder="能力" style={{ width: 140 }} value={capabilityFilter} options={[{ value: 'chat', label: 'chat' }, { value: 'other', label: 'other' }, { value: 'unknown', label: '待确认' }]} onChange={setCapabilityFilter} />
                      <Button onClick={handleFilterCatalog} loading={catalogLoading}>筛选</Button>
                      <Button type="primary" onClick={handleSyncModels} loading={syncingModels}>同步最新模型</Button>
                      <Button onClick={handleCreateModel}>手工新增</Button>
                    </Space>
                    <Table
                      rowKey="id"
                      dataSource={catalog}
                      loading={loading || catalogLoading || syncingModels}
                      pagination={false}
                      scroll={{ x: 1100 }}
                      columns={[
                        { title: '平台', dataIndex: 'platform', width: 100 },
                        { title: '模型 ID', dataIndex: 'modelId' },
                        { title: '名称', dataIndex: 'label' },
                        { title: '能力', dataIndex: 'capability', render: (value: string) => <Tag color={value === 'unknown' ? 'orange' : value === 'chat' ? 'green' : 'default'}>{value}</Tag> },
                        { title: '来源', dataIndex: 'capabilitySource' },
                        { title: '启用', dataIndex: 'enabled', render: (value: boolean, record) => (
                          <Switch
                            checked={value}
                            loading={updatingModelId === record.id}
                            disabled={!record.id || updatingModelId === record.id}
                            onChange={(enabled) => {
                              if (!record.id) return
                              void handleUpdateModel(record.id, { enabled })
                            }}
                          />
                        ) },
                        { title: '推荐', dataIndex: 'recommended', render: (value: boolean, record) => (
                          <Switch
                            checked={value}
                            loading={updatingModelId === record.id}
                            disabled={!record.id || updatingModelId === record.id}
                            onChange={(recommended) => {
                              if (!record.id) return
                              void handleUpdateModel(record.id, { recommended })
                            }}
                          />
                        ) }
                      ]}
                    />
                  </>
                )
              },
              {
                key: 'prices',
                label: '模型单价',
                children: (
                  <>
                    <Space style={{ marginBottom: 12 }}>
                      <Button type="primary" onClick={handleSyncPrices} loading={syncingPrices}>刷新价格</Button>
                      <Text type="secondary">上次同步：{priceSyncedAt ? new Date(priceSyncedAt).toLocaleString() : '尚未同步'}。DeepSeek 用官方人民币闲时价（高峰自动 ×2）；社区价为美元，计费时折人民币。</Text>
                    </Space>
                    <Table
                      rowKey={(row) => `${row.platform}-${row.modelId}`}
                      dataSource={prices}
                      loading={loading || syncingPrices}
                      pagination={false}
                      scroll={{ x: 1100 }}
                      columns={[
                        { title: '平台', dataIndex: 'platform' },
                        { title: '模型', dataIndex: 'modelId' },
                        { title: '输入/百万', dataIndex: 'inputPerMillion' },
                        { title: '缓存/百万', dataIndex: 'cachedInputPerMillion', render: (value?: string | null) => value || '—' },
                        { title: '输出/百万', dataIndex: 'outputPerMillion' },
                        { title: '币种', dataIndex: 'currency' },
                        { title: '来源', dataIndex: 'source', render: (value: string) => <Tag>{value === 'manual' ? '手工' : value === 'community' ? '社区' : value === 'official' ? '官方' : value}</Tag> },
                        {
                          title: '操作',
                          render: (_, record) => (
                            <Button size="small" onClick={() => handleEditPrice(record)}>改价</Button>
                          )
                        }
                      ]}
                    />
                  </>
                )
              },
              {
                key: 'feedbacks',
                label: '反馈列表',
                children: (
                  <Table
                    rowKey="id"
                    columns={feedbackColumns}
                    dataSource={feedbacks}
                    loading={loading}
                    pagination={{ current: feedbacksPage, pageSize: PAGE_SIZE, total: feedbacksTotal }}
                    onChange={handleFeedbacksPageChange}
                  />
                )
              },
              {
                key: 'logs',
                label: 'AI 请求日志',
                children: (
                  <>
                    <Space wrap style={{ marginBottom: 12 }}>
                      <Select allowClear placeholder="平台" style={{ width: 120 }} options={['aliyun', 'zhipu', 'deepseek', 'openai', 'custom'].map((value) => ({ value, label: value }))} onChange={(platform) => setLogFilters((prev) => ({ ...prev, platform }))} />
                      <Select allowClear placeholder="状态" style={{ width: 120 }} options={[{ value: 'success', label: '成功' }, { value: 'failed', label: '失败' }]} onChange={(status) => setLogFilters((prev) => ({ ...prev, status }))} />
                      <Select allowClear placeholder="密钥来源" style={{ width: 140 }} options={[{ value: 'env', label: '平台代付' }, { value: 'user', label: '自备 Key' }]} onChange={(keySource) => setLogFilters((prev) => ({ ...prev, keySource }))} />
                      <Select allowClear placeholder="花费标记" style={{ width: 180 }} options={['missing_price', 'cache_price_missing', 'estimated_tokens', 'fx_default'].map((value) => ({ value, label: value }))} onChange={(costFlag) => setLogFilters((prev) => ({ ...prev, costFlag }))} />
                      <Button onClick={handleFilterLogs} loading={logsLoading}>筛选</Button>
                    </Space>
                    <Table
                      rowKey="id"
                      columns={logColumns}
                      dataSource={logs}
                      loading={loading || logsLoading}
                      pagination={{ current: logsPage, pageSize: PAGE_SIZE, total: logsTotal }}
                      onChange={handleLogsPageChange}
                      scroll={{ x: 1600 }}
                    />
                  </>
                )
              }
            ]}
          />
        </Card>
      </Space>
    </div>
  )
}

export default Admin
