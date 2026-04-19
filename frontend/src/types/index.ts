export interface User {
  id: number
  username: string
  createdAt: string
  updatedAt: string
}

export interface Novel {
  id: number
  userId: number
  name: string
  description: string
  createdAt: string
  updatedAt: string
}

export interface Chapter {
  id: number
  novelId: number
  title: string
  content: string
  plot?: string
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
