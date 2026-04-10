import React from 'react'
import { Spin } from 'antd'

interface LoadingProps {
  tip?: string
  size?: 'small' | 'default' | 'large'
}

const Loading: React.FC<LoadingProps> = ({ tip = '加载中...', size = 'default' }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <Spin size={size} tip={tip} />
    </div>
  )
}

export default Loading
