export type UserRole = 'user' | 'admin'
export type UserStatus = 'active' | 'banned'
export type AiPlatform = 'aliyun' | 'zhipu' | 'deepseek' | 'openai' | 'custom'
export type AiRequestStatus = 'success' | 'failed'
export type AiKeySource = 'user' | 'env'
export type AiTokenSource = 'api' | 'tokenizer' | 'heuristic'
export type AiModelCapability = 'chat' | 'other' | 'unknown'
export type AiCapabilitySource = 'seed' | 'adapter' | 'admin'
export type AiCatalogSource = 'api' | 'manual' | 'seed'
export type AiPriceSource = 'official' | 'community' | 'manual'
export type SettingType = 'character' | 'world' | 'item'
export type AiStreamPhase = 'waiting' | 'thinking' | 'generating'
export type CreationStage = 'inspiration' | 'worldview' | 'characters' | 'outline' | 'writing'
export type ReviewStatus = 'empty' | 'ai_proposed' | 'confirmed'
export type AgentRole = 'inspiration' | 'writer' | 'reviewer'
export type ProposalUserAction = 'pending' | 'adopted' | 'rejected' | 'edited'

export interface MessageResponse {
  message: string
}

export interface User {
  id: number
  username: string
  email?: string | null
  role: UserRole
  status: UserStatus
  bannedAt?: string | null
  banReason?: string | null
  createdAt: string
  updatedAt?: string
}

export interface LoginResponse {
  token: string
  userId: number
  user: User
}

export interface Novel {
  id: number
  userId: number
  name: string
  description?: string | null
  creationStage: CreationStage
  stageProgress?: Record<string, unknown> | null
  completeness: number
  isDeleted?: boolean
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface Chapter {
  id: number
  novelId: number
  title?: string | null
  content: string
  plot?: string | null
  outline?: string | null
  stale: boolean
  stalePlot: boolean
  order: number
  isDeleted?: boolean
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface CharacterCard {
  id: number
  novelId: number
  name: string
  role?: string | null
  identity?: string | null
  personality?: string | null
  appearance?: string | null
  relationship?: string | null
  secret?: string | null
  arc?: string | null
  notes?: string | null
  priority: number
  isActive: boolean
  reviewStatus: ReviewStatus
  confirmedAt?: string | null
  aiProposalHistory?: AiProposalHistoryItem[] | null
  stale: boolean
  createdAt: string
  updatedAt: string
}

export interface NovelSetting {
  id: number
  novelId: number
  worldview?: string | null
  genreStyle?: string | null
  powerSystem?: string | null
  timeline?: string | null
  plotRules?: string | null
  taboos?: string | null
  styleGuide?: string | null
  notes?: string | null
  overallOutline?: string | null
  reviewStatus: ReviewStatus
  confirmedAt?: string | null
  stale: boolean
  createdAt: string
  updatedAt: string
}

export interface Creative {
  id: number
  userId: number
  title: string
  type: string
  genre?: string | null
  content: string
  isDeleted?: boolean
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface DeletedNovel extends Novel {
  deletedAt: string
}

export interface DeletedChapter extends Chapter {
  deletedAt: string
  novel?: Pick<Novel, 'id' | 'name'>
  Novel?: Pick<Novel, 'id' | 'name'>
}

export interface Feedback {
  id: number
  userId: number
  type: string
  content: string
  createdAt: string
  User?: Pick<User, 'id' | 'username'>
}

export interface AiRequestLog {
  id: number
  userId: number
  novelId?: number | null
  chapterId?: number | null
  action: string
  platform: string
  model: string
  status: AiRequestStatus
  keySource?: AiKeySource | null
  tokenSource?: AiTokenSource | null
  promptTokens: number
  cachedPromptTokens?: number
  uncachedPromptTokens?: number
  completionTokens: number
  totalTokens: number
  isEstimated: boolean
  costAmount?: string | null
  costCurrency?: string | null
  costAmountCny?: string | null
  fxRateUsed?: string | null
  fxRateSource?: string | null
  inputPrice?: string | null
  cachedInputPrice?: string | null
  outputPrice?: string | null
  costFlag?: string | null
  durationMs?: number | null
  promptLength: number
  resultLength: number
  errorMessage?: string | null
  createdAt: string
  User?: Pick<User, 'id' | 'username'>
}

export interface AdminUser extends User {
  requestCount: number
  totalTokens: number
  paidCostCnyMonth?: string
  paidCostCnyTotal?: string
  userKeyTokens?: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export interface CreativeListResponse {
  creatives: Creative[]
  total: number
  page: number
  limit: number
}

export interface UsageSummary {
  totalRequests: number
  successRequests: number
  failedRequests: number
  totalTokens: number
  todayTokens: number
  todayPaidCostCny?: string
  monthPaidCostCny?: string
  userKeyRequestRatio?: number
}

export interface UsageBreakdownItem {
  platform: string
  model: string
  promptTokens: number
  cachedPromptTokens: number
  completionTokens: number
  totalTokens: number
  requestCount: number
}

export interface UserUsageSummary {
  today: { promptTokens: number; cachedPromptTokens: number; completionTokens: number; totalTokens: number }
  month: { promptTokens: number; cachedPromptTokens: number; completionTokens: number; totalTokens: number }
  total: { promptTokens: number; cachedPromptTokens: number; completionTokens: number; totalTokens: number }
  officialCount: number
  estimatedCount: number
  breakdown: UsageBreakdownItem[]
}

export interface UserUsageLog {
  id: number
  action: string
  platform: string
  model: string
  promptTokens: number
  cachedPromptTokens: number
  uncachedPromptTokens: number
  completionTokens: number
  totalTokens: number
  isEstimated: boolean
  tokenSource?: AiTokenSource | null
  keySource?: AiKeySource | null
  createdAt: string
}

export interface AiCatalogModel {
  id?: number
  platform: Exclude<AiPlatform, 'custom'>
  modelId: string
  label: string
  ownedBy?: string | null
  capability: AiModelCapability
  capabilitySource: AiCapabilitySource
  enabled: boolean
  recommended: boolean
  sortOrder: number
  description?: string | null
  badge?: string | null
  source: AiCatalogSource
  syncedAt?: string | null
}

export interface AiCatalogResponse {
  platforms: Record<string, AiCatalogModel[]>
  syncedAt: string | null
  fallback: boolean
}

export interface AiModelPrice {
  id?: number
  platform: string
  modelId: string
  inputPerMillion: string
  outputPerMillion: string
  cachedInputPerMillion?: string | null
  currency: 'CNY' | 'USD'
  source: AiPriceSource
  syncedAt?: string | null
  notes?: string | null
}

export interface NovelSnapshot {
  novel?: Pick<Novel, 'id' | 'name' | 'description' | 'createdAt' | 'updatedAt'>
  chapters?: Array<Pick<Chapter, 'id' | 'order' | 'title' | 'content' | 'plot' | 'outline' | 'createdAt' | 'updatedAt'>>
}

export interface NovelVersion {
  id: number
  userId: number
  novelId: number
  label?: string | null
  snapshot: NovelSnapshot
  createdAt: string
  updatedAt: string
}

export interface GenerationHistory {
  id: number
  userId: number
  novelId?: number | null
  chapterId?: number | null
  action: string
  prompt?: string | null
  params?: Record<string, unknown> | null
  result?: string | null
  createdAt: string
  updatedAt: string
}

export interface GenerationHistoryResponse {
  page: number
  limit: number
  total: number
  histories: GenerationHistory[]
}

export interface ChapterUpdateResponse extends MessageResponse {
  chapter: Chapter
}

export interface AIConfig {
  platform: AiPlatform
  model: string
  apiKey?: string
  customBaseURL?: string
  enableDeepThinking?: boolean
}

export interface NovelContext {
  novelId?: number
  novelMeta?: {
    name?: string
    description?: string
    genre?: string
    style?: string
    totalChapters?: number
  }
  chapters?: Array<{
    id: number
    title?: string
    content?: string
    plot?: string
  }>
  currentChapterId?: number
}

export interface GenerateRequest extends NovelContext {
  prompt: string
  chapterTitle?: string
  platform?: AiPlatform
  model?: string
  apiKey?: string
  customBaseURL?: string
  enableDeepThinking?: boolean
  genre?: string
  style?: string
  corePlot?: string
  characters?: string
  wordCount?: string
  other?: string
}

export interface ContinueRequest extends NovelContext {
  prompt?: string
  lastContent?: string
  lastPlot?: string
  platform?: AiPlatform
  model?: string
  apiKey?: string
  customBaseURL?: string
  enableDeepThinking?: boolean
  wordCount?: string
}

export interface PolishRequest extends NovelContext {
  content: string
  prompt?: string
  platform?: AiPlatform
  model?: string
  apiKey?: string
  customBaseURL?: string
  enableDeepThinking?: boolean
  beforeContent?: string
  beforePlot?: string
  chapterTitle?: string
}

export interface SettingRequest {
  type: SettingType
  prompt: string
  platform?: AiPlatform
  model?: string
  apiKey?: string
  customBaseURL?: string
  enableDeepThinking?: boolean
  novelId?: number
}

export interface OutlineRequest extends NovelContext {
  novelType: string
  corePlot: string
  length?: string
  platform?: AiPlatform
  model?: string
  apiKey?: string
  customBaseURL?: string
  enableDeepThinking?: boolean
}

export interface CreativeRequest {
  prompt: string
  type: string
  platform?: AiPlatform
  model?: string
  apiKey?: string
  customBaseURL?: string
  enableDeepThinking?: boolean
}

export interface SseContentChunk {
  content: string
}

export interface SseStatusEvent {
  status: AiStreamPhase
}

export interface SseDoneEvent {
  done: true
  plot?: string
}

export interface SseStructuredResultEvent<T = unknown> {
  type: 'result'
  data: T
  done?: true
}

export type SseEvent = SseContentChunk | SseStatusEvent | SseDoneEvent | SseStructuredResultEvent

export interface AiUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  isEstimated: boolean
  tokenSource?: AiTokenSource
  cachedPromptTokens?: number
  uncachedPromptTokens?: number
}

export interface AiContentResult {
  content: string
  plot?: string
  usage?: AiUsage
  prompt?: string
}

export type CharacterCardPayload = Partial<Omit<CharacterCard, 'id' | 'novelId' | 'createdAt' | 'updatedAt'>>
export type NovelSettingPayload = Partial<Omit<NovelSetting, 'id' | 'novelId' | 'createdAt' | 'updatedAt'>>

export interface AiProposalHistoryItem {
  version: number
  content: unknown
  createdAt: string
  prompt?: string
}

export interface ConfirmedContext {
  novel: Pick<Novel, 'id' | 'name' | 'description' | 'creationStage'>
  settings: Partial<Pick<NovelSetting, 'worldview' | 'genreStyle' | 'powerSystem' | 'timeline' | 'plotRules' | 'taboos' | 'styleGuide' | 'notes'>>
  characters: Array<Pick<CharacterCard, 'id' | 'name' | 'role' | 'identity' | 'personality' | 'appearance' | 'relationship' | 'secret' | 'arc' | 'priority' | 'isActive'>>
  outline?: string
  chapterOutlines: Array<Pick<Chapter, 'id' | 'title' | 'order' | 'outline'>>
  chapterSummaries: Array<Pick<Chapter, 'id' | 'title' | 'order' | 'plot'> & { stalePlot: boolean }>
}

export interface GuideMissingItem {
  type: 'inspiration' | 'setting' | 'character' | 'outline'
  field?: string
  severity: 'info' | 'warning'
  message: string
}

export interface GuideStatus {
  stage: CreationStage
  completeness: number
  missingItems: GuideMissingItem[]
  nextAction: {
    label: string
    step: CreationStage
    agent: AgentRole
    aiAction: string
  }
  warnings: string[]
}

export interface ReviewIssue {
  id: string
  severity: 'minor' | 'major' | 'blocker'
  category: 'plot' | 'character' | 'world' | 'taboo' | 'style' | 'continuity'
  location: string
  evidence: string
  expected: string
  suggestion: string
}

export interface ChapterReviewResult {
  verdict: 'pass' | 'revise' | 'block'
  summary: string
  issues: ReviewIssue[]
}

export interface InspirationProposal {
  options: Array<{
    title: string
    genre: string
    premise: string
    coreConflict: string
    sellingPoints: string[]
    reasoning?: string
  }>
}

export interface SettingProposal {
  field: string
  content: string
  alternatives?: string[]
  reasoning?: string
}

export interface CharactersProposal {
  characters: Array<Omit<CharacterCardPayload, 'reviewStatus' | 'confirmedAt' | 'aiProposalHistory' | 'stale'> & {
    name: string
    reasoning?: string
  }>
}

export interface OutlineProposal {
  overallOutline: string
  chapters?: Array<{ title: string; outline: string; order: number }>
}

export interface AiProposalLog {
  id: number
  novelId: number
  userId: number
  agent: AgentRole
  proposalType: string
  inputContext: ConfirmedContext | Record<string, unknown>
  output: unknown
  userAction: ProposalUserAction
  createdAt: string
  updatedAt: string
}
