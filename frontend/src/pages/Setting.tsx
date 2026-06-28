import React, { useEffect, useState } from 'react'
import { App as AntdApp, Button, Typography, Form, Select, Input, Space, Card, Alert, Switch, Tag, Progress, Collapse } from 'antd'
import { KeyOutlined, ApiOutlined, ExperimentOutlined, InfoCircleOutlined, CheckOutlined, BgColorsOutlined, CheckCircleFilled } from '@ant-design/icons'
import { useAIConfig } from '@contexts/AIConfigContext'
import { useTheme } from '@contexts/ThemeContext'
import { UI_THEMES } from '@/themes/uiThemes'
import type { UIThemeKey } from '@/themes/uiThemes'
import {
  DEFAULT_AI_MODEL,
  DEFAULT_AI_PLATFORM,
  MODEL_CATALOG_UPDATED_AT,
  PLATFORM_CONFIG,
  PLATFORM_META,
  getRecommendedModel,
  readStoredAiConfig
} from '@/data/aiModelCatalog'
import { aiConfigService, type AiConfigStatus, type AiConfigSummary } from '@services/aiConfigService'
import '@styles/Setting.css'

const { Title, Paragraph } = Typography

const THEME_SWATCH: Record<UIThemeKey, string> = {
  'cyber-dark': 'linear-gradient(135deg, #00d4ff, #7c3aed)',
  'warm-light': 'linear-gradient(135deg, #f97316, #a855f7)',
  'ink-dark': 'linear-gradient(135deg, #34d399, #fbbf24)'
}

const Setting: React.FC = () => {
  const { message } = AntdApp.useApp()
  const { config, updateConfig } = useAIConfig()
  const { themeKey, setThemeKey } = useTheme()
  const [form] = Form.useForm()
  const initialConfig = readStoredAiConfig()
  const [selectedPlatform, setSelectedPlatform] = useState(config.platform || initialConfig.platform || DEFAULT_AI_PLATFORM)
  const [selectedModel, setSelectedModel] = useState(config.model)
  const [apiKeyVisible, setApiKeyVisible] = useState(false)
  const [configStatus, setConfigStatus] = useState<AiConfigStatus | null>(null)
  const [configSummary, setConfigSummary] = useState<AiConfigSummary | null>(null)
  const [editingApiKey, setEditingApiKey] = useState(false)
  const configuredEntry = configSummary?.configuredPlatforms.find((item) => item.platform === selectedPlatform)
  const hasUserSavedApiKey = Boolean(configuredEntry) || configStatus?.source === 'user'
  const maskedApiKey = configuredEntry?.maskedApiKey || (configStatus?.source === 'user' ? configStatus.maskedApiKey : undefined)
  const [desktopPetEnabled, setDesktopPetEnabled] = useState(true)
  const [desktopPetMotion, setDesktopPetMotion] = useState<string>('Idle')

  useEffect(() => {
    const raw = localStorage.getItem('desktopPetEnabled')
    setDesktopPetEnabled(raw === null ? true : raw === 'true')
  }, [])

  const currentPlatformConfig = PLATFORM_CONFIG[selectedPlatform]
  const currentModel = currentPlatformConfig?.models.find((item) => item.value === selectedModel)
  const activePlatformConfig = PLATFORM_CONFIG[configSummary?.activePlatform || DEFAULT_AI_PLATFORM]
  const activeConfigured = configSummary?.configuredPlatforms.find((item) => item.platform === configSummary.activePlatform)

  const loadSummary = async (platform = selectedPlatform) => {
    const summary = await aiConfigService.getPlatformConfig(platform)
    setConfigSummary(summary)
    setConfigStatus(summary.platformStatus || null)

    const activePlatform = summary.usingDefault ? DEFAULT_AI_PLATFORM : summary.activePlatform
    const activeModel = summary.usingDefault ? DEFAULT_AI_MODEL : summary.activeModel

    updateConfig({ platform: activePlatform, model: activeModel })

    if (summary.platformStatus) {
      setSelectedModel(summary.platformStatus.model)
      form.setFieldsValue({
        platform,
        model: summary.platformStatus.model,
        customBaseURL: summary.platformStatus.customBaseURL || PLATFORM_CONFIG[platform]?.defaultBaseURL || '',
        apiKey: ''
      })
    }

    return summary
  }

  useEffect(() => {
    aiConfigService.getSummary()
      .then((summary) => {
        setConfigSummary(summary)
        const initialPlatform = summary.usingDefault ? DEFAULT_AI_PLATFORM : summary.activePlatform
        setSelectedPlatform(initialPlatform)
        setSelectedModel(summary.usingDefault ? DEFAULT_AI_MODEL : summary.activeModel)
        updateConfig({
          platform: initialPlatform,
          model: summary.usingDefault ? DEFAULT_AI_MODEL : summary.activeModel
        })
      })
      .catch(() => {
        message.warning('获取 AI 配置状态失败，请稍后刷新重试')
      })
  }, [message, updateConfig])

  useEffect(() => {
    if (!configSummary) return

    aiConfigService.getPlatformConfig(selectedPlatform)
      .then((summary) => {
        setConfigStatus(summary.platformStatus || null)
        if (summary.platformStatus) {
          setSelectedModel(summary.platformStatus.model)
          form.setFieldsValue({
            platform: selectedPlatform,
            model: summary.platformStatus.model,
            customBaseURL: summary.platformStatus.customBaseURL || PLATFORM_CONFIG[selectedPlatform]?.defaultBaseURL || '',
            apiKey: ''
          })
        }
      })
      .catch(() => {
        message.warning('获取当前服务商配置失败')
      })
  }, [configSummary, form, message, selectedPlatform])

  const handlePlatformChange = (platform: string) => {
    const platformConf = PLATFORM_CONFIG[platform]
    const configured = configSummary?.configuredPlatforms.find((item) => item.platform === platform)
    const defaultModel = configured?.model || getRecommendedModel(platform)?.value || DEFAULT_AI_MODEL
    setSelectedPlatform(platform)
    setSelectedModel(defaultModel)
    setConfigStatus(null)
    setEditingApiKey(false)
    if (configured) {
      updateConfig({ platform, model: defaultModel })
    }
    form.setFieldsValue({
      platform,
      model: defaultModel,
      apiKey: '',
      customBaseURL: configured?.customBaseURL || platformConf?.defaultBaseURL || ''
    })
  }

  const onFinish = async (values: {
    platform: string
    model: string
    apiKey?: string
    customBaseURL?: string
  }) => {
    try {
      await aiConfigService.saveConfig({
        platform: values.platform || selectedPlatform,
        apiKey: values.apiKey || '',
        model: values.model,
        customBaseURL: values.customBaseURL
      })
      await loadSummary(values.platform || selectedPlatform)
      setEditingApiKey(false)
      message.success(`${PLATFORM_CONFIG[values.platform || selectedPlatform]?.label || values.platform} 配置已加密保存`)
    } catch {
      message.error('配置保存失败')
    }
  }

  const onToggleDesktopPet = (checked: boolean) => {
    setDesktopPetEnabled(checked)
    localStorage.setItem('desktopPetEnabled', String(checked))
    window.dispatchEvent(new CustomEvent('desktopPetConfigChanged', { detail: { enabled: checked } }))
    message.success(checked ? '桌宠已开启' : '桌宠已关闭')
  }

  const onPlayDesktopPetMotion = () => {
    if (!desktopPetEnabled) {
      message.warning('请先开启桌宠')
      return
    }
    window.dispatchEvent(
      new CustomEvent('desktopPetConfigChanged', {
        detail: { playMotion: { group: desktopPetMotion, index: 0 } }
      })
    )
    message.success('已触发动作播放')
  }

  return (
    <div className="setting-container">
      <div className="setting-header setting-header--page">
        <Title level={2} className="setting-title">
          <ExperimentOutlined /> AI 配置
        </Title>
        <Paragraph className="setting-description">
          未配置密钥时默认使用 DeepSeek。选择服务商并保存密钥后，将按对应服务商进行 AI 生成。
        </Paragraph>
      </div>

      {configSummary?.usingDefault && (
        <Alert
          className="setting-alert"
          type="warning"
          showIcon
          message={`当前默认使用 ${PLATFORM_CONFIG[DEFAULT_AI_PLATFORM]?.label || 'DeepSeek'}`}
          description={configSummary.hint || '请先在下方选择服务商并保存 API 密钥。'}
        />
      )}

      <Alert
        className="setting-alert"
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        message="安全提示"
        description="API 密钥仅在保存时提交一次，并由服务端安全存储；后续生成请求只携带服务商和模型，不会再次传输明文密钥。"
      />

      <section className="setting-section">
        <h3 className="setting-section-heading">
          <BgColorsOutlined /> 界面风格
        </h3>
        <div className="theme-cards">
          {UI_THEMES.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`theme-card${themeKey === t.key ? ' selected' : ''}`}
              onClick={() => {
                setThemeKey(t.key)
                message.success('界面风格已切换')
              }}
            >
              <span className="theme-card-check"><CheckOutlined /></span>
              <span
                className="theme-card-swatch"
                style={{ background: THEME_SWATCH[t.key] }}
              />
              <span className="theme-card-name">{t.name}</span>
              <span className="theme-card-desc">{t.description}</span>
            </button>
          ))}
        </div>
      </section>

      <Form
        form={form}
        className="setting-form"
        onFinish={onFinish}
        layout="vertical"
        initialValues={{
          platform: config.platform || DEFAULT_AI_PLATFORM,
          model: config.model || DEFAULT_AI_MODEL,
          apiKey: '',
          customBaseURL: currentPlatformConfig?.defaultBaseURL || ''
        }}
      >
        <Form.Item name="platform" hidden>
          <Input />
        </Form.Item>

        <section className="setting-section">
          <h3 className="setting-section-heading">
            <ApiOutlined /> AI 平台
          </h3>
          <div className="platform-cards">
            {Object.entries(PLATFORM_CONFIG).map(([key, conf]) => {
              const meta = PLATFORM_META[key]
              const isConfigured = configSummary?.configuredPlatforms.some((item) => item.platform === key)
              return (
                <button
                  key={key}
                  type="button"
                  className={`platform-card${selectedPlatform === key ? ' selected' : ''}`}
                  onClick={() => handlePlatformChange(key)}
                >
                  <span className="platform-check"><CheckOutlined /></span>
                  <span className="platform-icon">{meta?.icon ?? '🔌'}</span>
                  <span className="platform-name">
                    {conf.label}
                    {isConfigured && <Tag color="success" style={{ marginLeft: 8 }}>已配置</Tag>}
                  </span>
                  <span className="platform-desc">{meta?.description ?? conf.envKeyHint}</span>
                </button>
              )
            })}
          </div>
        </section>

        <Card className="setting-card setting-card--form">
          <h3 className="setting-section-heading">
            <ExperimentOutlined /> 模型与密钥
          </h3>

          <Form.Item
            label={<span className="setting-form-label">模型选择</span>}
            name="model"
            rules={[{ required: true, message: '请选择或输入模型名称' }]}
          >
            {currentPlatformConfig && currentPlatformConfig.models.length > 0 ? (
              <Select
                className="setting-input setting-select"
                onChange={(value) => {
                  setSelectedModel(value)
                  updateConfig({ platform: selectedPlatform, model: value })
                }}
                optionLabelProp="label"
                options={currentPlatformConfig.models.map((model) => ({
                  value: model.value,
                  label: model.label,
                  model
                }))}
                optionRender={(option) => {
                  const model = option.data.model
                  return (
                    <Space direction="vertical" size={2} style={{ width: '100%' }}>
                      <Space wrap>
                        <span>{model.label}</span>
                        {model.badge && <Tag color="cyan">{model.badge}</Tag>}
                        <Tag color="purple">推荐度 {model.recommendation}</Tag>
                      </Space>
                      <span className="setting-model-hint">{model.bestFor}</span>
                    </Space>
                  )
                }}
              />
            ) : (
              <Input className="setting-input" placeholder="请输入模型名称，如 gpt-4o-mini" />
            )}
          </Form.Item>

          <Form.Item label={<span className="setting-form-label">深度思考</span>}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Switch
                checked={config.enableDeepThinking}
                onChange={(checked) => {
                  updateConfig({ enableDeepThinking: checked })
                  message.success(checked ? '已开启深度思考' : '已关闭深度思考')
                }}
              />
              <span className="setting-form-extra">
                开启后模型会先进行深度推理再输出正文，等待时间更长；默认关闭以加快出字速度。
              </span>
            </Space>
          </Form.Item>

          <Form.Item
            label={<span className="setting-form-label"><KeyOutlined /> API 密钥</span>}
            extra={
              <span className="setting-form-extra">
                环境变量: {currentPlatformConfig?.envKeyHint}；填写后将覆盖对应服务商的服务端默认密钥并加密保存
              </span>
            }
          >
            {hasUserSavedApiKey && !editingApiKey ? (
              <Input
                readOnly
                className="setting-input setting-api-key-display"
                prefix={<CheckCircleFilled className="setting-api-key-display__icon" />}
                value={maskedApiKey || '密钥已加密保存'}
                suffix={
                  <button
                    type="button"
                    className="setting-api-key-change-btn"
                    onClick={() => {
                      setEditingApiKey(true)
                      form.setFieldValue('apiKey', '')
                    }}
                  >
                    更换密钥
                  </button>
                }
              />
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                {hasUserSavedApiKey && (
                  <button
                    type="button"
                    className="setting-api-key-cancel-btn"
                    onClick={() => {
                      setEditingApiKey(false)
                      form.setFieldValue('apiKey', '')
                    }}
                  >
                    取消更换，保持已保存密钥
                  </button>
                )}
                <Form.Item
                  name="apiKey"
                  noStyle
                  rules={[{ required: !hasUserSavedApiKey, message: '请填写当前服务商的 AI 密钥' }]}
                >
                  <Input.Password
                    className="setting-input setting-input-password"
                    placeholder={
                      hasUserSavedApiKey
                        ? '输入新密钥（留空表示不修改已保存密钥）'
                        : `请输入 ${currentPlatformConfig?.label || 'AI 服务商'} API 密钥`
                    }
                    visibilityToggle={{ visible: apiKeyVisible, onVisibleChange: setApiKeyVisible }}
                  />
                </Form.Item>
              </Space>
            )}
          </Form.Item>

          {selectedPlatform === 'custom' && (
            <Form.Item
              label={<span className="setting-form-label"><ApiOutlined /> API 地址</span>}
              name="customBaseURL"
              rules={[{ required: true, message: '请输入自定义 API 地址' }]}
              extra={<span className="setting-form-extra">支持 OpenAI 兼容的 Chat Completions 地址</span>}
            >
              <Input className="setting-input" placeholder="https://api.example.com/v1/chat/completions" />
            </Form.Item>
          )}

          <Form.Item className="setting-submit-item">
            <Button type="primary" htmlType="submit" size="large" block className="setting-submit-btn">
              保存配置
            </Button>
          </Form.Item>
        </Card>
      </Form>

      {currentModel && (
        <Card className="setting-card">
          <h3 className="setting-section-heading">模型推荐说明</h3>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Space wrap>
              <Tag color="blue">{currentPlatformConfig.label}</Tag>
              <Tag color="cyan">{currentModel.label}</Tag>
              {currentModel.badge && <Tag color="gold">{currentModel.badge}</Tag>}
              <Tag>更新 {MODEL_CATALOG_UPDATED_AT}</Tag>
            </Space>
            <Progress percent={currentModel.recommendation} status="active" strokeColor={{ from: 'var(--primary-color)', to: 'var(--secondary-color)' }} />
            <div className="setting-status-item">
              <span className="setting-status-label">适合场景</span>
              <span className="setting-status-value">{currentModel.bestFor}</span>
            </div>
            <Paragraph className="setting-model-desc">{currentModel.description}</Paragraph>
          </Space>
        </Card>
      )}

      <Card className="setting-card setting-card--status">
        <h3 className="setting-section-heading">当前生效配置</h3>
        <div className="setting-status-grid">
          <div className="setting-status-chip">
            <span className="setting-status-label">平台</span>
            <span className="setting-status-value">
              {configSummary?.usingDefault
                ? `${activePlatformConfig?.label || PLATFORM_CONFIG[DEFAULT_AI_PLATFORM]?.label || 'DeepSeek'}（默认）`
                : activePlatformConfig?.label || configSummary?.activePlatform}
            </span>
          </div>
          <div className="setting-status-chip">
            <span className="setting-status-label">模型</span>
            <span className="setting-status-value">
              {configSummary?.usingDefault ? DEFAULT_AI_MODEL : configSummary?.activeModel}
            </span>
          </div>
          <div className="setting-status-chip setting-status-chip--wide">
            <span className="setting-status-label">密钥</span>
            <span className="setting-status-value">
              {configSummary?.usingDefault
                ? '未配置个人密钥'
                : activeConfigured
                  ? `已加密保存（${activeConfigured.maskedApiKey}）`
                  : '未配置'}
            </span>
          </div>
          <div className="setting-status-chip setting-status-chip--wide">
            <span className="setting-status-label">API 地址</span>
            <span className="setting-status-value setting-status-value--mono">
              {configSummary?.usingDefault
                ? activePlatformConfig?.defaultBaseURL || '未配置'
                : activeConfigured?.customBaseURL || activePlatformConfig?.defaultBaseURL || '未配置'}
            </span>
          </div>
        </div>
        {configSummary?.usingDefault && configSummary.hint && (
          <Paragraph className="setting-form-extra" style={{ marginTop: 16, marginBottom: 0 }}>
            {configSummary.hint}
          </Paragraph>
        )}
      </Card>

      <Collapse
        className="setting-collapse"
        items={[{
          key: 'experience',
          label: '体验功能（桌宠）',
          children: (
            <div className="setting-experience">
              <div className="setting-status-item">
                <span className="setting-status-label">桌宠开关</span>
                <Switch checked={desktopPetEnabled} onChange={onToggleDesktopPet} />
              </div>
              <div className="setting-status-item">
                <span className="setting-status-label">动作播放</span>
                <Space wrap>
                  <Select
                    value={desktopPetMotion}
                    style={{ minWidth: 180, flex: 1 }}
                    onChange={(v) => setDesktopPetMotion(String(v))}
                    options={[
                      { value: 'Idle', label: '待机（Idle）' },
                      { value: 'Tap', label: '点击（Tap）' },
                      { value: 'Tap@Body', label: '点击身体' },
                      { value: 'Flick', label: '轻扫（Flick）' },
                      { value: 'FlickDown', label: '下扫' },
                      { value: 'FlickUp', label: '上扫' },
                      { value: 'Flick@Body', label: '身体轻扫' },
                      { value: 'Bye', label: '再见挥手' }
                    ]}
                  />
                  <Button type="primary" onClick={onPlayDesktopPetMotion}>播放</Button>
                </Space>
              </div>
              <Paragraph className="setting-form-extra" style={{ marginBottom: 0 }}>
                移动端默认隐藏桌宠，避免遮挡编辑区域。
              </Paragraph>
            </div>
          )
        }]}
      />
    </div>
  )
}

export default Setting
