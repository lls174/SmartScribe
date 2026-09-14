import React from 'react'
import { Spin } from 'antd'

interface LoadingProps {
  tip?: string
  size?: 'small' | 'default' | 'large'
}

/** 路由/页面占位加载；文案放在转圈下方横排，避免 tip 被窄容器挤成竖排。 */
const Loading: React.FC<LoadingProps> = ({ tip = '加载中...', size = 'default' }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      gap: 12
    }}>
      <Spin size={size} />
      {tip ? <div style={{ whiteSpace: 'nowrap' }}>{tip}</div> : null}
    </div>
  )
}

export default Loading
