import React, { useEffect, useState } from 'react'
import { Button, Typography, Form, Select, Input, Row, Col, Space, message, Card, Alert, Switch } from 'antd'
import { KeyOutlined, ApiOutlined, ExperimentOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { useAIConfig } from '@contexts/AIConfigContext'
import '@styles/Setting.css'

const { Title, Paragraph } = Typography

const PLATFORM_CONFIG: Record<string, {
  label: string
  models: { value: string; label: string }[]
  defaultBaseURL: string
  envKeyHint: string
}> = {
  aliyun: {
    label: '阿里云百炼',
    models: [
      { value: 'qwen-turbo', label: '通义千问 Turbo' },
      { value: 'qwen-plus', label: '通义千问 Plus' },
      { value: 'qwen-max', label: '通义千问 Max' },
      { value: 'qwen-long', label: '通义千问 Long' }
    ],
    defaultBaseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    envKeyHint: 'DASHSCOPE_API_KEY'
  },
  zhipu: {
    label: '智谱 AI',
    models: [
      { value: 'glm-4-flash', label: 'GLM-4 Flash' },
      { value: 'glm-4', label: 'GLM-4' },
      { value: 'glm-4-plus', label: 'GLM-4 Plus' },
      { value: 'glm-4-long', label: 'GLM-4 Long' }
    ],
    defaultBaseURL: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    envKeyHint: 'GLM_AI_KEY'
  },
  deepseek: {
    label: 'DeepSeek',
    models: [
      { value: 'deepseek-chat', label: 'DeepSeek Chat' },
      { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner' }
    ],
    defaultBaseURL: 'https://api.deepseek.com/v1/chat/completions',
    envKeyHint: 'DEEPSEEK_API_KEY'
  },
  openai: {
    label: 'OpenAI',
    models: [
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' }
    ],
    defaultBaseURL: 'https://api.openai.com/v1/chat/completions',
    envKeyHint: 'OPENAI_API_KEY'
  },
  custom: {
    label: '自定义（OpenAI 兼容）',
    models: [],
    defaultBaseURL: '',
    envKeyHint: '自定义密钥'
  }
}

const Setting: React.FC = () => {
  const { config, updateConfig } = useAIConfig()
  const [form] = Form.useForm()
  const [selectedPlatform, setSelectedPlatform] = useState(config.platform)
  const [apiKeyVisible, setApiKeyVisible] = useState(false)
  const [desktopPetEnabled, setDesktopPetEnabled] = useState(true)

  useEffect(() => {
    const raw = localStorage.getItem('desktopPetEnabled')
    setDesktopPetEnabled(raw === null ? true : raw === 'true')
  }, [])

  const currentPlatformConfig = PLATFORM_CONFIG[selectedPlatform]

  const handlePlatformChange = (platform: string) => {
    setSelectedPlatform(platform)
    const platformConf = PLATFORM_CONFIG[platform]
    const defaultModel = platformConf.models.length > 0 ? platformConf.models[0].value : ''
    form.setFieldsValue({
      model: defaultModel,
      customBaseURL: platformConf.defaultBaseURL
    })
  }

  const onFinish = async (values: any) => {
    try {
      updateConfig({
        platform: values.platform,
        model: values.model,
        apiKey: values.apiKey || '',
        customBaseURL: values.customBaseURL || ''
      })
      message.success('AI 配置已更新（密钥仅存储在内存中，关闭页面后将清除）')
    } catch (error) {
      message.error('配置保存失败')
    }
  }

  const onToggleDesktopPet = (checked: boolean) => {
    setDesktopPetEnabled(checked)
    localStorage.setItem('desktopPetEnabled', String(checked))
    window.dispatchEvent(new CustomEvent('desktopPetConfigChanged', { detail: { enabled: checked } }))
    message.success(checked ? '桌宠已开启' : '桌宠已关闭')
  }

  // 桌宠模型已固定为组合模型，不再支持在设置页切换

  const getApiKeyPlaceholder = () => {
    if (selectedPlatform === 'custom') {
      return '请输入 API 密钥'
    }
    return `请输入 ${currentPlatformConfig?.label || ''} API 密钥（留空则使用服务端配置）`
  }

  return (
    <div className="setting-container">
      <div className="setting-header">
        <Title level={2} className="setting-title">
          <ExperimentOutlined /> AI 设置
        </Title>
        <Paragraph className="setting-description">
          选择 AI 平台和模型，配置 API 密钥。密钥仅存储在浏览器内存中，关闭页面后将自动清除。
        </Paragraph>
      </div>

      <Alert
        className="setting-alert"
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        message="安全提示"
        description="您的 API 密钥仅存储在浏览器内存中，不会保存到服务器或本地存储。关闭浏览器标签页后密钥将自动清除。如果密钥留空，系统将使用服务端预配置的密钥。"
      />

      <Card className="setting-card" style={{ marginTop: '1.5rem' }}>
        <Form
          form={form}
          onFinish={onFinish}
          layout="vertical"
          initialValues={{
            platform: config.platform,
            model: config.model,
            apiKey: config.apiKey,
            customBaseURL: config.customBaseURL || currentPlatformConfig?.defaultBaseURL || ''
          }}
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Form.Item
                label={<span className="setting-form-label"><ApiOutlined /> AI 平台</span>}
                name="platform"
                rules={[{ required: true, message: '请选择AI平台' }]}
              >
                <Select
                  options={Object.entries(PLATFORM_CONFIG).map(([key, conf]) => ({
                    value: key,
                    label: conf.label
                  }))}
                  onChange={handlePlatformChange}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label={<span className="setting-form-label"><ExperimentOutlined /> 模型选择</span>}
                name="model"
                rules={[{ required: true, message: '请选择或输入模型名称' }]}
              >
                {currentPlatformConfig && currentPlatformConfig.models.length > 0 ? (
                  <Select options={currentPlatformConfig.models} />
                ) : (
                  <Input placeholder="请输入模型名称，如 gpt-3.5-turbo" />
                )}
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label={<span className="setting-form-label"><KeyOutlined /> API 密钥</span>}
            name="apiKey"
            extra={<span className="setting-form-extra">环境变量名: {currentPlatformConfig?.envKeyHint}，留空使用服务端配置</span>}
          >
            <Input.Password
              placeholder={getApiKeyPlaceholder()}
              visibilityToggle={{ visible: apiKeyVisible, onVisibleChange: setApiKeyVisible }}
            />
          </Form.Item>

          {selectedPlatform === 'custom' && (
            <Form.Item
              label={<span className="setting-form-label"><ApiOutlined /> API 地址</span>}
              name="customBaseURL"
              rules={[{ required: true, message: '请输入API地址' }]}
              extra={<span className="setting-form-extra">支持 OpenAI 兼容的 API 地址</span>}
            >
              <Input placeholder="https://api.example.com/v1/chat/completions" />
            </Form.Item>
          )}

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button type="primary" htmlType="submit">
                应用配置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card className="setting-card" style={{ marginTop: '1.5rem' }}>
        <Title level={5} className="setting-section-title">当前配置状态</Title>
        <div className="setting-status">
          <div className="setting-status-item">
            <span className="setting-status-label">平台:</span>
            <span className="setting-status-value">{PLATFORM_CONFIG[config.platform]?.label || config.platform}</span>
          </div>
          <div className="setting-status-item">
            <span className="setting-status-label">模型:</span>
            <span className="setting-status-value">{config.model}</span>
          </div>
          <div className="setting-status-item">
            <span className="setting-status-label">密钥:</span>
            <span className="setting-status-value">
              {config.apiKey ? `已配置 (${config.apiKey.substring(0, 4)}****)` : '未配置（使用服务端密钥）'}
            </span>
          </div>
          {config.customBaseURL && (
            <div className="setting-status-item">
              <span className="setting-status-label">API 地址:</span>
              <span className="setting-status-value">{config.customBaseURL}</span>
            </div>
          )}
        </div>
      </Card>

      <Card className="setting-card" style={{ marginTop: '1.5rem' }}>
        <Title level={5} className="setting-section-title">体验功能</Title>
        <div className="setting-status">
          <div className="setting-status-item" style={{ alignItems: 'center' }}>
            <span className="setting-status-label">桌宠（悬浮助手）:</span>
            <span className="setting-status-value">
              <Switch checked={desktopPetEnabled} onChange={onToggleDesktopPet} />
            </span>
          </div>
          <Paragraph style={{ marginTop: 12, marginBottom: 0, color: '#a5b4fc' }}>
            桌宠会常驻在页面右下角，可拖拽移动。当前使用 Live2D 模型：`public/hiyori_pro_zh/runtime/hiyori_pro_t11.model3.json`
          </Paragraph>
        </div>
      </Card>
    </div>
  )
}

export default Setting
