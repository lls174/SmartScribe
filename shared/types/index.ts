export type UserRole = 'user' | 'admin'
export type UserStatus = 'active' | 'banned'
export type AiPlatform = 'aliyun' | 'zhipu' | 'deepseek' | 'openai' | 'custom'
export type AiRequestStatus = 'success' | 'failed'
export type SettingType = 'character' | 'world' | 'item'
export type AiStreamPhase = 'waiting' | 'thinking' | 'generating'

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
  promptTokens: number
  completionTokens: number
  totalTokens: number
  isEstimated: boolean
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
}

export interface NovelSnapshot {
  novel?: Pick<Novel, 'id' | 'name' | 'description' | 'createdAt' | 'updatedAt'>
  chapters?: Array<Pick<Chapter, 'id' | 'order' | 'title' | 'content' | 'plot' | 'createdAt' | 'updatedAt'>>
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

export type SseEvent = SseContentChunk | SseStatusEvent | SseDoneEvent

export interface AiUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  isEstimated: boolean
}

export interface AiContentResult {
  content: string
  plot?: string
  usage?: AiUsage
}

export type CharacterCardPayload = Partial<Omit<CharacterCard, 'id' | 'novelId' | 'createdAt' | 'updatedAt'>>
export type NovelSettingPayload = Partial<Omit<NovelSetting, 'id' | 'novelId' | 'createdAt' | 'updatedAt'>>
