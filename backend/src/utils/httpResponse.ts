import type { Response } from 'express'
import type { MessageResponse } from '../../../shared/types'

export const sendError = (res: Response, statusCode: number, message: string): Response<MessageResponse> => {
  return res.status(statusCode).json({ message })
}

export const sendServerError = (res: Response, error: unknown, message: string): Response<MessageResponse> => {
  console.error(`${message}:`, error)
  return res.status(500).json({ message })
}
