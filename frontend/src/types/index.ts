export * from '../../../shared/types'
export interface User {
  id: number
  username: string
  email?: string | null
  role: 'user' | 'admin'
  status: 'active' | 'banned'
  bannedAt?: string | null
  banReason?: string | null
  createdAt: string
  updatedAt?: string
}

export interface Novel {
  id: number
  userId: number
  name: string
  description: string
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
  overallOutline?: string | null
  createdAt: string
  updatedAt: string
}

export interface Chapter {
  id: number
  novelId: number
  title: string
  content: string
  plot?: string
  outline?: string
  createdAt: string
  updatedAt: string
}

export interface DeletedNovel {
  id: number
  name: string
  description?: string
  deletedAt: string
}

export interface DeletedChapter {
  id: number
  title: string
  novelId: number
  novel: {
    name: string
  }
  deletedAt: string
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
  status: 'success' | 'failed'
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

export interface UsageSummary {
  totalRequests: number
  successRequests: number
  failedRequests: number
  totalTokens: number
  todayTokens: number
}

export interface AIConfig {
  platform: 'aliyun' | 'zhipu'
  model: string
}

export interface GenerateRequest {
  prompt: string
  chapterTitle?: string
}

export interface ContinueRequest {
  prompt?: string
  lastContent: string
}

export interface PolishRequest {
  content: string
  prompt?: string
}

export interface SettingRequest {
  type: 'character' | 'world' | 'item'
  prompt: string
}

export interface OutlineRequest {
  novelType: string
  corePlot: string
  length: string
}
