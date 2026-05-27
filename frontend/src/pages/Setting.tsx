import React, { useEffect, useState } from 'react'
import { App as AntdApp, Button, Typography, Form, Select, Input, Space, Card, Alert, Switch, Tag, Progress, Collapse } from 'antd'
import { KeyOutlined, ApiOutlined, ExperimentOutlined, InfoCircleOutlined, CheckOutlined, BgColorsOutlined } from '@ant-design/icons'
import { useAIConfig } from '@contexts/AIConfigContext'
import { useTheme } from '@contexts/ThemeContext'
import { UI_THEMES } from '@/themes/uiThemes'
import type { UIThemeKey } from '@/themes/uiThemes'
import { MODEL_CATALOG_UPDATED_AT, PLATFORM_CONFIG, PLATFORM_META, getRecommendedModel } from '@/data/aiModelCatalog'
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
  const [selectedPlatform, setSelectedPlatform] = useState(config.platform)
  const [selectedModel, setSelectedModel] = useState(config.model)
  const [apiKeyVisible, setApiKeyVisible] = useState(false)
  const [desktopPetEnabled, setDesktopPetEnabled] = useState(true)
  const [desktopPetMotion, setDesktopPetMotion] = useState<string>('Idle')

  useEffect(() => {
    const raw = localStorage.getItem('desktopPetEnabled')
    setDesktopPetEnabled(raw === null ? true : raw === 'true')
  }, [])

  const currentPlatformConfig = PLATFORM_CONFIG[selectedPlatform]
  const currentModel = currentPlatformConfig?.models.find((item) => item.value === selectedModel)

  const handlePlatformChange = (platform: string) => {
    setSelectedPlatform(platform)
    const platformConf = PLATFORM_CONFIG[platform]
    const defaultModel = getRecommendedModel(platform)?.value || ''
    setSelectedModel(defaultModel)
    form.setFieldsValue({
      platform,
      model: defaultModel,
      customBaseURL: platformConf?.defaultBaseURL || ''
    })
  }

  const onFinish = async (values: {
    platform: string
    model: string
    apiKey?: string
    customBaseURL?: string
  }) => {
    try {
      updateConfig({
        platform: values.platform,
        model: values.model,
        apiKey: values.apiKey || '',
        customBaseURL: values.customBaseURL || ''
      })
      message.success('AI 配置已更新（密钥仅存储在内存中，关闭页面后将清除）')
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

  const getApiKeyPlaceholder = () => {
    if (selectedPlatform === 'custom') {
      return '请输入 API 密钥'
    }
    return `请输入 ${currentPlatformConfig?.label || ''} API 密钥（留空则使用服务端配置）`
  }

  return (
    <div className="setting-container">
      <div className="setting-header setting-header--page">
        <Title level={2} className="setting-title">
          <ExperimentOutlined /> AI 配置
        </Title>
        <Paragraph className="setting-description">
          选择 AI 平台与模型，配置 API 密钥。密钥仅保存在浏览器内存中。
        </Paragraph>
      </div>

      <Alert
        className="setting-alert"
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        message="安全提示"
        description="API 密钥不会写入服务器或本地存储，关闭标签页后自动清除。留空时将使用服务端预配置密钥。"
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
          platform: config.platform,
          model: config.model,
          apiKey: config.apiKey,
          customBaseURL: config.customBaseURL || currentPlatformConfig?.defaultBaseURL || ''
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
              return (
                <button
                  key={key}
                  type="button"
                  className={`platform-card${selectedPlatform === key ? ' selected' : ''}`}
                  onClick={() => handlePlatformChange(key)}
                >
                  <span className="platform-check"><CheckOutlined /></span>
                  <span className="platform-icon">{meta?.icon ?? '🔌'}</span>
                  <span className="platform-name">{conf.label}</span>
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
                onChange={setSelectedModel}
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

          <Form.Item
            label={<span className="setting-form-label"><KeyOutlined /> API 密钥</span>}
            name="apiKey"
            extra={
              <span className="setting-form-extra">
                环境变量: {currentPlatformConfig?.envKeyHint}，留空使用服务端配置
              </span>
            }
          >
            <Input.Password
              className="setting-input setting-input-password"
              placeholder={getApiKeyPlaceholder()}
              visibilityToggle={{ visible: apiKeyVisible, onVisibleChange: setApiKeyVisible }}
            />
          </Form.Item>

          {selectedPlatform === 'custom' && (
            <Form.Item
              label={<span className="setting-form-label"><ApiOutlined /> API 地址</span>}
              name="customBaseURL"
              rules={[{ required: true, message: '请输入 API 地址' }]}
              extra={<span className="setting-form-extra">支持 OpenAI 兼容的 API 地址</span>}
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
        <h3 className="setting-section-heading">当前配置状态</h3>
        <div className="setting-status-grid">
          <div className="setting-status-chip">
            <span className="setting-status-label">平台</span>
            <span className="setting-status-value">{PLATFORM_CONFIG[config.platform]?.label || config.platform}</span>
          </div>
          <div className="setting-status-chip">
            <span className="setting-status-label">模型</span>
            <span className="setting-status-value">{config.model}</span>
          </div>
          <div className="setting-status-chip setting-status-chip--wide">
            <span className="setting-status-label">密钥</span>
            <span className="setting-status-value">
              {config.apiKey ? `已配置 (${config.apiKey.substring(0, 4)}****)` : '未配置（服务端）'}
            </span>
          </div>
          {config.customBaseURL && (
            <div className="setting-status-chip setting-status-chip--wide">
              <span className="setting-status-label">API 地址</span>
              <span className="setting-status-value setting-status-value--mono">{config.customBaseURL}</span>
            </div>
          )}
        </div>
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
