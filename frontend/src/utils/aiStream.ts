import type { AiStreamPhase } from '@app-types/index'

const AI_STREAM_PHASE_LABELS: Record<AiStreamPhase, string> = {
  waiting: '等待 AI 响应中...',
  thinking: '深度思考中...',
  generating: '正在生成内容...'
}

export const getAiStreamPhaseLabel = (phase: AiStreamPhase): string => AI_STREAM_PHASE_LABELS[phase]
