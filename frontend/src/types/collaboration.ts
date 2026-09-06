/** 人机协作向导的五个创作阶段 */
export type CreationStage = 'inspiration' | 'worldview' | 'characters' | 'outline' | 'writing'

/** 三智能体角色 */
export type AgentRole = 'inspiration' | 'writer' | 'reviewer'

export interface GuideMissingItem {
  type: string
  field?: string
  severity: 'info' | 'warning' | 'error'
  message: string
}

export interface GuideStatus {
  stage: CreationStage
  completeness: number
  missingItems: GuideMissingItem[]
  nextAction?: {
    label: string
    step: CreationStage
    agent?: AgentRole
    aiAction?: string
  }
}

export interface InspirationProposal {
  titleSuggestion: string
  genre: string
  style: string
  logline: string
  coreConflict: string
  targetAudience?: string
  reasoning?: string
}

export interface CharacterProposal {
  name: string
  role?: string
  identity?: string
  personality?: string
  appearance?: string
  relationship?: string
  secret?: string
  arc?: string
  notes?: string
  priority?: number
  reasoning?: string
}

export interface ReviewIssue {
  id: string
  severity: 'blocker' | 'major' | 'minor'
  category: 'plot' | 'character' | 'world' | 'taboo' | 'style' | 'continuity'
  location?: string
  evidence?: string
  expected?: string
  suggestion: string
  fixableByWriter?: boolean
}

export interface ChapterReview {
  verdict: 'pass' | 'revise' | 'block'
  summary: string
  issues: ReviewIssue[]
  available?: boolean
}

export interface PlotReviewIssue {
  id: string
  severity?: 'minor' | 'major'
  message: string
  suggestion?: string
}

export interface PlotReview {
  verdict: 'pass' | 'revise'
  summary: string
  issues: PlotReviewIssue[]
  available?: boolean
  message?: string
}

export interface StructuredAiResponse<T> {
  data: T
  rawContent: string
}
