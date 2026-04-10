import api from './api'
import type { Feedback } from '@types/index'

export const feedbackService = {
  // 提交反馈
  submitFeedback: async (type: string, content: string): Promise<void> => {
    await api.post('/feedback', { type, content })
  },

  // 获取反馈列表
  getFeedbacks: async (): Promise<Feedback[]> => {
    const response = await api.get('/feedback')
    return response.data
  }
}
