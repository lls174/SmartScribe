import { Alert, Progress, Steps } from 'antd'
import type { CreationStage, GuideStatus } from '@/types/collaboration'

const STAGES: Array<{ key: CreationStage; title: string }> = [
  { key: 'inspiration', title: '灵感定位' },
  { key: 'worldview', title: '世界观' },
  { key: 'characters', title: '人物体系' },
  { key: 'outline', title: '故事大纲' },
  { key: 'writing', title: '章节写作' }
]

interface GuideProgressProps {
  status: GuideStatus
  onStageChange: (stage: CreationStage) => void
}

/** 展示向导阶段、完备度和当前最重要的缺失项，所有步骤均可人工跳转。 */
export default function GuideProgress({ status, onStageChange }: GuideProgressProps) {
  const current = Math.max(0, STAGES.findIndex((item) => item.key === status.stage))
  const percent = Math.round(Math.max(0, Math.min(1, status.completeness)) * 100)
  const primaryWarning = status.missingItems.find((item) => item.severity !== 'info')

  return (
    <div className="guide-progress">
      <div className="guide-progress__score">
        <span>设定完备度</span>
        <Progress percent={percent} status={percent < 30 ? 'exception' : 'active'} />
      </div>
      <Steps
        current={current}
        responsive
        onChange={(index) => onStageChange(STAGES[index]?.key || status.stage)}
        items={STAGES.map((item) => ({ title: item.title }))}
      />
      {primaryWarning && (
        <Alert
          type={percent < 30 ? 'error' : 'warning'}
          showIcon
          message={primaryWarning.message}
          description="这是质量提示，不会阻止您继续创作。"
        />
      )}
    </div>
  )
}
